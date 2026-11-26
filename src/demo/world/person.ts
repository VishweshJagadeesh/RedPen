/** Low-poly people: a hip/torso/arms/legs/head rig, eased between named poses, walking along paths. */
import * as THREE from "three";
import { clamp, lerp } from "../engine/math";
import { G, glowTex, blobTex } from "./kit";

const legGeo = new THREE.BoxGeometry(0.17, 0.9, 0.19).translate(0, -0.45, 0);
const armGeo = new THREE.BoxGeometry(0.12, 0.56, 0.13).translate(0, -0.28, 0);
const torsoGeo = new THREE.BoxGeometry(0.46, 0.62, 0.27).translate(0, 0.31, 0);
const headGeo = new THREE.IcosahedronGeometry(0.16, 1);
const handGeo = new THREE.IcosahedronGeometry(0.066, 0);
const skirtGeo = new THREE.CylinderGeometry(0.22, 0.36, 0.92, 9).translate(0, -0.46, 0);
const kurtaGeo = new THREE.CylinderGeometry(0.25, 0.32, 0.55, 9).translate(0, -0.22, 0);
const pinaforeGeo = new THREE.CylinderGeometry(0.24, 0.33, 0.5, 9).translate(0, -0.2, 0);
const capGeo = new THREE.SphereGeometry(0.172, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
const bunGeo = new THREE.IcosahedronGeometry(0.085, 0);
const plaitGeo = new THREE.BoxGeometry(0.06, 0.34, 0.06).translate(0, -0.17, 0);
const phoneGeo = new THREE.BoxGeometry(0.08, 0.155, 0.014);
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export interface Pose {
  hipY: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  armLz: number;
  armRz: number;
  lean: number;
  head: number;
  turn: number;
}

const P = (o: Partial<Pose>): Pose => ({ hipY: 0.9, legL: 0, legR: 0, armL: 0, armR: 0, armLz: -0.07, armRz: 0.07, lean: 0, head: 0, turn: 0, ...o });
const SIT = { hipY: 0.5, legL: -1.5, legR: -1.5 };

export const POSES = {
  idle: P({}),
  sit: P({ ...SIT, armL: -0.35, armR: -0.35, lean: -0.05, head: 0.05 }),
  sitDesk: P({ ...SIT, armL: -1.05, armR: -1.05, armLz: -0.12, armRz: 0.12, lean: 0.12, head: 0.22 }),
  sitType: P({ ...SIT, armL: -1.15, armR: -1.15, armLz: -0.18, armRz: 0.18, lean: 0.08, head: 0.3 }),
  sitTalk: P({ ...SIT, armL: -0.9, armR: -1.25, armLz: -0.15, armRz: 0.25, lean: 0.06, head: 0.05 }),
  sitPhone: P({ ...SIT, armL: -0.6, armR: -1.25, armRz: -0.22, lean: 0.12, head: 0.38 }),
  phoneLook: P({ armR: -1.3, armRz: -0.22, lean: 0.04, head: 0.34 }),
  phoneShoot: P({ armL: -1.15, armR: -1.35, armLz: 0.2, armRz: -0.32, lean: 0.12, head: 0.45 }),
  write: P({ armR: -2.55, armRz: 0.1, armL: -0.25, head: -0.12 }),
  point: P({ armR: -1.7, armRz: 0.35, head: 0.0 }),
  hold: P({ armL: -0.85, armR: -0.85, armLz: -0.12, armRz: 0.12 }),
  give: P({ armR: -1.25, armRz: 0.05, armL: -0.15, lean: 0.08, head: 0.18 }),
  wave: P({ armR: -2.7, armRz: 0.35 }),
};
export type PoseName = keyof typeof POSES;

export interface PersonOpts {
  skin?: string;
  hair?: string;
  top?: string;
  bottom?: string;
  sari?: string;
  sariAccent?: string;
  kurta?: boolean;
  dupatta?: string;
  pinafore?: string;
  plaits?: boolean;
  bun?: boolean;
  longHair?: boolean;
  scale?: number;
  glasses?: boolean;
}

export class Person {
  g = new THREE.Group();
  inner = new THREE.Group();
  hip = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  skirt: THREE.Mesh | null = null;
  phone = new THREE.Group();
  itemL = new THREE.Group();
  itemR = new THREE.Group();
  scrMat = new THREE.MeshBasicMaterial({ color: "#20222a" });
  glow: THREE.Sprite;
  blob: THREE.Mesh;
  mode: PoseName = "idle";
  anim: null | "type" | "talk" | "nod" | "write" | "wave" = null;
  speed = 0;
  yaw = 0;
  p: Pose = { ...POSES.idle };
  private ph = 0;
  private wb = 0;
  private seed: number;
  readonly scale: number;

  constructor(
    parent: THREE.Object3D,
    readonly o: PersonOpts,
    seed: number,
  ) {
    this.seed = seed;
    this.scale = o.scale ?? 1;
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const mm = (c: string) => {
      let m = mats.get(c);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, flatShading: true });
        mats.set(c, m);
      }
      return m;
    };
    const add = (par: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      par.add(m);
      return m;
    };
    const sk = mm(o.skin ?? "#a86d48");
    const top = mm(o.top ?? "#888888");
    const bottom = mm(o.bottom ?? "#333333");
    const hair = mm(o.hair ?? "#17120f");
    parent.add(this.g);
    this.g.add(this.inner);
    this.hip.position.y = 0.9;
    this.inner.add(this.hip);
    this.legL = add(this.hip, legGeo, bottom, -0.1);
    this.legR = add(this.hip, legGeo, bottom, 0.1);
    if (o.sari) {
      this.skirt = add(this.hip, skirtGeo, mm(o.sari), 0, 0.02, 0);
      this.legL.visible = this.legR.visible = false;
    }
    if (o.kurta) add(this.hip, kurtaGeo, top);
    if (o.pinafore) add(this.hip, pinaforeGeo, mm(o.pinafore));
    this.hip.add(this.torso);
    add(this.torso, torsoGeo, top);
    if (o.pinafore) {
      const bib = add(this.torso, G.box, mm(o.pinafore), 0, 0.27, 0.13);
      bib.scale.set(0.34, 0.46, 0.03);
    }
    if (o.sari) {
      const pallu = add(this.torso, G.box, mm(o.sari), 0.03, 0.34, 0);
      pallu.scale.set(0.52, 0.11, 0.3);
      pallu.rotation.z = 0.78;
      if (o.sariAccent) {
        const border = add(this.torso, G.box, mm(o.sariAccent), 0.03, 0.34, 0);
        border.scale.set(0.53, 0.025, 0.31);
        border.rotation.z = 0.78;
        border.position.y = 0.27;
        border.position.x = -0.04;
      }
    }
    if (o.dupatta) {
      const d = add(this.torso, G.box, mm(o.dupatta), 0, 0.5, 0.02);
      d.scale.set(0.5, 0.08, 0.31);
    }
    const sleeve = o.sari ? sk : top;
    this.armL.position.set(-0.3, 0.58, 0);
    this.torso.add(this.armL);
    add(this.armL, armGeo, sleeve);
    add(this.armL, handGeo, sk, 0, -0.6, 0);
    this.armR.position.set(0.3, 0.58, 0);
    this.torso.add(this.armR);
    add(this.armR, armGeo, sleeve);
    add(this.armR, handGeo, sk, 0, -0.6, 0);
    const neck = add(this.torso, G.cyl6, sk, 0, 0.67, 0);
    neck.scale.set(0.12, 0.12, 0.12);
    this.head.position.y = 0.84;
    this.torso.add(this.head);
    add(this.head, headGeo, sk);
    add(this.head, capGeo, hair, 0, 0.015, -0.01);
    if (o.bun) add(this.head, bunGeo, hair, 0, 0.03, -0.17);
    if (o.longHair) {
      const m = add(this.head, G.box, hair, 0, -0.13, -0.11);
      m.scale.set(0.3, 0.36, 0.1);
    }
    if (o.plaits) {
      add(this.head, plaitGeo, hair, -0.12, -0.02, -0.1).rotation.z = 0.1;
      add(this.head, plaitGeo, hair, 0.12, -0.02, -0.1).rotation.z = -0.1;
    }
    if (o.glasses) {
      const gl = add(this.head, G.box, mm("#2a2a30"), 0, 0.02, 0.15);
      gl.scale.set(0.22, 0.035, 0.02);
    }
    // phone in the right hand
    this.phone.position.set(0, -0.66, 0.06);
    this.armR.add(this.phone);
    add(this.phone, phoneGeo, mm("#15171d"));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.13), this.scrMat);
    scr.position.z = 0.0075;
    this.phone.add(scr);
    const back = scr.clone();
    back.position.z = -0.0075;
    back.rotation.y = Math.PI;
    this.phone.add(back);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffd2b8", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.phone.add(this.glow);
    this.phone.visible = false;
    this.itemL.position.set(0, -0.66, 0.02);
    this.armL.add(this.itemL);
    this.itemR.position.set(0, -0.66, 0.02);
    this.armR.add(this.itemR);
    this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    this.blob.position.y = 0.012;
    this.blob.scale.set(0.95, 1, 0.95);
    this.g.add(this.blob);
    this.g.scale.setScalar(this.scale);
    this.reset();
  }

  reset() {
    this.g.visible = false;
    this.mode = "idle";
    this.anim = null;
    this.speed = 0;
    this.yaw = 0;
    this.p = { ...POSES.idle };
    this.phoneOn(false);
    this.phone.visible = false;
    this.itemL.clear();
    this.itemR.clear();
    this.g.position.set(0, 0, 0);
  }

  place(x: number, z: number, yaw: number, mode: PoseName = "idle", y = 0) {
    this.g.visible = true;
    this.g.position.set(x, y, z);
    this.yaw = yaw;
    this.g.rotation.y = yaw;
    this.mode = mode;
    this.p = { ...POSES[mode] };
    this.speed = 0;
    return this;
  }

  phoneOn(on: boolean, color = "#ffd2b8", intensity = 1) {
    this.scrMat.color.set(on ? "#fff3ea" : "#20222a");
    const m = this.glow.material as THREE.SpriteMaterial;
    m.color.set(color);
    m.opacity = on ? 0.8 * intensity : 0;
    this.glow.scale.setScalar(on ? 0.4 + 0.3 * intensity : 0.4);
    if (on) this.phone.visible = true;
  }

  /** World position just above the head (for labels). */
  top(dy = 0) {
    const v = this.g.position.clone();
    v.y += 2.12 * this.scale + (this.p.hipY - 0.9) * this.scale + dy;
    return v;
  }

  chest() {
    const v = this.g.position.clone();
    v.y += (this.p.hipY + 0.35) * this.scale;
    return v;
  }

  /** World position of the right hand. */
  hand() {
    return this.itemR.getWorldPosition(new THREE.Vector3());
  }

  update(dt: number, T: number) {
    if (!this.g.visible) return;
    const target = POSES[this.mode] ?? POSES.idle;
    const k = 1 - Math.exp(-dt * 7);
    for (const key of Object.keys(target) as (keyof Pose)[]) this.p[key] += (target[key] - this.p[key]) * k;
    const moving = this.speed > 0.05;
    this.wb += ((moving ? 1 : 0) - this.wb) * (1 - Math.exp(-dt * 10));
    if (moving) this.ph += (dt * this.speed * 2.6) / this.scale;
    const s = Math.sin(this.ph) * this.wb;
    const bob = Math.abs(Math.cos(this.ph)) * 0.05 * this.wb;
    const p = this.p;
    const swing = this.mode === "idle" ? 0.5 : 0.08;
    let aL = p.armL - s * swing;
    let aR = p.armR + s * swing;
    let hd = p.head;
    let hz = 0;
    if (this.anim === "type") {
      aL += Math.max(0, Math.sin(T * 13 + 1)) * 0.07;
      aR += Math.max(0, Math.sin(T * 11)) * 0.07;
    }
    if (this.anim === "talk") {
      aR += Math.sin(T * 3.2) * 0.18;
      hz = Math.sin(T * 2.1) * 0.06;
      hd += Math.sin(T * 4.3) * 0.04;
    }
    if (this.anim === "nod") hd += Math.sin(T * 5) * 0.11;
    if (this.anim === "write") {
      aR += Math.sin(T * 7) * 0.08;
      this.armR.rotation.z = p.armRz + Math.sin(T * 3.5) * 0.12;
    } else this.armR.rotation.z = p.armRz;
    if (this.anim === "wave") aR += Math.sin(T * 9) * 0.3;
    this.legL.rotation.x = p.legL + s * 0.62;
    this.legR.rotation.x = p.legR - s * 0.62;
    this.armL.rotation.x = aL;
    this.armR.rotation.x = aR;
    this.armL.rotation.z = p.armLz;
    this.hip.position.y = p.hipY + bob + Math.sin(T * 1.7 + this.seed) * 0.005;
    this.torso.rotation.x = p.lean;
    this.torso.rotation.y = p.turn;
    this.head.rotation.x = hd;
    this.head.rotation.z = hz;
    if (this.skirt) this.skirt.rotation.x = s * 0.07;
    let d = this.yaw - this.g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.g.rotation.y += d * (1 - Math.exp(-dt * 9));
    this.blob.visible = p.hipY > 0.7;
    const gm = this.glow.material as THREE.SpriteMaterial;
    if (gm.opacity > 0) gm.opacity = 0.65 + 0.2 * Math.sin(T * 5);
  }
}

/** A point along a polyline path [x, z][] at u (0..1), with the heading of that segment. */
export function along(pts: [number, number][], u: number) {
  let tot = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(l);
    tot += l;
  }
  let d = clamp(u) * tot;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const f = seg[i] ? clamp(d / seg[i]) : 0;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: lerp(a[0], b[0], f), z: lerp(a[1], b[1], f), dx: b[0] - a[0], dz: b[1] - a[1], len: tot };
    }
    d -= seg[i];
  }
  const l = pts[pts.length - 1];
  return { x: l[0], z: l[1], dx: 0, dz: 1, len: tot };
}

/** Walks `p` along `pts` between t0 and t1 (scene time t); faces the path, then `yawEnd` on arrival. */
export function walk(p: Person, pts: [number, number][], t: number, t0: number, t1: number, yawEnd?: number, yawStart?: number) {
  const u = clamp((t - t0) / (t1 - t0));
  const a = along(pts, u);
  p.g.visible = true;
  p.g.position.x = a.x;
  p.g.position.z = a.z;
  const moving = u > 0 && u < 1;
  p.speed = moving ? a.len / (t1 - t0) : 0;
  if (moving) {
    p.yaw = Math.atan2(a.dx, a.dz);
    if (p.mode !== "hold" && p.mode !== "give") p.mode = "idle";
  } else if (u >= 1 && yawEnd !== undefined) p.yaw = yawEnd;
  else if (u <= 0 && yawStart !== undefined) p.yaw = yawStart;
  return u;
}
