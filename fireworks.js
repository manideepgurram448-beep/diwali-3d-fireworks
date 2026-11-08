/* ============================================================================
 * fireworks.js — Realistic particle fireworks engine built on Three.js.
 * ----------------------------------------------------------------------------
 *  • Pooled GPU particle systems (sparks + smoke) — no per-frame allocations
 *  • Realistic physics: gravity, air drag, lifetime fades, flicker
 *  • Many distinct explosion patterns (sphere, ring, willow, palm, heart, star…)
 *  • Rocket trails, continuous emitters, shockwave rings, dynamic light flashes
 *
 * SAFETY: purely a visual particle simulator. No real pyrotechnics are
 * involved, controlled or referenced at runtime.
 * ==========================================================================*/

import * as THREE from 'three';

/* ------------------------------------------------------------------ palettes */

export const PALETTES = {
  gold:      [[1.00, 0.82, 0.32], [1.00, 0.94, 0.66], [1.00, 0.64, 0.14]],
  silver:    [[0.92, 0.95, 1.00], [1.00, 1.00, 1.00], [0.72, 0.78, 0.90]],
  saffron:   [[1.00, 0.56, 0.12], [1.00, 0.79, 0.28], [1.00, 0.34, 0.06]],
  emerald:   [[0.24, 1.00, 0.55], [0.62, 1.00, 0.82], [0.08, 0.86, 0.40]],
  sapphire:  [[0.26, 0.60, 1.00], [0.64, 0.86, 1.00], [0.14, 0.34, 1.00]],
  magenta:   [[1.00, 0.24, 0.76], [1.00, 0.62, 0.90], [0.70, 0.10, 0.92]],
  crimson:   [[1.00, 0.20, 0.22], [1.00, 0.56, 0.42], [0.82, 0.06, 0.16]],
  violet:    [[0.66, 0.30, 1.00], [0.86, 0.62, 1.00], [0.44, 0.14, 0.92]],
  ice:       [[0.70, 0.94, 1.00], [1.00, 1.00, 1.00], [0.48, 0.80, 1.00]],
  rainbow:   [[1.00, 0.34, 0.34], [1.00, 0.82, 0.28], [0.42, 1.00, 0.52], [0.40, 0.78, 1.00], [0.82, 0.48, 1.00]],
};

const ALL_PALETTE_NAMES = Object.keys(PALETTES);
export function randomPalette(rng = Math.random) {
  return PALETTES[ALL_PALETTE_NAMES[(rng() * ALL_PALETTE_NAMES.length) | 0]];
}

/** Patterns that read well as an aerial shell break. */
const PATTERNS_FOR_SHELL = ['sphere', 'chrysanthemum', 'doubleRing', 'willow', 'palm', 'star', 'ring'];

/* ------------------------------------------------------------------ textures */

function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export const TEX = {
  spark: radialTexture(64, [
    [0.0, 'rgba(255,255,255,1)'],
    [0.22, 'rgba(255,255,255,0.92)'],
    [0.55, 'rgba(255,255,255,0.28)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]),
  soft: radialTexture(128, [
    [0.0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(255,255,255,0.62)'],
    [0.5, 'rgba(255,255,255,0.16)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]),
  smoke: radialTexture(128, [
    [0.0, 'rgba(255,255,255,0.55)'],
    [0.45, 'rgba(255,255,255,0.22)'],
    [0.78, 'rgba(255,255,255,0.06)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]),
};

/* --------------------------------------------------------------- particle pool */

const VERT = /* glsl */`
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uSizeScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uSizeScale / max(-mv.z, 0.15);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uTexture;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uTexture, gl_PointCoord);
    float a = t.a * vAlpha;
    if (a < 0.008) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
  }
`;

export class ParticlePool {
  constructor(max, texture, blending, sizeScale = 700) {
    this.max = max;
    this.count = 0;

    this.position = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);

    this.velocity = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.lifeMax = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max);
    this.flick = new Float32Array(max);
    this.grow = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uSizeScale: { value: sizeScale },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending,
    });

    this.geometry = geo;
    this.material = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setSizeScale(v) { this.material.uniforms.uSizeScale.value = v; }

  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, drag, grav, flick, grow) {
    const n = this.count;
    if (n >= this.max) return;
    const i = n, i3 = i * 3;

    this.position[i3] = x; this.position[i3 + 1] = y; this.position[i3 + 2] = z;
    this.velocity[i3] = vx; this.velocity[i3 + 1] = vy; this.velocity[i3 + 2] = vz;
    this.color[i3] = r; this.color[i3 + 1] = g; this.color[i3 + 2] = b;
    this.base[i] = size;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.lifeMax[i] = life;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.flick[i] = flick || 0;
    this.grow[i] = grow || 0;
    this.count = n + 1;
  }

  _copy(from, to) {
    const f3 = from * 3, t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.position[t3 + k] = this.position[f3 + k];
      this.velocity[t3 + k] = this.velocity[f3 + k];
      this.color[t3 + k] = this.color[f3 + k];
    }
    this.size[to] = this.size[from];
    this.alpha[to] = this.alpha[from];
    this.life[to] = this.life[from];
    this.lifeMax[to] = this.lifeMax[from];
    this.drag[to] = this.drag[from];
    this.grav[to] = this.grav[from];
    this.base[to] = this.base[from];
    this.flick[to] = this.flick[from];
    this.grow[to] = this.grow[from];
  }

  update(dt, time) {
    const pos = this.position, vel = this.velocity, life = this.life;
    const size = this.size, alpha = this.alpha, base = this.base;
    const drag = this.drag, grav = this.grav, flick = this.flick, grow = this.grow;
    const lifeMax = this.lifeMax;

    let n = this.count;
    for (let i = 0; i < n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        n--;
        if (i !== n) { this._copy(n, i); i--; }
        continue;
      }
      const i3 = i * 3;

      const d = drag[i] * dt;
      const damp = d >= 1 ? 0 : 1 - d;
      vel[i3] *= damp;
      vel[i3 + 1] = vel[i3 + 1] * damp - grav[i] * dt;
      vel[i3 + 2] *= damp;

      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;

      const t = life[i] / lifeMax[i];
      let a = t < 0.85 ? Math.min(1, t * 3.2) : 1; // quick bloom-in, soft fade-out
      a *= t * t;                                   // tail fade
      if (flick[i] > 0) a *= 0.45 + 0.55 * Math.abs(Math.sin(time * flick[i] + i * 1.7));
      alpha[i] = a;
      size[i] = base[i] * (1 + grow[i] * (1 - t)) * (0.35 + 0.65 * t);
    }

    this.count = n;
    this.geometry.setDrawRange(0, n);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }
}

/* ------------------------------------------------------------- math helpers */

const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function randomBasis(outU, outV) {
  _w.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  if (_w.lengthSq() < 1e-4) _w.set(0, 1, 0);
  _w.normalize();
  _u.set(0, 1, 0);
  if (Math.abs(_w.dot(_u)) > 0.95) _u.set(1, 0, 0);
  outU.crossVectors(_w, _u).normalize();
  outV.crossVectors(_w, outU).normalize();
}

const _bu = new THREE.Vector3();
const _bv = new THREE.Vector3();

/** Returns a unit direction on the plane/curve described by `pattern`. */
function patternDirection(pattern, i, count, out) {
  const rnd = Math.random;
  switch (pattern) {
    case 'ring':
    case 'doubleRing': {
      randomBasis(_bu, _bv);
      const ring = pattern === 'doubleRing' ? (i % 2 ? 1 : 0.62) : 1;
      const a = (i / count) * Math.PI * 2 + rnd() * 0.04;
      out.copy(_bu).multiplyScalar(Math.cos(a) * ring)
        .addScaledVector(_bv, Math.sin(a) * ring);
      return out.normalize();
    }
    case 'willow': {
      const th = Math.acos(2 * rnd() - 1);
      const ph = rnd() * Math.PI * 2;
      out.set(Math.sin(th) * Math.cos(ph), Math.cos(th) * 0.85 + 0.15, Math.sin(th) * Math.sin(ph));
      return out.normalize();
    }
    case 'palm': {
      const k = 0.85 + rnd() * 0.15;
      const ph = (i / count) * Math.PI * 2 + rnd() * 0.5;
      const el = 0.25 + rnd() * 0.75;
      out.set(Math.cos(ph) * (1 - el) * k, el, Math.sin(ph) * (1 - el) * k);
      return out.normalize();
    }
    case 'chrysanthemum': {
      const th = Math.acos(2 * rnd() - 1) * 0.85;
      const ph = rnd() * Math.PI * 2;
      out.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      return out.normalize();
    }
    case 'heart': {
      randomBasis(_bu, _bv);
      const t = (i / count) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      out.copy(_bu).multiplyScalar(x / 17).addScaledVector(_bv, y / 17);
      return out.normalize();
    }
    case 'star': {
      randomBasis(_bu, _bv);
      const spikes = 5;
      const t = (i / count) * Math.PI * 2;
      const seg = (t % (Math.PI * 2 / spikes)) / (Math.PI * 2 / spikes);
      const r = seg < 0.5 ? 1 : 0.42;
      out.copy(_bu).multiplyScalar(Math.cos(t) * r).addScaledVector(_bv, Math.sin(t) * r);
      return out.normalize();
    }
    case 'crossette': {
      const th = Math.acos(2 * rnd() - 1) * 0.5;
      const ph = (i / count) * Math.PI * 2;
      out.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      return out.normalize();
    }
    default: { // 'sphere'
      const th = Math.acos(2 * rnd() - 1);
      const ph = rnd() * Math.PI * 2;
      out.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      return out.normalize();
    }
  }
}

/* ------------------------------------------------------------ the FX engine */

export class FireworksEngine {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {{density?:number, quality?:'high'|'low'}} [opts]
   */
  constructor(scene, camera, opts = {}) {
    this.scene = scene;
    this.camera = camera;
    this.density = opts.density ?? 1;
    this.lowQuality = opts.quality === 'low';

    const sparkMax = this.lowQuality ? 3200 : 9000;
    const smokeMax = this.lowQuality ? 260 : 900;

    this.sizeScale = 700;

    this.sparks = new ParticlePool(sparkMax, TEX.spark, THREE.AdditiveBlending, this.sizeScale);
    this.smoke = new ParticlePool(smokeMax, TEX.smoke, THREE.NormalBlending, this.sizeScale);

    this.group = new THREE.Group();
    this.group.add(this.sparks.points);
    if (!this.lowQuality) this.group.add(this.smoke.points);
    scene.add(this.group);

    this.shockwaves = [];
    this.emitters = [];
    this.timers = [];
    this._emitterId = 0;
    this._timerId = 0;
    this.time = 0;

    // Small pool of reusable point lights for explosion flashes.
    this.flashes = [];
    const lightCount = this.lowQuality ? 2 : 4;
    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight(0xffcc66, 0, 30, 2);
      l.visible = false;
      scene.add(l);
      this.flashes.push({ light: l, power: 0, decay: 0, free: true });
    }

    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  /* --------------------------------------------------------------- resizing */

  setViewportSize(heightPx, fovDeg) {
    this.sizeScale = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.sparks.setSizeScale(this.sizeScale);
    this.smoke.setSizeScale(this.sizeScale);
  }

  setDensity(v) { this.density = Math.max(0.2, v); }

  /* ------------------------------------------------------------------ bursts */

  /** Spawn one firework burst. */
  burst(pos, opt = {}) {
    const o = {
      count: 160, colors: PALETTES.gold, speed: 8.5, spread: 0.5, pattern: 'sphere',
      life: 1.65, size: 0.11, gravity: 5.6, drag: 1.05, flicker: 0,
      core: true, smoke: true, light: true, lightColor: null, ...opt,
    };
    const count = Math.max(6, Math.round(o.count * this.density));
    const p = this.sparks;
    const cols = o.colors;

    for (let i = 0; i < count; i++) {
      patternDirection(o.pattern, i, count, this._dir);
      const sp = o.speed * (1 - o.spread * Math.random());
      const c = o.sequence
        ? cols[Math.min(cols.length - 1, ((i / count) * cols.length) | 0)]
        : cols[(Math.random() * cols.length) | 0];
      const life = o.life * (0.7 + Math.random() * 0.6);
      p.spawn(
        pos.x + this._dir.x * 0.06, pos.y + this._dir.y * 0.06, pos.z + this._dir.z * 0.06,
        this._dir.x * sp, this._dir.y * sp, this._dir.z * sp,
        c[0], c[1], c[2],
        o.size * (0.6 + Math.random() * 0.9),
        life,
        o.drag * (0.85 + Math.random() * 0.4),
        o.gravity * (0.8 + Math.random() * 0.5),
        o.flicker,
        0
      );
    }

    // Bright core flash particles
    if (o.core) {
      for (let i = 0; i < 6; i++) {
        p.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 1, 1, 0.95, 0.6 + Math.random() * 0.5, 0.16, 3, 0, 0, 0);
      }
    }

    if (o.glitter > 0) this.glitter(pos, { count: o.glitter, spread: o.speed * 0.34, life: o.life * 1.6 });
    if (o.smoke && !this.lowQuality) this.smokePuff(pos, { size: o.speed * 0.5, count: 4 + (count / 40) | 0 });
    if (o.light) this.flash(pos, o.lightColor ?? cols[0], 2.6 + o.speed * 0.16, 0.5);

    return count;
  }

  /* ------------------------------------------- advanced layered explosions */

  /**
   * Queue a callback after `delay` seconds of simulated time.
   * Because the timer runs off the engine's own dt it slows down correctly
   * during slow-motion replays.
   * @returns {number} timer id
   */
  schedule(delay, fn) {
    const id = ++this._timerId;
    this.timers.push({ id, t: Math.max(0, delay), fn });
    return id;
  }

  cancelScheduled(id) {
    const i = this.timers.findIndex((t) => t.id === id);
    if (i >= 0) this.timers.splice(i, 1);
  }

  /** Small golden glints that hang and twinkle — the "sparkle dust" of a shell. */
  glitter(pos, { count = 80, spread = 3, color = [1, 0.87, 0.46], life = 2.8, size = 0.072 } = {}) {
    const p = this.sparks;
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI - Math.PI / 2;
      const sp = spread * (0.25 + Math.random() * 0.95);
      p.spawn(
        pos.x, pos.y, pos.z,
        Math.cos(el) * Math.cos(a) * sp,
        Math.sin(el) * sp * 0.8 + 1.1,
        Math.cos(el) * Math.sin(a) * sp,
        color[0], color[1], color[2],
        size * (0.6 + Math.random()),
        life * (0.55 + Math.random() * 0.85),
        1.5, 1.05, 42, 0
      );
    }
  }

  /** Rising comet sparks — gives secondary shells a glowing trail in. */
  trailRise(pos, { color = [1, 0.82, 0.42], count = 18, speed = 6.5 } = {}) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      this.sparks.spawn(
        pos.x + (Math.random() - 0.5) * 0.35,
        pos.y - Math.random() * 1.6,
        pos.z + (Math.random() - 0.5) * 0.35,
        (Math.random() - 0.5) * 1.3,
        speed * (0.55 + Math.random() * 0.8),
        (Math.random() - 0.5) * 1.3,
        color[0], color[1], color[2],
        0.085 + Math.random() * 0.055,
        0.42 + Math.random() * 0.34,
        1.4, 3.2, 32, 0
      );
    }
  }

  /** Falling golden rain (long-lived willow sparks with a slow shimmer). */
  goldenRain(pos, { count = 240, radius = 6.5, life = 3.4, color = [1, 0.84, 0.36] } = {}) {
    const p = this.sparks;
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      p.spawn(
        pos.x + Math.cos(a) * r * 0.24, pos.y, pos.z + Math.sin(a) * r * 0.24,
        Math.cos(a) * r * 0.55, 1.9 + Math.random() * 3.1, Math.sin(a) * r * 0.55,
        color[0], color[1], color[2],
        0.1 * (0.7 + Math.random() * 0.85),
        life * (0.6 + Math.random() * 0.85),
        0.7, 2.55, 26, 0
      );
    }
    this.flash(pos, [1, 0.85, 0.5], 3.2, 0.6);
  }

  /** Slow low-hanging clouds of vivid colour (skipped in low-quality mode). */
  colorSmoke(pos, { colors = [[0.66, 0.28, 1]], size = 3.2, count = 12, spread = 1.8, rise = 0.9 } = {}) {
    if (this.lowQuality) return;
    const s = this.smoke;
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const c = colors[(Math.random() * colors.length) | 0];
      s.spawn(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread * 0.6,
        pos.z + (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * 0.8,
        rise * (0.5 + Math.random()),
        (Math.random() - 0.5) * 0.8,
        c[0], c[1], c[2],
        size * (0.6 + Math.random() * 0.8),
        2.2 + Math.random() * 1.7,
        0.5, -0.10, 0, 1.6
      );
    }
  }

  /**
   * Multi-layer air shell: a bright primary break followed by 1–3 timed
   * secondary breaks that rise on glowing trails before they detonate.
   */
  airShell(pos, opt = {}) {
    const o = {
      palette: randomPalette(), layers: 3, spread: 3.4,
      glitter: 90, rain: false, smoke: false, ...opt,
    };
    const base = new THREE.Vector3().copy(pos);
    const pattern = opt.pattern || PATTERNS_FOR_SHELL[(Math.random() * PATTERNS_FOR_SHELL.length) | 0];

    this.burst(base, {
      count: 210, colors: o.palette, speed: 12.5, spread: 0.46, pattern,
      life: 1.9, size: 0.12, gravity: 4.7, drag: 1.0, flicker: 12,
    });
    this.glitter(base, { count: o.glitter, spread: o.spread, life: 2.7 });
    if (o.rain) this.schedule(0.28, () => this.goldenRain(base, { count: 130, radius: 5.5 }));
    if (o.smoke) this.colorSmoke(base, { colors: o.palette, count: 8, size: 2.8 });

    const layers = Math.max(1, o.layers | 0);
    for (let i = 1; i < layers; i++) {
      const delay = 0.24 * i + Math.random() * 0.14;
      this.schedule(delay, () => {
        const p = base.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * o.spread * 2,
          (Math.random() - 0.5) * o.spread * 1.3,
          (Math.random() - 0.5) * o.spread * 2
        ));
        this.trailRise(p, { color: (Math.random() < 0.3 ? PALETTES.gold : o.palette)[0] });
        const pal = Math.random() < 0.45 ? randomPalette() : o.palette;
        this.burst(p, {
          count: 120 + Math.random() * 90, colors: pal, speed: 10 + Math.random() * 4,
          spread: 0.5, pattern: PATTERNS_FOR_SHELL[(Math.random() * PATTERNS_FOR_SHELL.length) | 0],
          life: 1.6, size: 0.105, gravity: 4.8, drag: 1.05, flicker: Math.random() < 0.5 ? 18 : 0,
        });
        this.glitter(p, { count: 45, spread: 2.2, life: 2.2 });
      });
    }
    return base;
  }

  /** Massive rainbow celebration shell: concentric multi-colour layers. */
  rainbowShell(pos) {
    const base = new THREE.Vector3().copy(pos);
    this.burst(base, {
      count: 260, colors: PALETTES.rainbow, speed: 14, spread: 0.42,
      pattern: 'doubleRing', life: 2.0, size: 0.125, gravity: 4.4, drag: 0.95, sequence: true,
    });
    this.schedule(0.18, () => this.burst(base, {
      count: 190, colors: PALETTES.rainbow, speed: 10.5, spread: 0.5,
      pattern: 'chrysanthemum', life: 1.8, size: 0.12, gravity: 4.8, drag: 1.0, sequence: true,
    }));
    this.schedule(0.42, () => {
      this.burst(base, {
        count: 150, colors: randomPalette(), speed: 8.5, spread: 0.55, pattern: 'sphere',
        life: 1.7, size: 0.11, gravity: 5.0, drag: 1.05, flicker: 20,
      });
      this.goldenRain(base, { count: 150, radius: 6.5, life: 3.0 });
      this.colorSmoke(base, { colors: PALETTES.rainbow, count: 10, size: 3.0 });
    });
    this.glitter(base, { count: 130, spread: 4.2, life: 3.0 });
    this.shockwave(base, { color: 0xffe6a8, maxRadius: 6.5, duration: 0.85 });
  }

  /** Throwaway gold spark used for trails, fountains and sparklers. */
  spark(x, y, z, vx, vy, vz, color, size, life, drag = 1.2, grav = 2.4, flick = 26) {
    this.sparks.spawn(x, y, z, vx, vy, vz, color[0], color[1], color[2], size, life, drag, grav, flick, 0);
  }

  /** Rocket exhaust trail at a world position. */
  trail(pos, color = [1, 0.85, 0.45], spread = 0.55, count = 2) {
    for (let i = 0; i < count; i++) {
      this.sparks.spawn(
        pos.x + (Math.random() - 0.5) * 0.05,
        pos.y + (Math.random() - 0.5) * 0.05,
        pos.z + (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * spread,
        -0.35 - Math.random() * spread,
        (Math.random() - 0.5) * spread,
        color[0], color[1], color[2] * (0.85 + Math.random() * 0.3),
        0.075 + Math.random() * 0.05,
        0.4 + Math.random() * 0.45,
        1.6, 1.1, 34, 0
      );
    }
  }

  /** Soft glowing smoke puff. */
  smokePuff(pos, { size = 1.2, count = 5, color = [0.30, 0.28, 0.34], up = 0.6 } = {}) {
    const s = this.smoke;
    for (let i = 0; i < count; i++) {
      s.spawn(
        pos.x + (Math.random() - 0.5) * size * 0.5,
        pos.y + (Math.random() - 0.5) * size * 0.5,
        pos.z + (Math.random() - 0.5) * size * 0.5,
        (Math.random() - 0.5) * 0.5,
        up * (0.4 + Math.random()),
        (Math.random() - 0.5) * 0.5,
        color[0], color[1], color[2],
        size * (0.5 + Math.random() * 0.7),
        1.4 + Math.random() * 1.4,
        0.55, -0.15,
        0, 1.4
      );
    }
  }

  /** Expanding shockwave ring plus a light flash. */
  shockwave(pos, { color = 0xffd27a, maxRadius = 4.5, duration = 0.75, thickness = 0.10 } = {}) {
    const geo = new THREE.RingGeometry(1 - thickness, 1, 72, 1);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.renderOrder = 12;
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, mat, t: 0, duration, maxRadius });
    this.flash(pos, [1, 0.9, 0.6], 5, duration);
  }

  /** Briefly illuminate the scene from a position (pooled point lights). */
  flash(pos, color, power = 3, duration = 0.45) {
    let slot = null;
    for (const f of this.flashes) { if (f.free) { slot = f; break; } }
    if (!slot) { // steal the weakest
      slot = this.flashes.reduce((a, b) => (a.power <= b.power ? a : b));
    }
    slot.free = false;
    slot.light.position.copy(pos);
    if (Array.isArray(color)) {
      slot.light.color.setRGB(color[0], color[1], color[2]);
    } else {
      slot.light.color.set(color);
    }
    slot.power = power;
    slot.decay = power / duration;
    slot.light.intensity = power;
    slot.light.distance = 22 + power * 6;
    slot.light.visible = true;
  }

  /** Fountain-style upward cone of sparks (one shot, with a duration). */
  fountain(pos, {
    duration = 1.6, rate = 220, speed = 9, colors = PALETTES.gold,
    spread = 0.32, life = 1.5, size = 0.1, gravity = 4.2, up = 1,
  } = {}) {
    return this.addEmitter({
      duration, rate,
      getPosition: () => pos,
      spawn: (p) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        const c = colors[(Math.random() * colors.length) | 0];
        const sp = speed * (0.45 + Math.random() * 0.75);
        this.sparks.spawn(
          p.x + Math.cos(a) * 0.05, p.y, p.z + Math.sin(a) * 0.05,
          Math.cos(a) * r * speed, sp * up, Math.sin(a) * r * speed,
          c[0], c[1], c[2],
          size * (0.55 + Math.random() * 0.85),
          life * (0.65 + Math.random() * 0.7),
          0.85, gravity, 30, 0
        );
      },
    });
  }

  /**
   * Generic continuous emitter.
   * @returns {number} emitter id
   */
  addEmitter(cfg) {
    const id = ++this._emitterId;
    this.emitters.push({
      id,
      acc: 0,
      elapsed: 0,
      duration: cfg.duration ?? Infinity,
      rate: cfg.rate ?? 60,
      getPosition: cfg.getPosition,
      spawn: cfg.spawn,
      onEnd: cfg.onEnd || null,
      smoke: cfg.smoke || 0,
      _smokeAcc: 0,
    });
    return id;
  }

  removeEmitter(id) {
    const i = this.emitters.findIndex((e) => e.id === id);
    if (i >= 0) {
      const e = this.emitters[i];
      if (e.onEnd) e.onEnd();
      this.emitters.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------------ update */

  update(dt, camera) {
    this.time += dt;
    const cam = camera || this.camera;
    const time = this.time;

    // Simulated-time timers (multi-layer shells, delayed breaks). Advanced on
    // the same clock as the particles so slow-motion slows them too.
    if (this.timers.length) {
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const t = this.timers[i];
        t.t -= dt;
        if (t.t <= 0) {
          this.timers.splice(i, 1);
          try { t.fn(); } catch (err) { /* keep the frame loop alive */ }
        }
      }
    }

    this.sparks.update(dt, time);
    if (!this.lowQuality) this.smoke.update(dt, time);

    // Continuous emitters
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.elapsed += dt;
      e.acc += dt * e.rate * this.density;
      const p = e.getPosition();
      let guard = 120; // never spawn more than 120/frame per emitter
      while (e.acc >= 1 && guard-- > 0) {
        e.acc -= 1;
        e.spawn(p);
      }
      if (e.acc > 4) e.acc = 4;

      if (e.smoke > 0 && !this.lowQuality) {
        e._smokeAcc += dt * e.smoke;
        if (e._smokeAcc >= 1) {
          e._smokeAcc -= 1;
          this.smokePuff(p, { size: 0.9, count: 1, up: 0.9 });
        }
      }

      if (e.elapsed >= e.duration) {
        if (e.onEnd) e.onEnd();
        this.emitters.splice(i, 1);
      }
    }

    // Shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const r = 0.4 + eased * s.maxRadius;
      s.mesh.scale.setScalar(r);
      s.mat.opacity = (1 - k) * 0.85;
      if (cam) s.mesh.quaternion.copy(cam.quaternion);
      if (k >= 1) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mat.dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // Flash lights
    for (const f of this.flashes) {
      if (f.free) continue;
      f.power -= f.decay * dt;
      if (f.power <= 0) {
        f.power = 0;
        f.free = true;
        f.light.intensity = 0;
        f.light.visible = false;
      } else {
        f.light.intensity = f.power * (0.75 + Math.random() * 0.25);
      }
    }
  }

  get particleCount() { return this.sparks.count + this.smoke.count; }

  clearAll() {
    this.sparks.clear();
    this.smoke.clear();
    this.emitters.length = 0;
    this.timers.length = 0;
    this.shockwaves.forEach((s) => {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mat.dispose();
    });
    this.shockwaves.length = 0;
    this.flashes.forEach((f) => {
      f.power = 0; f.free = true; f.light.intensity = 0; f.light.visible = false;
    });
  }

  dispose() {
    this.clearAll();
    this.sparks.geometry.dispose();
    this.sparks.material.dispose();
    this.smoke.geometry.dispose();
    this.smoke.material.dispose();
    this.scene.remove(this.group);
  }
}

export default FireworksEngine;
