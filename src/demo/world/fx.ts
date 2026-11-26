/**
 * Effects: glowing arcs between people and places, pulsing ground rings, camera flashes, and paper sheets
 * flying along arcs (instanced). Everything created here is temporary and removed on scene cleanup.
 */
import * as THREE from "three";
import { clamp, ease, rng } from "../engine/math";
import { PAL, glowTex } from "./kit";

export interface Arc {
  group: THREE.Group;
  p: number;
  set(p: number): void;
  tick(T: number): void;
}

export interface Ring {
  mesh: THREE.Mesh;
  on: boolean;
  tick(T: number): void;
}

export class Fx {
  private temps: THREE.Object3D[] = [];
  arcs: Arc[] = [];
  rings: Ring[] = [];
  private sparkMat = new THREE.SpriteMaterial({ map: glowTex(), color: "#ffd0c0", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  flashLight = new THREE.PointLight("#ffffff", 0, 6, 1.5);
  flashSprite: THREE.Sprite;
  private flashes: { t: number; pos: THREE.Vector3 }[] = [];
  sheets: THREE.InstancedMesh;
  private sheetSpecs: { from: THREE.Vector3; mid: THREE.Vector3; to: THREE.Vector3; t0: number; t1: number; spin: number }[] = [];
  private m4 = new THREE.Matrix4();
  reduced = false;

  constructor(private scene: THREE.Scene) {
    scene.add(this.flashLight);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffffff", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flashSprite.scale.set(1.6, 1.6, 1);
    scene.add(this.flashSprite);
    this.sheets = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.27), new THREE.MeshStandardMaterial({ color: PAL.paper, side: THREE.DoubleSide, roughness: 0.9, emissive: "#3a2a20", emissiveIntensity: 0.25 }), 80);
    this.sheets.count = 0;
    this.sheets.frustumCulled = false;
    scene.add(this.sheets);
  }

  /** A glowing arc from a to b (drawn as p goes 0 → 1). */
  arc(a: THREE.Vector3, b: THREE.Vector3, opts: { height?: number; color?: string; width?: number } = {}): Arc {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + (opts.height ?? 0.8 + a.distanceTo(b) * 0.25);
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const w = opts.width ?? 1;
    const color = opts.color ?? PAL.inkGlow;
    const g = new THREE.Group();
    this.scene.add(g);
    const coreColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45);
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.02 * w, 6, false), new THREE.MeshBasicMaterial({ color: coreColor, toneMapped: false }));
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, 0.06 * w, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    g.add(glow, core);
    const spark = new THREE.Sprite(this.sparkMat);
    spark.scale.set(0.35 * w, 0.35 * w, 1);
    g.add(spark);
    const ends = [a, b].map((p) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      r.position.set(p.x, Math.max(0.015, p.y - 0.95), p.z);
      g.add(r);
      return r;
    });
    const A: Arc = {
      group: g,
      p: 0,
      set(p: number) {
        this.p = p;
        const n = core.geometry.index!.count;
        core.geometry.setDrawRange(0, Math.floor((n * p) / 3) * 3);
        const n2 = glow.geometry.index!.count;
        glow.geometry.setDrawRange(0, Math.floor((n2 * p) / 3) * 3);
        g.visible = p > 0;
      },
      tick(T: number) {
        if (this.p <= 0) return;
        const s = this.p < 1 ? this.p : (T * 0.45) % 1;
        spark.position.copy(curve.getPoint(s));
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.24 + 0.08 * Math.sin(T * 3);
        ends.forEach((r, i) => {
          (r.material as THREE.MeshBasicMaterial).opacity = i === 0 || this.p >= 1 ? 0.7 : 0;
          r.scale.setScalar(1 + 0.2 * Math.sin(T * 3 + i));
        });
      },
    };
    A.set(0);
    this.temps.push(g);
    this.arcs.push(A);
    return A;
  }

  /** A pulsing ring on the ground. */
  ring(pos: THREE.Vector3, color: string = PAL.amber, radius = 0.7, y = 0.03): Ring {
    const m = new THREE.Mesh(new THREE.RingGeometry(radius * 0.72, radius, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(pos.x, y, pos.z);
    this.scene.add(m);
    this.temps.push(m);
    const reduced = this.reduced;
    const R: Ring = {
      mesh: m,
      on: false,
      tick(T: number) {
        const mat = m.material as THREE.MeshBasicMaterial;
        if (!this.on) {
          mat.opacity = 0;
          return;
        }
        if (reduced) {
          m.scale.setScalar(1);
          mat.opacity = 0.85;
          return;
        }
        const f = (T * 0.75) % 1;
        m.scale.setScalar(0.6 + f * 0.9);
        mat.opacity = 0.35 + 0.6 * (1 - f);
      },
    };
    this.rings.push(R);
    return R;
  }

  /** A camera flash at `pos` at scene time t. */
  flash(t: number, pos: THREE.Vector3) {
    this.flashes.push({ t, pos: pos.clone() });
  }

  /** Paper sheets flying from `from` to `to`, staggered between t0 and t1 (each takes `fly` seconds). */
  sheetStream(from: THREE.Vector3, to: THREE.Vector3, count: number, t0: number, t1: number, fly = 1.1, height = 0.7, seed = 1) {
    const r = rng(seed);
    const n = this.reduced ? Math.max(3, Math.round(count / 4)) : count;
    for (let i = 0; i < n; i++) {
      const start = t0 + ((t1 - t0 - fly) * i) / Math.max(1, n - 1);
      const f = from.clone().add(new THREE.Vector3((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08));
      const mid = f.clone().lerp(to, 0.5);
      mid.y = Math.max(f.y, to.y) + height + r() * 0.15;
      this.sheetSpecs.push({ from: f, mid, to: to.clone(), t0: start, t1: start + fly, spin: (r() - 0.5) * 3 });
    }
  }

  /** Per-frame: t is scene time, T global time. */
  tick(t: number, T: number) {
    for (const a of this.arcs) a.tick(T);
    for (const r of this.rings) r.tick(T);
    // flashes (dimmer and shorter with reduced motion)
    let flashI = 0;
    let at: THREE.Vector3 | null = null;
    for (const f of this.flashes) {
      const age = t - f.t;
      if (age < 0 || age > 0.35) continue;
      const k = age < 0.05 ? age / 0.05 : 1 - (age - 0.05) / 0.3;
      if (k > flashI) {
        flashI = k;
        at = f.pos;
      }
    }
    const peak = this.reduced ? 0.35 : 1;
    this.flashLight.intensity = flashI * 18 * peak;
    (this.flashSprite.material as THREE.SpriteMaterial).opacity = flashI * peak;
    if (at) {
      this.flashLight.position.copy(at);
      this.flashSprite.position.copy(at);
    }
    // flying sheets
    let k = 0;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    for (const sp of this.sheetSpecs) {
      const u = (t - sp.t0) / (sp.t1 - sp.t0);
      if (u <= 0 || u >= 1 || k >= this.sheets.instanceMatrix.count) continue;
      const v = ease(clamp(u));
      const a = 1 - v;
      p.set(a * a * sp.from.x + 2 * a * v * sp.mid.x + v * v * sp.to.x, a * a * sp.from.y + 2 * a * v * sp.mid.y + v * v * sp.to.y, a * a * sp.from.z + 2 * a * v * sp.mid.z + v * v * sp.to.z);
      e.set(-Math.PI / 2 + Math.sin(u * Math.PI) * 0.9, sp.spin * u, Math.sin(u * 6 + sp.spin) * 0.3);
      q.setFromEuler(e);
      const sc = 1 - 0.55 * v;
      s.set(sc, sc, sc);
      this.m4.compose(p, q, s);
      this.sheets.setMatrixAt(k++, this.m4);
    }
    this.sheets.count = k;
    this.sheets.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const o of this.temps) {
      this.scene.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat && mat !== this.sparkMat) mat.dispose();
      });
    }
    this.temps = [];
    this.arcs = [];
    this.rings = [];
    this.flashes = [];
    this.sheetSpecs = [];
    this.sheets.count = 0;
    this.flashLight.intensity = 0;
    (this.flashSprite.material as THREE.SpriteMaterial).opacity = 0;
  }
}
