/* ============================================================================
 * crackers.js — Eighteen hand-built virtual crackers with unique animations.
 * ----------------------------------------------------------------------------
 *  1. Flower Pot  → golden spark fountain that rises and falls, glowing smoke
 *  2. Rocket      → 3D rocket lifts off with an exhaust trail, sky explosion
 *  3. Chakri      → disc spins up fast, throws circular spark trails
 *  4. Anar        → tall colourful column fountain, gold + silver sparks
 *  5. Sparkler    → press & hold for a continuous sizzling spark stream
 *  6. Virtual Blast → huge multi-pattern explosion, shockwaves, camera shake
 *  7-18. Twelve additional digital crackers, each with a distinct model and effect.
 *
 * SAFETY: these are purely visual 3D models. They cannot ignite or control
 * any real firecracker or explosive device — nothing here is physical.
 * ==========================================================================*/

import * as THREE from 'three';
import { PALETTES } from './fireworks.js';

/* ------------------------------------------------------------------ helpers */

function mat(opts) {
  return new THREE.MeshStandardMaterial({
    metalness: 0.55,
    roughness: 0.42,
    envMapIntensity: 0.55,
    emissiveIntensity: 0.7,
    ...opts,
  });
}

const MAT = {
  gold: () => mat({ color: 0xe8bc63, metalness: 1.0, roughness: 0.24, emissive: 0x4a3208, emissiveIntensity: 0.6 }),
  goldDark: () => mat({ color: 0xa87a26, metalness: 1.0, roughness: 0.35, emissive: 0x2a1c04, emissiveIntensity: 0.5 }),
  clay: () => mat({ color: 0x8a3a24, metalness: 0.15, roughness: 0.85, emissive: 0x2a0a04, emissiveIntensity: 0.5 }),
  clayDark: () => mat({ color: 0x5d2517, metalness: 0.15, roughness: 0.9, emissive: 0x180603, emissiveIntensity: 0.5 }),
  red: () => mat({ color: 0xbe2a22, metalness: 0.35, roughness: 0.5, emissive: 0x3a0805, emissiveIntensity: 0.6 }),
  silver: () => mat({ color: 0xd8dee8, metalness: 1.0, roughness: 0.22, emissive: 0x141820, emissiveIntensity: 0.5 }),
  glow: (c = 0xffd27a) => mat({ color: c, metalness: 0.1, roughness: 0.6, emissive: c, emissiveIntensity: 1.4 }),
};

/* --------------------------------------------------------------- base class */

class Cracker {
  constructor(ctx, meta) {
    this.ctx = ctx;
    this.id = meta.id;
    this.name = meta.name;
    this.desc = meta.desc;
    this.icon = meta.icon;

    this.group = new THREE.Group();
    this.group.userData.crackerId = meta.id;
    this.layoutScale = 1;
    this.hl = 0;
    this.hlTarget = 0;
    this.time = Math.random() * 10;
    this.active = false;
    this.materials = [];
    this._tmp = new THREE.Vector3();

    this.build();
    this.group.traverse((o) => {
      o.userData.crackerId = meta.id;
      if (o.isMesh && o.material && 'emissiveIntensity' in o.material) {
        o.material.userData.baseEmissive = o.material.emissiveIntensity;
        this.materials.push(o.material);
      }
    });
    this.addPlatform();
  }

  addPlatform() {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.06, 36), MAT.goldDark());
    disc.position.y = -0.03;
    this.platform = disc;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.86, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffc978, transparent: true, opacity: 0.28,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.platformRing = ring;

    this.group.add(disc, ring);
  }

  setHighlight(on) { this.hlTarget = on ? 1 : 0; }

  trigger() {}
  release() {}

  update(dt) {
    this.time += dt;
    this.hl += (this.hlTarget - this.hl) * Math.min(1, dt * 7);
    const s = this.layoutScale * (1 + this.hl * 0.07);
    this.group.scale.setScalar(s);
    for (const m of this.materials) {
      m.emissiveIntensity = m.userData.baseEmissive * (1 + this.hl * 0.9 + Math.sin(this.time * 3) * 0.05);
    }
    if (this.platformRing) {
      this.platformRing.material.opacity = 0.18 + this.hl * 0.42 + Math.sin(this.time * 2.4) * 0.05;
      this.platformRing.scale.setScalar(1 + this.hl * 0.12 + Math.sin(this.time * 2.4) * 0.015);
    }
  }

  /** World position of a local point (used to anchor particle emitters). */
  worldPoint(localX, localY, localZ, out) {
    out = out || this._tmp;
    out.set(localX, localY, localZ);
    return this.group.localToWorld(out);
  }
}

/* ============================================================ 1. FLOWER POT */

class FlowerPotCracker extends Cracker {
  build() {
    const g = this.group;

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.46, 0.66, 28, 1, true), MAT.clay());
    body.position.y = 0.33;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 28), MAT.clayDark());
    bottom.position.y = 0.03;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.045, 14, 30), MAT.gold());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.66;

    // golden bands
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.36 + i * 0.03, 0.018, 10, 32), MAT.gold());
      b.rotation.x = Math.PI / 2;
      b.position.y = 0.22 + i * 0.22;
      g.add(b);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 0.22, 24), MAT.goldDark());
    neck.position.y = 0.78;
    const mouth = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.26, 24, 1, true), MAT.gold());
    mouth.position.y = 0.98;

    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), MAT.glow(0xffcf78));
    this.core.position.y = 0.9;

    // decorative marigold ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), MAT.glow(0xff9a2e));
      petal.position.set(Math.cos(a) * 0.28, 0.70, Math.sin(a) * 0.28);
      g.add(petal);
    }

    g.add(body, bottom, rim, neck, mouth, this.core);

    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 1.02, 0);
    g.add(this.tip);
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.duration = 3.0;
    const fx = this.ctx.fireworks;

    // Golden fountain: long-lived sparks that rise then fall naturally.
    this.emitter = fx.addEmitter({
      duration: this.duration,
      rate: 320,
      smoke: 26,
      getPosition: () => this.tip.getWorldPosition(this._tmp),
      spawn: (p) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.random() * 1.6;
        const sp = 10.5 * (0.5 + Math.random() * 0.85);
        const c = Math.random() < 0.62 ? PALETTES.gold[0] : (Math.random() < 0.5 ? PALETTES.gold[1] : PALETTES.saffron[0]);
        fx.sparks.spawn(
          p.x + Math.cos(a) * 0.04, p.y, p.z + Math.sin(a) * 0.04,
          Math.cos(a) * r, sp, Math.sin(a) * r,
          c[0], c[1], c[2],
          0.085 * (0.6 + Math.random() * 0.9),
          1.5 * (0.6 + Math.random() * 0.8),
          0.72, 5.4, 30, 0
        );
      },
    });

    this.ctx.audio.sparkle(3, 0.8);
    this.ctx.audio.startLoop('fountain');
    this.ctx.onShake(0.1, 0.5);
  }

  update(dt) {
    super.update(dt);
    if (this.active) {
      this.timer += dt;
      const k = 1 - this.timer / this.duration;
      this.core.scale.setScalar(1 + Math.max(0, k) * 2.4);
      this.group.position.x = this.homeX + Math.sin(this.timer * 42) * 0.012 * Math.max(0, k);
      if (this.timer >= this.duration) {
        this.active = false;
        this.core.scale.setScalar(1);
        this.group.position.x = this.homeX;
        this.ctx.audio.stopLoop('fountain');
        this.ctx.fireworks.smokePuff(this.tip.getWorldPosition(this._tmp), { size: 1.6, count: 6, up: 1.0 });
      }
    }
  }
}

/* =============================================================== 2. ROCKET */

class RocketCracker extends Cracker {
  build() {
    const g = this.group;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 1.05, 20), MAT.red());
    body.position.y = 0.72;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 20), MAT.gold());
    nose.position.y = 1.45;
    const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 10, 24), MAT.gold());
    band1.rotation.x = Math.PI / 2; band1.position.y = 1.02;
    const band2 = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.022, 10, 24), MAT.gold());
    band2.rotation.x = Math.PI / 2; band2.position.y = 0.42;

    // fins
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.4, 4), MAT.goldDark());
      fin.position.set(Math.cos(a) * 0.19, 0.24, Math.sin(a) * 0.19);
      fin.rotation.y = -a;
      fin.rotation.z = Math.PI;
      fin.scale.set(1, 1, 0.35);
      g.add(fin);
    }

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.7, 8), MAT.silver());
    stick.position.y = -0.35;
    this.engine = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), MAT.glow(0xffb04a));
    this.engine.position.y = 0.18;

    g.add(body, nose, band1, band2, stick, this.engine);

    this.phase = 'idle';
    this.t = 0;
    this.flightDur = 1.45;
    this.apexY = 17;
  }

  trigger() {
    if (this.phase !== 'idle') return;
    this.phase = 'launch';
    this.t = 0;
    this.active = true;
    this.flightDur = 1.35 + Math.random() * 0.35;
    this.startY = this.group.position.y;
    this.apexY = 15 + Math.random() * 8;
    this.driftX = (Math.random() - 0.5) * 4.2;
    this.driftZ = (Math.random() - 0.5) * 2.6;
    this.startX = this.homeX;
    this.startZ = this.homeZ;

    const fx = this.ctx.fireworks;
    // Ignition puff + first sparks
    fx.smokePuff(this.worldPoint(0, 0.12, 0), { size: 1.1, count: 6, up: 0.9 });
    fx.sparks.spawn(
      this.group.position.x, this.group.position.y + 0.12, this.group.position.z,
      0, 0.45, 0, 1, 1, 0.9, 0.22, 0.4, 2.0, 1.5, 40, 0
    );

    this.ctx.audio.rocketLaunch();
    this.ctx.onShake(0.12, 0.7);

    // Continuous exhaust trail while flying.
    this.trail = fx.addEmitter({
      duration: this.flightDur + 0.05,
      rate: 260,
      getPosition: () => this.worldPoint(0, -0.1, 0, this._trailVec || (this._trailVec = new THREE.Vector3())),
      spawn: (p) => {
        fx.trail(p, Math.random() < 0.4 ? [1, 1, 0.92] : [1, 0.78, 0.34], 0.7, 1);
      },
      onEnd: () => { this.trail = null; },
    });
  }

  update(dt) {
    super.update(dt);
    const fx = this.ctx.fireworks;

    if (this.phase === 'launch') {
      this.t += dt;
      const k = Math.min(1, this.t / this.flightDur);
      const e = k * k * (3 - 2 * k); // smooth accel then settle
      this.group.position.y = this.startY + (this.apexY - this.startY) * e;
      this.group.position.x = this.startX + this.driftX * e;
      this.group.position.z = this.startZ + this.driftZ * e;
      this.group.rotation.z = Math.sin(this.t * 18) * 0.05;

      if (this.engine) this.engine.scale.setScalar(1 + Math.random() * 0.8);

      if (k >= 1) {
        this.explode();
        this.phase = 'gone';
        this.t = 0;
      }
    } else if (this.phase === 'gone') {
      this.t += dt;
      this.group.visible = false;
      if (this.t > 1.0) {
        this.phase = 'return';
        this.t = 0;
        this.group.visible = true;
        this.group.position.set(this.homeX, this.homeY, this.homeZ);
        this.group.rotation.z = 0;
        // A small sparkle marks a fresh rocket popping back onto the stand.
        fx.burst(new THREE.Vector3(this.homeX, this.homeY + 0.6, this.homeZ), {
          count: 34, colors: PALETTES.gold, speed: 3.6, spread: 0.4, pattern: 'sphere',
          life: 0.75, size: 0.08, gravity: 4.2, drag: 2.1, smoke: false, light: false, core: false,
        });
        this.ctx.audio.sparkle(2, 0.5);
      }
    } else if (this.phase === 'return') {
      this.t += dt;
      const k = Math.min(1, this.t / 0.45);
      this.group.scale.setScalar(this.layoutScale * k);
      if (k >= 1) {
        this.phase = 'idle';
        this.active = false;
        this.group.scale.setScalar(this.layoutScale);
      }
    }
  }

  explode() {
    const fx = this.ctx.fireworks;
    const p = this.group.position.clone();
    const pal = [PALETTES.crimson, PALETTES.sapphire, PALETTES.magenta, PALETTES.emerald, PALETTES.gold][(Math.random() * 5) | 0];

    fx.burst(p, {
      count: 320, colors: pal, speed: 15, spread: 0.55, pattern: 'sphere',
      life: 1.9, size: 0.12, gravity: 5.0, drag: 1.0, flicker: 0,
    });
    fx.burst(p, {
      count: 90, colors: PALETTES.silver, speed: 8.5, spread: 0.3, pattern: 'ring',
      life: 1.4, size: 0.1, gravity: 5.5, drag: 1.2, flicker: 40,
    });
    fx.smokePuff(p, { size: 3.4, count: 12, up: 0.5 });
    fx.shockwave(p, { color: 0xffd08a, maxRadius: 5.5, duration: 0.7 });

    this.ctx.audio.explosion(0.85);
    this.ctx.onShake(0.5, 0.7);
    this.ctx.onFlash(0xffffff, 0.16, 0.22);
  }
}

/* =============================================================== 3. CHAKRI */

class ChakriCracker extends Cracker {
  build() {
    const g = this.group;

    // stand
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.08, 32), MAT.goldDark());
    stand.position.y = 0.04;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 12), MAT.gold());
    post.position.y = 0.2;

    this.disc = new THREE.Group();
    this.disc.position.y = 0.38;

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 40), MAT.red());
    const underGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 40), MAT.gold());
    underGlow.position.y = -0.04;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), MAT.gold());
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 10, 40), MAT.gold());
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 0.035;

    this.disc.add(top, underGlow, hub, hubRing);

    // rim embers
    this.embers = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), MAT.glow(0xffb347));
      e.position.set(Math.cos(a) * 0.54, 0.045, Math.sin(a) * 0.54);
      this.disc.add(e);
      this.embers.push(e);
    }

    g.add(stand, post, this.disc);

    // Ground light ring that appears while spinning
    this.lightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.6, 56),
      new THREE.MeshBasicMaterial({ color: 0xffb75e, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.lightRing.rotation.x = -Math.PI / 2;
    this.lightRing.position.y = 0.02;
    g.add(this.lightRing);

    this.spin = 0;
    this.spinSpeed = 0;
    this.spinning = false;
    this.timer = 0;
    this.duration = 3.4;
  }

  trigger() {
    if (this.spinning) return;
    this.spinning = true;
    this.active = true;
    this.timer = 0;
    const fx = this.ctx.fireworks;

    this.emitter = fx.addEmitter({
      duration: this.duration,
      rate: 300,
      getPosition: () => {
        const a = this.spin;
        return this.worldPoint(Math.cos(a) * 0.55, 0.42, Math.sin(a) * 0.55, this._rimVec || (this._rimVec = new THREE.Vector3()));
      },
      spawn: (p) => {
        const a = this.spin;
        const tx = -Math.sin(a), tz = Math.cos(a);
        const c = Math.random() < 0.5 ? PALETTES.gold[0] : (Math.random() < 0.5 ? PALETTES.saffron[0] : PALETTES.silver[0]);
        const sp = 3.2 + Math.random() * 3.4;
        this.ctx.fireworks.sparks.spawn(
          p.x, p.y + Math.random() * 0.08, p.z,
          tx * sp + Math.cos(a) * 1.4 + (Math.random() - 0.5) * 0.8,
          0.7 + Math.random() * 1.6,
          tz * sp + Math.sin(a) * 1.4 + (Math.random() - 0.5) * 0.8,
          c[0], c[1], c[2],
          0.075 * (0.7 + Math.random() * 0.7),
          0.55 + Math.random() * 0.5,
          1.5, 4.6, 44, 0
        );
      },
    });

    this.ctx.audio.startLoop('chakri');
    this.ctx.audio.sparkle(2, 0.7);
    this.ctx.onShake(0.14, 0.6);
  }

  update(dt) {
    super.update(dt);

    if (this.spinning) {
      this.timer += dt;
      const k = Math.min(1, this.timer / 0.5);
      const fade = this.timer > this.duration - 0.9 ? Math.max(0, (this.duration - this.timer) / 0.9) : 1;
      this.spinSpeed = 42 * k * fade;
      this.disc.rotation.y += this.spinSpeed * dt;
      this.spin += this.spinSpeed * dt;

      const lit = k * fade;
      this.lightRing.material.opacity = lit * 0.5;
      this.lightRing.scale.setScalar(1 + Math.sin(this.time * 14) * 0.04);
      this.lightRing.rotation.z += dt * 1.6;
      this.embers.forEach((e, i) => {
        e.scale.setScalar(1 + lit * (1.2 + Math.sin(this.time * 22 + i) * 0.7));
      });

      if (this.timer >= this.duration) {
        this.spinning = false;
        this.active = false;
        this.spinSpeed = 0;
        this.lightRing.material.opacity = 0;
        this.ctx.audio.stopLoop('chakri');
      }
    } else {
      this.disc.rotation.y += dt * 0.25;
      this.embers.forEach((e, i) => e.scale.setScalar(1 + Math.sin(this.time * 2 + i) * 0.12));
    }
  }
}

/* ================================================================= 4. ANAR */

class AnarCracker extends Cracker {
  build() {
    const g = this.group;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.78, 30), MAT.clay());
    body.position.y = 0.39;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 30), MAT.clayDark());
    base.position.y = 0.03;
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 12, 32), MAT.gold());
    topRing.rotation.x = Math.PI / 2; topRing.position.y = 0.78;
    const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 12, 32), MAT.gold());
    midRing.rotation.x = Math.PI / 2; midRing.position.y = 0.5;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.34, 30, 1, true), MAT.goldDark());
    cone.position.y = 0.96;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 20), MAT.gold());
    nozzle.position.y = 1.12;

    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), MAT.glow(0x9ff0ff));
    this.core.position.y = 1.14;

    // gold/silver studs
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), i % 2 ? MAT.silver() : MAT.gold());
      s.position.set(Math.cos(a) * 0.38, 0.64, Math.sin(a) * 0.38);
      g.add(s);
    }

    g.add(body, base, topRing, midRing, cone, nozzle, this.core);

    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 1.2, 0);
    g.add(this.tip);
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.duration = 3.2;
    const fx = this.ctx.fireworks;

    // Tall narrow column of colourful, alternating gold + silver sparks.
    this.emitter = fx.addEmitter({
      duration: this.duration,
      rate: 300,
      smoke: 14,
      getPosition: () => this.tip.getWorldPosition(this._tmp),
      spawn: (p) => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.random() * 0.55; // tight column
        const sp = 15.5 * (0.62 + Math.random() * 0.6);
        const pick = Math.random();
        const c = pick < 0.42 ? PALETTES.gold[0] : pick < 0.7 ? PALETTES.silver[1]
          : pick < 0.85 ? PALETTES.emerald[0] : PALETTES.sapphire[0];
        fx.sparks.spawn(
          p.x + Math.cos(a) * 0.03, p.y, p.z + Math.sin(a) * 0.03,
          Math.cos(a) * r, sp, Math.sin(a) * r,
          c[0], c[1], c[2],
          0.08 * (0.55 + Math.random() * 0.9),
          1.9 * (0.7 + Math.random() * 0.6),
          0.5, 6.2, 26, 0
        );
      },
    });

    // A bright ball of light at the nozzle.
    fx.flash(this.tip.getWorldPosition(new THREE.Vector3()), [0.7, 1, 1], 4.2, 0.6);
    this.ctx.audio.startLoop('fountain');
    this.ctx.audio.sparkle(4, 0.9);
    this.ctx.onShake(0.16, 0.7);
  }

  update(dt) {
    super.update(dt);
    if (this.active) {
      this.timer += dt;
      const k = Math.max(0, 1 - this.timer / this.duration);
      this.core.scale.setScalar(1 + k * 3.2);
      this.group.position.z = this.homeZ + Math.sin(this.timer * 55) * 0.014 * k;
      if (this.timer >= this.duration) {
        this.active = false;
        this.core.scale.setScalar(1);
        this.group.position.z = this.homeZ;
        this.ctx.audio.stopLoop('fountain');
        this.ctx.fireworks.smokePuff(this.tip.getWorldPosition(this._tmp), { size: 1.8, count: 7, up: 1.2 });
      }
    }
  }
}

/* ============================================================== 5. SPARKLER */

class SparklerCracker extends Cracker {
  build() {
    const g = this.group;
    this.stick = new THREE.Group();
    this.stick.position.y = 0.1;
    this.stick.rotation.z = 0.22;

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.5, 10), MAT.silver());
    rod.position.y = 0.75;
    this.tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), MAT.glow(0xfff0c0));
    this.tipBall.position.y = 1.5;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10), MAT.gold());
    grip.position.y = 0.14;

    this.tip = new THREE.Object3D();
    this.tip.position.y = 1.5;

    this.stick.add(rod, this.tipBall, grip, this.tip);
    g.add(this.stick);

    // small golden holder
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.2, 20), MAT.goldDark());
    holder.position.y = 0.1;
    g.add(holder);

    this.holding = false;
    this.emitter = null;
    this.crackleT = 0;
  }

  trigger() {
    if (this.holding) return;
    this.holding = true;
    this.active = true;
    const fx = this.ctx.fireworks;

    this.emitter = fx.addEmitter({
      duration: Infinity,
      rate: 190,
      getPosition: () => this.tip.getWorldPosition(this._tmp),
      spawn: (p) => {
        // Sparks burst outwards from the tip then drift and cool down.
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const sp = 1.4 + Math.random() * 4.2;
        const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph) * 0.7 + 0.55, dz = Math.sin(ph) * Math.sin(th);
        const c = Math.random() < 0.5 ? [1, 0.97, 0.82] : (Math.random() < 0.5 ? PALETTES.gold[0] : PALETTES.saffron[1]);
        const near = Math.random() < 0.45; // dense cluster hugging the tip
        fx.sparks.spawn(
          p.x + dx * 0.03, p.y + dy * 0.03, p.z + dz * 0.03,
          dx * sp * (near ? 0.25 : 1), dy * sp * (near ? 0.3 : 1), dz * sp * (near ? 0.25 : 1),
          c[0], c[1], c[2],
          0.045 + Math.random() * 0.05,
          0.28 + Math.random() * 0.55,
          1.9, 3.0, 60, 0
        );
      },
    });

    this.ctx.audio.startLoop('sparkler');
  }

  release() {
    if (!this.holding) return;
    this.holding = false;
    this.active = false;
    if (this.emitter !== null) {
      this.ctx.fireworks.removeEmitter(this.emitter);
      this.emitter = null;
    }
    this.ctx.audio.stopLoop('sparkler');
    this.ctx.fireworks.smokePuff(this.tip.getWorldPosition(this._tmp), { size: 0.7, count: 3, up: 0.6 });
  }

  update(dt) {
    super.update(dt);
    const lit = this.holding ? 1 : 0;
    this.tipBall.scale.setScalar(1 + lit * (1.4 + Math.random() * 0.9));
    this.tipBall.material.color.setHex(this.holding ? 0xfff6d8 : 0xffe9a8);
    this.stick.rotation.z = 0.22 + Math.sin(this.time * 1.6) * 0.03;

    if (this.holding) {
      // Slight recoil vibration while burning.
      this.stick.position.x = (Math.random() - 0.5) * 0.02;
      this.crackleT += dt;
      if (this.crackleT > 0.5) { this.crackleT = 0; this.ctx.audio.crackle(0.8); }
    } else {
      this.stick.position.x = 0;
    }
  }
}

/* ========================================================= 6. VIRTUAL BLAST */

class VirtualBlastCracker extends Cracker {
  build() {
    const g = this.group;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.26, 28), MAT.goldDark());
    pedestal.position.y = 0.13;
    const pedestalRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 12, 32), MAT.gold());
    pedestalRing.rotation.x = Math.PI / 2; pedestalRing.position.y = 0.26;

    // floating core orb
    this.orb = new THREE.Group();
    this.orb.position.y = 1.0;

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), MAT.glow(0x7fe6ff));
    core.material.emissiveIntensity = 1.6;

    this.shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.46, 1),
      new THREE.MeshBasicMaterial({ color: 0x8fd8ff, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.shell2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, wireframe: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.orb.add(core, this.shell, this.shell2);
    this.coreMesh = core;

    // orbiting sparks
    this.orbiters = [];
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), MAT.glow(i % 2 ? 0xffc46b : 0x7fe6ff));
      this.orb.add(o);
      this.orbiters.push(o);
    }

    // light beams
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.2, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.beam.position.y = 0.75;

    g.add(pedestal, pedestalRing, this.orb, this.beam);

    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 1.0, 0);
    g.add(this.tip);

    this.charge = 0;
    this.firing = false;
    this.stage = 0;
  }

  trigger() {
    if (this.firing) return;
    this.firing = true;
    this.active = true;
    this.charge = 0;
    this.stage = 0;
    const fx = this.ctx.fireworks;
    const p = this.tip.getWorldPosition(new THREE.Vector3());

    this.ctx.audio.blast();
    this.ctx.onShake(1.0, 0.95);
    this.ctx.onFlash(0xffffff, 0.45, 0.35);

    // Four layered patterns at once = a huge colourful digital explosion.
    fx.burst(p, { count: 420, colors: PALETTES.rainbow, speed: 19, spread: 0.5, pattern: 'sphere', life: 2.2, size: 0.13, gravity: 4.4, drag: 0.95, flicker: 20 });
    fx.burst(p, { count: 200, colors: PALETTES.gold, speed: 11, spread: 0.25, pattern: 'doubleRing', life: 1.6, size: 0.11, gravity: 5.4, drag: 1.15, flicker: 36, smoke: false });
    fx.burst(p, { count: 160, colors: PALETTES.ice, speed: 7.5, spread: 0.2, pattern: 'willow', life: 2.6, size: 0.09, gravity: 2.2, drag: 0.55, smoke: false, light: false });
    fx.burst(p, { count: 120, colors: PALETTES.magenta, speed: 24, spread: 0.35, pattern: 'star', life: 1.5, size: 0.1, gravity: 5.0, drag: 1.05, smoke: false, light: false });

    fx.shockwave(p, { color: 0xfff0c0, maxRadius: 9, duration: 0.85, thickness: 0.06 });
    fx.shockwave(p, { color: 0x7fd8ff, maxRadius: 6.5, duration: 1.1, thickness: 0.09 });
    fx.smokePuff(p, { size: 4.5, count: 16, up: 0.7 });

    // Delayed secondary burst → feels like a real multi-break shell.
    setTimeout(() => {
      if (!this.group.parent) return;
      const q = this.tip.getWorldPosition(new THREE.Vector3());
      q.y += 2.2 + Math.random() * 1.5;
      fx.burst(q, { count: 220, colors: PALETTES.violet, speed: 13, spread: 0.5, pattern: 'chrysanthemum', life: 1.8, size: 0.11, gravity: 4.6, drag: 1.0, flicker: 14 });
      fx.burst(q, { count: 80, colors: PALETTES.silver, speed: 9, spread: 0.3, pattern: 'heart', life: 1.5, size: 0.1, gravity: 4.8, drag: 1.2, smoke: false });
      this.ctx.audio.explosion(0.7);
      this.ctx.onShake(0.4, 0.5);
    }, 420);

    // Lingering sparkling rain.
    this.emitter = fx.addEmitter({
      duration: 1.4,
      rate: 130,
      getPosition: () => this.tip.getWorldPosition(this._tmp),
      spawn: (p2) => {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * 4.5;
        const c = PALETTES.rainbow[(Math.random() * PALETTES.rainbow.length) | 0];
        fx.sparks.spawn(
          p2.x + Math.cos(a) * rr, p2.y + Math.random() * 3.5, p2.z + Math.sin(a) * rr,
          (Math.random() - 0.5) * 2, -0.5 - Math.random() * 2, (Math.random() - 0.5) * 2,
          c[0], c[1], c[2], 0.06 + Math.random() * 0.06,
          1.1 + Math.random() * 1.1, 0.9, 3.4, 40, 0
        );
      },
      onEnd: () => { this.emitter = null; },
    });
  }

  update(dt) {
    super.update(dt);
    const pulse = 1 + Math.sin(this.time * 2.2) * 0.05;

    this.orb.position.y = 1.0 + Math.sin(this.time * 1.4) * 0.06;
    this.orb.rotation.y += dt * 0.5;
    this.shell.rotation.x += dt * 0.7;
    this.shell.rotation.z += dt * 0.4;
    this.shell2.rotation.x -= dt * 0.5;
    this.shell2.rotation.y += dt * 0.6;

    const charge = this.firing ? 1 : 0;
    this.charge += (charge - this.charge) * Math.min(1, dt * 6);
    const s = pulse * (1 + this.charge * 0.45);
    this.orb.scale.setScalar(s);

    this.orbiters.forEach((o, i) => {
      const a = this.time * (1.6 + i * 0.35) + i * 1.05;
      const r = 0.75 + Math.sin(this.time * 2 + i) * 0.12;
      o.position.set(Math.cos(a) * r, Math.sin(a * 1.4) * 0.35, Math.sin(a) * r);
    });

    this.beam.material.opacity = 0.10 + this.charge * 0.3 + Math.sin(this.time * 3) * 0.04;
    this.coreMesh.material.color.setHSL(0.55 + Math.sin(this.time * 0.6) * 0.12, 0.9, 0.65);

    if (this.firing) {
      this.stage += dt;
      if (this.stage > 1.2) { this.firing = false; this.active = false; }
    }
  }

  release() { /* blast is one-shot */ }
}

/* ========================================================= 7. BIJILI */

class BijiliCracker extends Cracker {
  build() {
    const g = this.group;
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.62, 20), MAT.red());
    this.body.position.y = 0.36;
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.08, 20), MAT.gold());
    capTop.position.y = 0.68;
    const capBottom = capTop.clone();
    capBottom.position.y = 0.04;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.257, 0.025, 8, 24), MAT.gold());
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.35;
    this.fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.24, 8), MAT.glow(0xffb347));
    this.fuse.position.set(0.1, 0.8, 0);
    this.fuse.rotation.z = -0.38;
    g.add(this.body, capTop, capBottom, band, this.fuse);
    this.timer = 0;
    this.cooldown = 0;
  }

  trigger() {
    if (this.cooldown > 0) return;
    this.cooldown = 0.55;
    const fx = this.ctx.fireworks;
    const p = this.worldPoint(0, 0.42, 0).clone();
    fx.flash(p, [1, 0.83, 0.5], 3.4, 0.18);
    fx.burst(p, {
      count: 110, colors: [PALETTES.silver[1], PALETTES.gold[0], PALETTES.saffron[0]],
      speed: 10, spread: 0.88, pattern: 'crossette', life: 0.85, size: 0.085,
      gravity: 7.2, drag: 1.8, flicker: 58, smoke: false, light: false,
    });
    this.ctx.audio.bijiliSnap();
    this.ctx.onShake(0.06, 0.16);
  }

  update(dt) {
    super.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.fuse.rotation.z = -0.38 + Math.sin(this.time * 9) * 0.08;
  }
}

/* ======================================================= 8. SUTLI BOMB */

class SutliBombCracker extends Cracker {
  build() {
    const g = this.group;
    this.shell = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.72, 24), MAT.red());
    this.shell.position.y = 0.38;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.09, 24), MAT.goldDark());
    top.position.y = 0.77;
    const ropePoints = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const a = t * Math.PI * 2 * 5;
      ropePoints.push(new THREE.Vector3(Math.cos(a) * 0.385, 0.08 + t * 0.64, Math.sin(a) * 0.385));
    }
    const rope = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePoints), 100, 0.025, 6, false),
      MAT.silver()
    );
    this.fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.28, 8), MAT.glow(0xff8a32));
    this.fuse.position.set(0.14, 0.9, 0);
    this.fuse.rotation.z = -0.48;
    this.ember = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), MAT.glow(0xffe194));
    this.ember.position.set(0.22, 1.03, 0);
    g.add(this.shell, top, rope, this.fuse, this.ember);
    this.phase = 'idle';
    this.timer = 0;
  }

  trigger() {
    if (this.phase === 'fuse') return;
    this.phase = 'fuse';
    this.timer = 0;
    this.active = true;
    this.ctx.audio.sutliFuse();
  }

  update(dt) {
    super.update(dt);
    if (this.phase !== 'fuse') return;
    this.timer += dt;
    this.ember.scale.setScalar(0.7 + Math.random() * (0.8 + this.timer * 0.8));
    this.ember.material.emissiveIntensity = 0.8 + Math.random() * 1.5;
    if ((this.timer * 4 | 0) !== ((this.timer - dt) * 4 | 0)) {
      this.ctx.fireworks.smokePuff(this.worldPoint(0.22, 1.02, 0), {
        size: 0.55, count: 2, color: [0.28, 0.25, 0.23], up: 0.8,
      });
    }
    if (this.timer >= 1.45) {
      this.phase = 'spent';
      this.active = false;
      const p = this.worldPoint(0, 0.55, 0).clone();
      const fx = this.ctx.fireworks;
      fx.burst(p, { count: 270, colors: PALETTES.crimson, speed: 13, spread: 0.5, pattern: 'sphere', life: 1.3, size: 0.12, gravity: 7.1, drag: 1.05 });
      fx.burst(p, { count: 150, colors: PALETTES.gold, speed: 8, spread: 0.4, pattern: 'ring', life: 1.1, size: 0.11, gravity: 6.8, drag: 1.3, smoke: false, light: false });
      fx.shockwave(p, { color: 0xff8d55, maxRadius: 6.4, duration: 0.8, thickness: 0.13 });
      this.ctx.audio.sutliBoom();
      this.ctx.onShake(0.72, 0.65);
      this.ctx.onFlash(0xffd5a0, 0.22);
    }
  }
}

/* ============================================================= 9. PENCIL */

class PencilCracker extends Cracker {
  build() {
    const g = this.group;
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.92, 18), MAT.red());
    this.body.position.y = 0.62;
    this.point = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.58, 18), MAT.gold());
    this.point.position.y = 1.37;
    this.base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.16, 18), MAT.goldDark());
    this.base.position.y = 0.12;
    this.fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.18, 8), MAT.glow(0xffd16a));
    this.fuse.position.y = 1.75;
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.16 + i * 0.012, 0.018, 8, 20), i % 2 ? MAT.silver() : MAT.gold());
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.4 + i * 0.22;
      g.add(stripe);
    }
    g.add(this.body, this.point, this.base, this.fuse);
    this.phase = 'idle';
    this.timer = 0;
    this.duration = 2.4;
  }

  trigger() {
    if (this.phase !== 'idle') return;
    this.phase = 'jet';
    this.timer = 0;
    this.active = true;
    this.ctx.audio.pencilWhistle();
    this.emitter = this.ctx.fireworks.addEmitter({
      duration: this.duration,
      rate: 150,
      getPosition: () => this.worldPoint(0, 1.75, 0),
      spawn: (p) => {
        const a = this.timer * 5.5 + Math.random() * 0.8;
        const c = Math.random() < 0.6 ? PALETTES.sapphire[0] : PALETTES.silver[1];
        this.ctx.fireworks.sparks.spawn(p.x, p.y, p.z,
          Math.cos(a) * (0.8 + Math.random() * 1.1), 12 + Math.random() * 7,
          Math.sin(a) * (0.8 + Math.random() * 1.1),
          c[0], c[1], c[2], 0.075, 1.15, 0.72, 5.5, 26, 0);
      },
    });
    this.ctx.onShake(0.1, 0.4);
  }

  update(dt) {
    super.update(dt);
    this.fuse.rotation.z = Math.sin(this.time * 12) * 0.11;
    if (this.phase !== 'jet') return;
    this.timer += dt;
    this.group.rotation.y += dt * 0.55;
    if (this.timer >= this.duration) {
      this.phase = 'idle';
      this.active = false;
      const p = this.worldPoint(0, 1.8, 0).clone();
      this.ctx.fireworks.burst(p, {
        count: 180, colors: [PALETTES.sapphire[0], PALETTES.ice[1], PALETTES.gold[0]],
        speed: 9, spread: 0.55, pattern: 'star', life: 1.5, size: 0.1, gravity: 5.2,
      });
    }
  }
}

/* ======================================================= 10. GROUND CHAKKAR */

class GroundChakkarCracker extends Cracker {
  build() {
    const g = this.group;
    this.rotor = new THREE.Group();
    this.rotor.position.y = 0.32;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 40), MAT.red());
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.045, 10, 40), MAT.gold());
    ring.rotation.x = Math.PI / 2;
    this.rotor.add(disc, ring);
    this.nozzles = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), MAT.goldDark());
      nozzle.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
      nozzle.rotation.z = Math.PI / 2;
      this.rotor.add(nozzle);
      this.nozzles.push(nozzle);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), MAT.glow(0xffc14d));
    this.rotor.add(hub);
    g.add(this.rotor);
    this.spin = 0;
    this.spinSpeed = 0;
    this.timer = 0;
    this.duration = 3.1;
    this.active = false;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.spinSpeed = 0;
    this.emitter = this.ctx.fireworks.addEmitter({
      duration: this.duration,
      rate: 230,
      getPosition: () => this.worldPoint(0, 0.42, 0),
      spawn: (p) => {
        const a = this.spin + Math.random() * Math.PI * 2;
        const c = Math.random() < 0.6 ? PALETTES.gold[0] : PALETTES.saffron[0];
        const speed = 5 + Math.random() * 5;
        this.ctx.fireworks.sparks.spawn(p.x, p.y, p.z,
          Math.cos(a) * speed, 0.4 + Math.random() * 1.4, Math.sin(a) * speed,
          c[0], c[1], c[2], 0.08, 0.8 + Math.random() * 0.5, 1.45, 4.9, 38, 0);
      },
    });
    this.ctx.audio.groundChakkar();
  }

  update(dt) {
    super.update(dt);
    if (!this.active) return;
    this.timer += dt;
    const ramp = Math.min(1, this.timer / 0.55);
    const fade = Math.min(1, Math.max(0, (this.duration - this.timer) / 0.6));
    this.spinSpeed = 48 * ramp * fade;
    this.spin += this.spinSpeed * dt;
    this.rotor.rotation.y = this.spin;
    this.rotor.position.y = 0.32 + Math.sin(this.time * 22) * 0.035 * fade;
    if (this.timer >= this.duration) {
      this.active = false;
      this.ctx.fireworks.burst(this.worldPoint(0, 0.4, 0).clone(), {
        count: 90, colors: PALETTES.silver, speed: 5, spread: 0.75,
        pattern: 'ring', life: 0.75, size: 0.08, gravity: 7, smoke: false,
      });
    }
  }
}

/* =========================================================== 11. 7-SHOT CAKE */

class SevenShotCakeCracker extends Cracker {
  build() {
    const g = this.group;
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.88), MAT.red());
    box.position.y = 0.3;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.08, 0.92), MAT.gold());
    trim.position.y = 0.59;
    g.add(box, trim);
    this.tubes = [];
    this.shots = [];
    for (let i = 0; i < 7; i++) {
      const row = i < 4 ? 0 : 1;
      const col = row === 0 ? i : i - 4;
      const x = (col - (row === 0 ? 1.5 : 1)) * 0.27;
      const z = row === 0 ? -0.2 : 0.2;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.22, 14), MAT.goldDark());
      tube.position.set(x, 0.69, z);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), MAT.glow(0xffd580));
      bead.position.set(x, 0.84, z);
      bead.visible = false;
      g.add(tube, bead);
      this.tubes.push({ x, z, bead });
      this.shots.push({ delay: i * 0.38, t: 0, phase: 'queued' });
    }
    this.active = false;
    this.timer = 0;
    this.duration = 4.2;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.shots.forEach((shot) => { shot.t = 0; shot.phase = 'queued'; });
    this.ctx.audio.sevenShot();
    this.ctx.onShake(0.15, 0.5);
  }

  update(dt) {
    super.update(dt);
    if (!this.active) return;
    this.timer += dt;
    this.shots.forEach((shot, i) => {
      const tube = this.tubes[i];
      if (shot.phase === 'queued' && this.timer >= shot.delay) {
        shot.phase = 'flight';
        shot.t = 0;
        tube.bead.visible = true;
        tube.bead.material.color.setHSL((i * 0.14 + 0.06) % 1, 0.95, 0.62);
      }
      if (shot.phase !== 'flight') return;
      shot.t += dt;
      const k = Math.min(1, shot.t / 0.72);
      tube.bead.position.y = 0.82 + 9.5 * (1 - Math.pow(1 - k, 2));
      const p = this.worldPoint(tube.x, tube.bead.position.y, tube.z);
      this.ctx.fireworks.trail(p, [1, 0.72 + i * 0.03, 0.3 + i * 0.08], 0.35, 1);
      if (k >= 1) {
        shot.phase = 'done';
        tube.bead.visible = false;
        const burst = p.clone();
        const palette = [PALETTES.saffron, PALETTES.emerald, PALETTES.sapphire, PALETTES.magenta, PALETTES.gold, PALETTES.ice, PALETTES.violet][i];
        this.ctx.fireworks.burst(burst, {
          count: 105, colors: palette, speed: 8.5, spread: 0.42,
          pattern: i % 2 ? 'ring' : 'sphere', life: 1.1, size: 0.09, gravity: 5.4,
        });
      }
    });
    if (this.shots.every((shot) => shot.phase === 'done')) this.active = false;
  }
}

/* ============================================================= 12. SKY SHOT */

class SkyShotCracker extends Cracker {
  build() {
    const g = this.group;
    this.tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.88, 24), MAT.goldDark());
    this.tube.position.y = 0.48;
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), MAT.glow(0x8fdcff));
    this.shell.position.y = 0.95;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 10, 28), MAT.gold());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.92;
    const legs = [];
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 8), MAT.silver());
      leg.position.set(Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3);
      leg.rotation.z = Math.cos(a) * 0.28;
      leg.rotation.x = Math.sin(a) * 0.28;
      legs.push(leg);
    }
    g.add(this.tube, this.shell, rim, ...legs);
    this.phase = 'idle';
    this.timer = 0;
  }

  trigger() {
    if (this.phase !== 'idle') return;
    this.phase = 'launch';
    this.timer = 0;
    this.active = true;
    this.shell.visible = true;
    this.ctx.audio.skyShot();
    this.emitter = this.ctx.fireworks.addEmitter({
      duration: 1.05,
      rate: 210,
      getPosition: () => this.worldPoint(0, this.shell.position.y, 0),
      spawn: (p) => this.ctx.fireworks.trail(p, [0.45, 0.78, 1], 0.55, 1),
    });
  }

  update(dt) {
    super.update(dt);
    if (this.phase !== 'launch') return;
    this.timer += dt;
    const k = Math.min(1, this.timer / 1.05);
    this.shell.position.y = 0.95 + 12.5 * (1 - Math.pow(1 - k, 2));
    this.shell.scale.setScalar(1 + Math.sin(this.timer * 22) * 0.12);
    if (k >= 1) {
      this.phase = 'idle';
      this.active = false;
      this.shell.position.y = 0.95;
      this.shell.scale.setScalar(1);
      this.shell.visible = true;
      const p = this.worldPoint(0, 13.3, 0).clone();
      this.ctx.fireworks.burst(p, {
        count: 230, colors: [PALETTES.ice[0], PALETTES.sapphire[0], PALETTES.silver[1]],
        speed: 13, spread: 0.45, pattern: 'doubleRing', life: 1.7, size: 0.11, gravity: 4.9,
      });
      this.ctx.fireworks.burst(p, {
        count: 100, colors: PALETTES.gold, speed: 7, spread: 0.28,
        pattern: 'willow', life: 2.1, size: 0.085, gravity: 2.5, smoke: false, light: false,
      });
      this.ctx.audio.skyShotBurst();
      this.ctx.onShake(0.24, 0.42);
    }
  }
}

/* ========================================================== 13. COLOR SMOKE */

class ColorSmokeCracker extends Cracker {
  build() {
    const g = this.group;
    this.canisters = [];
    const colors = [0xff3d55, 0x36a9ff, 0x9f53ff];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.42;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.74, 18), MAT.clay());
      body.position.set(x, 0.38, 0);
      const label = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 8, 24), MAT.glow(colors[i]));
      label.rotation.x = Math.PI / 2;
      label.position.set(x, 0.42, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 14), MAT.gold());
      cap.position.set(x, 0.86, 0);
      const nozzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), MAT.glow(colors[i]));
      nozzle.position.set(x, 1.01, 0);
      g.add(body, label, cap, nozzle);
      this.canisters.push({ x, color: colors[i], nozzle });
    }
    this.timer = 0;
    this.active = false;
    this.duration = 4.2;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.puffTimer = 0;
    this.ctx.audio.colorSmoke();
  }

  update(dt) {
    super.update(dt);
    if (!this.active) return;
    this.timer += dt;
    this.puffTimer -= dt;
    this.canisters.forEach((can, i) => {
      can.nozzle.scale.setScalar(0.8 + Math.sin(this.time * 9 + i * 2) * 0.25);
    });
    if (this.puffTimer <= 0) {
      this.puffTimer = 0.22;
      const can = this.canisters[(Math.random() * this.canisters.length) | 0];
      const p = this.worldPoint(can.x, 1.05, 0).clone();
      const color = new THREE.Color(can.color);
      const rgb = [color.r, color.g, color.b];
      if (!this.ctx.fireworks.lowQuality) {
        this.ctx.fireworks.smokePuff(p, { size: 2.2, count: 5, color: rgb, up: 1.15 });
      } else {
        for (let i = 0; i < 7; i++) {
          this.ctx.fireworks.sparks.spawn(p.x, p.y, p.z,
            (Math.random() - 0.5) * 1.8, 1.1 + Math.random() * 2.4, (Math.random() - 0.5) * 1.8,
            rgb[0], rgb[1], rgb[2], 0.16, 1.2, 0.65, -0.4, 0, 1.8);
        }
      }
    }
    if (this.timer >= this.duration) this.active = false;
  }
}

/* ========================================================== 14. GOLDEN RAIN */

class GoldenRainCracker extends Cracker {
  build() {
    const g = this.group;
    this.canopy = new THREE.Group();
    this.canopy.position.y = 1.55;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      MAT.gold()
    );
    this.canopy.add(dome);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 2 / 10;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.72, 6), MAT.silver());
      spoke.position.set(Math.cos(a) * 0.35, 0.18, Math.sin(a) * 0.35);
      spoke.rotation.z = Math.cos(a) * 0.65;
      spoke.rotation.x = Math.sin(a) * 0.65;
      this.canopy.add(spoke);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.35, 12), MAT.goldDark());
    stem.position.y = 0.65;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.3, 24), MAT.clay());
    base.position.y = 0.15;
    g.add(this.canopy, stem, base);
    this.timer = 0;
    this.active = false;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    const fx = this.ctx.fireworks;
    const p = this.worldPoint(0, 9, 0).clone();
    fx.burst(p, {
      count: 340, colors: [PALETTES.gold[0], PALETTES.gold[1], PALETTES.saffron[1]],
      speed: 8.2, spread: 0.35, pattern: 'willow', life: 3.8, size: 0.105,
      gravity: 2.8, drag: 0.42, flicker: 34,
    });
    this.emitter = fx.addEmitter({
      duration: 2.8, rate: 115,
      getPosition: () => this.worldPoint(0, 8.6, 0),
      spawn: (q) => {
        const c = Math.random() < 0.7 ? PALETTES.gold[0] : PALETTES.silver[1];
        fx.sparks.spawn(q.x + (Math.random() - 0.5) * 2.4, q.y, q.z + (Math.random() - 0.5) * 2.4,
          (Math.random() - 0.5) * 1.1, -1.5 - Math.random() * 2.8, (Math.random() - 0.5) * 1.1,
          c[0], c[1], c[2], 0.075, 2.4, 0.55, 2.2, 46, 0);
      },
    });
    this.ctx.audio.goldenRain();
    this.ctx.onShake(0.14, 0.4);
  }

  update(dt) {
    super.update(dt);
    this.canopy.rotation.y += dt * (this.active ? 1.8 : 0.18);
    if (!this.active) return;
    this.timer += dt;
    if (this.timer >= 3.1) this.active = false;
  }
}

/* ======================================================= 15. TWINKLING STAR */

class TwinklingStarCracker extends Cracker {
  build() {
    const g = this.group;
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? 0.28 : 0.66;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const star = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.055, bevelThickness: 0.05 }),
      MAT.glow(0xffdf70)
    );
    star.position.y = 0.78;
    star.rotation.x = -0.12;
    this.star = star;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 10, 40), MAT.gold());
    ring.position.y = 0.78;
    ring.rotation.x = Math.PI / 2;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.24, 24), MAT.goldDark());
    pedestal.position.y = 0.12;
    g.add(star, ring, pedestal);
    this.ring = ring;
    this.timer = 0;
    this.active = false;
    this.burstStep = 0;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.burstStep = 0;
    this.ctx.audio.twinklingStar();
    this.ctx.fireworks.flash(this.worldPoint(0, 0.8, 0).clone(), [1, 0.9, 0.56], 2.5, 0.25);
  }

  update(dt) {
    super.update(dt);
    this.star.rotation.y += dt * (this.active ? 2.8 : 0.28);
    const pulse = 1 + Math.sin(this.time * (this.active ? 12 : 4)) * (this.active ? 0.2 : 0.07);
    this.star.scale.setScalar(pulse);
    this.ring.rotation.z += dt * (this.active ? 2.4 : 0.22);
    if (!this.active) return;
    this.timer += dt;
    const steps = [0.08, 0.32, 0.58, 0.88];
    if (this.burstStep < steps.length && this.timer >= steps[this.burstStep]) {
      const palettes = [PALETTES.gold, PALETTES.silver, PALETTES.sapphire, PALETTES.magenta];
      const p = this.worldPoint(0, 1.1 + this.burstStep * 1.3, 0).clone();
      this.ctx.fireworks.burst(p, {
        count: 64 + this.burstStep * 12, colors: palettes[this.burstStep],
        speed: 4.8 + this.burstStep, spread: 0.24, pattern: 'star',
        life: 0.9, size: 0.095, gravity: 4.4, smoke: false, light: false,
      });
      this.burstStep++;
    }
    if (this.timer >= 1.3) this.active = false;
  }
}

/* ======================================================= 16. MULTI-SHOT ROCKET */

class MultiShotRocketCracker extends Cracker {
  build() {
    const g = this.group;
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.68), MAT.goldDark());
    rack.position.y = 0.12;
    g.add(rack);
    this.rockets = [];
    const colors = [0xff5c48, 0x53baff, 0x75f0a2];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.48;
      const rocket = new THREE.Group();
      rocket.position.set(x, 0.16, 0);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.74, 14), MAT.red());
      body.position.y = 0.48;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 14), MAT.glow(colors[i]));
      nose.position.y = 0.99;
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), MAT.silver());
      stick.position.y = 0.02;
      rocket.add(body, nose, stick);
      g.add(rocket);
      this.rockets.push({ group: rocket, x, delay: i * 0.62, t: 0, phase: 'queued', color: colors[i] });
    }
    this.timer = 0;
    this.active = false;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.rockets.forEach((r) => { r.t = 0; r.phase = 'queued'; r.group.visible = true; r.group.position.y = 0.16; });
    this.ctx.audio.multiShot();
    this.ctx.onShake(0.18, 0.55);
  }

  update(dt) {
    super.update(dt);
    if (!this.active) return;
    this.timer += dt;
    this.rockets.forEach((rocket) => {
      if (rocket.phase === 'queued' && this.timer >= rocket.delay) rocket.phase = 'flight';
      if (rocket.phase === 'flight') {
        rocket.t += dt;
        const k = Math.min(1, rocket.t / 0.95);
        rocket.group.position.y = 0.16 + 11 * (1 - Math.pow(1 - k, 2));
        rocket.group.rotation.z = Math.sin(rocket.t * 15) * 0.035;
        const p = rocket.group.getWorldPosition(this._tmp);
        this.ctx.fireworks.trail(p, new THREE.Color(rocket.color).toArray(), 0.45, 1);
        if (k >= 1) {
          rocket.phase = 'cooldown';
          rocket.t = 0;
          rocket.group.visible = false;
          const burst = p.clone();
          this.ctx.fireworks.burst(burst, {
            count: 145, colors: [PALETTES.saffron, PALETTES.sapphire, PALETTES.emerald][this.rockets.indexOf(rocket)],
            speed: 10.5, spread: 0.42, pattern: 'chrysanthemum',
            life: 1.35, size: 0.1, gravity: 4.8,
          });
        }
      } else if (rocket.phase === 'cooldown') {
        rocket.t += dt;
        if (rocket.t > 0.55) {
          rocket.phase = 'done';
          rocket.group.visible = true;
          rocket.group.position.y = 0.16;
          rocket.group.rotation.z = 0;
        }
      }
    });
    if (this.rockets.every((r) => r.phase === 'done')) this.active = false;
  }
}

/* ========================================================== 17. FLOWER SHOWER */

class FlowerShowerCracker extends Cracker {
  build() {
    const g = this.group;
    this.bloom = new THREE.Group();
    this.bloom.position.y = 1.15;
    this.petals = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI * 2 / 8;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), MAT.glow(i % 2 ? 0xffad45 : 0xffde7c));
      petal.scale.set(0.8, 1.65, 0.55);
      petal.position.set(Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24);
      petal.rotation.y = -a;
      this.bloom.add(petal);
      this.petals.push(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), MAT.glow(0xfff2aa));
    this.bloom.add(center);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.75, 20), MAT.clay());
    stalk.position.y = 0.38;
    const leaves = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 10, 28), MAT.gold());
    leaves.rotation.x = Math.PI / 2;
    leaves.position.y = 0.58;
    g.add(stalk, leaves, this.bloom);
    this.timer = 0;
    this.active = false;
    this.burstStep = 0;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.burstStep = 0;
    this.petals.forEach((p) => p.scale.y = 0.55);
    this.ctx.audio.flowerShower();
    this.ctx.fireworks.fountain(this.worldPoint(0, 1.2, 0).clone(), {
      duration: 1.05, rate: 115, speed: 9.5, colors: PALETTES.saffron,
      spread: 0.3, life: 1.4, size: 0.1, gravity: 4.4,
    });
  }

  update(dt) {
    super.update(dt);
    this.bloom.rotation.y += dt * (this.active ? 1.5 : 0.22);
    if (!this.active) return;
    this.timer += dt;
    const opening = Math.min(1, this.timer / 0.65);
    this.petals.forEach((p) => { p.scale.y = 0.55 + opening * 1.1; });
    const steps = [0.76, 0.98, 1.22];
    if (this.burstStep < steps.length && this.timer >= steps[this.burstStep]) {
      const i = this.burstStep++;
      const p = this.worldPoint(0, 8.2 + i * 1.4, 0).clone();
      this.ctx.fireworks.burst(p, {
        count: 180 + i * 35, colors: i === 1 ? PALETTES.magenta : PALETTES.saffron,
        speed: 8 + i, spread: 0.3, pattern: i === 2 ? 'star' : 'chrysanthemum',
        life: 1.8, size: 0.1, gravity: 4.2,
      });
    }
    if (this.timer >= 2.1) {
      this.active = false;
      this.petals.forEach((p) => p.scale.y = 1.65);
    }
  }
}

/* ======================================================= 18. RAINBOW FOUNTAIN */

class RainbowFountainCracker extends Cracker {
  build() {
    const g = this.group;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 0.6, 24), MAT.clay());
    base.position.y = 0.3;
    this.nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.28, 20), MAT.gold());
    this.nozzle.position.y = 0.72;
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), MAT.glow(0xff69d4));
    this.core.position.y = 0.88;
    this.rings = [];
    const hues = [0xff4b61, 0xffb43b, 0xffec58, 0x50e27a, 0x47c5ff, 0x9f69ff];
    for (let i = 0; i < hues.length; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.45 + i * 0.075, 0.025, 8, 32),
        MAT.glow(hues[i])
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12 + i * 0.13;
      g.add(ring);
      this.rings.push(ring);
    }
    g.add(base, this.nozzle, this.core);
    this.timer = 0;
    this.duration = 3.5;
    this.active = false;
  }

  trigger() {
    if (this.active) return;
    this.active = true;
    this.timer = 0;
    this.ctx.audio.rainbowFountain();
    this.emitter = this.ctx.fireworks.addEmitter({
      duration: this.duration,
      rate: 255,
      smoke: this.ctx.fireworks.lowQuality ? 0 : 8,
      getPosition: () => this.worldPoint(0, 0.9, 0),
      spawn: (p) => {
        const pick = Math.floor((this.timer * 2.4 + Math.random() * 2) % PALETTES.rainbow.length);
        const color = PALETTES.rainbow[pick];
        const a = Math.random() * Math.PI * 2;
        const spread = 0.5 + Math.random() * 1.1;
        this.ctx.fireworks.sparks.spawn(p.x, p.y, p.z,
          Math.cos(a) * spread, 10 + Math.random() * 9, Math.sin(a) * spread,
          color[0], color[1], color[2], 0.08, 1.6, 0.7, 4.7, 30, 0);
      },
    });
  }

  update(dt) {
    super.update(dt);
    this.rings.forEach((ring, i) => {
      ring.rotation.y += dt * (0.3 + i * 0.04);
      ring.material.emissiveIntensity = 0.65 + Math.sin(this.time * 3.5 - i * 0.55) * 0.45;
    });
    if (!this.active) return;
    this.timer += dt;
    this.core.material.color.setHSL((this.timer * 0.34) % 1, 0.95, 0.62);
    this.core.scale.setScalar(1 + Math.sin(this.timer * 18) * 0.35);
    if (this.timer >= this.duration) {
      this.active = false;
      this.core.scale.setScalar(1);
      const p = this.worldPoint(0, 8.5, 0).clone();
      this.ctx.fireworks.burst(p, {
        count: 290, colors: PALETTES.rainbow, speed: 10.5, spread: 0.42,
        pattern: 'doubleRing', life: 1.8, size: 0.105, gravity: 4.6,
      });
      this.ctx.onFlash(0xffffff, 0.14);
      this.ctx.onShake(0.2, 0.4);
    }
  }
}

/* ================================================================= MANAGER */

export class CrackersManager {
  /**
   * @param {{scene:THREE.Scene, fireworks:any, audio:any,
   *          onShake:Function, onFlash:Function, onSelect:Function}} ctx
   */
  constructor(ctx) {
    this.ctx = {
      ...ctx,
      onShake: ctx.onShake || (() => {}),
      onFlash: ctx.onFlash || (() => {}),
      onSelect: ctx.onSelect || (() => {}),
    };
    this.root = new THREE.Group();
    ctx.scene.add(this.root);
    this.crackers = [];
    this.byId = new Map();
    this.selected = -1;
    this.wide = true;
  }

  create() {
    const C = [
      FlowerPotCracker,
      RocketCracker,
      ChakriCracker,
      AnarCracker,
      SparklerCracker,
      VirtualBlastCracker,
      BijiliCracker,
      SutliBombCracker,
      PencilCracker,
      GroundChakkarCracker,
      SevenShotCakeCracker,
      SkyShotCracker,
      ColorSmokeCracker,
      GoldenRainCracker,
      TwinklingStarCracker,
      MultiShotRocketCracker,
      FlowerShowerCracker,
      RainbowFountainCracker,
    ];
    const META = [
      { id: 'flowerpot', name: 'Flower Pot', desc: 'Touch it to release a fountain of golden sparks that rise and fall.', icon: 'pot' },
      { id: 'rocket', name: 'Rocket', desc: 'Launch it into the night sky and watch a giant colourful burst.', icon: 'rocket' },
      { id: 'chakri', name: 'Chakri', desc: 'Spin it up to full speed and let it throw circular trails of fire.', icon: 'chakri' },
      { id: 'anar', name: 'Anar', desc: 'A tall column of gold and silver sparks shooting for the stars.', icon: 'anar' },
      { id: 'sparkler', name: 'Sparklers', desc: 'Press and hold for a continuous stream of sizzling stars.', icon: 'sparkler' },
      { id: 'blast', name: 'Virtual Blast', desc: 'A massive digital explosion with shockwaves and camera shake.', icon: 'blast' },
      { id: 'bijili', name: 'Bijili', desc: 'A sharp silver snap scatters a bright ring of electric sparks.', icon: 'bijili' },
      { id: 'sutli', name: 'Sutli Bomb', desc: 'Watch a glowing digital fuse end in a layered sky burst.', icon: 'sutli' },
      { id: 'pencil', name: 'Pencil', desc: 'A spinning blue-silver jet climbs into a crisp star burst.', icon: 'pencil' },
      { id: 'ground', name: 'Ground Chakkar', desc: 'A fast ground spinner paints a brilliant circle of sparks.', icon: 'ground' },
      { id: 'cake', name: '7-Shot Cake', desc: 'Seven colorful shells launch one after another into the sky.', icon: 'cake' },
      { id: 'skyshot', name: 'Sky Shot', desc: 'A blue comet rises into a double-ring and golden willow.', icon: 'skyshot' },
      { id: 'smoke', name: 'Color Smoke', desc: 'Three glowing canisters release slow clouds of vivid color.', icon: 'smoke' },
      { id: 'rain', name: 'Golden Rain', desc: 'A broad golden willow shimmers down like a canopy of light.', icon: 'rain' },
      { id: 'star', name: 'Twinkling Star', desc: 'A rotating star sends out four timed bursts of sparkle.', icon: 'star' },
      { id: 'multirocket', name: 'Multi-Shot Rocket', desc: 'Three colored rockets rise in sequence and bloom overhead.', icon: 'multirocket' },
      { id: 'flower', name: 'Flower Shower', desc: 'A glowing flower opens beneath three cascading sky blooms.', icon: 'flower' },
      { id: 'rainbow', name: 'Rainbow Fountain', desc: 'A vivid fountain pulses through the colors of the rainbow.', icon: 'rainbow' },
    ];

    C.forEach((Klass, i) => {
      const c = new Klass(this.ctx, META[i]);
      c.index = i;
      this.crackers.push(c);
      this.byId.set(c.id, c);
      this.root.add(c.group);
    });
    this.layout(true);
    return this.crackers;
  }

  /** Reposition crackers for the current viewport shape. */
  layout(wide) {
    this.wide = wide;
    const cols = wide ? 6 : 3;
    const rows = Math.ceil(this.crackers.length / cols);
    const spacingX = wide ? 2.9 : 2.8;
    const spacingZ = wide ? 3.15 : 2.2;
    const scale = wide ? 0.92 : 1.08;

    this.crackers.forEach((c, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const rowLength = Math.min(cols, this.crackers.length - row * cols);
      c.homeX = (col - (rowLength - 1) / 2) * spacingX;
      c.homeY = 0;
      c.homeZ = (row - (rows - 1) / 2) * spacingZ;
      c.layoutScale = scale;
    });

    this.crackers.forEach((c) => {
      if (c.phase === 'launch' || c.phase === 'gone') return;
      c.group.position.set(c.homeX, c.homeY, c.homeZ);
      c.group.scale.setScalar(c.layoutScale);
    });
  }

  /** Raycast helper: returns the cracker hit by a ray, or null. */
  pick(raycaster) {
    const groups = this.crackers.map((c) => c.group);
    const hits = raycaster.intersectObjects(groups, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.crackerId) o = o.parent;
      if (o && o.userData.crackerId) {
        return this.byId.get(o.userData.crackerId) || null;
      }
    }
    return null;
  }

  /** Called on pointer down over the 3D scene. */
  pointerDown(raycaster) {
    const c = this.pick(raycaster);
    if (c) {
      this.select(c.index, true);
      c.trigger();
    }
    return c;
  }

  pointerUp() {
    this.crackers.forEach((c) => {
      if (c.holding) c.release();
    });
  }

  select(index, notify = true) {
    if (index === this.selected) return;
    this.selected = index;
    this.crackers.forEach((c, i) => c.setHighlight(i === index));
    if (notify) this.ctx.onSelect(this.crackers[index], index);
  }

  deselect() {
    this.selected = -1;
    this.crackers.forEach((c) => c.setHighlight(false));
  }

  trigger(index) {
    const c = this.crackers[index];
    if (c) c.trigger();
  }

  get selectedCracker() { return this.selected >= 0 ? this.crackers[this.selected] : null; }

  stopAll() {
    this.crackers.forEach((c) => { if (c.holding) c.release(); });
  }

  update(dt) {
    for (const c of this.crackers) c.update(dt);
  }

  /** World position + suggested camera framing for focusing a cracker. */
  focusTarget(index) {
    const c = this.crackers[index];
    if (!c) return null;
    return {
      position: new THREE.Vector3(c.homeX, c.homeY + 3.9, c.homeZ),
      distance: this.wide ? 20 : 22,
      height: 3.2,
    };
  }
}

export default CrackersManager;
