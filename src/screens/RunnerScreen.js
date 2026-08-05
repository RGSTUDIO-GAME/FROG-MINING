import { Logger } from '@utils/logger.js';

// ══════════════════════════════════════════════════════════════
// FROG RUNNER — mini-game (Chrome-Dino style)
// Karakter, sky, cloud, hill, dan ground sekarang memakai aset PNG yang
// sudah kamu kirim. Rintangan dan efek ringan masih dibuat dengan kode.
//
// Jika nanti ada aset tambahan, tinggal lanjutkan daftar file di bawah dan
// sesuaikan loader. Logika gameplay tidak perlu dirombak.
// ══════════════════════════════════════════════════════════════

const FROG_ART = 'frames'; // 'builtin' (kode) | 'frames' (PNG sendiri)
const FRAME_DIR = `${import.meta.env.BASE_URL}assets/frog-runner/character/`;
const BG_DIR = `${import.meta.env.BASE_URL}assets/frog-runner/background/`;
const ASSETS = {
  IDLE: 'idle.png',
  BLINK: 'blink.png',
  RUN: ['run-1.png', 'run-2.png', 'run-3.png', 'run-4.png'],
  DUCK: ['duck-1.png', 'duck-2.png'],
  JUMP: ['jump-start.png', 'jump.png', 'fall.png', 'landing.png'],
};
const BG_ASSETS = {
  SKY: 'sky.png',
  CLOUDS: 'clouds.png',
  HILL_FAR: 'hill-far.png',
  HILL_NEAR: 'hill-near.png',
  GROUND: 'ground.png',
};

const RUNNER_BEST_KEY = 'frog-runner-best';

// Ukuran kanvas frame karakter (builtin)
const FRAME = { W: 240, H: 240 };

// Area tubuh katak di dalam frame — dipakai untuk hitbox
const FROG_BOUNDS = {
  idle: { x: 80, y: 174, w: 80, h: 58 },
  run: { x: 80, y: 174, w: 80, h: 58 },
  duck: { x: 84, y: 198, w: 70, h: 34 },
  jump: { x: 76, y: 170, w: 86, h: 60 },
  fall: { x: 76, y: 176, w: 86, h: 56 },
  landing: { x: 80, y: 182, w: 78, h: 50 },
};

// Anchor katak: titik acuan selalu di kaki (bawah), bukan tengah frame.
// FROG_FEET_Y = frame-y terendah kaki yang terlihat (di dalam 240×240).
// PNG frame katak punya padding bawah sekitar 4px, jadi anchor harus mengikuti itu
// supaya kaki benar-benar menapak dan tidak tampak melayang.
const FROG_FEET_Y = 236;
const FROG_FEET_GAP = 12;

// Jalur rintangan udara: pusat objek terbang 130–190px di atas permukaan tanah,
// sehingga seluruh objek selalu berada di band 90–220px dan tidak pernah menyentuh tanah.
const AIR_ALT_MIN = 130;
const AIR_ALT_MAX = 190;

// Fisika & kesulitan
const GRAVITY = 2300;
const JUMP_VELOCITY = -830;
const BASE_SPEED = 280;
const MAX_SPEED = 560;
const SURFACE_RAISE = 58;
const BG_CROP = {
  CLOUDS: { y: 0, h: 1024 },
  HILL_FAR: { y: 393, h: 320 },
  HILL_NEAR: { y: 484, h: 260 },
  GROUND: { x: 37, y: 422, w: 1472, h: 191 },
};

// Rintangan: tex = texture (atau frame pertama animasi), anim = animasi opsional.
// foot = frame-y dasar objek yang terlihat di dalam texture (dipakai agar menempel ke tanah).
// ground = true untuk rintangan darat (batu, kayu, jamur, kaktus) yang berdiri di atas tanah.
const OBSTACLES = {
  cactus: { tex: 'obs-cactus', w: 72, h: 140, foot: 132, ground: true, body: { x: 14, y: 8, w: 44, h: 124 } },
  rock: { tex: 'obs-rock', w: 84, h: 64, foot: 60, ground: true, body: { x: 6, y: 4, w: 72, h: 56 } },
  mushroom: { tex: 'obs-mushroom', w: 84, h: 80, foot: 80, ground: true, body: { x: 12, y: 6, w: 60, h: 72 } },
  log: { tex: 'obs-log', w: 104, h: 44, foot: 40, ground: true, body: { x: 4, y: 4, w: 96, h: 36 } },
  bird: { tex: 'obs-bird-0', anim: 'bird', w: 104, h: 60, foot: 55, body: { x: 8, y: 8, w: 88, h: 44 } },
};

// Pola rintangan — hanya darat (lompat) atau hanya udara (jongkok), tidak pernah dicampur
// agar pemain selalu punya waktu bereaksi. Sekitar 60% darat, 40% udara.
const PATTERNS = [
  ['cactus'], ['cactus'], ['rock'], ['mushroom'], ['log'],
  ['cactus', 'cactus'], ['rock', 'rock'], ['cactus', 'log'], ['mushroom', 'rock'],
  ['bird'], ['bird', 'bird'],
];

const frameKey = (file) => file.replace('.png', '');
const loadKey = (name) => `src-${name}`;
const frogKey = (name) => `frog-${name}`;

// ══════════════════════════════════════════════════════════════
// Scene Phaser (factory — Phaser di-load dynamic import)
// ══════════════════════════════════════════════════════════════
const createRunnerScene = (Phaser) => class RunnerScene extends Phaser.Scene {
  constructor() {
    super({ key: 'runner' });
    this.state = 'ready'; // ready | running | paused | over
    this.ducking = false;
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this._lastScore = -1;
    this._jumpQueued = false;
    this._best = 0;
    this._lastGroundCount = 0;
    this._wasAirborne = false;
    this._lastSquashAt = 0;
    this._dustTimer = 0;
    this._streakTimer = 0;
    this._landingUntil = 0;
  }

  preload() {
    this.load.image('bg-sky', BG_DIR + BG_ASSETS.SKY);
    this.load.image('bg-clouds', BG_DIR + BG_ASSETS.CLOUDS);
    this.load.image('bg-hill-far', BG_DIR + BG_ASSETS.HILL_FAR);
    this.load.image('bg-hill-near', BG_DIR + BG_ASSETS.HILL_NEAR);
    this.load.image('bg-ground', BG_DIR + BG_ASSETS.GROUND);

    if (FROG_ART === 'frames') {
      this.load.image(loadKey(ASSETS.IDLE), FRAME_DIR + ASSETS.IDLE);
      this.load.image(loadKey(ASSETS.BLINK), FRAME_DIR + ASSETS.BLINK);
      Object.values(ASSETS.RUN).flat().forEach((file) => this.load.image(loadKey(file), FRAME_DIR + file));
      Object.values(ASSETS.DUCK).flat().forEach((file) => this.load.image(loadKey(file), FRAME_DIR + file));
      Object.values(ASSETS.JUMP).flat().forEach((file) => this.load.image(loadKey(file), FRAME_DIR + file));
    }
  }

  create() {
    // Scene dipakai ulang oleh scene.restart() — reset SEMUA state di sini
    // Anime manager bertahan antar restart; pastikan tidak tersisa pause dari game-over.
    this.anims.resumeAll();
    this.state = 'ready';
    this.ducking = false;
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this._lastScore = -1;
    this._jumpQueued = false;
    this._nextObstacleAt = 0;
    this._coyoteUntil = 0;
    this._lastGroundCount = 0;
    this._wasAirborne = false;
    this._lastSquashAt = 0;
    this._dustTimer = 0;
    this._streakTimer = 0;
    this._best = this._readBest();
    this._overPauseCall = null;

    this._buildBackgroundTextures();
    this._buildFrameTextures();
    this._buildTextures();
    this._buildAnimations();
    this._initLayout();
    this._createPlayer();
    this._createObstacleGroups();
    this._createAmbient();
    this._bindInput();
    this._emitState(this.state);
    Logger.debug('Runner', 'Scene ready — ' + this.scale.width + 'x' + this.scale.height);
  }

  // ── Util ────────────────────────────────────────────────────

  _readBest() {
    try {
      return parseInt(localStorage.getItem(RUNNER_BEST_KEY) || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  _grounded() {
    return this.frog.body.blocked.down || this.frog.body.touching.down;
  }

  _emitState(state) {
    this.game.events.emit('runner:state', state);
  }

  _emitSfx(name) {
    this.game.events.emit('runner:sfx', name);
  }

  _makeCanvasTexture(key, srcKey) {
    if (this.textures.exists(key)) return;
    const src = this.textures.get(srcKey)?.getSourceImage?.();
    if (!src) return;
    const canvas = this.textures.createCanvas(key, FRAME.W, FRAME.H);
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, FRAME.W, FRAME.H);
    const x = Math.round((FRAME.W - src.width) / 2);
    const y = Math.round(FRAME.H - src.height - 2);
    ctx.drawImage(src, x, y);
    canvas.refresh();
  }

  _makeCropTexture(key, srcKey, cropY, cropH) {
    if (this.textures.exists(key)) return;
    const src = this.textures.get(srcKey)?.getSourceImage?.();
    if (!src) return;
    const canvas = this.textures.createCanvas(key, src.width, cropH);
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, src.width, cropH);
    ctx.drawImage(src, 0, cropY, src.width, cropH, 0, 0, src.width, cropH);
    canvas.refresh();
  }

  _makeCropTextureArea(key, srcKey, cropX, cropY, cropW, cropH) {
    if (this.textures.exists(key)) return;
    const src = this.textures.get(srcKey)?.getSourceImage?.();
    if (!src) return;
    const canvas = this.textures.createCanvas(key, cropW, cropH);
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, cropW, cropH);
    ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    canvas.refresh();
  }

  _buildFrameTextures() {
    if (FROG_ART !== 'frames') return;
    this._makeCanvasTexture(frogKey('idle'), loadKey(ASSETS.IDLE));
    this._makeCanvasTexture(frogKey('blink'), loadKey(ASSETS.BLINK));
    ASSETS.RUN.forEach((file) => this._makeCanvasTexture(frogKey(frameKey(file)), loadKey(file)));
    ASSETS.DUCK.forEach((file) => this._makeCanvasTexture(frogKey(frameKey(file)), loadKey(file)));
    ASSETS.JUMP.forEach((file) => this._makeCanvasTexture(frogKey(frameKey(file)), loadKey(file)));
  }

  _buildBackgroundTextures() {
    if (FROG_ART !== 'frames') return;
    this._makeCropTexture('bg-cloud-band', 'bg-clouds', BG_CROP.CLOUDS.y, BG_CROP.CLOUDS.h);
    // Crop hanya bagian visual yang memang dipakai agar tile tidak menampilkan
    // ruang kosong/transparan di sela-sela band.
    this._makeCropTexture('bg-hill-far-band', 'bg-hill-far', BG_CROP.HILL_FAR.y, BG_CROP.HILL_FAR.h);
    this._makeCropTexture('bg-hill-near-band', 'bg-hill-near', BG_CROP.HILL_NEAR.y, BG_CROP.HILL_NEAR.h);
    this._makeCropTextureArea('bg-ground-band', 'bg-ground', BG_CROP.GROUND.x, BG_CROP.GROUND.y, BG_CROP.GROUND.w, BG_CROP.GROUND.h);
  }

  // ── Pembuat texture (semua aset digambar dengan kode) ───────

  _tex(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _framesFor(pose) {
    if (FROG_ART === 'frames') return ASSETS[pose.toUpperCase()].map((file) => frogKey(frameKey(file)));
    const n = pose === 'run' ? 4 : 2;
    return Array.from({ length: n }, (_, i) => `frog-${pose}-${i}`);
  }

  _drawFrog(g, pose, i, n) {
    const body = 0x63d54f;
    const bodyDark = 0x2f8f2a;
    const belly = 0xcff0ba;
    const foot = 0x3f9e38;
    const eye = 0xffffff;
    const pupil = 0x1c2b18;
    const blush = 0xf2a0a0;

    if (pose === 'blink') {
      // Frame lari dengan mata tertutup (untuk animasi kedip)
      this._drawFrog(g, 'run', 0, 4);
      g.fillStyle(0x1c2b18, 1);
      g.lineBetween(165, 84, 176, 86);
      g.lineBetween(135, 80, 146, 82);
      return;
    }

    if (pose === 'duck') {
      const waddle = i === 1 ? 4 : -3;
      g.fillStyle(bodyDark, 1);
      g.fillRoundedRect(28, 148, 184, 46, 22);
      g.fillStyle(body, 1);
      g.fillRoundedRect(32, 144, 176, 42, 20);
      g.fillStyle(belly, 1);
      g.fillRoundedRect(42, 170, 112, 14, 7);
      // kepala di depan
      g.fillStyle(bodyDark, 1);
      g.fillCircle(194, 134, 26);
      g.fillStyle(body, 1);
      g.fillCircle(196, 132, 24);
      // mata
      g.fillStyle(eye, 1);
      g.fillCircle(204, 114, 9);
      g.fillCircle(176, 112, 8);
      g.fillStyle(pupil, 1);
      g.fillCircle(207, 114, 4.5);
      g.fillCircle(179, 112, 4);
      // mulut
      g.fillStyle(0x1c2b18, 1);
      g.lineBetween(200, 136, 214, 131);
      // kaki
      g.fillStyle(foot, 1);
      g.fillRoundedRect(48 + waddle, 188, 44, 14, 7);
      g.fillRoundedRect(126 - waddle, 188, 44, 14, 7);
      return;
    }

    const phase = (i / n) * Math.PI * 2;
    const bob = pose === 'run' ? Math.sin(phase) * 3 : 0;

    // kaki (belakang & depan) — garis tebal + telapak
    const frontPivot = { x: 126, y: 166 + bob * 0.4 };
    const backPivot = { x: 84, y: 164 + bob * 0.4 };
    let frontFoot, backFoot;
    if (pose === 'jump') {
      const splay = i === 1 ? 6 : 0;
      frontFoot = { x: 184 + splay, y: 190 };
      backFoot = { x: 40 - splay, y: 188 };
    } else {
      frontFoot = { x: 126 + Math.sin(phase) * 24, y: 194 + Math.cos(phase) * 4 + bob * 0.4 };
      backFoot = { x: 84 - Math.sin(phase) * 24, y: 194 - Math.cos(phase) * 4 + bob * 0.4 };
    }

    const drawLeg = (px, py, fx, fy) => {
      g.lineStyle(18, bodyDark, 1);
      g.lineBetween(px, py, fx, fy);
      g.lineStyle(12, body, 1);
      g.lineBetween(px, py, fx, fy);
    };
    drawLeg(backPivot.x, backPivot.y, backFoot.x, backFoot.y);
    drawLeg(frontPivot.x, frontPivot.y, frontFoot.x, frontFoot.y);
    g.fillStyle(foot, 1);
    g.fillEllipse(frontFoot.x, frontFoot.y, 30, 14);
    g.fillEllipse(backFoot.x, backFoot.y, 28, 13);

    // badan
    const bodyY = 140 + bob;
    const bodyX = 112;
    const rx = pose === 'jump' ? 52 : 58;
    const ry = pose === 'jump' ? 58 : 46;
    g.fillStyle(bodyDark, 1);
    g.fillEllipse(bodyX, bodyY, rx * 2 + 6, ry * 2 + 6);
    g.fillStyle(body, 1);
    g.fillEllipse(bodyX, bodyY, rx * 2, ry * 2);
    // perut
    g.fillStyle(belly, 1);
    g.fillEllipse(bodyX - 4, bodyY + 10, rx - 20, ry - 18);
    // pipi
    g.fillStyle(blush, 0.65);
    g.fillCircle(140, bodyY + 8, 7);

    // kepala (menghadap kanan)
    const headX = 158;
    const headY = 106 + bob;
    g.fillStyle(bodyDark, 1);
    g.fillCircle(headX, headY, 31);
    g.fillStyle(body, 1);
    g.fillCircle(headX, headY, 28);
    // mata
    g.fillStyle(eye, 1);
    g.fillCircle(headX + 12, headY - 22, 10);
    g.fillCircle(headX - 18, headY - 26, 9);
    g.fillStyle(pupil, 1);
    g.fillCircle(headX + 15, headY - 22, 5);
    g.fillCircle(headX - 15, headY - 26, 4.5);
    g.fillStyle(eye, 1);
    g.fillCircle(headX + 13, headY - 25, 2);
    g.fillCircle(headX - 17, headY - 29, 1.8);

    // mulut
    g.fillStyle(0x1c2b18, 1);
    if (pose === 'jump') {
      g.fillStyle(0x8c2f2f, 1);
      g.fillTriangle(headX + 2, headY + 2, headX + 26, headY + 4, headX + 10, headY + 14);
    } else {
      g.lineBetween(headX + 2, headY + 12, headX + 20, headY + 6);
    }
  }

  _buildTextures() {
    // pixel putih 1×1 (hitbox statis)
    this._tex('pixel', 1, 1, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
    });

    // karakter katak (builtin fallback)
    if (FROG_ART === 'builtin') {
      this._tex('frog-run-0', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'run', 0, 4));
      this._tex('frog-run-1', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'run', 1, 4));
      this._tex('frog-run-2', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'run', 2, 4));
      this._tex('frog-run-3', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'run', 3, 4));
      this._tex('frog-duck-0', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'duck', 0, 2));
      this._tex('frog-duck-1', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'duck', 1, 2));
      this._tex('frog-jump-0', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'jump', 0, 2));
      this._tex('frog-jump-1', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'jump', 1, 2));
      this._tex('frog-blink', FRAME.W, FRAME.H, (g) => this._drawFrog(g, 'blink', 0, 4));
    } else {
      // tanah: rumput + tanah berlumpur
      this._tex('ground-tile', 96, 64, (g) => {
        g.fillStyle(0x6b4f2a, 1);
        g.fillRect(0, 0, 96, 64);
        g.fillStyle(0x7d5a33, 1);
        for (let i = 0; i < 6; i++) g.fillCircle(8 + i * 16, 34 + (i % 3) * 12, 4);
        g.fillStyle(0x4a3b1f, 1);
        for (let i = 0; i < 5; i++) g.fillRect(4 + i * 20, 46 + (i % 2) * 8, 10, 3);
        g.fillStyle(0x52b788, 1);
        g.fillRect(0, 0, 96, 18);
        g.fillStyle(0x74c69d, 1);
        g.fillRect(0, 0, 96, 7);
        g.fillStyle(0x3f9e38, 1);
        for (let i = 0; i < 8; i++) g.fillRect(i * 13, 4 + (i % 3) * 5, 3, 8);
      });

      // bukit latar (parallax jauh)
      this._tex('hill-far', 400, 220, (g) => {
        g.fillStyle(0x2f7a5b, 1);
        g.fillRect(0, 150, 400, 70);
        g.fillCircle(80, 160, 90);
        g.fillCircle(220, 160, 120);
        g.fillCircle(360, 160, 80);
      });

      // semak latar (parallax dekat)
      this._tex('hill-near', 320, 140, (g) => {
        g.fillStyle(0x1d4a35, 1);
        g.fillRect(0, 96, 320, 44);
        g.fillCircle(60, 100, 60);
        g.fillCircle(170, 100, 80);
        g.fillCircle(280, 100, 55);
      });

      // awan (parallax paling jauh)
      this._tex('cloud', 200, 64, (g) => {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(52, 40, 22);
        g.fillCircle(96, 30, 28);
        g.fillCircle(140, 42, 20);
        g.fillRoundedRect(30, 40, 140, 20, 10);
      });
    }

    // kaktus (rintangan — lompat, warna kontras + bunga)
    this._tex('obs-cactus', 72, 140, (g) => {
      g.fillStyle(0x0c4022, 1);
      g.fillRoundedRect(20, 18, 32, 114, 14);
      g.fillRoundedRect(8, 52, 26, 14, 7);
      g.fillRoundedRect(8, 40, 14, 26, 7);
      g.fillRoundedRect(38, 74, 26, 14, 7);
      g.fillRoundedRect(50, 62, 14, 26, 7);
      g.fillStyle(0x1c8a4c, 1);
      g.fillRoundedRect(26, 26, 22, 98, 10);
      g.fillStyle(0x54d185, 1);
      g.fillRoundedRect(31, 36, 8, 82, 4);
      g.fillStyle(0xff7aa2, 1);
      g.fillCircle(36, 22, 7);
      g.fillCircle(36, 22, 3);
    });

    // batu (rintangan — lompat)
    this._tex('obs-rock', 84, 64, (g) => {
      g.fillStyle(0x3d3a36, 1);
      g.fillEllipse(42, 34, 80, 52);
      g.fillStyle(0x5c5750, 1);
      g.fillEllipse(42, 30, 68, 42);
      g.fillStyle(0x7d776e, 1);
      g.fillEllipse(34, 24, 30, 18);
      g.fillStyle(0x3f6d4a, 1);
      g.fillCircle(62, 26, 9);
      g.fillCircle(22, 42, 7);
    });

    // burung (rintangan — jongkok, 2 frame sayap)
    this._tex('obs-bird-0', 104, 60, (g) => this._drawBird(g, 0));
    this._tex('obs-bird-1', 104, 60, (g) => this._drawBird(g, 1));

    // batang kayu (rintangan — jongkok)
    this._tex('obs-log', 104, 44, (g) => {
      g.fillStyle(0x5d3a14, 1);
      g.fillRoundedRect(0, 2, 104, 38, 14);
      g.fillStyle(0x8a5a2b, 1);
      g.fillRoundedRect(0, 0, 104, 34, 14);
      g.fillStyle(0x6e3f1a, 1);
      g.fillEllipse(18, 18, 22, 26);
      g.fillEllipse(56, 18, 20, 24);
      g.fillEllipse(88, 18, 18, 22);
      g.fillStyle(0xa97c50, 1);
      g.fillRect(2, 6, 100, 4);
    });

    // jamur (rintangan — lompat, batang menempel tanah)
    this._tex('obs-mushroom', 84, 80, (g) => {
      g.fillStyle(0xf2f2e9, 1);
      g.fillRoundedRect(32, 24, 20, 56, 9);
      g.fillStyle(0xff5d5d, 1);
      g.fillRoundedRect(10, 4, 64, 44, 18);
      g.fillStyle(0xe63e3e, 1);
      g.fillRoundedRect(16, 8, 52, 34, 14);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(28, 18, 5);
      g.fillCircle(52, 24, 4.5);
      g.fillCircle(40, 34, 4);
      g.fillStyle(0x7d5a33, 1);
      g.fillEllipse(42, 78, 44, 10);
    });

    // titik cahaya kunang-kunang (ambience)
    this._tex('glow', 40, 40, (g) => {
      g.fillStyle(0xc99a12, 1);
      g.fillCircle(20, 20, 18);
      g.fillStyle(0xf0c040, 1);
      g.fillCircle(20, 20, 13);
      g.fillStyle(0xd4a017, 1);
      g.fillCircle(20, 20, 8);
      g.fillStyle(0xffe28a, 1);
      g.fillCircle(14, 14, 4);
    });

    // debu & garis kecepatan
    this._tex('dust', 16, 16, (g) => {
      g.fillStyle(0xd9e8d2, 0.9);
      g.fillCircle(8, 8, 7);
    });
    this._tex('streak', 46, 3, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 46, 3);
    });
  }

  _drawBird(g, frame) {
    const wingUp = frame === 1;
    g.fillStyle(0x4a2b20, 1);
    g.fillEllipse(52, 30, 88, 50);
    g.fillStyle(0x8a4a34, 1);
    g.fillEllipse(52, 28, 80, 44);
    g.fillStyle(0xf5e6d0, 1);
    g.fillEllipse(44, 36, 46, 24);
    // paruh
    g.fillStyle(0xf4845f, 1);
    g.fillTriangle(88, 30, 104, 25, 104, 35);
    // mata
    g.fillStyle(0xffffff, 1);
    g.fillCircle(74, 20, 7);
    g.fillStyle(0x1c2b18, 1);
    g.fillCircle(76, 20, 3.5);
    // sayap (kepak)
    g.fillStyle(0x6e3a28, 1);
    if (wingUp) {
      g.fillEllipse(40, 18, 52, 22);
    } else {
      g.fillEllipse(40, 42, 56, 22);
    }
  }

  _buildAnimations() {
    const frames = (keys) => keys.map((key) => ({ key }));
    if (FROG_ART === 'frames' && !this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: frames([frogKey('idle'), frogKey('blink'), frogKey('idle')]),
        frameRate: 2,
        repeat: -1,
      });
    }
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: frames(this._framesFor('run')),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (!this.anims.exists('duck')) {
      this.anims.create({
        key: 'duck',
        frames: frames(this._framesFor('duck')),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists('jump')) {
      this.anims.create({
        key: 'jump',
        frames: frames(this._framesFor('jump')),
        frameRate: 10,
        repeat: 0,
      });
    }
    if (FROG_ART === 'frames' && !this.anims.exists('land')) {
      this.anims.create({
        key: 'land',
        frames: frames([frogKey('landing'), frogKey('idle')]),
        frameRate: 8,
        repeat: 0,
      });
    }
    if (FROG_ART === 'builtin' && !this.anims.exists('blink')) {
      this.anims.create({
        key: 'blink',
        frames: frames(['frog-blink', 'frog-run-0']),
        frameRate: 6,
        repeat: 0,
      });
    }
    if (!this.anims.exists('bird')) {
      this.anims.create({
        key: 'bird',
        frames: frames(['obs-bird-0', 'obs-bird-1']),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  // ── Layout ──────────────────────────────────────────────────

  _initLayout() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.width = w;
    this.height = h;
    this.groundY = h - Math.max(76, Math.round(h * 0.13)) - SURFACE_RAISE;
    this.frogScale = Phaser.Math.Clamp((h * 0.12) / FROG_BOUNDS.run.h, 0.45, 1.05);
    this.frogX = Math.max(64, Math.round(w * 0.24));
    // Anchor katak di kaki (bawah): telapak kaki ~12px di atas garis tanah,
    // tidak pernah di tengah layar dan tidak tenggelam ke dalam tanah.
    this.frogY = this.groundY - FROG_FEET_GAP - (FROG_FEET_Y - FRAME.H / 2) * this.frogScale;

    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBackgroundColor('#9cdcf7');

    // Sky penuh
    this.sky = this.add.image(w / 2, h / 2, 'bg-sky')
      .setDisplaySize(w, h)
      .setDepth(0);

    // Awan / bukit parallax
    this.clouds = this.add.tileSprite(w / 2, h * 0.10, w, Math.max(120, Math.round(h * 0.34)), 'bg-cloud-band')
      .setOrigin(0.5, 0.5).setAlpha(0.28).setDepth(1);
    this.hillsFar = this.add.tileSprite(w / 2, this.groundY - h * 0.38, w, Math.min(BG_CROP.HILL_FAR.h, Math.max(260, Math.round(h * 0.34))), 'bg-hill-far-band')
      .setOrigin(0.5, 0.5).setAlpha(0.78).setDepth(3);
    this.hillsNear = this.add.tileSprite(w / 2, this.groundY - h * 0.24, w, Math.min(BG_CROP.HILL_NEAR.h, Math.max(220, Math.round(h * 0.27))), 'bg-hill-near-band')
      .setOrigin(0.5, 0.5).setAlpha(0.95).setDepth(4);

    // Tanah (visual bergerak + hitbox statis)
    this.ground = this.add.tileSprite(w / 2, h, w, Math.min(BG_CROP.GROUND.h, Math.max(190, h - this.groundY + 42)), 'bg-ground-band')
      .setOrigin(0.5, 1).setDepth(5);
    // Lantai fisis: bagian atasnya = garis kaki katak (10–20px di atas tanah visual),
    // tebalnya sampai jauh di bawah layar supaya katak tidak pernah tembus/tenggelam.
    this.groundHit = this.physics.add.staticImage(w / 2, this.groundY - FROG_FEET_GAP + h, 'pixel');
    this.groundHit.setDisplaySize(w + 400, h * 2);
    this.groundHit.refreshBody();
    this.groundHit.visible = false;
  }

  _createPlayer() {
    const tex = FROG_ART === 'frames' ? frogKey('idle') : 'frog-run-0';
    this.frog = this.physics.add.sprite(this.frogX, this.frogY, tex);
    this.frog.setOrigin(0.5, 0.5);
    this.frog.setScale(this.frogScale);
    this.frog.setDepth(10);
    this.frog.setCollideWorldBounds(true);
    this._applyBody('idle');
    this.physics.add.collider(this.frog, this.groundHit);
    this.frog.play(FROG_ART === 'frames' ? 'idle' : 'run');

    // Gerakan mengambang pelan saat mode ready (biar terasa hidup)
    this._idleTween = this.tweens.add({
      targets: this.frog,
      y: this.frogY - 7,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _createObstacleGroups() {
    this.obstacles = this.physics.add.group({ allowGravity: false });
    this.fx = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.frog, this.obstacles, () => this._gameOver());
  }

  _createAmbient() {
    // kunang-kunang — selalu bergerak pelan
    this.fireflies = [];
    for (let i = 0; i < 8; i++) {
      const f = this.add.image(
        Phaser.Math.Between(20, this.width - 20),
        Phaser.Math.Between(Math.round(this.height * 0.25), Math.round(this.height * 0.7)),
        'glow'
      );
      f.setScale(0.12 + Math.random() * 0.06);
      f.setAlpha(0.35 + Math.random() * 0.3);
      f.setDepth(2);
      f.setTint(0xd9f7a1);
      this.fireflies.push({
        sprite: f,
        baseY: f.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
        drift: 4 + Math.random() * 8,
      });
    }
  }

  _applyBody(mode) {
    this._bodyMode = mode;
    const b = FROG_BOUNDS[mode];
    // Ukuran & offset dalam "source pixels" (ukuran frame asli 240x240).
    // Phaser mengalikan body dengan skala sprite otomatis tiap frame, jadi hitbox
    // selalu menyatu dengan sprite — termasuk saat animasi squash/stretch.
    const bodyW = Math.max(14, b.w - 10);
    const bodyH = Math.max(10, b.h - 4);
    this.frog.body.setSize(bodyW, bodyH, false);
    this.frog.body.setOffset(b.x + 5, b.y + 4);
  }

  // ── Input ───────────────────────────────────────────────────

  _bindInput() {
    // Hapus listener lama dulu — scene.restart() memakai instance yang sama
    this.input.off('pointerdown');
    this.input.on('pointerdown', () => this.jump());

    const kb = this.input.keyboard;
    kb.off('keydown-SPACE');
    kb.off('keydown-UP');
    kb.off('keydown-W');
    kb.off('keydown-DOWN');
    kb.off('keydown-S');
    kb.off('keyup-DOWN');
    kb.off('keyup-S');
    kb.on('keydown-SPACE', () => this.jump());
    kb.on('keydown-UP', () => this.jump());
    kb.on('keydown-W', () => this.jump());
    kb.on('keydown-DOWN', () => this.setDucking(true));
    kb.on('keydown-S', () => this.setDucking(true));
    kb.on('keyup-DOWN', () => this.setDucking(false));
    kb.on('keyup-S', () => this.setDucking(false));
  }

  jump() {
    if (this.state === 'ready') {
      this._start();
      return;
    }
    if (this.state !== 'running') return;
    if (this._grounded() || this.time.now <= this._coyoteUntil) {
      this._doJump();
    } else {
      this._jumpQueued = true;
    }
  }

  setDucking(on) {
    if (this.state !== 'running') return;
    this._setDucking(on);
  }

  _setDucking(on) {
    if (this.ducking === on) return;
    this.ducking = on;
    if (on) {
      this._applyBody('duck');
    } else if (this._grounded()) {
      this._applyBody('run');
    } else {
      this._applyBody('jump');
    }
  }

  _doJump() {
    this._jumpQueued = false;
    if (this.ducking) this._setDucking(false);
    this.frog.setVelocityY(JUMP_VELOCITY);
    this._applyBody('jump');
    this._wasAirborne = true;
    this._landingUntil = 0;
    if (FROG_ART === 'frames') this.frog.play('jump', true);
    // regang saat melompat
    const s = this.frogScale;
    this.tweens.add({ targets: this.frog, scaleX: s * 0.92, scaleY: s * 1.08, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this._emitSfx('jump');
  }

  _start() {
    this.state = 'running';
    this.speed = BASE_SPEED;
    this._nextObstacleAt = this.distance + 42;
    this._wasAirborne = false;
    this._landingUntil = 0;
    if (this._idleTween) {
      this._idleTween.stop();
      this._idleTween = null;
      this.frog.y = this.frogY;
    }
    if (FROG_ART === 'frames') {
      this.frog.play('run', true);
    } else {
      this.frog.play('run', true);
    }
    this._emitState('running');
    this._emitSfx('start');
  }

  togglePause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this.physics.pause();
      this.anims.pauseAll();
      this._emitState('paused');
    } else if (this.state === 'paused') {
      this.state = 'running';
      this.physics.resume();
      this.anims.resumeAll();
      this._emitState('running');
    }
  }

  restartGame() {
    this.scene.restart();
  }

  // ── Spawn ───────────────────────────────────────────────────

  _spawnObstacle() {
    let patterns = PATTERNS;
    // Jamin rintangan darat tetap muncul: maksimal 3 udara berturut-turut
    if (this._lastGroundCount >= 3) {
      patterns = PATTERNS.filter((p) => p.some((t) => OBSTACLES[t].ground));
    }
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const isGround = pattern.some((t) => OBSTACLES[t].ground);
    this._lastGroundCount = isGround ? this._lastGroundCount + 1 : 0;

    // Jarak antar objek dalam satu kelompok: berbasis WAKTU (1.0–1.3s),
    // jadi selalu konsisten dan tidak pernah berdempetan berapa pun kecepatannya.
    const withinTime = 1.0 + Math.random() * 0.3;
    const spacing = this.speed * withinTime;

    pattern.forEach((type, i) => {
      const def = OBSTACLES[type];
      const s = this._obstacleScale(type);
      const x = this.width + 100 + i * spacing;
      let y;
      if (def.ground) {
        // Rintangan darat: dasar objek yang terlihat menempel tepat di permukaan tanah
        y = this.groundY + (def.h * 0.5 - def.foot) * s;
      } else {
        // Rintangan udara: selalu di jalur 90–220px di atas tanah, tidak pernah menyentuh tanah
        y = this.groundY - Phaser.Math.Between(AIR_ALT_MIN, AIR_ALT_MAX);
      }
      const obs = this.obstacles.create(x, y, def.tex);
      this._setupObstacle(obs, def, s);
      if (def.anim) obs.play(def.anim);
    });

    // Jarak antar kelompok: waktu reaksi 1.5–2.2s (makin jauh sedikit lebih rapat, tetap adil).
    // Dihitung dari obstacle TERAKHIR kelompok ini, jadi kelompok berikutnya tidak pernah
    // muncul menempel di belakang kelompok sebelumnya.
    const reactTime = Phaser.Math.Clamp(2.5 - this.distance * 0.0004, 2.0, 2.6);
    const gapPx = this.speed * reactTime;
    this._nextObstacleAt = this.distance + ((pattern.length - 1) * spacing + gapPx) / 10;
  }

  _setupObstacle(obs, def, s) {
    obs.setScale(s);
    obs.setDepth(7);
    obs.body.setAllowGravity(false);
    // Sama seperti katak: ukuran & offset dalam source pixels biar hitbox
    // seukuran visual rintangan (bukan lebih kecil dari tampilan).
    obs.body.setSize(def.body.w, def.body.h, false);
    obs.body.setOffset(def.body.x, def.body.y);
    obs.body.setVelocityX(-this.speed);
  }

  _obstacleScale(type) {
    const h = this.height;
    if (type === 'cactus') return Phaser.Math.Clamp((h * 0.16) / OBSTACLES.cactus.h, 0.5, 1.1);
    if (type === 'rock') return Phaser.Math.Clamp((h * 0.09) / OBSTACLES.rock.h, 0.5, 1.1);
    if (type === 'mushroom') return Phaser.Math.Clamp((h * 0.1) / OBSTACLES.mushroom.h, 0.5, 1.05);
    if (type === 'log') return Phaser.Math.Clamp((h * 0.1) / OBSTACLES.log.h, 0.5, 1.1);
    return Phaser.Math.Clamp((h * 0.08) / OBSTACLES.bird.h, 0.5, 1.0);
  }

  // ── Efek ringan ─────────────────────────────────────────────

  _spawnDust() {
    const d = this.fx.create(this.frogX + 12 * this.frogScale, this.groundY - 6, 'dust');
    d.setDepth(8);
    d.setAlpha(0.55);
    d.body.setAllowGravity(false);
    d.body.setVelocityX(-this.speed * 0.4);
    this.tweens.add({
      targets: d,
      scale: 1.15,
      alpha: 0,
      y: this.groundY - 26,
      duration: 380,
      onComplete: () => d.destroy(),
    });
  }

  _spawnStreak() {
    const st = this.fx.create(this.width + 60, Phaser.Math.Between(90, Math.round(this.height * 0.55)), 'streak');
    st.setDepth(9);
    st.setAlpha(0.22);
    st.body.setAllowGravity(false);
    st.body.setVelocityX(-this.speed * 2.6);
  }

  _landSquash() {
    const now = this.time.now;
    if (now - this._lastSquashAt < 140) return;
    this._lastSquashAt = now;
    const s = this.frogScale;
    this.tweens.add({
      targets: this.frog,
      scaleX: s * 1.07,
      scaleY: s * 0.82,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this._spawnDust();
    this._spawnDust();
  }

  // ── Gameplay ────────────────────────────────────────────────

  update(time, delta) {
    // Kunang-kunang selalu hidup (termasuk saat ready)
    for (const f of this.fireflies) {
      if (!f.sprite.active) continue;
      f.sprite.y = f.baseY + Math.sin(time * 0.001 * f.speed + f.phase) * 10;
      f.sprite.x -= f.drift * 0.016;
      if (f.sprite.x < -20) {
        f.sprite.x = this.width + 20;
        f.baseY = Phaser.Math.Between(Math.round(this.height * 0.25), Math.round(this.height * 0.7));
      }
    }

    if (this.state !== 'running') return;

    const dt = Math.min(delta, 34) / 1000;
    this.distance += this.speed * dt * 0.1;
    // Kurva kecepatan: mulai pelan lalu naik terus-menerus (eksponensial halus) sampai MAX_SPEED
    this.speed = Math.min(
      MAX_SPEED,
      BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (1 - Math.exp(-this.distance / 1000))
    );
    this.score = Math.floor(this.distance);

    // Parallax & tanah
    this.clouds.tilePositionX -= this.speed * dt * 0.05;
    this.hillsFar.tilePositionX -= this.speed * dt * 0.15;
    this.hillsNear.tilePositionX -= this.speed * dt * 0.35;
    this.ground.tilePositionX += this.speed * dt;

    // Sinkronkan kecepatan semua objek
    this.obstacles.getChildren().forEach((o) => {
      if (o.active) o.body.setVelocityX(-this.speed);
    });
    this.fx.getChildren().forEach((f) => {
      if (f.active && f.body) {
        if (f.texture.key === 'streak') f.body.setVelocityX(-this.speed * 2.6);
        else if (f.texture.key === 'dust') f.body.setVelocityX(-this.speed * 0.4);
      }
    });

    // Spawn & bersihkan
    if (this.distance >= this._nextObstacleAt) this._spawnObstacle();
    this.obstacles.getChildren().forEach((o) => {
      if (o.x < -160) o.destroy();
    });
    this.fx.getChildren().forEach((f) => {
      if (f.x < -120) f.destroy();
    });

    // Debu lari & garis kecepatan
    this._dustTimer += dt;
    if (this._dustTimer > 0.15 && this._grounded() && !this.ducking) {
      this._dustTimer = 0;
      this._spawnDust();
    }
    this._streakTimer += dt;
    if (this._streakTimer > 0.12 && this.speed > 470) {
      this._streakTimer = 0;
      this._spawnStreak();
    }

    // Lompat: coyote time + buffering + squash saat mendarat
    if (this._grounded()) {
      if (this._wasAirborne && !this.ducking) {
        this._landingUntil = this.time.now + 140;
        this._landSquash();
        if (FROG_ART === 'frames') this.frog.play('land', true);
      }
      this._wasAirborne = false;
      this._coyoteUntil = this.time.now + 80;
      if (this._jumpQueued) this._doJump();
    } else if (this.time.now > this._coyoteUntil) {
      this._jumpQueued = false;
    }

    // Animasi frog
    this._updateFrogAnim();

    // Kirim skor ke HUD (hanya saat berubah)
    if (this.score !== this._lastScore) {
      this._lastScore = this.score;
      this.game.events.emit('runner:score', this.score);
    }
  }

  _updateFrogAnim() {
    if (this._grounded()) {
      if (this.ducking) {
        if (this.frog.anims.currentAnim?.key !== 'duck') this.frog.play('duck');
        if (this._bodyMode !== 'duck') this._applyBody('duck');
      } else if (FROG_ART === 'frames' && this.time.now < this._landingUntil) {
        if (this._bodyMode !== 'landing') this._applyBody('landing');
      } else if (FROG_ART === 'frames') {
        if (this._bodyMode !== 'run') this._applyBody('run');
        if (this.frog.anims.currentAnim?.key !== 'run' || !this.frog.anims.isPlaying) {
          this.frog.play('run');
        }
      } else {
        if (this._bodyMode !== 'run') this._applyBody('run');
        if (this.frog.anims.currentAnim?.key !== 'run') this.frog.play('run');
      }
    } else if (this.frog.anims.currentAnim?.key !== 'jump') {
      this.frog.play('jump');
    }
  }

  _gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.ducking = false;
    if (this._idleTween) {
      this._idleTween.stop();
      this._idleTween = null;
    }
    if (FROG_ART === 'frames') {
      this.frog.anims.stop();
      this.frog.setTexture(frogKey('fall'));
    }
    this.frog.setTint(0xff8a7a);
    this.frog.setVelocityY(-460);
    this._emitSfx('over');

    const score = this.score;
    const isNewBest = score > this._best;
    const best = Math.max(this._best, score);
    this._best = best;
    try {
      localStorage.setItem(RUNNER_BEST_KEY, String(best));
    } catch (e) {
      /* storage penuh / private mode */
    }

    // Panel game over ditampilkan DULUAN, lalu payload skor — biar selalu muncul
    this._emitState('over');
    this.game.events.emit('runner:gameover', { score, best, isNewBest });

    this._overPauseCall = this.time.delayedCall(240, () => {
      this._overPauseCall = null;
      // Kalau scene sudah di-restart (state bukan 'over'), jangan pause scene yang baru —
      // kalau tidak animasi akan tersisa beku setelah tombol Main Lagi.
      if (this.state !== 'over') return;
      this.physics.pause();
      this.anims.pauseAll();
    });
  }
};

// ══════════════════════════════════════════════════════════════
// Screen wrapper — DOM overlay + lifecycle Phaser
// ══════════════════════════════════════════════════════════════
export class RunnerScreen {
  constructor(eventBus) {
    this.events = eventBus;
    this.el = null;
    this.game = null;
    this._state = 'ready';
    this._audioCtx = null;
    this._onVisibility = null;
    this._restarting = false;
  }

  show() {
    this._createOverlay();
    this._startGame();
  }

  hide() {
    this._destroyGame();
    this.el?.remove();
    this.el = null;
  }

  destroy() {
    this.hide();
  }

  // ── DOM ─────────────────────────────────────────────────────

  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'runner-overlay is-ready';
    overlay.innerHTML = `
      <div class="runner-topbar">
        <div class="runner-score-box">
          <span class="runner-score-icon">🐸</span>
          <span class="runner-score-value" id="runner-score">0</span>
        </div>
        <div class="runner-hud-btns">
          <button class="runner-hud-btn" id="runner-pause" type="button" aria-label="Pause">⏸</button>
          <button class="runner-hud-btn" id="runner-quit" type="button" aria-label="Keluar">✕</button>
        </div>
      </div>
      <div class="runner-stage" id="runner-stage">
        <div class="runner-chip runner-chip-ready" id="runner-chip-ready">👆 Tap untuk mulai lari!</div>
        <div class="runner-chip runner-chip-paused" id="runner-chip-paused">⏸ Paused</div>
        <div class="runner-gameover" id="runner-gameover">
          <div class="runner-gameover-card">
            <div class="runner-gameover-title">💀 Game Over</div>
            <div class="runner-gameover-score" id="runner-final-score">0</div>
            <div class="runner-gameover-best" id="runner-final-best">Best: 0</div>
            <div class="runner-gameover-new" id="runner-new-best">🎉 Rekor Baru!</div>
            <div class="runner-gameover-actions">
              <button class="btn btn-gold" id="runner-retry" type="button">▶ Main Lagi</button>
              <button class="btn btn-secondary" id="runner-exit" type="button">🏠 Menu</button>
            </div>
          </div>
        </div>
      </div>
      <div class="runner-controls">
        <div class="runner-controls-hint">Tap layar / ⬆ untuk lompat</div>
        <button class="runner-ctrl" id="runner-ctrl-jump" type="button" aria-label="Lompat">⬆️</button>
        <button class="runner-ctrl" id="runner-ctrl-duck" type="button" aria-label="Jongkok">⬇️</button>
      </div>
    `;
    document.body.appendChild(overlay);
    this.el = overlay;

    this._bindDom();
  }

  _bindDom() {
    const $ = (id) => this.el.querySelector('#' + id);

    const jumpBtn = $('runner-ctrl-jump');
    const duckBtn = $('runner-ctrl-duck');

    jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._sceneCall('jump');
    });

    const duckDown = (e) => {
      e.preventDefault();
      this._sceneCall('setDucking', true);
    };
    const duckUp = (e) => {
      e.preventDefault();
      this._sceneCall('setDucking', false);
    };
    duckBtn.addEventListener('pointerdown', duckDown);
    duckBtn.addEventListener('pointerup', duckUp);
    duckBtn.addEventListener('pointerleave', duckUp);
    duckBtn.addEventListener('pointercancel', duckUp);

    $('runner-pause').addEventListener('click', () => this._sceneCall('togglePause'));
    $('runner-quit').addEventListener('click', () => this._quit());
    $('runner-retry').addEventListener('click', () => this._restart());
    $('runner-exit').addEventListener('click', () => this._quit());

    // Auto-pause saat tab tersembunyi
    this._onVisibility = () => {
      if (document.hidden && this._state === 'running') {
        this._sceneCall('togglePause');
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _sceneCall(method, ...args) {
    const scene = this.game?.scene?.getScene('runner');
    if (scene && typeof scene[method] === 'function') scene[method](...args);
  }

  _quit() {
    this.events.emit('runner:quit');
  }

  _restart() {
    if (this._restarting) return;
    this._restarting = true;
    this._setState('ready');
    this._setScore(0);
    this._sceneCall('restartGame');
    setTimeout(() => {
      this._restarting = false;
    }, 400);
  }

  // ── Phaser ──────────────────────────────────────────────────

  async _startGame() {
    const stage = this.el.querySelector('#runner-stage');

    // Tunggu layout overlay selesai supaya ukuran stage akurat
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const width = Math.max(280, stage.clientWidth || window.innerWidth);
    const height = Math.max(320, stage.clientHeight || window.innerHeight);

    const Phaser = await import('phaser');
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: stage,
      width,
      height,
      backgroundColor: '#25634a',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: GRAVITY }, debug: false },
      },
      scene: [createRunnerScene(Phaser)],
      banner: false,
      audio: { noAudio: true },
    });

    // Komunikasi scene → HUD
    this.game.events.on('runner:state', (s) => this._setState(s));
    this.game.events.on('runner:score', (n) => this._setScore(n));
    this.game.events.on('runner:sfx', (name) => this._playSfx(name));
    this.game.events.on('runner:gameover', (payload) => this._onGameOver(payload));

    Logger.info('Runner', 'Mini-game started');
  }

  _destroyGame() {
    if (this._onVisibility) {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._onVisibility = null;
    }
    if (this.game) {
      try {
        this.game.destroy(true);
      } catch (e) {
        Logger.warn('Runner', 'Destroy game gagal', e.message);
      }
      this.game = null;
    }
  }

  // ── UI updates ──────────────────────────────────────────────

  _setScore(n) {
    const el = this.el?.querySelector('#runner-score');
    if (!el) return;
    el.textContent = n.toLocaleString();
    el.classList.remove('pop');
    // paksa reflow supaya animasi pop bisa diulang
    void el.offsetWidth;
    el.classList.add('pop');
  }

  _setState(state) {
    this._state = state;
    const overlay = this.el;
    if (!overlay) return;
    overlay.classList.toggle('is-ready', state === 'ready');
    overlay.classList.toggle('is-running', state === 'running');
    overlay.classList.toggle('is-paused', state === 'paused');
    overlay.classList.toggle('is-over', state === 'over');
    const pauseBtn = overlay.querySelector('#runner-pause');
    if (pauseBtn) pauseBtn.textContent = state === 'paused' ? '▶' : '⏸';
  }

  _onGameOver({ score, best, isNewBest }) {
    const el = this.el;
    if (!el) return;
    // Paksa tampilkan panel — tidak bergantung pada urutan event state
    el.classList.remove('is-ready', 'is-running', 'is-paused');
    el.classList.add('is-over');
    el.querySelector('#runner-final-score').textContent = score.toLocaleString();
    el.querySelector('#runner-final-best').textContent = 'Best: ' + best.toLocaleString();
    el.querySelector('#runner-new-best').classList.toggle('hidden', !isNewBest);
    this._setScore(score);
    try {
      this.events.emit('runner:gameOver', { score });
    } catch (e) {
      Logger.warn('Runner', 'Kredit skor gagal', e.message);
    }
  }

  // ── Efek suara ringan (Web Audio, opsional) ─────────────────

  _playSfx(name) {
    try {
      const ctx = this._audioCtx || (this._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      const defs = {
        jump: { type: 'square', f0: 520, f1: 880, dur: 0.12, vol: 0.045 },
        start: { type: 'triangle', f0: 440, f1: 660, dur: 0.15, vol: 0.05 },
        over: { type: 'sawtooth', f0: 300, f1: 90, dur: 0.5, vol: 0.05 },
      };
      const d = defs[name] || defs.jump;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      osc.type = d.type;
      osc.frequency.setValueAtTime(d.f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, d.f1), t + d.dur);
      gain.gain.setValueAtTime(d.vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d.dur);
      osc.start(t);
      osc.stop(t + d.dur);
    } catch (e) {
      /* audio tidak wajib */
    }
  }
}
