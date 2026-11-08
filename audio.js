/* ============================================================================
 * audio.js — Procedural Web Audio engine for the Diwali experience.
 * ----------------------------------------------------------------------------
 * 100% synthesised with the Web Audio API (no external audio files needed):
 *   • Rocket launch whoosh        • Sky explosion booms
 *   • Sparkle / crackle ticks     • Chakri whirr (looping)
 *   • Fountain hiss (looping)     • A gentle festive background raga loop
 *
 * SAFETY: this module only generates sound. It never controls, ignites or
 * communicates with any real firecracker or explosive device.
 * ==========================================================================*/

const SCALE = [0, 2, 3, 5, 7, 8, 10, 12]; // Bhairavi-flavoured scale (semitones)
const ROOT_HZ = 174.61; // F3 — warm, festive root note

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.masterGain = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;

    this.volume = 0.7;
    this.sfxEnabled = false;
    this.musicEnabled = false;

    this._loops = new Map();
    this._musicTimer = null;
    this._musicStep = 0;
    this._nextNoteTime = 0;
  }

  /* ---------------------------------------------------------------- context */

  /** Must be called from a real user gesture (click / touch / key press). */
  init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    this.ctx = new Ctx({ latencyHint: 'interactive' });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._curve(this.volume);
    this.masterGain.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxEnabled ? 1 : 0;
    this.sfxBus.connect(this.masterGain);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.masterGain);

    this.noiseBuffer = this._makeNoise(2.5);

    this.ready = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  _curve(v) { return Math.pow(Math.max(0, Math.min(1, v)), 1.5) * 0.95; }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---------------------------------------------------------------- routing */

  setMasterVolume(v01) {
    this.volume = Math.max(0, Math.min(1, v01));
    if (!this.ready) return;
    this.masterGain.gain.setTargetAtTime(this._curve(this.volume), this.now, 0.05);
  }

  setSfx(on) {
    this.sfxEnabled = !!on;
    if (!this.ready) return;
    this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.now, 0.08);
  }

  setMusic(on) {
    this.musicEnabled = !!on;
    if (!this.ready) return;
    if (on) {
      this.startMusic();
    } else {
      this.musicBus.gain.setTargetAtTime(0, this.now, 0.4);
      this._stopScheduler();
    }
  }

  /* ------------------------------------------------------------ primitives */

  // Builds a noise source but never starts it — each caller schedules its own
  // start time (so a source is started exactly once).
  _noise(_duration, loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  _osc(type, freq, t) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    return o;
  }

  _gain(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  /** Attack / decay envelope helper. */
  _env(gain, t, attack, decay, peak = 1) {
    const p = gain.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    p.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /* -------------------------------------------------------------------- SFX */

  /** Deep boom + crackle tail. `size` 0..1 scales the whole explosion. */
  explosion(size = 0.7) {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    const s = 0.35 + size * 0.65;

    // 1. Body — filtered noise burst
    const n = this._noise(1.2);
    const lp = this._filter('lowpass', 1800 * s + 500, 0.9);
    lp.frequency.setValueAtTime(3400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.75 * s);
    const ng = this._gain(0);
    this._env(ng, t, 0.006, 0.95 * s, 0.85 * s);
    n.connect(lp).connect(ng).connect(this.sfxBus);
    n.start(t); n.stop(t + 1.4);

    // 2. Thump — pitch-sweeping sine
    const o = this._osc('sine', 130 * s + 45, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    const og = this._gain(0);
    this._env(og, t, 0.004, 0.5 * s, 0.9);
    o.connect(og).connect(this.sfxBus);
    o.start(t); o.stop(t + 0.7);

    // 3. Crackle tail — sparse high noise ticks
    const ticks = Math.round(14 + size * 26);
    for (let i = 0; i < ticks; i++) {
      const tt = t + 0.05 + Math.random() * (0.9 * s);
      const tn = this._noise(0.05);
      const hp = this._filter('highpass', 2200 + Math.random() * 3500, 2);
      const tg = this._gain(0);
      this._env(tg, tt, 0.002, 0.05, 0.12 + Math.random() * 0.16);
      tn.connect(hp).connect(tg).connect(this.sfxBus);
      tn.start(tt); tn.stop(tt + 0.08);
    }
  }

  /** Rising whoosh for ascending rockets. */
  rocketLaunch() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;

    const n = this._noise(1.6);
    const bp = this._filter('bandpass', 500, 1.2);
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 1.1);
    const ng = this._gain(0);
    this._env(ng, t, 0.06, 1.1, 0.34);
    n.connect(bp).connect(ng).connect(this.sfxBus);
    n.start(t); n.stop(t + 1.4);

    const o = this._osc('sawtooth', 120, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 1.05);
    const lp = this._filter('lowpass', 1400, 3);
    const og = this._gain(0);
    this._env(og, t, 0.05, 1.0, 0.10);
    o.connect(lp).connect(og).connect(this.sfxBus);
    o.start(t); o.stop(t + 1.3);
  }

  /** Short bright sparkle — used by chakri, sparklers and small bursts. */
  sparkle(n = 1, bright = 1) {
    if (!this.ready || !this.sfxEnabled) return;
    const t0 = this.now;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.012 + Math.random() * 0.05);
      const src = this._noise(0.09);
      const hp = this._filter('highpass', 3000 + Math.random() * 4000, 1.5);
      const g = this._gain(0);
      this._env(g, t, 0.001, 0.06 + Math.random() * 0.06, (0.06 + Math.random() * 0.1) * bright);
      src.connect(hp).connect(g).connect(this.sfxBus);
      src.start(t); src.stop(t + 0.14);
    }
  }

  /** Dry crackle — sparkler style. */
  crackle(strength = 1) {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    const src = this._noise(0.06);
    const bp = this._filter('bandpass', 1800 + Math.random() * 2200, 6);
    const g = this._gain(0);
    this._env(g, t, 0.001, 0.035, 0.05 + Math.random() * 0.09 * strength);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t); src.stop(t + 0.08);
  }

  /** Huge digital blast — Virtual Blast cracker. */
  blast() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;

    // sub drop
    const o = this._osc('sine', 200, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 0.9);
    const og = this._gain(0);
    this._env(og, t, 0.003, 1.0, 1.0);
    o.connect(og).connect(this.sfxBus);
    o.start(t); o.stop(t + 1.2);

    // wide noise wall
    const n = this._noise(1.6);
    const bp = this._filter('lowpass', 2600, 0.8);
    bp.frequency.setValueAtTime(6000, t);
    bp.frequency.exponentialRampToValueAtTime(160, t + 1.1);
    const ng = this._gain(0);
    this._env(ng, t, 0.004, 1.3, 1.0);
    n.connect(bp).connect(ng).connect(this.sfxBus);
    n.start(t); n.stop(t + 1.7);

    // metallic sheen
    for (let i = 0; i < 5; i++) {
      const tt = t + 0.02 + i * 0.035;
      const so = this._osc('triangle', 900 + i * 420, tt);
      const sg = this._gain(0);
      this._env(sg, tt, 0.002, 0.28, 0.14);
      so.connect(sg).connect(this.sfxBus);
      so.start(tt); so.stop(tt + 0.4);
    }
    this.explosion(1);
  }

  _noiseHit(t, filterType, cutoff, duration, peak, q = 1, endCutoff = null) {
    const src = this._noise(duration);
    const filter = this._filter(filterType, cutoff, q);
    if (endCutoff) {
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(endCutoff, t + duration * 0.82);
    }
    const gain = this._gain(0);
    this._env(gain, t, Math.min(0.012, duration * 0.08), duration, peak);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration);
  }

  _toneHit(t, type, frequency, endFrequency, duration, peak) {
    const osc = this._osc(type, frequency, t);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, t + duration * 0.82);
    const gain = this._gain(0);
    this._env(gain, t, Math.min(0.01, duration * 0.06), duration, peak);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + duration);
  }

  bijiliSnap() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._noiseHit(t, 'highpass', 4800, 0.11, 0.34, 1.4);
    this._noiseHit(t + 0.018, 'bandpass', 1800, 0.17, 0.14, 5);
    this._toneHit(t, 'triangle', 1900, 720, 0.08, 0.055);
  }

  sutliFuse() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._noiseHit(t, 'highpass', 3200, 1.2, 0.07, 2, 6200);
    for (let i = 0; i < 5; i++) this._noiseHit(t + i * 0.22, 'bandpass', 2700 + i * 160, 0.045, 0.08, 5);
  }

  sutliBoom() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._toneHit(t, 'sine', 105, 26, 0.9, 0.82);
    this._noiseHit(t, 'lowpass', 1700, 0.78, 0.62, 0.8, 130);
    this._noiseHit(t + 0.035, 'highpass', 1600, 0.2, 0.16, 1.3);
  }

  pencilWhistle() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._toneHit(t, 'sawtooth', 240, 1760, 1.75, 0.085);
    this._noiseHit(t, 'bandpass', 850, 1.4, 0.09, 1.2, 3400);
  }

  groundChakkar() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._noiseHit(t, 'bandpass', 760, 2.9, 0.13, 5, 2500);
    this._toneHit(t, 'sawtooth', 68, 310, 2.5, 0.045);
    this._toneHit(t + 0.18, 'triangle', 540, 180, 2.1, 0.035);
  }

  sevenShot() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.34;
      this._noiseHit(at, 'bandpass', 1100 + i * 420, 0.18, 0.15, 2.2);
      this._toneHit(at, 'sine', 120 + i * 16, 48, 0.24, 0.21);
    }
  }

  skyShot() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._noiseHit(t, 'bandpass', 460, 1.35, 0.2, 1.4, 3200);
    this._toneHit(t, 'sine', 190, 920, 1.15, 0.075);
  }

  skyShotBurst() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [1320, 1760, 2210, 2640].forEach((freq, i) => {
      this._toneHit(t + i * 0.045, 'triangle', freq, freq * 0.76, 0.32, 0.075);
    });
    this._noiseHit(t, 'highpass', 3600, 0.22, 0.1, 1.1);
  }

  colorSmoke() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    this._noiseHit(t, 'lowpass', 920, 3.2, 0.11, 0.7, 360);
    this._toneHit(t, 'sine', 145, 230, 2.8, 0.035);
    this._toneHit(t + 0.12, 'sine', 218, 170, 2.5, 0.025);
  }

  goldenRain() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [660, 880, 990, 1320, 1100, 1480, 1760].forEach((freq, i) => {
      this._toneHit(t + i * 0.14, 'sine', freq, freq * 0.98, 0.75, 0.085 / (1 + i * 0.12));
    });
    this._noiseHit(t + 0.45, 'highpass', 5200, 1.3, 0.035, 1.8);
  }

  twinklingStar() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [1568, 2093, 2637, 3136, 2349].forEach((freq, i) => {
      this._toneHit(t + i * 0.12, 'triangle', freq, freq * 1.015, 0.52, 0.075);
    });
    this._noiseHit(t, 'highpass', 6200, 0.55, 0.035, 2.5);
  }

  multiShot() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [0, 0.56, 1.12].forEach((delay, i) => {
      this._noiseHit(t + delay, 'bandpass', 520 + i * 220, 0.82, 0.12, 1.1, 2800);
      this._toneHit(t + delay, 'sawtooth', 110 + i * 45, 780 + i * 160, 0.72, 0.055);
    });
  }

  flowerShower() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [1046, 988, 784, 659, 523, 392].forEach((freq, i) => {
      this._toneHit(t + i * 0.16, 'sine', freq, freq * 0.94, 0.62, 0.065);
    });
    this._noiseHit(t + 0.18, 'highpass', 4800, 1.1, 0.035, 2.4);
  }

  rainbowFountain() {
    if (!this.ready || !this.sfxEnabled) return;
    const t = this.now;
    [392, 494, 587, 784, 988, 1175, 1568].forEach((freq, i) => {
      this._toneHit(t + i * 0.17, 'triangle', freq, freq * 1.025, 0.58, 0.055);
    });
    this._noiseHit(t, 'bandpass', 1250, 2.2, 0.06, 1.2, 5100);
  }

  /* ------------------------------------------------------------ long loops */

  /**
   * Start a continuous sound. ids: 'chakri' | 'fountain' | 'sparkler'
   */
  startLoop(id, opts = {}) {
    if (!this.ready || !this.sfxEnabled) return;
    if (this._loops.has(id)) return;

    if (id === 'sparkler') {
      const due = () => {
        const h = this._loops.get('sparkler');
        if (!h) return;
        this.crackle(1);
        if (Math.random() < 0.5) this.sparkle(1, 0.6);
        h.timer = setTimeout(due, 45 + Math.random() * 120);
      };
      const h = { timer: null };
      this._loops.set('sparkler', h);
      due();
      return;
    }

    const t = this.now;
    const src = this._noise(1, true);
    const g = this._gain(0);
    let filter, lfo, lfoGain, extra;

    if (id === 'chakri') {
      filter = this._filter('bandpass', 900, 4);
      src.connect(filter).connect(g).connect(this.sfxBus);
      // mechanical whirr
      extra = this._osc('sawtooth', 96, t);
      const eg = this._gain(0.05);
      extra.connect(eg).connect(this.sfxBus);
      extra.start(t);
      // wobble
      lfo = this._osc('sine', 11, t);
      lfoGain = this._gain(420);
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start(t);
      g.gain.setTargetAtTime(0.30, t, 0.12);
      src.start(t);
      this._loops.set(id, { src, g, lfo, lfoGain, extra, eg });
      return;
    }

    if (id === 'fountain') {
      filter = this._filter('highpass', 1400, 1.1);
      src.connect(filter).connect(g).connect(this.sfxBus);
      const sweep = this._osc('sine', 0.6, t);
      const sweepGain = this._gain(900);
      sweep.connect(sweepGain).connect(filter.frequency);
      sweep.start(t);
      lfo = sweep; lfoGain = sweepGain;
      g.gain.setTargetAtTime(0.26, t, 0.15);
      src.start(t);
      this._loops.set(id, { src, g, lfo, lfoGain });
      return;
    }

    src.connect(g).connect(this.sfxBus);
    g.gain.setTargetAtTime(0.2, t, 0.1);
    this._loops.set(id, { src, g });
    src.start(t);
  }

  stopLoop(id) {
    const h = this._loops.get(id);
    if (!h) return;
    this._loops.delete(id);
    if (h.timer) { clearTimeout(h.timer); return; }
    const t = this.now;
    try { h.g.gain.setTargetAtTime(0, t, 0.09); } catch (e) { /* noop */ }
    const stopAt = t + 0.5;
    if (h.src) { try { h.src.stop(stopAt); } catch (e) { /* noop */ } }
    if (h.extra) { try { h.extra.stop(stopAt); } catch (e) { /* noop */ } }
    if (h.lfo) { try { h.lfo.stop(stopAt); } catch (e) { /* noop */ } }
  }

  stopAllLoops() { Array.from(this._loops.keys()).forEach((k) => this.stopLoop(k)); }

  /* --------------------------------------------------------- background music */

  startMusic() {
    if (!this.ready) return;
    this.musicBus.gain.setTargetAtTime(0.55, this.now, 0.8);
    if (this._musicTimer) return;
    this._musicStep = 0;
    this._nextNoteTime = this.now + 0.1;

    // Tanpura-style drone (root + fifth), permanent for the loop lifetime.
    this._startDrone();

    const lookahead = 0.25;
    this._musicTimer = setInterval(() => {
      const beat = 0.5; // 120 BPM
      while (this._nextNoteTime < this.now + lookahead) {
        this._scheduleBeat(this._musicStep, this._nextNoteTime);
        this._musicStep++;
        this._nextNoteTime += beat / 2; // eighth notes
      }
    }, 60);
  }

  _startDrone() {
    if (this._drone) return;
    const t = this.now;
    const g = this._gain(0.10);
    const a = this._osc('sine', ROOT_HZ, t);
    const b = this._osc('sine', ROOT_HZ * 1.5, t);
    const lfo = this._osc('sine', 0.18, t);
    const lfoGain = this._gain(2.4);
    lfo.connect(lfoGain).connect(b.frequency);
    a.connect(g); b.connect(g);
    g.connect(this.musicBus);
    a.start(t); b.start(t); lfo.start(t);
    this._drone = { g, a, b, lfo };
  }

  _scheduleBeat(step, time) {
    const eighth = step % 8;
    const bar = Math.floor(step / 8);

    // Melody — every other eighth for a relaxed phrase.
    if (eighth % 2 === 0 || Math.random() < 0.35) {
      const deg = SCALE[(bar * 3 + step) % SCALE.length];
      const octave = Math.random() < 0.25 ? 2 : 1;
      const freq = ROOT_HZ * Math.pow(2, deg / 12) * octave;
      this._pluck(freq, time, 0.55 + Math.random() * 0.3);
    }

    // Tabla — downbeat + syncopated accents.
    if (eighth === 0 || eighth === 3 || eighth === 6) this._tabla(time, 0.9);
    else if (Math.random() < 0.25) this._tabla(time, 0.45);

    // Occasional bell accent at the top of a bar.
    if (eighth === 0 && bar % 2 === 1) this._bell(ROOT_HZ * 4, time);
  }

  _pluck(freq, t, amp) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = this._gain(0);
    const f = this._filter('lowpass', 2600, 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.85);
  }

  _bell(freq, t) {
    [1, 2.01, 3.02].forEach((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * m;
      const g = this._gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + 1.5);
    });
  }

  _tabla(t, amp) {
    const o = this._osc('sine', 180, t);
    o.frequency.exponentialRampToValueAtTime(62, t + 0.16);
    const g = this._gain(0);
    this._env(g, t, 0.002, 0.2, 0.3 * amp);
    o.connect(g).connect(this.musicBus);
    o.start(t); o.stop(t + 0.3);

    const n = this._noise(0.06);
    const bp = this._filter('bandpass', 5200, 1.4);
    const ng = this._gain(0);
    this._env(ng, t, 0.001, 0.05, 0.055 * amp);
    n.connect(bp).connect(ng).connect(this.musicBus);
    n.start(t); n.stop(t + 0.09);
  }

  _stopScheduler() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  }

  stopMusic() {
    this._stopScheduler();
    this.musicEnabled = false;
    if (!this.ready) return;
    this.musicBus.gain.setTargetAtTime(0, this.now, 0.3);
  }

  /* ------------------------------------------------------------- slow-mo */

  /**
   * Cinematic slow-motion treatment. Sweeps a low-pass filter over the whole
   * mix and plays a short cue so the effect is felt, not just seen.
   */
  slowMo(on) {
    if (!this.ready) return;
    const t = this.now;

    // Lazily route the master through a filter we can sweep.
    if (!this._slowFilter) {
      this._slowFilter = this.ctx.createBiquadFilter();
      this._slowFilter.type = 'lowpass';
      this._slowFilter.frequency.value = 20000;
      this._slowFilter.Q.value = 0.6;
      try { this.masterGain.disconnect(); } catch (e) { /* not connected yet */ }
      this.masterGain.connect(this._slowFilter);
      this._slowFilter.connect(this.ctx.destination);
    }

    this._slowFilter.frequency.cancelScheduledValues(t);
    if (on) {
      this._slowFilter.frequency.setTargetAtTime(760, t, 0.25);
      this._slowMoCue(true);
    } else {
      this._slowFilter.frequency.setTargetAtTime(20000, t, 0.35);
      this._slowMoCue(false);
    }
  }

  _slowMoCue(entering) {
    const t = this.now;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(entering ? 880 : 260, t);
    o.frequency.exponentialRampToValueAtTime(entering ? 220 : 780, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.6);
  }
}

export default AudioEngine;
