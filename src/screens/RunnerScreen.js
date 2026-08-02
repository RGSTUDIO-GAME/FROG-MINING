import { Logger } from '@utils/logger.js';

// ══════════════════════════════════════════════════════════════
// FROG RUNNER — mini-game (Chrome-Dino style)
// Aset A1 hanya untuk frog; semua aset lain dibuat sendiri.
// Skor mini-game dikreditkan ke Frog Mining (tanpa hitung tap).
// ══════════════════════════════════════════════════════════════

const RUNNER_BEST_KEY = 'frog-runner-best';

// ── Aset frog (A1) — tukar daftar frame di sini untuk ganti aset ──
const FRAME_DIR = `${import.meta.env.BASE_URL}assets/frog-runner/frames/`;
const ASSETS = {
  RUN: ['frog-r1-0.png', 'frog-r1-1.png', 'frog-r1-2.png', 'frog-r1-3.png'],
  DUCK: ['frog-r2-0.png', 'frog-r2-1.png', 'frog-r2-2.png', 'frog-r2-3.png'],
  JUMP: ['frog-r3-0.png', 'frog-r3-1.png', 'frog-r3-2.png'],
};

// Area visible frog di dalam frame 320×320 (diukur dari alpha).
const FRAME = { W: 320, H: 320 };
const FROG_BOUNDS = {
  run: { x: 31, y: 150, w: 258, h: 157 },
  duck: { x: 40, y: 265, w: 210, h: 43 },
  jump: { x: 35, y: 189, w: 250, h: 118 },
};

// Fisika & kesulitan
const GRAVITY = 2400;
const JUMP_VELOCITY = -830;
const BASE_SPEED = 300;
const MAX_SPEED = 600;
const SPEED_PER_SCORE = 0.12; // akselerasi per poin jarak
const COIN_SCORE = 50;
const OBSTACLE_GAP_MIN = 0.55; // detik antar rintangan
const OBSTACLE_GAP_RANDOM = 0.6;

// Rintangan buatan sendiri (bukan aset A1)
const OBSTACLES = {
  cactus: { tex: 'obs-cactus', w: 64, h: 120, body: { x: 12, y: 6, w: 40, h: 108 } },
  bird: { tex: 'obs-bird', w: 96, h: 56, body: { x: 6, y: 7, w: 84, h: 42 } },
  log: { tex: 'obs-log', w: 96, h: 40, body: { x: 3, y: 3, w: 90, h: 34 } },
};

const frameKey = (file) => file.replace('.png', '');

// ══════════════════════════════════════════════════════════════
// Scene Phaser (dibuat via factory supaya Phaser hanya di-load
// saat mini-game dibuka — dynamic import)
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
  }

  preload() {
    Object.values(ASSETS)
      .flat()
      .forEach((file) => this.load.image(frameKey(file), FRAME_DIR + file));
  }

  create() {
    // Scene instance dipakai ulang oleh scene.restart(), jadi semua state
    // harus di-reset di sini (bukan hanya di constructor).
    this.state = 'ready';
    this.ducking = false;
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this._lastScore = -1;
    this._jumpQueued = false;
    this._nextObstacleAt = 0;
    this._nextCoinAt = 0;
    this._coyoteUntil = 0;
    this._best = this._readBest();

    this._buildTextures();
    this._buildAnimations();
    this._initLayout();
    this._createPlayer();
    this._createObstacleGroups();
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

  // ── Aset buatan sendiri (texture generated) ────────────────

  _tex(key, w, h, draw) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  _buildTextures() {
    // pixel putih 1×1 (untuk hitbox statis)
    this._tex('pixel', 1, 1, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 1, 1);
    });

    // tanah: rumput + tanah berlumpur
    this._tex('ground-tile', 96, 64, (g) => {
      g.fillStyle(0x6b4f2a, 1);
      g.fillRect(0, 0, 96, 64);
      g.fillStyle(0x7d5a33, 1);
      for (let i = 0; i < 6; i++) {
        g.fillCircle(8 + i * 16, 30 + (i % 3) * 14, 4);
      }
      g.fillStyle(0x4a3b1f, 1);
      for (let i = 0; i < 5; i++) {
        g.fillRect(4 + i * 20, 44 + (i % 2) * 10, 10, 3);
      }
      g.fillStyle(0x52b788, 1);
      g.fillRect(0, 0, 96, 18);
      g.fillStyle(0x74c69d, 1);
      g.fillRect(0, 0, 96, 7);
    });

    // bukit latar (parallax jauh)
    this._tex('hill-far', 400, 220, (g) => {
      g.fillStyle(0x1e5038, 1);
      g.fillRect(0, 160, 400, 60);
      g.fillCircle(80, 170, 90);
      g.fillCircle(220, 170, 120);
      g.fillCircle(360, 170, 80);
    });

    // semak latar (parallax dekat)
    this._tex('hill-near', 320, 140, (g) => {
      g.fillStyle(0x1f3d2e, 1);
      g.fillRect(0, 100, 320, 40);
      g.fillCircle(60, 105, 60);
      g.fillCircle(170, 105, 80);
      g.fillCircle(280, 105, 55);
    });

    // kaktus (rintangan — lompat)
    this._tex('obs-cactus', 64, 120, (g) => {
      g.fillStyle(0x2d6a4f, 1);
      g.fillRoundedRect(18, 24, 28, 96, 12);
      g.fillRoundedRect(8, 52, 22, 12, 6);
      g.fillRoundedRect(8, 40, 12, 24, 6);
      g.fillRoundedRect(34, 64, 22, 12, 6);
      g.fillRoundedRect(44, 52, 12, 24, 6);
      g.fillStyle(0x52b788, 1);
      g.fillRoundedRect(23, 32, 8, 78, 4);
    });

    // burung (rintangan — jongkok)
    this._tex('obs-bird', 96, 56, (g) => {
      g.fillStyle(0x3a2d4d, 1);
      g.fillEllipse(48, 28, 72, 40);
      g.fillEllipse(24, 26, 44, 26);
      g.fillStyle(0xf4845f, 1);
      g.fillTriangle(84, 30, 96, 26, 96, 36);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(68, 20, 7);
      g.fillStyle(0x1b4332, 1);
      g.fillCircle(70, 20, 3.5);
    });

    // batang kayu (rintangan — jongkok)
    this._tex('obs-log', 96, 40, (g) => {
      g.fillStyle(0x8a5a2b, 1);
      g.fillRoundedRect(0, 4, 96, 32, 12);
      g.fillStyle(0x6e3f1a, 1);
      g.fillEllipse(16, 20, 20, 24);
      g.fillEllipse(52, 20, 18, 22);
      g.fillEllipse(84, 20, 16, 20);
      g.fillStyle(0xa97c50, 1);
      g.fillRect(2, 8, 92, 4);
    });

    // koin bonus
    this._tex('coin', 40, 40, (g) => {
      g.fillStyle(0xd4a017, 1);
      g.fillCircle(20, 20, 17);
      g.fillStyle(0xf0c040, 1);
      g.fillCircle(20, 20, 12);
      g.fillStyle(0xd4a017, 1);
      g.fillCircle(20, 20, 8);
      g.fillStyle(0xffe28a, 1);
      g.fillCircle(14, 14, 4);
    });
  }

  _buildAnimations() {
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: ASSETS.RUN.map((f) => ({ key: frameKey(f) })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('duck')) {
      this.anims.create({
        key: 'duck',
        frames: ASSETS.DUCK.map((f) => ({ key: frameKey(f) })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('jump')) {
      this.anims.create({
        key: 'jump',
        frames: ASSETS.JUMP.map((f) => ({ key: frameKey(f) })),
        frameRate: 14,
        repeat: 0,
      });
    }
  }

  // ── Layout ──────────────────────────────────────────────────

  _initLayout() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.width = w;
    this.height = h;
    this.groundY = h - Math.max(76, Math.round(h * 0.13));
    this.frogScale = Phaser.Math.Clamp((h * 0.12) / FROG_BOUNDS.run.h, 0.38, 0.68);
    this.frogX = Math.max(64, Math.round(w * 0.24));

    this.physics.world.setBounds(0, 0, w, h);
    this.cameras.main.setBackgroundColor('#2d6a4f');

    // Parallax latar
    this.hillsFar = this.add.tileSprite(w / 2, this.groundY - h * 0.32, w, h * 0.26, 'hill-far')
      .setOrigin(0.5, 0.5).setAlpha(0.55);
    this.hillsNear = this.add.tileSprite(w / 2, this.groundY - h * 0.15, w, h * 0.16, 'hill-near')
      .setOrigin(0.5, 0.5).setAlpha(0.7);

    // Tanah (visual bergerak + hitbox statis)
    this.ground = this.add.tileSprite(w / 2, this.groundY + (h - this.groundY) / 2, w, h - this.groundY, 'ground-tile');
    this.ground.setOrigin(0.5, 0.5);
    this.groundHit = this.physics.add.staticImage(w / 2, this.groundY + 28, 'pixel');
    this.groundHit.setDisplaySize(w + 400, 56);
    this.groundHit.refreshBody();
    this.groundHit.visible = false;
  }

  _createPlayer() {
    this.frog = this.physics.add.sprite(this.frogX, this.groundY - (FRAME.H - 13) * this.frogScale, frameKey(ASSETS.RUN[0]));
    this.frog.setOrigin(0.5, 0.5);
    this.frog.setScale(this.frogScale);
    this.frog.setDepth(10);
    this.frog.setCollideWorldBounds(true);
    this._applyBody('run');
    this.physics.add.collider(this.frog, this.groundHit);
    this.frog.play('run');
  }

  _createObstacleGroups() {
    this.obstacles = this.physics.add.group({ allowGravity: false });
    this.coins = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.frog, this.obstacles, () => this._gameOver());
    this.physics.add.overlap(this.frog, this.coins, (_frog, coin) => this._collectCoin(coin));
  }

  _applyBody(mode) {
    const b = FROG_BOUNDS[mode];
    const s = this.frogScale;
    const padX = 16 * s;
    const padY = 14 * s;
    const bodyW = Math.max(16, b.w * s - padX);
    const bodyH = Math.max(10, b.h * s - padY);
    this.frog.body.setSize(bodyW, bodyH);
    this.frog.body.setOffset(b.x * s + padX / 2, b.y * s + padY / 2);
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
    this._emitSfx('jump');
  }

  _start() {
    this.state = 'running';
    this.speed = BASE_SPEED;
    this._nextObstacleAt = this.distance + 35;
    this._nextCoinAt = this.distance + 140;
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
    const pool = ['cactus', 'bird', 'bird', 'cactus', 'log', 'log'];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const def = OBSTACLES[type];
    const s = this._obstacleScale(type);
    const x = this.width + 100;
    let y = this.groundY;
    if (type === 'bird' || type === 'log') {
      const duckH = FROG_BOUNDS.duck.h * this.frogScale;
      y = this.groundY - duckH - 6 - (def.h * s) / 2;
    } else {
      y = this.groundY - (def.h * s) / 2;
    }

    const obs = this.obstacles.create(x, y, def.tex);
    this._setupObstacle(obs, def, s);

    // Kadang rintangan kaktus ganda
    if (type === 'cactus' && Math.random() < 0.25) {
      const second = this.obstacles.create(x + 74 + Math.random() * 42, y, def.tex);
      this._setupObstacle(second, def, s);
    }

    this._nextObstacleAt = this.distance + (this.speed * (OBSTACLE_GAP_MIN + Math.random() * OBSTACLE_GAP_RANDOM)) / 10;
  }

  _setupObstacle(obs, def, s) {
    obs.setScale(s);
    obs.setDepth(5);
    obs.body.setAllowGravity(false);
    obs.body.setSize(def.body.w * s, def.body.h * s);
    obs.body.setOffset(def.body.x * s, def.body.y * s);
    obs.body.setVelocityX(-this.speed);
  }

  _obstacleScale(type) {
    const h = this.height;
    if (type === 'cactus') return Phaser.Math.Clamp((h * 0.15) / OBSTACLES.cactus.h, 0.55, 1.05);
    if (type === 'bird') return Phaser.Math.Clamp((h * 0.075) / OBSTACLES.bird.h, 0.5, 1.0);
    return Phaser.Math.Clamp((h * 0.06) / OBSTACLES.log.h, 0.5, 1.0);
  }

  _spawnCoins() {
    const n = 3 + Math.floor(Math.random() * 3);
    const y = this.groundY - Math.min(122, this.height * 0.2);
    for (let i = 0; i < n; i++) {
      const coin = this.coins.create(this.width + 130 + i * 40, y, 'coin');
      coin.setScale(0.75);
      coin.setDepth(4);
      coin.body.setAllowGravity(false);
      coin.body.setVelocityX(-this.speed);
    }
    this._nextCoinAt = this.distance + (this.speed * (5 + Math.random() * 6)) / 10;
  }

  // ── Gameplay ────────────────────────────────────────────────

  update(time, delta) {
    if (this.state !== 'running') return;

    const dt = Math.min(delta, 34) / 1000;
    this.distance += this.speed * dt * 0.1;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * SPEED_PER_SCORE);
    this.score = Math.floor(this.distance);

    // Parallax & tanah
    this.hillsFar.tilePositionX -= this.speed * dt * 0.18;
    this.hillsNear.tilePositionX -= this.speed * dt * 0.38;
    this.ground.tilePositionX -= this.speed * dt;

    // Sinkronkan kecepatan semua objek
    this.obstacles.getChildren().forEach((o) => {
      if (o.active) o.body.setVelocityX(-this.speed);
    });
    this.coins.getChildren().forEach((c) => {
      if (c.active) c.body.setVelocityX(-this.speed);
    });

    // Spawn & bersihkan
    if (this.distance >= this._nextObstacleAt) this._spawnObstacle();
    if (this.distance >= this._nextCoinAt) this._spawnCoins();
    this.obstacles.getChildren().forEach((o) => { if (o.x < -140) o.destroy(); });
    this.coins.getChildren().forEach((c) => { if (c.x < -100) c.destroy(); });

    // Lompat: coyote time + buffering
    if (this._grounded()) {
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
      } else if (this.frog.anims.currentAnim?.key !== 'run') {
        this.frog.play('run');
      }
    } else if (this.frog.anims.currentAnim?.key !== 'jump') {
      this.frog.play('jump');
    }
  }

  _collectCoin(_frog, coin) {
    if (!coin.active) return;
    coin.destroy();
    this.distance += COIN_SCORE;
    this.score = Math.floor(this.distance);
    this.game.events.emit('runner:score', this.score);
    this._emitSfx('coin');
  }

  _gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.ducking = false;
    this.frog.setTint(0xff7a6b);
    this.frog.setVelocityY(-480);
    this._emitSfx('over');

    this.time.delayedCall(260, () => {
      this.physics.pause();
      this.anims.pauseAll();
    });

    const score = this.score;
    const isNewBest = score > this._best;
    const best = Math.max(this._best, score);
    this._best = best;
    try {
      localStorage.setItem(RUNNER_BEST_KEY, String(best));
    } catch (e) {
      /* storage penuh / private mode */
    }

    this.game.events.emit('runner:gameover', { score, best, isNewBest });
    this._emitState('over');
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
    this._setState('ready');
    this._setScore(0);
    this._sceneCall('restartGame');
  }

  // ── Phaser ──────────────────────────────────────────────────

  async _startGame() {
    const stage = this.el.querySelector('#runner-stage');

    // Tunggu layout overlay selesai supaya ukuran stage akurat
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const width = Math.max(280, stage.clientWidth || window.innerWidth);
    const height = Math.max(320, stage.clientHeight || window.innerHeight - 140);

    const Phaser = await import('phaser');
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: stage,
      width,
      height,
      backgroundColor: '#2d6a4f',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
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
    if (el) el.textContent = n.toLocaleString();
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
    el.querySelector('#runner-final-score').textContent = score.toLocaleString();
    el.querySelector('#runner-final-best').textContent = 'Best: ' + best.toLocaleString();
    el.querySelector('#runner-new-best').classList.toggle('hidden', !isNewBest);
    this._setScore(score);
    this.events.emit('runner:gameOver', { score });
  }

  // ── Efek suara ringan (Web Audio, opsional) ─────────────────

  _playSfx(name) {
    try {
      const ctx = this._audioCtx || (this._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      const defs = {
        jump: { type: 'square', f0: 520, f1: 880, dur: 0.12, vol: 0.045 },
        coin: { type: 'sine', f0: 880, f1: 1320, dur: 0.14, vol: 0.06 },
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
