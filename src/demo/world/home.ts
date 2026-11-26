/**
 * HOME_NIGHT: a small room — a table with a desk lamp, two tall stacks of answer sheets, a phone, a laptop
 * and a wall clock. Warm lamp light against the night outside. Built away from the classroom.
 */
import * as THREE from "three";
import { rng } from "../engine/math";
import { G, M, PAL, bb, bx, grp, mk, V3, glowTex } from "./kit";

export const HOME_O = V3(80, 0, 0);
const SHEETS = 52;

export class Home {
  root = new THREE.Group();
  lamp = new THREE.PointLight("#ffbf7a", 0, 7, 1.6);
  lampGlow: THREE.Sprite;
  /** Answer sheets still to photograph (left) and already photographed (right). */
  stackA: THREE.InstancedMesh;
  stackB: THREE.InstancedMesh;
  piles: THREE.InstancedMesh[] = [];
  phone = new THREE.Group();
  phoneScreen = new THREE.MeshBasicMaterial({ color: "#1b1d24" });
  phoneGlow: THREE.Sprite;
  laptop = new THREE.Group();
  laptopScreen = new THREE.MeshBasicMaterial({ color: "#f3efe6" });
  secondHand = new THREE.Group();
  minuteHand = new THREE.Group();
  hourHand = new THREE.Group();
  /** World positions used by scenes. */
  P = {
    seat: V3(HOME_O.x, 0, HOME_O.z + 0.62),
    stackA: V3(HOME_O.x - 0.48, 0.76, HOME_O.z - 0.02),
    stackB: V3(HOME_O.x + 0.5, 0.76, HOME_O.z + 0.05),
    laptop: V3(HOME_O.x + 0.02, 0.76, HOME_O.z - 0.12),
    pileX: [0.34, 0.52, 0.7].map((dx) => HOME_O.x + dx),
    pileZ: HOME_O.z - 0.32,
    clock: V3(HOME_O.x - 0.9, 2.2, HOME_O.z + 2.66),
  };
  private m4 = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.root.position.copy(HOME_O);
    const g = this.root;
    // a closed room: the camera always works from inside it
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.8), M("#7d5a3f"));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 0.3;
    floor.receiveShadow = true;
    g.add(floor);
    for (let i = -3; i <= 3; i++) bx(g, "#6f4f37", i * 0.5, 0.002, 0.3, 0.02, 0.004, 4.8, false);
    const wall = "#d9c9a8";
    bb(g, wall, 0, 0, -2.05, 7, 3, 0.15);
    bb(g, wall, 0, 0, 2.75, 7, 3, 0.15);
    bb(g, "#cdbb98", 3.55, 0, 0.35, 0.15, 3, 4.9);
    // left wall with the window (night sky)
    const lw = grp(g, -3.55, 0, 0);
    bb(lw, "#cdbb98", 0, 0, -1.35, 0.15, 3, 1.5);
    bb(lw, "#cdbb98", 0, 0, 2.0, 0.15, 3, 1.6);
    bb(lw, "#cdbb98", 0, 0, 0.3, 0.15, 0.95, 1.8);
    bb(lw, "#cdbb98", 0, 2.4, 0.3, 0.15, 0.6, 1.8);
    const win = grp(lw, 0.09, 0.3, Math.PI / 2, 0.95);
    bx(win, "#4b3828", 0, 0.725, -0.04, 1.82, 1.5, 0.05);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 1.38), new THREE.MeshBasicMaterial({ color: "#0e1838" }));
    night.position.set(0, 0.725, -0.01);
    win.add(night);
    const r = rng(9);
    for (let i = 0; i < 30; i++) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.013, 0.013), new THREE.MeshBasicMaterial({ color: r() > 0.7 ? "#ffe9b8" : "#cfd8ff" }));
      st.position.set(-0.78 + r() * 1.56, 0.1 + r() * 1.26, 0);
      win.add(st);
    }
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#e6ecff", depthWrite: false }));
    moon.position.set(0.42, 1.18, 0.01);
    moon.scale.set(0.3, 0.3, 1);
    win.add(moon);
    bx(win, "#4b3828", 0, 0.725, 0.01, 0.05, 1.38, 0.03);
    bx(win, "#4b3828", 0, 0.725, 0.01, 1.66, 0.05, 0.03);
    // shelf with books on the far wall
    const shelf = grp(g, 1.5, 2.62, Math.PI, 1.0);
    bb(shelf, PAL.woodDark, 0, 0, 0, 1.2, 0.04, 0.3);
    const cols = ["#b5442f", "#2f5d8a", "#d8a43a", "#3f7a5a", "#8a3b5c", "#e0d6c2"];
    for (let i = 0; i < 9; i++) bb(shelf, cols[i % cols.length], -0.5 + i * 0.12, 0.04, 0, 0.09, 0.22 + (i % 3) * 0.03, 0.22);
    // a calendar
    const cal = grp(g, 2.6, 2.66, Math.PI, 1.5);
    bx(cal, "#f4efe4", 0, 0, 0, 0.42, 0.56, 0.01);
    bx(cal, PAL.ink, 0, 0.21, -0.008, 0.42, 0.12, 0.01);
    // wall clock on the far wall, above her head (hands set by the scene)
    const clock = grp(g, -0.9, 2.66, Math.PI, 2.2);
    mk(G.cyl, M("#f7f3ea"), clock, 0, 0, 0.03, 0.5, 0.05, 0.5).rotation.x = Math.PI / 2;
    mk(G.cyl, M("#3a2c22"), clock, 0, 0, 0.01, 0.56, 0.03, 0.56).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      bx(clock, "#3a2c22", Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0.06, 0.015, i % 3 ? 0.025 : 0.05, 0.005, false);
    }
    for (const [h, len, w, z] of [[this.hourHand, 0.12, 0.022, 0.065], [this.minuteHand, 0.18, 0.016, 0.07], [this.secondHand, 0.2, 0.007, 0.075]] as const) {
      h.position.z = z;
      clock.add(h);
      bx(h, h === this.secondHand ? PAL.ink : "#22201d", 0, len / 2 - 0.02, 0, w, len, 0.005, false);
    }
    // table and chair
    const table = grp(g, 0, 0, 0);
    bb(table, "#8a5a36", 0, 0.72, 0, 1.7, 0.05, 0.9);
    for (const a of [-1, 1]) for (const b of [-1, 1]) bb(table, "#6b4228", a * 0.78, 0, b * 0.38, 0.06, 0.72, 0.06);
    const chair = grp(g, 0, 0.72, 0);
    bb(chair, "#5d4330", 0, 0.44, 0, 0.48, 0.05, 0.46);
    bb(chair, "#5d4330", 0, 0.49, 0.22, 0.48, 0.55, 0.04);
    for (const a of [-1, 1]) for (const b of [-1, 1]) bb(chair, "#4a3324", a * 0.2, 0, b * 0.19, 0.035, 0.44, 0.035);
    // desk lamp
    const lamp = grp(g, -0.62, -0.28, 0.5, 0.745);
    mk(G.cyl, M("#2e3138"), lamp, 0, 0.01, 0, 0.16, 0.02, 0.16);
    const arm = bx(lamp, "#2e3138", 0.05, 0.22, 0, 0.025, 0.44, 0.025);
    arm.rotation.z = -0.25;
    const shade = mk(new THREE.ConeGeometry(0.11, 0.14, 12, 1, true), M("#c7472f", { side: THREE.DoubleSide }), lamp, 0.13, 0.42, 0.04);
    shade.rotation.z = -0.6;
    this.lamp.position.set(-0.45, 1.1, -0.2);
    g.add(this.lamp);
    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffcf8f", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.lampGlow.position.set(-0.5, 1.05, -0.24);
    this.lampGlow.scale.set(0.9, 0.9, 1);
    g.add(this.lampGlow);
    // answer-sheet stacks (instanced thin sheets)
    const sheetGeo = new THREE.BoxGeometry(0.24, 0.0062, 0.33);
    const sheetMat = M(PAL.paper);
    this.stackA = new THREE.InstancedMesh(sheetGeo, sheetMat, SHEETS);
    this.stackB = new THREE.InstancedMesh(sheetGeo, sheetMat, SHEETS);
    for (const s of [this.stackA, this.stackB]) {
      s.castShadow = s.receiveShadow = true;
      s.frustumCulled = false;
      g.add(s);
    }
    this.setStacks(SHEETS, 0);
    // a second, already-graded section's stack for scale (static)
    const other = new THREE.InstancedMesh(sheetGeo, M("#ebe4d2"), 46);
    for (let i = 0; i < 46; i++) {
      this.m4.compose(V3(-0.5, 0.75 + i * 0.0064, -0.38 + (i % 4) * 0.002), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.1 + ((i * 37) % 7) * 0.012, 0)), V3(1, 1, 1));
      other.setMatrixAt(i, this.m4);
    }
    other.castShadow = true;
    g.add(other);
    // three graded piles beside the laptop (scene 3)
    for (let k = 0; k < 3; k++) {
      const p = new THREE.InstancedMesh(sheetGeo, M(PAL.paper), 40);
      p.count = 0;
      p.castShadow = true;
      p.frustumCulled = false;
      g.add(p);
      this.piles.push(p);
    }
    // phone on the table
    this.phone.position.set(0.32, 0.751, 0.28);
    this.phone.rotation.y = -0.3;
    g.add(this.phone);
    bb(this.phone, "#15171d", 0, 0, 0, 0.08, 0.012, 0.16);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.145), this.phoneScreen);
    ps.rotation.x = -Math.PI / 2;
    ps.position.y = 0.013;
    this.phone.add(ps);
    this.phoneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffd9c2", blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.phoneGlow.position.y = 0.08;
    this.phoneGlow.scale.set(0.6, 0.6, 1);
    this.phone.add(this.phoneGlow);
    // laptop (closed until scene 3)
    this.laptop.position.set(0.02, 0.745, -0.12);
    g.add(this.laptop);
    bb(this.laptop, "#3a3d45", 0, 0, 0, 0.5, 0.02, 0.34);
    const lid = grp(this.laptop, 0, -0.17, 0, 0.02);
    lid.name = "lid";
    bb(lid, "#3a3d45", 0, 0, -0.01, 0.5, 0.33, 0.015);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), this.laptopScreen);
    scr.position.set(0, 0.17, 0.0);
    lid.add(scr);
    // a mug
    mk(G.cyl, M("#e8e1d3"), g, 0.62, 0.8, 0.2, 0.1, 0.11, 0.1);
  }

  /** a: sheets left to photograph, b: sheets photographed. */
  setStacks(a: number, b: number) {
    const place = (im: THREE.InstancedMesh, n: number, x: number, z: number, seed: number) => {
      for (let i = 0; i < n; i++) {
        const j = ((i + seed) * 2654435761) % 97;
        this.m4.compose(V3(x + (j % 5) * 0.002 - 0.004, 0.75 + i * 0.0064, z + (j % 7) * 0.002 - 0.006), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ((j % 9) - 4) * 0.012, 0)), V3(1, 1, 1));
        im.setMatrixAt(i, this.m4);
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    };
    place(this.stackA, Math.round(a), -0.48, -0.02, 3);
    place(this.stackB, Math.round(b), 0.5, 0.05, 11);
  }

  /** Graded piles: counts per band (high, medium, low), drawn at most 40 tall. */
  setPiles(counts: [number, number, number]) {
    counts.forEach((n, k) => {
      const im = this.piles[k];
      const shown = Math.min(40, Math.round(n));
      for (let i = 0; i < shown; i++) {
        this.m4.compose(V3(this.P.pileX[k] - HOME_O.x, 0.75 + i * 0.0064, this.P.pileZ - HOME_O.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (((i * 13) % 7) - 3) * 0.015, 0)), V3(0.62, 1, 0.62));
        im.setMatrixAt(i, this.m4);
      }
      im.count = shown;
      im.instanceMatrix.needsUpdate = true;
    });
  }

  setClock(hours: number, minutes: number, seconds: number) {
    this.secondHand.rotation.z = -(seconds / 60) * Math.PI * 2;
    this.minuteHand.rotation.z = -((minutes + seconds / 60) / 60) * Math.PI * 2;
    this.hourHand.rotation.z = -(((hours % 12) + minutes / 60) / 12) * Math.PI * 2;
  }

  setLaptopOpen(open: number) {
    const lid = this.laptop.getObjectByName("lid")!;
    lid.rotation.x = (Math.PI / 2) * (1 - open) - 0.3 * open;
    this.laptopScreen.color.set(open > 0.6 ? "#f6f1e6" : "#1b1d24");
  }

  phoneLit(on: number) {
    this.phoneScreen.color.set(on > 0 ? "#fff1e6" : "#1b1d24");
    (this.phoneGlow.material as THREE.SpriteMaterial).opacity = on * 0.9;
  }
}
