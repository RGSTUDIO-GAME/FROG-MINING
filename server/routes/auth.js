import { v4 as uuidv4 } from 'uuid';
import db, { hashPassword } from '../db/database.js';
import { markDataChanged } from '../services/backup.js';

export default async function authRoutes(fastify) {
  // Register
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, email, password, deviceId } = request.body || {};

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

    markDataChanged();

    const player = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status FROM players WHERE id = ?').get(id);

    return reply.send({ status: 'success', message: 'Akun berhasil dibuat', data: { player } });
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

    const safePlayer = {
      id: player.id, username: player.username, avatar: player.avatar,
      total_score: player.total_score, total_diamonds: player.total_diamonds,
      created_at: player.created_at, last_login: player.last_login, status: player.status,
    };

    return reply.send({ status: 'success', message: 'Login berhasil', data: { player: safePlayer } });
  });

  // Session check
  fastify.get('/api/auth/session/:playerId', async (request, reply) => {
    const { playerId } = request.params;
    const player = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status FROM players WHERE id = ?').get(playerId);

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
    const player = db.prepare('SELECT id, username, avatar, total_score, total_diamonds, created_at, last_login, status FROM players WHERE id = ?').get(playerId);

    if (!player) {
      return reply.code(404).send({ status: 'error', message: 'Player not found' });
    }

    return reply.send({ status: 'success', data: { player } });
  });
}
