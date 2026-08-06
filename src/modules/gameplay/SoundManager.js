import { Logger } from '@utils/logger.js';
import { Config } from '@core/Config.js';

const MUSIC_SRC = `${import.meta.env.BASE_URL}assets/sounds/bg_morning.mp3`;
const TAP_SOUND_SRC = `${import.meta.env.BASE_URL}assets/sounds/fx_tap_frog.mp3`;
const MUSIC_GAP_MS = 5000;
const MUSIC_FADE_MS = 3000;

/**
 * SoundManager — Handles all game audio.
 * Uses Web Audio API for lightweight sound effects.
 */
export class SoundManager {
  constructor(eventBus) {
    this.events = eventBus;
    this._enabled = true;
    this._musicEnabled = true;
    this._musicVolume = 0.7;
    this._audioCtx = null;
    this._sounds = {};
    this._music = null;
    this._musicTimer = null;
    this._tapAudio = null;
    this._loadPrefs();
  }

  init() {
    // Create audio context on first user interaction
    this._initOnInteraction();
    Logger.info('SoundManager', 'Initialized');
  }

  _initOnInteraction() {
    const init = () => {
      if (!this._audioCtx) {
        try {
          this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          Logger.debug('SoundManager', 'AudioContext created');
        } catch (e) {
          Logger.warn('SoundManager', 'Web Audio not supported');
        }
      }
      this._startMusic();
      document.removeEventListener('touchstart', init);
      document.removeEventListener('click', init);
    };
    document.addEventListener('touchstart', init, { once: true });
    document.addEventListener('click', init, { once: true });
  }

  // ── Music (background loop with 5s gap) ──

  _startMusic() {
    if (!this._musicEnabled) return;
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
    }
    if (!this._music) {
      try {
        this._music = new Audio(MUSIC_SRC);
        this._music.preload = 'auto';
        this._music.volume = this._musicVolume;
        this._music.addEventListener('timeupdate', () => this._handleMusicTimeupdate());
        this._music.addEventListener('ended', () => this._scheduleMusicReplay());
      } catch (e) {
        Logger.warn('SoundManager', 'Music element gagal dibuat');
        return;
      }
    }
    this._music.volume = this._musicVolume;
    this._music.currentTime = 0;
    const p = this._music.play();
    if (p && p.catch) p.catch(() => { /* autoplay diblokir browser, coba lagi saat interaksi */ });
  }

  _handleMusicTimeupdate() {
    if (!this._musicEnabled || !this._music) return;
    const duration = this._music.duration;
    if (!duration || !isFinite(duration) || duration <= 0) return;
    const fadeSec = MUSIC_FADE_MS / 1000;
    const remaining = duration - this._music.currentTime;
    if (remaining > 0 && remaining <= fadeSec) {
      this._music.volume = Math.max(0, this._musicVolume * (remaining / fadeSec));
    }
  }

  _scheduleMusicReplay() {
    if (!this._musicEnabled) return;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    this._musicTimer = setTimeout(() => {
      this._musicTimer = null;
      this._startMusic();
    }, MUSIC_GAP_MS);
  }

  setMusicEnabled(enabled) {
    this._musicEnabled = !!enabled;
    this._savePrefs();
    if (!this._musicEnabled) {
      if (this._musicTimer) {
        clearTimeout(this._musicTimer);
        this._musicTimer = null;
      }
      try { this._music?.pause(); } catch (e) { /* ignore */ }
    } else {
      this._startMusic();
    }
    Logger.debug('SoundManager', 'Music ' + (this._musicEnabled ? 'enabled' : 'disabled'));
  }

  setMusicVolume(volume) {
    this._musicVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    if (this._music) this._music.volume = this._musicVolume;
    this._savePrefs();
  }

  getMusicVolume() {
    return this._musicVolume;
  }

  getState() {
    return {
      sound: this._enabled,
      music: this._musicEnabled,
      volume: this._musicVolume,
    };
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem(Config.STORAGE_KEY + ':audio');
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.sound === 'boolean') this._enabled = p.sound;
      if (typeof p.music === 'boolean') this._musicEnabled = p.music;
      if (typeof p.volume === 'number') this._musicVolume = Math.min(1, Math.max(0, p.volume));
    } catch (e) { /* ignore */ }
  }

  _savePrefs() {
    try {
      localStorage.setItem(Config.STORAGE_KEY + ':audio', JSON.stringify({
        sound: this._enabled,
        music: this._musicEnabled,
        volume: this._musicVolume,
      }));
    } catch (e) { /* ignore */ }
  }

  /**
   * Play a tap sound effect.
   */
  playTap() {
    if (!this._enabled) return;
    if (this._playTapFile()) return;
    if (!this._audioCtx) return;
    this._playFrog();
  }

  _playTapFile() {
    if (!this._tapAudio) {
      try {
        this._tapAudio = new Audio(TAP_SOUND_SRC);
        this._tapAudio.preload = 'auto';
      } catch (e) {
        return false;
      }
    }
    try {
      this._tapAudio.currentTime = 0;
      const p = this._tapAudio.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Play a reward/success sound.
   */
  playReward() {
    if (!this._enabled || !this._audioCtx) return;
    this._playChime();
  }

  /**
   * Play a button click sound.
   */
  playClick() {
    if (!this._enabled || !this._audioCtx) return;
    this._playClick();
  }

  /**
   * Play error sound.
   */
  playError() {
    if (!this._enabled || !this._audioCtx) return;
    this._playBonk();
  }

  // ── Sound generators ──

  _playFrog() {
    const ctx = this._audioCtx;
    const now = ctx.currentTime;

    // Triple croak "kro-krok-kek" with wobble — lucu dan ringan
    const freqs = [150, 130, 200];
    const durs = [0.14, 0.14, 0.1];
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.15;
      const dur = durs[i];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i], start);
      osc.frequency.exponentialRampToValueAtTime(80, start + dur);

      // Wobble 30Hz membuat suara khas katak
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(30, start);
      lfoGain.gain.setValueAtTime(0.16, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      osc.start(start);
      osc.stop(start + dur + 0.02);
      lfo.start(start);
      lfo.stop(start + dur + 0.02);
    }
  }

  _playChime() {
    const ctx = this._audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  _playClick() {
    const ctx = this._audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  _playBonk() {
    const ctx = this._audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // ── Controls ──

  setEnabled(enabled) {
    this._enabled = enabled;
    this._savePrefs();
    Logger.debug('SoundManager', 'Sound ' + (enabled ? 'enabled' : 'disabled'));
  }

  isEnabled() {
    return this._enabled;
  }

  isMusicEnabled() {
    return this._musicEnabled;
  }

  destroy() {
    if (this._musicTimer) {
      clearTimeout(this._musicTimer);
      this._musicTimer = null;
    }
    try { this._music?.pause(); } catch (e) { /* ignore */ }
    this._audioCtx?.close();
  }
}
