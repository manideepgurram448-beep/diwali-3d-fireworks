/* ============================================================================
 * script.js — Application shell for the Diwali 2026 3D experience.
 * ----------------------------------------------------------------------------
 * Wires together: renderer + bloom pipeline, night-sky world (stars, floating
 * diyas, glowing motes), the fireworks engine, the six 3D crackers, the audio
 * engine, all UI controls, camera choreography and the render loop.
 * ==========================================================================*/

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { FireworksEngine, PALETTES, TEX, randomPalette } from './fireworks.js';
import { CrackersManager } from './crackers.js';
import { AudioEngine } from './audio.js';

/* ============================================================== constants */

const THEMES = {
  midnight: { top: '#010614', horizon: '#14294d', bottom: '#030711', fog: 0x080f23, accent: '#ffd479', bloom: 0.95 },
  royal:    { top: '#07041a', horizon: '#3d1a8f', bottom: '#0a0620', fog: 0x0b0722, accent: '#d4a6ff', bloom: 1.05 },
  ember:    { top: '#0b0402', horizon: '#7a280a', bottom: '#120603', fog: 0x120603, accent: '#ff9a52', bloom: 1.1 },
  emerald:  { top: '#02100a', horizon: '#0d6b48', bottom: '#03130c', fog: 0x03130c, accent: '#7dffc0', bloom: 0.95 },
  rose:     { top: '#150410', horizon: '#8f1f57', bottom: '#1a0514', fog: 0x1a0514, accent: '#ff9ec9', bloom: 1.05 },
  void:     { top: '#000000', horizon: '#141414', bottom: '#000000', fog: 0x000000, accent: '#ffd479', bloom: 1.15 },
};

const INTENSITY = [
  { name: 'Low', volley: 1, interval: 2.3 },
  { name: 'Medium', volley: 2, interval: 1.5 },
  { name: 'Spectacular', volley: 4, interval: 0.85 },
];

const PATTERNS = ['sphere', 'chrysanthemum', 'doubleRing', 'willow', 'palm', 'star', 'crossette', 'ring', 'heart'];

const ICONS = {
  pot: '<svg viewBox="0 0 48 48"><path d="M14 21h20l-3 17a5 5 0 0 1-5 4h-4a5 5 0 0 1-5-4z"/><path d="M11 21h26"/><path d="M24 5c3 5 3 10 0 15-3-5-3-10 0-15z"/></svg>',
  rocket: '<svg viewBox="0 0 48 48"><path d="M24 4c6 6 9 14 9 22l-9 6-9-6c0-8 3-16 9-22z"/><circle cx="24" cy="19" r="3"/><path d="M15 27l-6 8 8-2M33 27l6 8-8-2"/><path d="M24 32v11"/></svg>',
  chakri: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="5"/><path d="M24 8v6M24 34v6M8 24h6M34 24h6M12.7 12.7l4.2 4.2M31.1 31.1l4.2 4.2M35.3 12.7l-4.2 4.2M16.9 31.1l-4.2 4.2"/></svg>',
  anar: '<svg viewBox="0 0 48 48"><path d="M17 22h14l-2 20H19z"/><path d="M14 22h20"/><path d="M24 4v7M18 9l3 5M30 9l-3 5"/></svg>',
  sparkler: '<svg viewBox="0 0 48 48"><path d="M22 44l4-11"/><path d="M24 31v-5"/><path d="M24 26l-4-6M24 26l4-6M24 24l-6-2M24 24l6-2M24 20l-2-6M24 20l2-6"/></svg>',
  blast: '<svg viewBox="0 0 48 48"><path d="M24 6l3 9 9-5-4 9 9 3-9 3 4 9-9-5-3 9-3-9-9 5 4-9-9-3 9-3-4-9 9 5z"/><circle cx="24" cy="24" r="3"/></svg>',
  bijili: '<svg viewBox="0 0 48 48"><path d="M27 4L12 26h10l-2 18 16-24H25z"/></svg>',
  sutli: '<svg viewBox="0 0 48 48"><circle cx="23" cy="27" r="13"/><path d="M18 14V8h11l3 5M28 7l5-3M23 17v10l7 4"/></svg>',
  pencil: '<svg viewBox="0 0 48 48"><path d="M24 5l9 29-9 9-9-9z"/><path d="M24 5v38M17 28h14M19 34h10"/></svg>',
  ground: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="8"/><path d="M24 7v9M41 24h-9M24 41v-9M7 24h9"/></svg>',
  cake: '<svg viewBox="0 0 48 48"><path d="M8 21h32v20H8zM12 21V9h6v12M21 21V6h6v15M30 21V9h6v12"/><path d="M13 29h22"/></svg>',
  skyshot: '<svg viewBox="0 0 48 48"><path d="M17 30V12h14v18M13 41l5-11M35 41l-5-11M24 12V5M20 8l4-4 4 4"/></svg>',
  smoke: '<svg viewBox="0 0 48 48"><path d="M12 36h24a7 7 0 0 0 1-14 12 12 0 0 0-23-2 8 8 0 0 0-2 16z"/><path d="M18 41h13M22 9l2-4M32 14l4-3"/></svg>',
  rain: '<svg viewBox="0 0 48 48"><path d="M7 22a17 17 0 0 1 34 0zM24 22v20M18 42h12"/><path d="M13 25l-3 5M22 25l-3 7M31 25l-2 6M39 25l-3 5"/></svg>',
  star: '<svg viewBox="0 0 48 48"><path d="M24 4l5.4 13.2L43 18.5l-10.4 8.7L36 41l-12-7.5L12 41l3.4-13.8L5 18.5l13.6-1.3z"/></svg>',
  multirocket: '<svg viewBox="0 0 48 48"><path d="M12 9c3 4 4 8 4 14l-4 4-4-4c0-6 1-10 4-14zM24 4c4 5 5 10 5 17l-5 5-5-5c0-7 1-12 5-17zM36 9c3 4 4 8 4 14l-4 4-4-4c0-6 1-10 4-14z"/><path d="M12 29v13M24 28v14M36 29v13"/></svg>',
  flower: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="5"/><path d="M24 19c-8-13 7-17 8-6 0 3-2 5-8 6zM29 24c13-8 17 7 6 8-3 0-5-2-6-8zM24 29c8 13-7 17-8 6 0-3 2-5 8-6zM19 24C6 32 2 17 13 16c3 0 5 2 6 8z"/><path d="M24 29v14"/></svg>',
  rainbow: '<svg viewBox="0 0 48 48"><path d="M5 35a19 19 0 0 1 38 0M11 35a13 13 0 0 1 26 0M17 35a7 7 0 0 1 14 0"/><path d="M24 35V9M20 14l4-5 4 5"/></svg>',
};

const isCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const CLOUD_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScale;
  uniform vec3 uTint;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float n = 0.0;
    float a = 0.55;
    for (int i = 0; i < 4; i++) {
      n += noise2(p) * a;
      p = p * 2.03 + 17.1;
      a *= 0.5;
    }
    return n;
  }

  void main() {
    vec2 p = vec2(vUv.x * uScale, vUv.y * 2.1);
    p.x += uTime * 0.012;
    float n = fbm(p);
    float cloud = smoothstep(0.46, 0.74, n);
    float edgeFade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);
    float silver = smoothstep(0.52, 0.76, n);
    float alpha = cloud * edgeFade * uOpacity;
    vec3 color = uTint * (0.4 + silver * 0.55);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createMoonTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = ctx.createRadialGradient(82, 72, 8, 128, 128, 184);
  base.addColorStop(0, '#fffdf3');
  base.addColorStop(0.62, '#f4e9c9');
  base.addColorStop(1, '#c8bd9d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 42; i++) {
    const x = 14 + Math.random() * (size - 28);
    const y = 14 + Math.random() * (size - 28);
    const r = 2 + Math.random() * (i < 10 ? 11 : 6);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(91,76,52,${0.2 + Math.random() * 0.18})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y - r * 0.16, r * 0.72, Math.PI * 1.08, Math.PI * 1.88);
    ctx.strokeStyle = 'rgba(255,250,224,0.18)';
    ctx.lineWidth = Math.max(0.7, r * 0.12);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/* ======================================================= screen-space FX 2D */

class ScreenFX {
  constructor(canvas, lowPerf) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0;
    this.flash = 0;
    this.flashRGB = '255,255,255';
    this.lowPerf = lowPerf;
    this.sprite = this._sprite();
    this.dots = [];
    this.t = 0;
  }

  _sprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,236,190,1)');
    g.addColorStop(0.35, 'rgba(255,206,120,0.55)');
    g.addColorStop(1, 'rgba(255,180,60,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = this.lowPerf ? 26 : 70;
    this.dots = Array.from({ length: target }, () => this._dot(true));
  }

  _dot(initial) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : this.h + 20,
      r: 1 + Math.random() * 3.4,
      vy: -(4 + Math.random() * 16),
      vx: (Math.random() - 0.5) * 9,
      a: 0.15 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
    };
  }

  flashNow(color, strength) {
    this.flash = Math.min(1, Math.max(this.flash, strength));
    const c = new THREE.Color(color);
    this.flashRGB = `${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0}`;
  }

  update(dt) {
    const ctx = this.ctx;
    this.t += dt;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';

    for (const d of this.dots) {
      d.y += d.vy * dt;
      d.x += d.vx * dt + Math.sin(this.t * 0.6 + d.ph) * 4 * dt;
      if (d.y < -20) {
        d.y = this.h + 20;
        d.x = Math.random() * this.w;
      }
      if (d.x < -20) d.x = this.w + 20;
      if (d.x > this.w + 20) d.x = -20;
      const tw = 0.55 + 0.45 * Math.sin(this.t * 2.2 + d.ph);
      ctx.globalAlpha = d.a * tw * 0.55;
      const s = d.r * 9;
      ctx.drawImage(this.sprite, d.x - s / 2, d.y - s / 2, s, s);
    }

    if (this.flash > 0.001) {
      ctx.globalAlpha = this.flash * 0.5;
      ctx.fillStyle = `rgb(${this.flashRGB})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flash *= Math.pow(0.0009, dt);
      if (this.flash < 0.01) this.flash = 0;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/* ==================================================== ambient glowing motes */

class AmbientMotes {
  constructor(scene, count, texture) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    for (let i = 0; i < count; i++) this._seed(i + 0, true);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      map: texture, color: 0xffc978, size: 0.34, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    scene.add(this.points);
  }

  _seed(i, initial) {
    const i3 = i * 3;
    const r = 5 + Math.random() * 22;
    const a = Math.random() * Math.PI * 2;
    this.pos[i3] = Math.cos(a) * r;
    this.pos[i3 + 1] = initial ? Math.random() * 16 - 1 : -2;
    this.pos[i3 + 2] = Math.sin(a) * r;
    this.speed[i] = 0.25 + Math.random() * 0.9;
  }

  update(dt) {
    const p = this.pos;
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      p[i3 + 1] += this.speed[i] * dt;
      p[i3] += Math.sin((p[i3 + 1] + i) * 0.3) * dt * 0.33;
      if (p[i3 + 1] > 17) this._seed(i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/* ============================================================= main app */

class DiwaliExperience {
  constructor() {
    // Coarse pointers on a small screen get the lighter pipeline by default —
    // the visitor can switch back at any time from the settings panel.
    this.lowPerf = isCoarse && Math.min(window.innerWidth, window.innerHeight) < 700;
    this.wide = true;
    this.clock = new THREE.Clock();
    this.time = 0;

    // state
    this.theme = 'midnight';
    this.intensity = 1;
    this.densityPct = 100;
    this.modeRandom = false;
    this.modeContinuous = false;
    this.audioReady = false;
    this.comets = [];
    this.autoTimer = 3;
    this.orbitAngle = 0;
    this.orbitOffset = 0;
    this.camElev = 0;
    this.camMode = 'overview';
    this.focusIndex = -1;
    this.greetingOpen = false;
    this.settingsOpen = false;

    // cinematic extras
    this.timeScale = 1;        // 1 = real time, < 1 = slow-motion replay
    this.slowMo = false;
    this.cinematic = false;
    this.lastBurst = null;     // descriptor of the most recent explosion
    this._slowMoTimer = null;
    this._hold = { stream: false, x: 0, y: 0, acc: 0, timer: null };
    this._lastTap = 0;
    this._lastTapPt = { x: 0, y: 0 };
    this._lastCard = { i: -1, t: 0 };

    // camera maths
    this.camPos = new THREE.Vector3(0, 6.4, 15);
    this.camTarget = new THREE.Vector3(0, 5.2, 0);
    this._goalPos = this.camPos.clone();
    this._goalTarget = this.camTarget.clone();
    this._shakeAmt = 0;
    this._shakeDur = 1;
    this._shakeT = 999;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    this.dom = this._collectDom();
  }

  _collectDom() {
    const $ = (id) => document.getElementById(id);
    return {
      canvas: $('scene-canvas'),
      fxCanvas: $('fx-canvas'),
      loader: $('loader'),
      loaderFill: $('loader-fill'),
      loaderPct: $('loader-pct'),
      landing: $('landing'),
      celebration: $('celebration'),
      fallback: $('fallback'),
      dock: $('dock'),
      settings: $('settings'),
      greeting: $('greeting'),
      toasts: $('toasts'),
      dockPrev: $('dock-prev'),
      dockNext: $('dock-next'),
      intensityVal: $('intensity-val'),
      densityVal: $('density-val'),
      btnSound: $('btn-sound'),
      btnMusic: $('btn-music'),
      btnSettings: $('btn-settings'),
      btnFullscreen: $('btn-fullscreen'),
      btnSlowMo: $('btn-slow-mo'),
      btnCinematic: $('btn-cinematic'),
      btnCinema2: $('btn-cinema-2'),
      btnReplay: $('btn-replay'),
      btnCloseSettings: $('btn-close-settings'),
      btnEnter: $('btn-enter'),
      btnExplore: $('btn-explore'),
      btnStart: $('btn-start'),
      btnBackHome: $('btn-back-home'),
      btnRandom: $('btn-random'),
      btnContinuous: $('btn-continuous'),
      btnQuality: $('btn-quality'),
      btnGreeting: $('btn-greeting'),
      btnRestart: $('btn-restart'),
      btnShare: $('btn-share'),
      btnGreetingClose: $('btn-greeting-close'),
      btnGreetingCelebrate: $('btn-greeting-celebrate'),
      btnScrollHint: $('btn-scroll-hint'),
      volume: $('volume'),
      intensity: $('intensity'),
      density: $('density'),
      themes: $('themes'),
    };
  }

  /* ------------------------------------------------------------- bootstrap */

  async init() {
    if (!window.__HAS_WEBGL__) {
      this._showFallback();
      return;
    }
    try {
      this._initRenderer();
      this._initScene();
      this._initWorld();
      this._initEngines();
      this._initUi();
      this._initInput();

      // Simulated asset warm-up so the loader feels meaningful and the first
      // frame is compiled before we reveal the scene.
      this._fakeLoad();
      window.addEventListener('resize', () => this.onResize());
      document.addEventListener('fullscreenchange', () => this._syncFullscreenLabel());
      document.addEventListener('visibilitychange', () => { this.clock.getDelta(); });

      this.onResize(true);
      this.renderer.setAnimationLoop(() => this._frame());
    } catch (err) {
      console.error('[Diwali] init failed:', err);
      this._showFallback();
    }
  }

  _showFallback() {
    this.dom.loader.classList.add('is-hidden');
    this.dom.landing.classList.add('is-hidden');
    this.dom.celebration.classList.add('is-hidden');
    this.dom.fallback.classList.remove('is-hidden');
    document.body.classList.add('ready');
  }

  _initRenderer() {
    const canvas = this.dom.canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isCoarse,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x03050d, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.6 : 1.85));
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050912, 0.011);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.72, 0.42);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // A tiny studio environment gives the gold and clay a believable lustre.
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch (e) { /* environment is cosmetic — safe to skip */ }
  }

  _initWorld() {
    // ---- gradient sky dome ----
    this.skyUniforms = {
      uTop: { value: new THREE.Color('#03050d') },
      uHorizon: { value: new THREE.Color('#16265e') },
      uBottom: { value: new THREE.Color('#05070f') },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */`
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = mix(uBottom, uHorizon, smoothstep(-0.30, 0.06, h));
            c = mix(c, uTop, smoothstep(0.04, 0.62, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      })
    );
    sky.frustumCulled = false;
    this.scene.add(sky);

    // Camera-following sky details stay framed on both wide and portrait screens.
    this.skyDecor = new THREE.Group();
    this.scene.add(this.skyDecor);
    this.cloudMaterials = [];

    const addCloudLayer = (width, height, y, z, opacity, scale) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uScale: { value: scale },
          uTint: { value: new THREE.Color('#d9a76f') },
        },
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        toneMapped: false,
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      cloud.position.set(0, y, z);
      cloud.frustumCulled = false;
      this.skyDecor.add(cloud);
      this.cloudMaterials.push(material);
    };

    addCloudLayer(190, 30, -15, -112, 0.2, 9);
    addCloudLayer(220, 18, -23, -118, 0.13, 12);

    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.soft,
      color: 0xffc56f,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    }));
    moonGlow.position.set(-38, 37, -131);
    moonGlow.scale.set(39, 39, 1);
    moonGlow.material.depthTest = true;
    this.moonGlow = moonGlow;
    this.skyDecor.add(moonGlow);

    const moonTexture = createMoonTexture();
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(9.1, 40, 32),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
        color: 0xc7b992,
        toneMapped: true,
        fog: false,
      })
    );
    this.moon.position.set(-38, 37, -130);
    this.skyDecor.add(this.moon);

    // ---- stars ----
    const starCount = this.lowPerf ? 1800 : 4200;
    const sp = new Float32Array(starCount * 3);
    const phases = new Float32Array(starCount);
    const sizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 170 + Math.random() * 24;
      const th = Math.acos(Math.random());
      const ph = Math.random() * Math.PI * 2;
      sp[i * 3] = r * Math.sin(th) * Math.cos(ph);
      sp[i * 3 + 1] = r * Math.cos(th);
      sp[i * 3 + 2] = r * Math.sin(th) * Math.sin(ph);
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.15 + Math.random() * 2.1;
      if (Math.random() < 0.035) sizes[i] += 1.4;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying float vTwinkle;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float pulse = 0.58 + 0.42 * sin(uTime * (0.8 + aPhase * 0.12) + aPhase);
          vTwinkle = pulse;
          gl_PointSize = clamp(aSize * (180.0 / max(-mv.z, 1.0)), 0.8, 4.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vTwinkle;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float halo = 1.0 - smoothstep(0.08, 0.5, d);
          float core = 1.0 - smoothstep(0.0, 0.16, d);
          float alpha = halo * 0.56 + core * 0.44;
          if (alpha < 0.015) discard;
          gl_FragColor = vec4(vec3(0.72, 0.82, 1.0) * (0.72 + core * 0.9), alpha * vTwinkle);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // ---- ground ----
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x04060f, roughness: 0.42, metalness: 0.55, envMapIntensity: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    this.scene.add(ground);

    // golden pool of light on the ground
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 256;
    const gx = glowCanvas.getContext('2d');
    const grad = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,205,120,0.55)');
    grad.addColorStop(0.4, 'rgba(255,170,70,0.20)');
    grad.addColorStop(1, 'rgba(255,150,40,0)');
    gx.fillStyle = grad;
    gx.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    this.groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.groundGlow.rotation.x = -Math.PI / 2;
    this.groundGlow.position.y = 0.005;
    this.scene.add(this.groundGlow);

    // ---- lighting ----
    this.scene.add(new THREE.HemisphereLight(0x2a4a7d, 0x140d06, 0.75));
    const key = new THREE.PointLight(0xffcc88, 90, 60, 2);
    key.position.set(0, 9, 7);
    this.keyLight = key;
    this.scene.add(key);
    const rim = new THREE.PointLight(0x6fa8ff, 45, 70, 2);
    rim.position.set(-10, 5, -8);
    this.rimLight = rim;
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x2a2f45, 0.6));

    // ---- floating diyas ----
    this.diyas = [];
    const diyaCount = this.lowPerf ? 8 : 16;
    for (let i = 0; i < diyaCount; i++) this._makeDiya(i, diyaCount);

    // ---- ambient glowing motes ----
    this.motes = new AmbientMotes(this.scene, this.lowPerf ? 90 : 240, TEX.soft);
  }

  _makeDiya(i, total) {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.19, 0.1, 14),
      new THREE.MeshStandardMaterial({ color: 0x8a3a24, roughness: 0.75, metalness: 0.2, emissive: 0x3a1206, emissiveIntensity: 0.6 })
    );
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.132, 0.02, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xe8bc63, metalness: 1, roughness: 0.3, emissive: 0x3a2606, emissiveIntensity: 0.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.05;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.2, 10),
      new THREE.MeshBasicMaterial({ color: 0xffc463 })
    );
    flame.position.y = 0.19;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.soft, color: 0xffab4a, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(1.5);
    glow.position.y = 0.22;

    g.add(bowl, rim, flame, glow);

    const a = (i / total) * Math.PI * 2 + Math.random() * 0.4;
    const r = 8 + Math.random() * 16;
    g.position.set(Math.cos(a) * r, 1.2 + Math.random() * 3.4, Math.sin(a) * r * 0.8 - 3);
    g.scale.setScalar(0.9 + Math.random() * 0.7);

    const data = {
      group: g, flame, glow,
      baseY: g.position.y,
      bobAmp: 0.12 + Math.random() * 0.3,
      bobSpeed: 0.4 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    };
    this.diyas.push(data);
    this.scene.add(g);
  }

  _initEngines() {
    this.audio = new AudioEngine();

    this.screenFX = new ScreenFX(this.dom.fxCanvas, this.lowPerf);

    this.fx = new FireworksEngine(this.scene, this.camera, {
      density: 1,
      quality: this.lowPerf ? 'low' : 'high',
    });

    this.crackers = new CrackersManager({
      scene: this.scene,
      fireworks: this.fx,
      audio: this.audio,
      onShake: (a, d) => this.shake(a, d),
      onFlash: (c, s) => this.screenFX.flashNow(c, s),
      onSelect: (c) => this._onCrackerSelected(c),
    });
    this.crackers.create();
  }

  /* ------------------------------------------------------------------- UI */

  _initUi() {
    const d = this.dom;

    // dock cards
    this.crackers.crackers.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.dataset.index = String(i);
      btn.innerHTML =
        `<span class="card__icon">${ICONS[c.icon] || ''}</span>` +
        `<span class="card__name">${c.name}</span>` +
        `<span class="card__hint">${c.desc}</span>` +
        `<span class="card__glow"></span>`;
      btn.setAttribute('aria-label', `${c.name}. ${c.desc}`);
      btn.title = c.desc;
      btn.addEventListener('click', () => this.activateCracker(i));
      d.dock.appendChild(btn);
    });
    this.cards = Array.from(d.dock.querySelectorAll('.card'));
    d.dockPrev.addEventListener('click', () => {
      d.dock.scrollBy({ left: -d.dock.clientWidth * 0.82, behavior: 'smooth' });
    });
    d.dockNext.addEventListener('click', () => {
      d.dock.scrollBy({ left: d.dock.clientWidth * 0.82, behavior: 'smooth' });
    });
    d.dock.addEventListener('scroll', () => this._updateDockNav(), { passive: true });
    this._updateDockNav();

    // hero buttons
    d.btnEnter.addEventListener('click', () => { this.enterCelebration(); this.welcomeVolley(); });
    d.btnExplore.addEventListener('click', () => { this.enterCelebration(); this.activateCracker(0); });
    d.btnStart.addEventListener('click', () => {
      this.enterCelebration();
      this.toggleContinuous(true);
      this.toast('Continuous celebration started ✨');
    });
    d.btnScrollHint.addEventListener('click', () => { this.enterCelebration(); this.welcomeVolley(); });

    d.btnBackHome.addEventListener('click', () => this.exitToHome());

    // audio
    d.btnSound.addEventListener('click', () => this.toggleSound());
    d.btnMusic.addEventListener('click', () => this.toggleMusic());
    d.volume.addEventListener('input', () => this.audio.setMasterVolume(Number(d.volume.value) / 100));

    // settings panel
    d.btnSettings.addEventListener('click', () => this.toggleSettings());
    d.btnCloseSettings.addEventListener('click', () => this.toggleSettings(false));

    d.intensity.addEventListener('input', () => this.setIntensity(Number(d.intensity.value)));
    d.density.addEventListener('input', () => this.setDensity(Number(d.density.value)));

    d.themes.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme');
      if (!btn) return;
      this.setTheme(btn.dataset.theme);
    });

    d.btnRandom.addEventListener('click', () => this.toggleRandom());
    d.btnContinuous.addEventListener('click', () => this.toggleContinuous());
    d.btnQuality.addEventListener('click', () => this.setLowPerf(!this.lowPerf));
    d.btnGreeting.addEventListener('click', () => this.showGreeting(true));
    d.btnRestart.addEventListener('click', () => this.restart());
    d.btnShare.addEventListener('click', () => this.share());

    d.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    d.btnSlowMo.addEventListener('click', () => this.toggleSlowMotion());
    d.btnCinematic.addEventListener('click', () => this.toggleCinematic());
    d.btnReplay.addEventListener('click', () => this.replayLastExplosion());
    if (d.btnCinema2) d.btnCinema2.addEventListener('click', () => this.toggleCinematic(false));
    d.btnGreetingClose.addEventListener('click', () => this.showGreeting(false));
    d.btnGreetingCelebrate.addEventListener('click', () => {
      this.showGreeting(false);
      this.enterCelebration();
      this.toggleContinuous(true);
    });

    this.setIntensity(1, true);
    this.setDensity(100, true);
    this.setTheme('midnight');
    this._syncSoundButtons();
    this._syncExtraButtons();
  }

  _initInput() {
    const canvas = this.dom.canvas;
    const drag = { active: false, x: 0, y: 0, moved: 0, id: null, crackerHit: null, sky: false, holding: false };

    const cancelHold = () => {
      if (this._hold.timer) { clearTimeout(this._hold.timer); this._hold.timer = null; }
    };

    const onDown = (e) => {
      this.ensureAudio();
      drag.active = true;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved = 0; drag.id = e.pointerId;
      drag.sky = false;
      drag.holding = false;
      drag.crackerHit = null;

      this._updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hit = this.crackers.pick(this.raycaster);
      if (hit) {
        drag.crackerHit = hit;
        this.crackers.select(hit.index, true);
        hit.trigger();
      } else {
        drag.sky = true;
        // Press and hold the sky to start a continuous fireworks stream.
        this._hold.x = e.clientX; this._hold.y = e.clientY;
        cancelHold();
        this._hold.timer = setTimeout(() => {
          if (!drag.active || drag.moved > 14 || !drag.sky) return;
          drag.holding = true;
          this._startHoldStream();
        }, 260);
      }
    };

    const onMove = (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved > 14) {
        cancelHold();
        this.orbitOffset = THREE.MathUtils.clamp(this.orbitOffset - dx * 0.004, -0.75, 0.75);
        this.camElev = THREE.MathUtils.clamp((this.camElev ?? 0) - dy * 0.006, -3.5, 4.5);
      }
      if (drag.holding) { this._hold.x = e.clientX; this._hold.y = e.clientY; }
    };

    const onUp = () => {
      if (!drag.active) return;
      drag.active = false;
      cancelHold();
      this.crackers.pointerUp();
      if (drag.holding) {
        this._stopHoldStream();
      } else if (drag.moved < 14 && drag.sky) {
        this._updateNdc(drag.x, drag.y);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const p = this._skyPointFromRay();
        const now = performance.now();
        const near = Math.hypot(drag.x - this._lastTapPt.x, drag.y - this._lastTapPt.y) < 46;
        if (now - this._lastTap < 340 && near) {
          this._lastTap = 0;
          this.doubleExplosion(p);
        } else {
          this._lastTap = now;
          this._lastTapPt.x = drag.x; this._lastTapPt.y = drag.y;
          this.spawnBurstAt(p);
        }
      }
      drag.crackerHit = null;
      drag.sky = false;
      drag.holding = false;
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      this.ensureAudio();
      switch (e.key) {
        case ' ': {
          e.preventDefault();
          const i = this.crackers.selected >= 0 ? this.crackers.selected : 0;
          this.activateCracker(i);
          break;
        }
        case 'Escape':
          if (this.greetingOpen) this.showGreeting(false);
          else if (this.settingsOpen) this.toggleSettings(false);
          else if (this.cinematic) this.toggleCinematic(false);
          else this.exitToHome();
          break;
        case 'f': case 'F': this.toggleFullscreen(); break;
        case 'm': case 'M': this.toggleMusic(); break;
        case 's': case 'S': this.toggleSound(); break;
        case 'r': case 'R': this.toggleRandom(); break;
        case 'c': case 'C': this.toggleContinuous(); break;
        case 'd': case 'D': {
          const p = this._skyPointFromRay();
          this._updateNdc(innerWidth / 2, innerHeight * 0.42);
          this.raycaster.setFromCamera(this.ndc, this.camera);
          this.doubleExplosion(this._skyPointFromRay() || p);
          break;
        }
        case 'k': case 'K': this.toggleCinematic(); break;
        case 'l': case 'L': this.toggleSlowMotion(); break;
        case 'v': case 'V': this.replayLastExplosion(); break;
        default: break;
      }
    });
  }

  /* ------------------------------------------------ touch & hold fireworks */

  _startHoldStream() {
    this.enterCelebration();
    this._hold.stream = true;
    this._hold.acc = 0.6;
    this.toast('Hold for continuous fireworks 🎆', 1500);
  }

  _stopHoldStream() {
    this._hold.stream = false;
    this._hold.acc = 0;
  }

  _updateHoldStream(dt) {
    const h = this._hold;
    if (!h.stream) return;
    h.acc += dt;
    if (h.acc < 0.32) return;
    h.acc = 0;

    this._updateNdc(h.x, h.y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const p = this._skyPointFromRay();
    if (Math.random() < 0.45) {
      // Launch a comet that climbs towards the held point.
      this._launchCometTo(p);
    } else {
      this.spawnBurstAt(p, { quiet: true });
    }
    this.audio.sparkle(2, 0.7);
  }


  _updateNdc(clientX, clientY) {
    this.ndc.x = (clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  _skyPointFromRay() {
    const o = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;
    let t = 34;
    if (dir.y > 0.06) {
      const targetY = 11 + Math.random() * 8;
      const cand = (targetY - o.y) / dir.y;
      if (cand > 8 && cand < 120) t = cand;
    }
    const p = o.clone().addScaledVector(dir, t);
    p.y = THREE.MathUtils.clamp(p.y, 7.5, 27);
    p.x = THREE.MathUtils.clamp(p.x, -28, 28);
    p.z = THREE.MathUtils.clamp(p.z, -36, -3);
    return p;
  }

  /* --------------------------------------------------------------- audio */

  ensureAudio() {
    if (this.audioReady) return;
    this.audio.init();
    this.audioReady = true;
    this.audio.setMasterVolume(Number(this.dom.volume.value) / 100);
    // Sound effects start on the first interaction (browser autoplay policy);
    // music stays off until the visitor asks for it.
    this.audio.setSfx(true);
    this._syncSoundButtons();
  }

  _syncSoundButtons() {
    const s = this.dom.btnSound;
    const m = this.dom.btnMusic;
    s.dataset.on = String(this.audio.sfxEnabled);
    s.classList.toggle('is-on', this.audio.sfxEnabled);
    m.dataset.on = String(this.audio.musicEnabled);
    m.classList.toggle('is-on', this.audio.musicEnabled);
  }

  toggleSound(force) {
    this.ensureAudio();
    const next = force ?? !this.audio.sfxEnabled;
    this.audio.setSfx(next);
    if (!next) this.audio.stopAllLoops();
    this._syncSoundButtons();
    this.toast(next ? 'Sound effects on' : 'Sound effects off', 1400);
  }

  toggleMusic(force) {
    this.ensureAudio();
    const next = force ?? !this.audio.musicEnabled;
    this.audio.setMusic(next);
    if (next && !this.audio.sfxEnabled) this.audio.setSfx(true);
    this._syncSoundButtons();
    this.toast(next ? 'Background music on 🎵' : 'Background music off', 1400);
  }

  /* ------------------------------------------------------------- settings */

  setIntensity(v, silent) {
    this.intensity = THREE.MathUtils.clamp(v, 0, 2);
    this.dom.intensity.value = String(this.intensity);
    this.dom.intensityVal.textContent = INTENSITY[this.intensity].name;
    if (!silent) this.toast(`Fireworks intensity: ${INTENSITY[this.intensity].name}`, 1400);
  }

  setDensity(v, silent) {
    this.densityPct = v;
    this.dom.density.value = String(v);
    this.dom.densityVal.textContent = `${v}%`;
    this._applyDensity();
    if (!silent) this.toast(`Explosion density: ${v}%`, 1200);
  }

  _applyDensity() {
    const base = this.densityPct / 100;
    const q = this.lowPerf ? 0.6 : 1;
    this.fx.setDensity(base * q);
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.midnight;
    this.theme = name;
    this.skyUniforms.uTop.value.set(t.top);
    this.skyUniforms.uHorizon.value.set(t.horizon);
    this.skyUniforms.uBottom.value.set(t.bottom);
    this.scene.fog.color.set(t.fog);
    this.renderer.setClearColor(new THREE.Color(t.bottom), 1);
    if (this.bloom) this.bloom.strength = t.bloom * (this.lowPerf ? 0.6 : 1);
    if (this.keyLight) this.keyLight.color.set(t.accent);
    if (this.groundGlow) this.groundGlow.material.color.set(t.accent);
    if (this.cloudMaterials) {
      const tint = new THREE.Color(t.accent);
      this.cloudMaterials.forEach((m) => m.uniforms.uTint.value.copy(tint));
    }
    document.documentElement.style.setProperty('--accent', t.accent);
    if (this.dom.themes) {
      this.dom.themes.querySelectorAll('.theme').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.theme === name);
      });
    }
  }

  setLowPerf(on) {
    this.lowPerf = !!on;
    const d = this.dom;
    d.btnQuality.classList.toggle('is-on', this.lowPerf);
    d.btnQuality.dataset.on = String(this.lowPerf);

    this.renderer.setPixelRatio(this.lowPerf ? 1 : Math.min(window.devicePixelRatio || 1, isCoarse ? 1.6 : 1.85));
    if (this.bloom) {
      this.bloom.enabled = !this.lowPerf;
      this.bloom.strength = (THEMES[this.theme]?.bloom ?? 0.95) * (this.lowPerf ? 0.6 : 1);
    }
    if (this.fx.smoke) this.fx.smoke.points.visible = !this.lowPerf;
    if (this.stars) this.stars.visible = true;
    this._applyDensity();
    this.onResize(true);
    this.toast(this.lowPerf ? 'Low performance mode on' : 'Full quality mode on', 1600);
  }

  toggleSettings(force) {
    this.settingsOpen = force ?? !this.settingsOpen;
    this.dom.settings.classList.toggle('is-open', this.settingsOpen);
  }

  /* ------------------------------------------------------------ fireworks */

  /**
   * One sky explosion with random variety: single breaks, multi-layer shells,
   * massive rainbow shells, golden rain and coloured smoke.
   * @param {THREE.Vector3} p
   * @param {{type?:string, mega?:boolean, quiet?:boolean, simple?:boolean}} [opts]
   */
  spawnBurstAt(p, opts = {}) {
    this.ensureAudio();
    const pal = randomPalette();
    const pattern = PATTERNS[(Math.random() * PATTERNS.length) | 0];
    const scale = 0.75 + this.intensity * 0.35;

    let type = opts.type;
    if (!type) {
      const r = Math.random();
      if (opts.simple) type = r < 0.5 ? 'plain' : 'shell';
      else if (opts.mega) type = 'rainbow';
      else if (r < 0.09 + this.intensity * 0.03) type = 'rainbow';
      else if (r < 0.26) type = 'multi';
      else if (r < 0.46) type = 'shell';
      else if (r < 0.58) type = 'rain';
      else if (r < 0.70) type = 'smoke';
      else type = 'plain';
    }

    switch (type) {
      case 'rainbow':
        this.fx.rainbowShell(p);
        break;
      case 'multi':
        this.fx.airShell(p, {
          palette: pal, layers: 4,
          glitter: 70 + Math.random() * 90,
          rain: Math.random() < 0.45, smoke: Math.random() < 0.35,
        });
        break;
      case 'shell':
        this.fx.airShell(p, { palette: pal, layers: 3, glitter: 60 + Math.random() * 60 });
        break;
      case 'rain':
        this.fx.burst(p, {
          count: 90, colors: PALETTES.gold, speed: 8.5, spread: 0.6, pattern: 'willow',
          life: 2.4, size: 0.1, gravity: 4.4, drag: 0.9, flicker: 22,
        });
        this.fx.goldenRain(p, { count: 220, radius: 6.4, life: 3.2 });
        break;
      case 'smoke':
        this.fx.burst(p, {
          count: 80, colors: pal, speed: 6.8, spread: 0.62, pattern: 'sphere',
          life: 1.5, size: 0.105, gravity: 4.2, drag: 1.25,
        });
        this.fx.colorSmoke(p, {
          colors: [PALETTES.magenta, PALETTES.emerald, PALETTES.sapphire, PALETTES.crimson, PALETTES.violet],
          count: 14, size: 3.4,
        });
        break;
      default:
        this.fx.burst(p, {
          count: (170 + Math.random() * 150) * scale,
          colors: pal,
          speed: (11 + Math.random() * 8) * (0.85 + this.intensity * 0.12),
          spread: 0.5,
          pattern,
          life: 1.6 + Math.random() * 0.9,
          size: 0.115,
          gravity: 4.8,
          drag: 1.0,
          flicker: Math.random() < 0.35 ? 20 : 0,
          glitter: Math.random() < 0.4 ? 60 : 0,
        });
        break;
    }

    this.lastBurst = { type, p: p.clone() };
    if (!opts.quiet) {
      this.audio.explosion(0.45 + Math.random() * 0.4);
      this.shake(0.14, 0.4);
    }
  }

  /** Two rapid, layered breaks — the "double pataka" for a double tap. */
  doubleExplosion(p) {
    this.ensureAudio();
    const p2 = p.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 3.4, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 3.4
    ));

    this.fx.burst(p, {
      count: 210, colors: randomPalette(), speed: 13, spread: 0.42, pattern: 'doubleRing',
      life: 1.8, size: 0.125, gravity: 4.6, drag: 0.95, glitter: 60,
    });
    this.fx.glitter(p, { count: 70, spread: 4, life: 2.6 });

    this.fx.schedule(0.16, () => {
      this.fx.burst(p2, {
        count: 230, colors: randomPalette(), speed: 14.5, spread: 0.45, pattern: 'chrysanthemum',
        life: 1.9, size: 0.125, gravity: 4.8, drag: 0.95, glitter: 70,
      });
      this.fx.goldenRain(p2, { count: 140, radius: 5.6, life: 3.0 });
      this.fx.colorSmoke(p2, { colors: [PALETTES.rainbow[0], PALETTES.rainbow[3]], count: 8, size: 2.8 });
    });

    this.lastBurst = { type: 'double', p: p.clone() };
    this.audio.explosion(0.7);
    setTimeout(() => this.audio.blast(), 170);
    this.shake(0.24, 0.55);
    this.screenFX.flashNow(0xfff0c0, 0.13);
  }

  /** Nudge a whole volley of fireworks into the sky (used by the hold stream). */
  _launchCometTo(to) {
    const from = new THREE.Vector3(to.x + (Math.random() - 0.5) * 5, 0.6, to.z + 4 + Math.random() * 5);
    this._spawnComet(from, to, { volley: 1 + ((Math.random() * 1.6) | 0) });
  }

  launchComet() {
    const to = new THREE.Vector3(
      (Math.random() - 0.5) * 24,
      10 + Math.random() * 11,
      -7 - Math.random() * 20
    );
    const from = new THREE.Vector3(
      to.x + (Math.random() - 0.5) * 5,
      0.6,
      to.z + 4 + Math.random() * 5
    );
    this._spawnComet(from, to, { volley: 1 + ((Math.random() * 2.4) | 0) });
  }

  _spawnComet(from, to, { volley = 1 } = {}) {
    const c = {
      from, to,
      pos: from.clone(),
      t: 0,
      dur: 0.85 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 2.2,
      palette: randomPalette(),
      pattern: PATTERNS[(Math.random() * PATTERNS.length) | 0],
      volley,
    };
    this.comets.push(c);
    this.fx.addEmitter({
      duration: c.dur,
      rate: 220,
      getPosition: () => c.pos,
      spawn: (p) => this.fx.trail(p, c.palette[0], 0.65, 2),
    });
    this.audio.rocketLaunch();
  }


  _updateComets(dt) {
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.t += dt;
      const k = Math.min(1, c.t / c.dur);
      const ascent = 1 - Math.pow(1 - k, 2);
      c.pos.lerpVectors(c.from, c.to, ascent);
      c.pos.x += Math.sin(k * Math.PI) * c.drift;
      if (k >= 1) {
        for (let v = 0; v < c.volley; v++) {
          const p = c.to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3));
          this.fx.burst(p, {
            count: 160 + Math.random() * 140,
            colors: Math.random() < 0.3 ? randomPalette() : c.palette,
            speed: 11 + Math.random() * 8,
            spread: 0.5, pattern: c.pattern,
            life: 1.7, size: 0.115, gravity: 4.7, drag: 1.0,
            flicker: Math.random() < 0.4 ? 18 : 0,
          });
        }
        this.audio.explosion(0.5 + Math.random() * 0.4);
        this.shake(0.16 + Math.random() * 0.14, 0.4);
        this.comets.splice(i, 1);
      }
    }
  }

  welcomeVolley() {
    this.spawnBurstAt(new THREE.Vector3(-7, 15, -12));
    this.spawnBurstAt(new THREE.Vector3(7, 17, -14));
    setTimeout(() => this.launchComet(), 350);
    setTimeout(() => this.launchComet(), 800);
    // A ground fountain greeting behind the crackers.
    this.fx.fountain(new THREE.Vector3(0, 0.4, -6), {
      duration: 1.6, rate: 160, speed: 11, colors: PALETTES.gold, spread: 0.5, life: 1.5, size: 0.1, gravity: 5.2,
    });
    this.audio.explosion(0.8);
  }

  toggleRandom(force) {
    this.modeRandom = force ?? !this.modeRandom;
    this.dom.btnRandom.dataset.on = String(this.modeRandom);
    this.dom.btnRandom.classList.toggle('is-on', this.modeRandom);
    this.autoTimer = 0.6;
    if (this.modeRandom) this.enterCelebration();
    this.toast(this.modeRandom ? 'Random fireworks mode on 🎆' : 'Random fireworks mode off', 1600);
  }

  toggleContinuous(force) {
    this.modeContinuous = force ?? !this.modeContinuous;
    this.dom.btnContinuous.dataset.on = String(this.modeContinuous);
    this.dom.btnContinuous.classList.toggle('is-on', this.modeContinuous);
    this.autoTimer = 0.4;
    if (this.modeContinuous) this.enterCelebration();
    this.toast(this.modeContinuous ? 'Continuous celebration on 🪔' : 'Continuous celebration off', 1600);
  }

  _updateModes(dt) {
    if (!this.modeRandom && !this.modeContinuous) return;
    this.autoTimer -= dt;
    if (this.autoTimer > 0) return;

    const cfg = INTENSITY[this.intensity];
    let interval = this.modeContinuous ? cfg.interval * 0.6 : cfg.interval;
    let volley = cfg.volley + (this.modeContinuous ? 1 : 0);
    if (this.lowPerf) { interval *= 1.5; volley = Math.max(1, volley - 1); }
    this.autoTimer = interval * (0.7 + Math.random() * 0.6);

    for (let i = 0; i < volley; i++) {
      setTimeout(() => {
        if (this.modeRandom || this.modeContinuous) this.launchComet();
      }, i * 160);
    }

    if (this.modeContinuous && Math.random() < 0.3) {
      const n = this.crackers.crackers.length;
      const idx = (Math.random() * n) | 0;
      setTimeout(() => { if (this.modeContinuous) this.crackers.trigger(idx); }, 300 + Math.random() * 400);
    }
  }

  /* ------------------------------------------------- cinematic extras */

  /** Enter/exit a temporary slow-motion window (auto-restores afterwards). */
  _enterSlowMo(scale = 0.35, ms = 2600) {
    this.timeScale = scale;
    if (this._slowMoTimer) clearTimeout(this._slowMoTimer);
    this._slowMoTimer = setTimeout(() => {
      this._slowMoTimer = null;
      if (!this.slowMo) this.timeScale = 1;
    }, ms);
  }

  toggleSlowMotion(force) {
    this.slowMo = force ?? !this.slowMo;
    if (this._slowMoTimer) { clearTimeout(this._slowMoTimer); this._slowMoTimer = null; }
    this.timeScale = this.slowMo ? 0.34 : 1;
    this._syncExtraButtons();
    this.audio.slowMo(this.slowMo);
    this.toast(this.slowMo ? 'Slow-motion mode on 🎬' : 'Slow-motion off', 1500);
  }

  /** Replay the most recent explosion in slow motion. */
  replayLastExplosion() {
    if (!this.lastBurst) {
      this.toast('Tap the sky first, then replay it 🎬', 1800);
      return;
    }
    const lb = this.lastBurst;
    this._enterSlowMo(0.34, 2800);
    this._syncExtraButtons();

    this.fx.schedule(0.05, () => {
      switch (lb.type) {
        case 'rainbow': this.fx.rainbowShell(lb.p); break;
        case 'double': this.doubleExplosion(lb.p); break;
        case 'rain':
          this.fx.burst(lb.p, { count: 90, colors: PALETTES.gold, speed: 8.5, spread: 0.6, pattern: 'willow', life: 2.4, size: 0.1, gravity: 4.4, drag: 0.9, flicker: 22 });
          this.fx.goldenRain(lb.p, { count: 220, radius: 6.4, life: 3.2 });
          break;
        case 'smoke':
          this.fx.burst(lb.p, { count: 80, colors: randomPalette(), speed: 6.8, spread: 0.62, pattern: 'sphere', life: 1.5, size: 0.105, gravity: 4.2, drag: 1.25 });
          this.fx.colorSmoke(lb.p, { colors: PALETTES.rainbow, count: 14, size: 3.4 });
          break;
        case 'multi':
        case 'shell': this.fx.airShell(lb.p, { layers: 4, rain: true, glitter: 110 }); break;
        default:
          this.fx.burst(lb.p, { count: 240, colors: randomPalette(), speed: 12, spread: 0.48, pattern: PATTERNS[(Math.random() * PATTERNS.length) | 0], life: 1.9, size: 0.12, gravity: 4.8, drag: 1.0, glitter: 70 });
          break;
      }
      this.audio.explosion(0.65);
      this.shake(0.1, 0.5);
    });
    this.toast('Slow-motion replay 🎬', 1700);
  }

  /** Hide the whole HUD for a full-screen, game-like celebration view. */
  toggleCinematic(force) {
    this.cinematic = force ?? !this.cinematic;
    document.body.classList.toggle('is-cinematic', this.cinematic);
    if (this.cinematic) {
      this.enterCelebration();
      this.toggleSettings(false);
      if (!document.fullscreenElement) this.toggleFullscreen();
      this.toast('Cinematic mode — tap ✕ to exit 🎬', 2400);
    } else {
      this.toast('Cinematic mode off', 1200);
    }
    this._syncExtraButtons();
  }

  _syncExtraButtons() {
    const d = this.dom;
    if (d.btnSlowMo) {
      d.btnSlowMo.classList.toggle('is-on', this.slowMo);
      d.btnSlowMo.dataset.on = String(this.slowMo);
    }
    if (d.btnCinematic) {
      d.btnCinematic.classList.toggle('is-on', this.cinematic);
      d.btnCinematic.dataset.on = String(this.cinematic);
    }
    // In cinematic mode a single exit button replaces the regular close button.
    if (d.btnCinema2) d.btnCinema2.classList.toggle('is-hidden', !this.cinematic);
    if (d.btnBackHome) d.btnBackHome.classList.toggle('is-hidden', this.cinematic);
  }

  /* ------------------------------------------------------------- camera */

  shake(amount, duration = 0.4) {
    this._shakeAmt = Math.max(this._shakeAmt, amount);
    this._shakeDur = duration;
    this._shakeT = 0;
  }

  _updateCamera(dt) {
    const smooth = (a, b, k) => a + (b - a) * (1 - Math.exp(-k * dt));

    let goalPos;
    let goalTarget;

    if (this.camMode === 'focus' && this.crackers.selected >= 0) {
      const f = this.crackers.focusTarget(this.crackers.selected);
      goalTarget = f.position;
      goalPos = new THREE.Vector3(
        f.position.x * 0.92,
        f.position.y + f.height,
        f.position.z + f.distance
      );
    } else {
      const H = this.wide ? 18 : 20;
      const Yc = this.wide ? 10.5 : 11.2;
      const a = Math.sin(this.time * 0.07) * 0.42 + this.orbitOffset;
      goalPos = new THREE.Vector3(Math.sin(a) * H, Yc + (this.camElev ?? 0), Math.cos(a) * H);
      goalTarget = new THREE.Vector3(0, this.wide ? 8.2 : 8.5, 0);
    }

    this.camPos.x = smooth(this.camPos.x, goalPos.x, 2.6);
    this.camPos.y = smooth(this.camPos.y, goalPos.y, 2.6);
    this.camPos.z = smooth(this.camPos.z, goalPos.z, 2.6);
    this.camTarget.x = smooth(this.camTarget.x, goalTarget.x, 3.2);
    this.camTarget.y = smooth(this.camTarget.y, goalTarget.y, 3.2);
    this.camTarget.z = smooth(this.camTarget.z, goalTarget.z, 3.2);

    // idle breathing
    const bx = Math.sin(this.time * 0.31) * 0.12;
    const by = Math.sin(this.time * 0.42 + 1.3) * 0.09;

    let sx = 0, sy = 0, sz = 0;
    if (this._shakeT < this._shakeDur) {
      this._shakeT += dt;
      const f = 1 - this._shakeT / this._shakeDur;
      const m = this._shakeAmt * f * f;
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
      sz = (Math.random() - 0.5) * m * 0.5;
      if (this._shakeT >= this._shakeDur) this._shakeAmt = 0;
    }

    this.camera.position.set(this.camPos.x + bx + sx, this.camPos.y + by + sy, this.camPos.z + sz);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + by * 0.5, this.camTarget.z);
    if (this.skyDecor) {
      this.skyDecor.position.copy(this.camera.position);
      this.skyDecor.quaternion.copy(this.camera.quaternion);
    }
  }

  /* --------------------------------------------------------------- views */

  enterCelebration() {
    this.dom.landing.classList.add('is-hidden');
    this.dom.celebration.classList.remove('is-hidden');
    this.camMode = 'overview';
    if (!this._celebrated) {
      this._celebrated = true;
      setTimeout(() => this.toast('Tap a cracker, or tap the sky to launch a firework ✨', 3600), 900);
    }
  }

  exitToHome() {
    this.dom.celebration.classList.add('is-hidden');
    this.dom.landing.classList.remove('is-hidden');
    this.crackers.deselect();
    this.camMode = 'overview';
    this.toggleSettings(false);
  }

  activateCracker(i) {
    this.ensureAudio();
    this.enterCelebration();
    this.crackers.select(i, true);
    this.camMode = 'focus';
    this.focusIndex = i;
    this.crackers.trigger(i);
  }

  _onCrackerSelected(c) {
    if (!c) return;
    this.cards.forEach((el, i) => {
      const on = i === c.index;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
      if (on) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  _updateDockNav() {
    const { dock, dockPrev, dockNext } = this.dom;
    const max = Math.max(0, dock.scrollWidth - dock.clientWidth);
    const hasOverflow = max > 2;
    dockPrev.hidden = !hasOverflow;
    dockNext.hidden = !hasOverflow;
    dockPrev.disabled = !hasOverflow || dock.scrollLeft <= 2;
    dockNext.disabled = !hasOverflow || dock.scrollLeft >= max - 2;
  }

  /* -------------------------------------------------------------- extras */

  showGreeting(on) {
    this.greetingOpen = on ?? !this.greetingOpen;
    this.dom.greeting.classList.toggle('is-hidden', !this.greetingOpen);
    if (this.greetingOpen) {
      this.ensureAudio();
      this.spawnBurstAt(new THREE.Vector3(0, 16, -13));
    }
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el).catch?.(() => {});
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  }

  _syncFullscreenLabel() {
    this.dom.btnFullscreen.classList.toggle('is-on', !!document.fullscreenElement);
  }

  async share() {
    const data = {
      title: 'Happy Diwali 2026',
      text: 'Experience the magic of lights — a 3D virtual Diwali celebration ✨🪔',
      url: window.location.href,
    };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      this.toast('Celebration link copied to clipboard 🔗', 2400);
    } catch (e) {
      this.toast('Copy this link to share: ' + data.url, 4200);
    }
  }

  restart() {
    this.fx.clearAll();
    this.crackers.stopAll();
    this.crackers.crackers.forEach((c) => {
      if ('phase' in c) { c.phase = 'idle'; c.t = 0; }
      c.active = false;
      c.group.visible = true;
      c.group.position.set(c.homeX, c.homeY, c.homeZ);
      c.group.rotation.set(0, 0, 0);
      c.group.scale.setScalar(c.layoutScale);
    });
    this.comets.length = 0;
    this.modeRandom = false;
    this.modeContinuous = false;
    this.dom.btnRandom.classList.remove('is-on');
    this.dom.btnContinuous.classList.remove('is-on');
    this.dom.btnRandom.dataset.on = 'false';
    this.dom.btnContinuous.dataset.on = 'false';
    this.audio.stopAllLoops();
    this.crackers.deselect();
    this.camMode = 'overview';
    this.orbitOffset = 0;
    this.camElev = 0;
    this.toggleSettings(false);
    this.exitToHome();
    this.toast('Celebration restarted 🪔', 2000);
  }

  toast(msg, ms = 2400) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    this.dom.toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  /* ------------------------------------------------------------ lifecycle */

  _fakeLoad() {
    let p = 0;
    const fill = this.dom.loaderFill;
    const pct = this.dom.loaderPct;
    const tick = () => {
      p += Math.random() * 16 + 6;
      if (p > 100) p = 100;
      fill.style.width = p + '%';
      pct.textContent = Math.floor(p) + '%';
      if (p < 100) {
        setTimeout(tick, 90 + Math.random() * 140);
      } else {
        setTimeout(() => {
          this.dom.loader.classList.add('is-hidden');
          document.body.classList.add('ready');
          setTimeout(() => { if (!this.greetingOpen) this.welcomeVolley(); }, 500);
        }, 350);
      }
    };
    setTimeout(tick, 220);
  }

  onResize(force) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = this.renderer.getPixelRatio();

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);

    this.fx.setViewportSize(Math.floor(h * dpr), this.camera.fov);
    this.screenFX.lowPerf = this.lowPerf;
    this.screenFX.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));

    const wide = w / h >= 1.05;
    if (this.moon && this.moonGlow) {
      const x = wide ? -38 : -14;
      const y = wide ? 37 : 34;
      const scale = wide ? 1 : 0.84;
      this.moon.position.set(x, y, -130);
      this.moon.scale.setScalar(scale);
      this.moonGlow.position.set(x, y, -131);
      this.moonGlow.scale.set(39 * scale, 39 * scale, 1);
    }
    if (force || wide !== this.wide) {
      this.wide = wide;
      this.crackers.layout(wide);
    }
    this._updateDockNav();
  }

  _frame() {
    if (document.hidden) return;
    const real = Math.min(this.clock.getDelta(), 0.05);
    const dt = real * this.timeScale;   // simulation time (slow-motion aware)
    this.time += real;

    // ambient world (kept at real time so the sky and camera stay lively)
    this.motes.update(real);
    for (const d of this.diyas) {
      d.group.position.y = d.baseY + Math.sin(this.time * d.bobSpeed + d.phase) * d.bobAmp;
      d.group.rotation.y += real * 0.12;
      const fl = 0.8 + Math.random() * 0.5;
      d.flame.scale.set(fl, 0.85 + Math.random() * 0.4, fl);
      d.glow.material.opacity = 0.55 + Math.random() * 0.3;
    }
    this.starMat.uniforms.uTime.value = this.time;
    this.cloudMaterials.forEach((m) => { m.uniforms.uTime.value = this.time; });
    this.moonGlow.material.opacity = 0.2 + Math.sin(this.time * 0.45) * 0.025;
    this.stars.rotation.y += real * 0.006;
    this.groundGlow.material.opacity = 0.62 + Math.sin(this.time * 1.4) * 0.09;

    // simulation (scaled so slow-motion reads clearly)
    this._updateModes(dt);
    this._updateComets(dt);
    this._updateHoldStream(dt);
    this.crackers.update(dt);
    this.fx.update(dt, this.camera);
    this.screenFX.update(real);
    this._updateCamera(real);

    this.composer.render();
  }
}

/* -------------------------------------------------------------------- boot */

const app = new DiwaliExperience();
window.__DIWALI__ = app;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}
