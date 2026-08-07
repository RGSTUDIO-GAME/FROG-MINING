import { v4 as uuidv4 } from 'uuid';
import db, { hashPassword } from '../db/database.js';
import { markDataChanged } from '../services/backup.js';
import { ensureWelcomeGift } from '../services/gifts.js';
import { bindReferral, ensureRefCode } from '../services/referral.js';

function makeUniqueUsername(base, maxLen = 32) {
  const clean = String(base || 'Pemain').trim().replace(/\s+/g, '_').slice(0, maxLen) || 'Pemain';
  let candidate = clean;
  let n = 0;
  while (db.prepare('SELECT id FROM players WHERE username = ?').get(candidate)) {
    n++;
    candidate = clean.slice(0, maxLen - String(n).length) + n;
  }
  return candidate;
}

function cleanName(name, tgId) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  if (clean && !/^\d+$/.test(clean)) return clean;
  const id = String(tgId || '');
  return id ? 'Frog#' + id.slice(-4) : 'Pemain';
}

function safePlayer(player, now) {
  return {
    id: player.id,
    username: player.username,
    avatar: player.avatar,
    total_score: player.total_score,
    total_diamonds: player.total_diamonds,
    created_at: player.created_at,
    last_login: now || player.last_login,
    status: player.status,
    telegram_id: player.telegram_id || null,
    ref_code: player.ref_code || null,
    referrer_id: player.referrer_id || null,
  };
}

export default async function authRoutes(fastify) {
  // Telegram Mini App auto-login (create account if missing)
  fastify.post('/api/auth/telegram', async (request, reply) => {
    const { telegramId, username, firstName, avatar, deviceId, ref } = request.body || {};
    if (!telegramId) {
      return reply.code(400).send({ status: 'error', message: 'Telegram ID diperlukan' });
    }

    const tgId = String(telegramId);
    const now = new Date().toISOString();
    let player = db.prepare('SELECT * FROM players WHERE telegram_id = ?').get(tgId);

    if (!player) {
      const id = uuidv4();
      const finalName = makeUniqueUsername(cleanName(username || firstName, tgId));
      db.prepare(
        'INSERT INTO players (id, username, telegram_id, avatar, device_id, created_at, updated_at, last_login, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, finalName, tgId, avatar || '🐸', deviceId || null, now, now, now, 'active');
      db.prepare('INSERT INTO auto_mining (id, player_id, status) VALUES (?, ?, ?)').run(uuidv4(), id, 'inactive');
      player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      bindReferral(id, ref);
      ensureRefCode(id);
      player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      markDataChanged();
    } else {
      const updatedName = cleanName(username || firstName, tgId);
      db.prepare(
        'UPDATE players SET username = ?, avatar = ?, device_id = COALESCE(?, device_id), last_login = ?, updated_at = ? WHERE id = ?'
      ).run(updatedName, avatar || player.avatar, deviceId || null, now, now, player.id);
      player = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
      // Pemain lama yang belum punya pengundang tetap bisa terhubung (sekali saja)
      bindReferral(player.id, ref);
    }

    ensureWelcomeGift(player.id);

    return reply.send({ status: 'success', message: 'Selamat datang', data: { player: safePlayer(player, now) } });
  });

  // Device auto-login for web fallback (anonymous, one account per device)
  fastify.post('/api/auth/device', async (request, reply) => {
    const { deviceId, username, ref } = request.body || {};
    if (!deviceId) {
      return reply.code(400).send({ status: 'error', message: 'Device ID diperlukan' });
    }

    const now = new Date().toISOString();
    let player = db.prepare('SELECT * FROM players WHERE device_id = ?').get(deviceId);

    if (!player) {
      const id = uuidv4();
      const finalName = makeUniqueUsername(username || 'Pemain' + Math.floor(1000 + Math.random() * 9000));
      db.prepare(
        'INSERT INTO players (id, username, device_id, created_at, updated_at, last_login, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, finalName, deviceId, now, now, now, 'active');
      db.prepare('INSERT INTO auto_mining (id, player_id, status) VALUES (?, ?, ?)').run(uuidv4(), id, 'inactive');
      player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      bindReferral(id, ref);
      ensureRefCode(id);
      player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
      markDataChanged();
    } else {
      db.prepare('UPDATE players SET last_login = ?, updated_at = ? WHERE id = ?').run(now, now, player.id);
      // Pemain lama yang belum punya pengundang tetap bisa terhubung (sekali saja)
      bindReferral(player.id, ref);
    }

    ensureWelcomeGift(player.id);

    return reply.send({ status: 'success', message: 'Selamat datang', data: { player: safePlayer(player, now) } });
  });

  // Register
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, email, password, deviceId, ref } = request.body || {};

    if (!username || !email || !password) {
      return reply.code(400).send({ status: 'error', message: 'Username, email, dan password wajib diisi' });
    }

    const trimmedUser = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUser.length < 3 || trimmedUser.length > 20) {
      return reply.code(400).send({ status: 'error', message: 'Username harus 3-20 karakter' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
      return reply.code(400).send({ status: 'error', message: 'Username hanya boleh huruf, angka, dan underscore' });
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return reply.code(400).send({ status: 'error', message: 'Email tidak valid' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ status: 'error', message: 'Password minimal 6 karakter' });
    }

    // Check username
    const existUser = db.prepare('SELECT id FROM players WHERE username = ?').get(trimmedUser);
    if (existUser) {
      return reply.code(409).send({ status: 'error', message: 'Username sudah digunakan' });
    }

    // Check email
    const existEmail = db.prepare('SELECT id FROM players WHERE email = ?').get(trimmedEmail);
    if (existEmail) {
      return reply.code(409).send({ status: 'error', message: 'Email sudah terdaftar' });
    }

    // Policy B: one device can only register ONE account
    if (deviceId) {
      const boundDevice = db.prepare('SELECT id FROM players WHERE device_id = ?').get(deviceId);
      if (boundDevice) {
        return reply.code(403).send({ status: 'error', message: 'Perangkat ini sudah terdaftar dengan akun lain' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO players (id, username, email, password_hash, device_id, created_at, updated_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, trimmedUser, trimmedEmail, hashPassword(password), deviceId || null, now, now, now);

    db.prepare('INSERT INTO auto_mining (id, player_id, status) VALUES (?, ?, ?)').run(uuidv4(), id, 'inactive');

    bindReferral(id, ref);
    markDataChanged();

    ensureRefCode(id);
    const playerWithRef = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status, ref_code, referrer_id FROM players WHERE id = ?').get(id);

    return reply.send({ status: 'success', message: 'Akun berhasil dibuat', data: { player: playerWithRef } });
  });

  // Login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password, deviceId } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ status: 'error', message: 'Email dan password wajib diisi' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const player = db.prepare('SELECT * FROM players WHERE email = ?').get(trimmedEmail);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Email tidak ditemukan' });
    }

    if (player.password_hash !== hashPassword(password)) {
      return reply.code(401).send({ status: 'error', message: 'Password salah' });
    }

    if (player.status !== 'active') {
      return reply.code(403).send({ status: 'error', message: 'Akun tidak aktif' });
    }

    db.prepare('UPDATE players SET last_login = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), player.id);

    // Bind device on first login from this device (migrates old accounts)
    if (deviceId && !player.device_id) {
      db.prepare('UPDATE players SET device_id = ? WHERE id = ?').run(deviceId, player.id);
    }

    const safe = {
      id: player.id, username: player.username, avatar: player.avatar,
      total_score: player.total_score, total_diamonds: player.total_diamonds,
      created_at: player.created_at, last_login: player.last_login, status: player.status,
      ref_code: player.ref_code || null, referrer_id: player.referrer_id || null,
    };

    ensureWelcomeGift(player.id);

    return reply.send({ status: 'success', message: 'Login berhasil', data: { player: safe } });
  });

  // Session check
  fastify.get('/api/auth/session/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status, ref_code, referrer_id FROM players WHERE id = ?').get(playerId);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    db.prepare('UPDATE players SET last_login = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), playerId);

    return reply.send({ status: 'success', data: { player } });
  });

  // Get player
  fastify.get('/api/players/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status, ref_code, referrer_id FROM players WHERE id = ?').get(playerId);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    return reply.send({ status: 'success', data: { player } });
  });

  // Referral info (invite link)
  fastify.get('/api/referral/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT id, ref_code, referrer_id FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }
    const refCode = ensureRefCode(playerId);
    const invitedCount = db.prepare('SELECT COUNT(*) AS c FROM players WHERE referrer_id = ?').get(playerId).c;
    const proto = request.headers['x-forwarded-proto'] || request.protocol || 'https';
    const host = request.headers['x-forwarded-host'] || request.hostname || request.host;
    return reply.send({
      status: 'success',
      data: {
        refCode,
        inviteUrl: (proto + '://' + host) + '/?ref=' + refCode,
        invitedCount,
        inviterBonus: 500,
        friendBonus: 200,
        commissionPercent: 5,
      },
    });
  });
}
