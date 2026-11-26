/**
 * CLASSROOM_8B: rows of wooden desks and benches, a blackboard (canvas texture), the teacher's desk,
 * windows, ceiling fans and a door. 52 students in uniform: instanced meshes, except Rohan, Sneha and Imran,
 * who are full rigs so they can be addressed, labelled and animated individually.
 */
import * as THREE from "three";
import { rng } from "../engine/math";
import { G, M, PAL, bb, bx, grp, mk, V3 } from "./kit";
import { Person } from "./person";
import type { DemoStudent } from "../data/types";

export const ROOM = { x0: -6.2, x1: 6.2, z0: -7.2, z1: 7.4, h: 3.4 };
const COL_X = [-4.3, -1.5, 1.5, 4.3];
const ROW_Z = [-3.4, -1.95, -0.5, 0.95, 2.4, 3.85, 5.3];
const SEAT_DX = 0.37;
/** Where a seated student's hips are, relative to their desk. */
const BENCH_DZ = 0.46;

const GIRLS = new Set(["Aditi", "Ananya", "Ayesha", "Bhavya", "Deepika", "Diya", "Harini", "Harpreet", "Isha", "Kavya", "Lakshmi", "Meera", "Nandini", "Neha", "Pooja", "Priya", "Riya", "Saanvi", "Sanjana", "Shreya", "Sneha", "Tanvi", "Vaishnavi", "Zara", "Zoya"]);
const SKINS = ["#a86d48", "#8d5a3b", "#b97f57", "#9c6544", "#c08a63", "#7f5034"];
const RIGGED = ["Rohan Kumar", "Sneha Iyer", "Imran Shaikh"];

export interface Seat {
  student: DemoStudent;
  x: number;
  z: number;
  deskX: number;
  deskZ: number;
  girl: boolean;
}

/**
 * Deterministic seating. The three students the story follows sit beside the centre aisle (Rohan on the
 * back bench), so the teacher can walk to them; everyone else is shuffled into the remaining seats.
 */
function seatPlan(students: DemoStudent[]): Seat[] {
  const r = rng(808);
  type Slot = { x: number; z: number; dx: number; dz: number };
  const slot = (row: number, c: number, s: number): Slot => ({ x: COL_X[c] + (s ? SEAT_DX : -SEAT_DX), z: ROW_Z[row] + BENCH_DZ, dx: COL_X[c], dz: ROW_Z[row] });
  const fixed: Record<string, Slot> = { "Imran Shaikh": slot(1, 2, 0), "Sneha Iyer": slot(3, 1, 1), "Rohan Kumar": slot(6, 2, 0) };
  const taken = new Set(Object.values(fixed).map((x) => `${x.x},${x.z}`));
  const free: Slot[] = [];
  for (let row = 0; row < 7; row++) for (let c = 0; c < 4; c++) for (let s = 0; s < 2; s++) if (row < 6 || c === 1 || c === 2) free.push(slot(row, c, s));
  const open = free.filter((x) => !taken.has(`${x.x},${x.z}`));
  const others = students.filter((s) => !fixed[s.name]);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const seats: Seat[] = [];
  const girl = (st: DemoStudent) => GIRLS.has(st.name.split(" ")[0]);
  others.forEach((st, i) => seats.push({ student: st, x: open[i].x, z: open[i].z, deskX: open[i].dx, deskZ: open[i].dz, girl: girl(st) }));
  for (const st of students.filter((s) => fixed[s.name])) {
    const f = fixed[st.name];
    seats.push({ student: st, x: f.x, z: f.z, deskX: f.dx, deskZ: f.dz, girl: girl(st) });
  }
  return seats;
}

function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      x.fillStyle = (i + j) % 2 ? "#cfc6b4" : "#d8d0bf";
      x.fillRect(i * 64, j * 64, 64, 64);
    }
  x.strokeStyle = "rgba(90,80,60,.25)";
  x.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    x.beginPath();
    x.moveTo(i * 64, 0);
    x.lineTo(i * 64, 512);
    x.stroke();
    x.beginPath();
    x.moveTo(0, i * 64);
    x.lineTo(512, i * 64);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3.1, 3.6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The blackboard: a canvas texture redrawn per scene. */
export class Blackboard {
  canvas = document.createElement("canvas");
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  private lines: string[] = [];
  private header = "";
  private balance = 0;

  constructor() {
    this.canvas.width = 1280;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.draw();
  }

  /** header: top-left date/topic; lines: chalk lines (partial reveal via `shown`); balance: 0..1 scale drawing. */
  set(header: string, lines: string[], balance = 0) {
    if (header === this.header && balance === this.balance && lines.join("\n") === this.lines.join("\n")) return;
    this.header = header;
    this.lines = lines;
    this.balance = balance;
    this.draw();
  }

  private draw() {
    const x = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    x.fillStyle = "#24352b";
    x.fillRect(0, 0, W, H);
    // faint smudges
    const r = rng(5);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.025})`;
      x.beginPath();
      x.ellipse(r() * W, r() * H, 40 + r() * 120, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#eef2ea";
    x.font = "600 34px Kalam, 'Comic Sans MS', cursive";
    x.fillText(this.header, 34, 52);
    x.font = "40px Kalam, 'Comic Sans MS', cursive";
    let y = 112;
    const left = this.balance > 0 ? 560 : 60;
    for (const l of this.lines) {
      x.fillText(l, left, y, W - left - 30);
      y += 52;
    }
    if (this.balance > 0) this.drawBalance(this.balance);
    this.tex.needsUpdate = true;
  }

  /** A balance (taraazu): both pans level, "3x + 5" on the left, "20" on the right. */
  private drawBalance(p: number) {
    const x = this.ctx;
    x.save();
    x.globalAlpha = Math.min(1, p * 1.4);
    x.strokeStyle = "#eef2ea";
    x.lineWidth = 6;
    x.lineCap = "round";
    const cx = 270;
    x.beginPath();
    x.moveTo(cx, 420);
    x.lineTo(cx, 170);
    x.moveTo(cx - 70, 420);
    x.lineTo(cx + 70, 420);
    x.moveTo(cx - 190, 170);
    x.lineTo(cx + 190, 170);
    x.stroke();
    for (const side of [-1, 1]) {
      const px = cx + side * 190;
      x.beginPath();
      x.moveTo(px, 170);
      x.lineTo(px - 70, 290);
      x.moveTo(px, 170);
      x.lineTo(px + 70, 290);
      x.moveTo(px - 90, 290);
      x.quadraticCurveTo(px, 340, px + 90, 290);
      x.stroke();
    }
    x.fillStyle = "#eef2ea";
    x.font = "40px Kalam, 'Comic Sans MS', cursive";
    x.textAlign = "center";
    x.fillText("3x + 5", cx - 190, 282);
    x.fillText("20", cx + 190, 282);
    x.restore();
  }
}

export class Classroom {
  root = new THREE.Group();
  seats: Seat[];
  rigs = new Map<string, Person>();
  board = new Blackboard();
  fans: THREE.Group[] = [];
  windowMat = new THREE.MeshBasicMaterial({ color: "#cfe6f5" });
  teacherDesk = V3(-3.3, 0, -5.3);
  laptop = new THREE.Group();
  laptopScreen = new THREE.MeshBasicMaterial({ color: "#f3efe6" });
  doorPos = V3(6.0, 0, -5.5);
  /** Floor rings and desk tiles, one per seat (instanced, coloured per student). */
  rings: THREE.InstancedMesh;
  tiles: THREE.InstancedMesh;
  ptm = new THREE.Group();
  exitStack = new THREE.Group();
  private studentParts: THREE.InstancedMesh[] = [];
  private instanced: Seat[] = [];
  private headMesh!: THREE.InstancedMesh;
  private hairMesh!: THREE.InstancedMesh;
  private plaitMesh!: THREE.InstancedMesh;
  private plaitOwners: number[] = [];
  private m4 = new THREE.Matrix4();

  constructor(scene: THREE.Scene, students: DemoStudent[]) {
    scene.add(this.root);
    this.seats = seatPlan(students);
    this.buildRoom();
    this.buildDesks();
    this.buildStudents();
    const ringGeo = new THREE.RingGeometry(0.42, 0.52, 36).rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), this.seats.length);
    const tileGeo = new THREE.PlaneGeometry(0.5, 0.3).rotateX(-Math.PI / 2);
    this.tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), this.seats.length);
    this.seats.forEach((s, i) => {
      this.m4.makeTranslation(s.x, 0.02, s.z - 0.05);
      this.rings.setMatrixAt(i, this.m4);
      this.m4.makeTranslation(s.x, 0.785, s.deskZ);
      this.tiles.setMatrixAt(i, this.m4);
      this.rings.setColorAt(i, new THREE.Color("#ffffff"));
      this.tiles.setColorAt(i, new THREE.Color("#ffffff"));
    });
    this.rings.visible = this.tiles.visible = false;
    this.root.add(this.rings, this.tiles);
    this.buildPtm();
  }

  seatOf(name: string) {
    return this.seats.find((s) => s.student.name === name)!;
  }

  seatPos(name: string) {
    const s = this.seatOf(name);
    return V3(s.x, 0, s.z);
  }

  private buildRoom() {
    const g = this.root;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (ROOM.z0 + ROOM.z1) / 2);
    floor.receiveShadow = true;
    g.add(floor);
    const wall = "#efe6cf";
    const dado = "#8fb39a";
    // front wall + blackboard
    bb(g, wall, 0, 0, ROOM.z0 - 0.1, ROOM.x1 - ROOM.x0 + 0.4, ROOM.h, 0.2);
    bb(g, dado, 0, 0, ROOM.z0 + 0.01, ROOM.x1 - ROOM.x0, 1.0, 0.02);
    bx(g, "#5b3f28", 0, 1.9, ROOM.z0 + 0.03, 4.5, 1.8, 0.06);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.6), new THREE.MeshStandardMaterial({ map: this.board.tex, roughness: 0.95 }));
    board.position.set(0, 1.9, ROOM.z0 + 0.065);
    g.add(board);
    bx(g, "#5b3f28", 0, 1.06, ROOM.z0 + 0.12, 4.4, 0.05, 0.14);
    for (let i = 0; i < 4; i++) bx(g, "#f4f1ea", -1.6 + i * 0.12, 1.1, ROOM.z0 + 0.12, 0.07, 0.025, 0.025);
    // wall clock above the board
    const clock = grp(g, 2.9, ROOM.z0 + 0.04, 0, 2.95);
    mk(G.cyl, M("#f7f3ea"), clock, 0, 0, 0.02, 0.42, 0.04, 0.42).rotation.x = Math.PI / 2;
    bx(clock, "#222", 0.05, 0.06, 0.05, 0.02, 0.15, 0.01).rotation.z = -0.7;
    bx(clock, "#222", -0.06, 0.03, 0.05, 0.02, 0.1, 0.01).rotation.z = 1.1;
    // left wall with windows
    const lw = grp(g, ROOM.x0 - 0.1, 0, 0);
    bb(lw, wall, 0, 0, 0.1, 0.2, 0.9, ROOM.z1 - ROOM.z0);
    bb(lw, dado, 0.11, 0, 0.1, 0.02, 0.9, ROOM.z1 - ROOM.z0);
    bb(lw, wall, 0, 2.6, 0.1, 0.2, 0.8, ROOM.z1 - ROOM.z0);
    const wins = [-5.2, -2.2, 0.8, 3.8];
    const between = [-7.2, ...wins.flatMap((z) => [z - 1.1, z + 1.1]), 7.4];
    for (let i = 0; i < between.length; i += 2) {
      const a = between[i];
      const b = between[i + 1];
      if (b > a) bb(lw, wall, 0, 0.9, (a + b) / 2, 0.2, 1.7, b - a);
    }
    for (const z of wins) {
      const pane = new THREE.Mesh(G.box, this.windowMat);
      pane.position.set(0, 1.75, z);
      pane.scale.set(0.05, 1.7, 2.2);
      lw.add(pane);
      for (let k = -2; k <= 2; k++) bx(lw, "#3f6b55", 0.06, 1.75, z + k * 0.44, 0.06, 1.7, 0.05);
      bx(lw, "#3f6b55", 0.06, 1.75, z, 0.06, 0.05, 2.2);
    }
    // right wall with the door near the front
    const rw = grp(g, ROOM.x1 + 0.1, 0, 0);
    bb(rw, wall, 0, 0, -6.6, 0.2, ROOM.h, 1.2);
    bb(rw, wall, 0, 0, 1.25, 0.2, ROOM.h, 12.3);
    bb(rw, wall, 0, 2.3, -5.5, 0.2, ROOM.h - 2.3, 1.0);
    bb(rw, dado, -0.11, 0, 1.25, 0.02, 1.0, 12.3);
    bx(rw, "#7a5234", -0.12, 1.15, -5.5, 0.06, 2.3, 1.1);
    const door = grp(rw, -0.1, -5.95, 0);
    bb(door, "#8a5f3b", 0, 0, 0.42, 0.05, 2.2, 0.86).rotation.y = 0;
    door.rotation.y = -1.1;
    // charts on the right wall
    const charts: [number, string][] = [[-2.5, "#f2d27a"], [-0.6, "#bfe0e8"], [1.4, "#f4b8a6"], [3.4, "#d7e8b6"]];
    for (const [z, c] of charts) {
      bx(rw, "#ffffff", -0.12, 2.0, z, 0.02, 0.95, 1.3);
      bx(rw, c, -0.135, 2.0, z, 0.02, 0.8, 1.15);
    }
    // ceiling: faces down, so it is seen from inside the room and invisible from the overhead cameras
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0 + 0.4, ROOM.z1 - ROOM.z0 + 0.4), new THREE.MeshStandardMaterial({ color: "#f1ebdc", roughness: 0.95 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, ROOM.h, (ROOM.z0 + ROOM.z1) / 2);
    g.add(ceiling);
    // low back wall (cut away so the class can be seen)
    bb(g, wall, 0, 0, ROOM.z1 + 0.1, ROOM.x1 - ROOM.x0 + 0.4, 0.9, 0.2);
    // ceiling fans (the ceiling itself is left out so the camera can see in)
    for (const [fx, fz] of [[-2.8, -2.6], [2.8, -2.6], [-2.8, 2.9], [2.8, 2.9]]) {
      const f = grp(g, fx, fz, 0, 3.05);
      bx(f, "#e8e4da", 0, 0.32, 0, 0.04, 0.64, 0.04, false);
      mk(G.cyl, M("#ddd8cc"), f, 0, 0, 0, 0.22, 0.1, 0.22, false);
      const blades = grp(f, 0, 0, 0, -0.02);
      for (let k = 0; k < 3; k++) {
        const b = bx(blades, "#d8d2c4", 0, 0, 0, 0.62, 0.015, 0.13, false);
        b.position.set(Math.cos((k * Math.PI * 2) / 3) * 0.42, 0, Math.sin((k * Math.PI * 2) / 3) * 0.42);
        b.rotation.y = (-k * Math.PI * 2) / 3;
      }
      this.fans.push(blades);
    }
    // teacher's desk, chair, laptop
    const td = grp(g, this.teacherDesk.x, this.teacherDesk.z, 0);
    bb(td, PAL.woodDark, 0, 0.72, 0, 1.7, 0.06, 0.8);
    bb(td, PAL.wood, -0.6, 0, 0, 0.42, 0.72, 0.74);
    bb(td, PAL.wood, 0.6, 0, 0, 0.42, 0.72, 0.74);
    bb(td, PAL.wood, 0, 0.2, 0.36, 0.8, 0.5, 0.03);
    const chair = grp(g, this.teacherDesk.x, this.teacherDesk.z - 0.62, 0);
    bb(chair, "#5b6b7a", 0, 0.44, 0, 0.5, 0.06, 0.48);
    bb(chair, "#5b6b7a", 0, 0.5, -0.24, 0.5, 0.55, 0.05);
    for (const a of [-1, 1]) for (const b of [-1, 1]) bb(chair, "#3d4550", a * 0.21, 0, b * 0.2, 0.04, 0.44, 0.04);
    // books and a register on the desk
    bb(td, "#b5442f", 0.55, 0.78, -0.1, 0.32, 0.05, 0.24);
    bb(td, "#2f5d8a", 0.57, 0.83, -0.08, 0.3, 0.04, 0.22);
    // laptop (lid opens toward the teacher, who sits on the -z side)
    td.add(this.laptop);
    this.laptop.position.set(-0.05, 0.75, -0.08);
    this.laptop.rotation.y = Math.PI;
    bb(this.laptop, "#3a3d45", 0, 0, 0, 0.5, 0.02, 0.34);
    const lid = grp(this.laptop, 0, -0.17, 0, 0.02);
    lid.rotation.x = -0.32;
    bb(lid, "#3a3d45", 0, 0, -0.01, 0.5, 0.33, 0.015);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), this.laptopScreen);
    scr.position.set(0, 0.17, 0.009);
    lid.add(scr);
    this.exitStack.position.set(0.18, 0.75, 0.12);
    td.add(this.exitStack);
    for (let i = 0; i < 14; i++) {
      const s = bb(this.exitStack, i % 2 ? PAL.paper : "#ece6d6", (i % 3) * 0.006, i * 0.008, (i % 4) * 0.004, 0.21, 0.007, 0.3);
      s.rotation.y = (i % 5) * 0.03 - 0.06;
    }
    this.exitStack.visible = false;
  }

  private buildDesks() {
    const desks: [number, number][] = [];
    for (let row = 0; row < 7; row++) for (const c of row === 6 ? [1, 2] : [0, 1, 2, 3]) desks.push([COL_X[c], ROW_Z[row]]);
    const n = desks.length;
    const parts: { geo: THREE.BufferGeometry; mat: THREE.Material; place: (x: number, z: number, m: THREE.Matrix4) => void }[] = [
      { geo: G.box, mat: M(PAL.wood), place: (x, z, m) => m.compose(V3(x, 0.75, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, 0)), V3(1.5, 0.045, 0.48)) },
      { geo: G.box, mat: M(PAL.woodDark), place: (x, z, m) => m.compose(V3(x, 0.47, z - 0.22), new THREE.Quaternion(), V3(1.46, 0.5, 0.035)) },
      { geo: G.box, mat: M(PAL.woodDark), place: (x, z, m) => m.compose(V3(x, 0.58, z + 0.02), new THREE.Quaternion(), V3(1.4, 0.025, 0.36)) },
      { geo: G.box, mat: M(PAL.wood), place: (x, z, m) => m.compose(V3(x, 0.44, z + BENCH_DZ + 0.02), new THREE.Quaternion(), V3(1.5, 0.05, 0.3)) },
      { geo: G.box, mat: M(PAL.woodDark), place: (x, z, m) => m.compose(V3(x, 0.22, z + BENCH_DZ), new THREE.Quaternion(), V3(1.4, 0.04, 0.05)) },
    ];
    const m = new THREE.Matrix4();
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geo, p.mat, n);
      desks.forEach(([x, z], i) => {
        p.place(x, z, m);
        im.setMatrixAt(i, m);
      });
      im.castShadow = im.receiveShadow = true;
      this.root.add(im);
    }
    // legs: 4 per desk + 4 per bench
    const legs = new THREE.InstancedMesh(G.box, M(PAL.woodDark), n * 8);
    let k = 0;
    for (const [x, z] of desks) {
      for (const a of [-0.7, 0.7]) {
        for (const dz of [-0.2, 0.2]) {
          m.compose(V3(x + a, 0.37, z + dz), new THREE.Quaternion(), V3(0.05, 0.74, 0.05));
          legs.setMatrixAt(k++, m);
        }
        for (const dz of [BENCH_DZ - 0.1, BENCH_DZ + 0.12]) {
          m.compose(V3(x + a, 0.21, z + dz), new THREE.Quaternion(), V3(0.05, 0.42, 0.05));
          legs.setMatrixAt(k++, m);
        }
      }
    }
    legs.castShadow = true;
    this.root.add(legs);
  }

  private buildStudents() {
    const r = rng(52);
    const others = this.seats.filter((s) => !RIGGED.includes(s.student.name));
    this.instanced = others;
    const n = others.length;
    const girls = others.filter((s) => s.girl);
    const mk2 = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.castShadow = true;
      this.root.add(im);
      this.studentParts.push(im);
      return im;
    };
    const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, flatShading: true });
    const torso = mk2(new THREE.BoxGeometry(0.38, 0.5, 0.23).translate(0, 0.25, 0), M(PAL.white), n);
    const lower = mk2(new THREE.BoxGeometry(0.36, 0.16, 0.42).translate(0, 0.08, 0.1), M(PAL.navy), n);
    const bib = mk2(new THREE.BoxGeometry(0.3, 0.36, 0.02), M(PAL.navy), Math.max(1, girls.length));
    this.headMesh = mk2(new THREE.IcosahedronGeometry(0.14, 1), white, n);
    this.hairMesh = mk2(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), M("#17120f"), n);
    const arms = mk2(new THREE.BoxGeometry(0.1, 0.1, 0.42).translate(0, 0, -0.21), white, n * 2);
    this.plaitMesh = mk2(new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(0, -0.15, 0), M("#17120f"), Math.max(1, girls.length * 2));
    const c = new THREE.Color();
    let gi = 0;
    others.forEach((s, i) => {
      const skin = SKINS[Math.floor(r() * SKINS.length)];
      const yaw = Math.PI; // facing the board (-z)
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      this.m4.compose(V3(s.x, 0.48, s.z), q, V3(1, 1, 1));
      torso.setMatrixAt(i, this.m4);
      this.m4.compose(V3(s.x, 0.4, s.z), q, V3(1, 1, 1));
      lower.setMatrixAt(i, this.m4);
      for (const side of [-1, 1]) {
        this.m4.compose(V3(s.x + side * 0.22, 0.86, s.z - 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, side * 0.08, 0)), V3(1, 1, 1));
        arms.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), this.m4);
        arms.setColorAt(i * 2 + (side < 0 ? 0 : 1), c.set(PAL.white));
      }
      this.headMesh.setColorAt(i, c.set(skin));
      if (s.girl) {
        this.m4.compose(V3(s.x, 0.74, s.z - 0.125), q, V3(1, 1, 1));
        bib.setMatrixAt(gi, this.m4);
        this.plaitOwners.push(i, i);
        gi++;
      }
    });
    bib.count = gi;
    this.plaitMesh.count = this.plaitOwners.length;
    this.updateStudents(0, 0);
    // the three addressable students
    const rig = (name: string, o: ConstructorParameters<typeof Person>[1]) => {
      const p = new Person(this.root, { scale: 0.8, top: PAL.white, bottom: PAL.navy, ...o }, name.length);
      this.rigs.set(name, p);
      return p;
    };
    rig("Rohan Kumar", { skin: "#9c6544" });
    rig("Sneha Iyer", { skin: "#b97f57", pinafore: PAL.navy, plaits: true });
    rig("Imran Shaikh", { skin: "#8d5a3b" });
  }

  /** Head bob and look-around for the instanced students. `look` turns heads toward a point (0 = board). */
  updateStudents(T: number, attention: number, look?: THREE.Vector3) {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    this.instanced.forEach((s, i) => {
      const ph = i * 1.7;
      let yaw = Math.PI + Math.sin(T * 0.4 + ph) * 0.18 * (1 - attention);
      if (look) yaw = Math.atan2(look.x - s.x, look.z - s.z) * attention + yaw * (1 - attention);
      const pitch = 0.12 + Math.sin(T * 0.7 + ph * 2) * 0.05;
      e.set(pitch, yaw, 0, "YXZ");
      q.setFromEuler(e);
      const y = 1.17 + Math.sin(T * 1.3 + ph) * 0.006;
      this.m4.compose(V3(s.x, y, s.z - 0.02), q, V3(1, 1, 1));
      this.headMesh.setMatrixAt(i, this.m4);
      this.m4.compose(V3(s.x, y + 0.015, s.z - 0.02), q, V3(1, 1, 1));
      this.hairMesh.setMatrixAt(i, this.m4);
    });
    this.plaitOwners.forEach((owner, k) => {
      const s = this.instanced[owner];
      const side = k % 2 ? 1 : -1;
      this.m4.compose(V3(s.x + side * 0.1, 1.17, s.z + 0.09), new THREE.Quaternion(), V3(1, 1, 1));
      this.plaitMesh.setMatrixAt(k, this.m4);
    });
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.hairMesh.instanceMatrix.needsUpdate = true;
    this.plaitMesh.instanceMatrix.needsUpdate = true;
  }

  /** Seat the three rigged students. */
  seatRigs() {
    for (const [name, p] of this.rigs) {
      const s = this.seatOf(name);
      p.place(s.x, s.z + 0.08, Math.PI, "sitDesk");
    }
  }

  setStudentsVisible(v: boolean) {
    for (const m of this.studentParts) m.visible = v;
    for (const p of this.rigs.values()) p.g.visible = v;
  }

  /** Colour the rings/tiles from a name → colour map; hidden seats get no ring. */
  colourRings(colour: (s: Seat) => string | null, scale = 1) {
    const c = new THREE.Color();
    this.seats.forEach((s, i) => {
      const col = colour(s);
      this.m4.compose(V3(s.x, 0.02, s.z - 0.05), new THREE.Quaternion(), col ? V3(scale, 1, scale) : V3(0.0001, 1, 0.0001));
      this.rings.setMatrixAt(i, this.m4);
      this.m4.compose(V3(s.x, 0.785, s.deskZ), new THREE.Quaternion(), col ? V3(1, 1, 1) : V3(0.0001, 1, 0.0001));
      this.tiles.setMatrixAt(i, this.m4);
      c.set(col ?? "#ffffff");
      this.rings.setColorAt(i, c);
      this.tiles.setColorAt(i, c);
    });
    this.rings.instanceMatrix.needsUpdate = this.tiles.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  /** PTM furniture: two chairs across the teacher's desk. */
  private buildPtm() {
    this.root.add(this.ptm);
    for (const dx of [-0.45, 0.45]) {
      const c = grp(this.ptm, this.teacherDesk.x + dx, this.teacherDesk.z + 0.95, Math.PI);
      bb(c, "#7b8a63", 0, 0.44, 0, 0.46, 0.05, 0.44);
      bb(c, "#7b8a63", 0, 0.49, -0.22, 0.46, 0.5, 0.04);
      for (const a of [-1, 1]) for (const b of [-1, 1]) bb(c, "#4d573e", a * 0.19, 0, b * 0.18, 0.035, 0.44, 0.035);
    }
    // a bench by the door for waiting parents
    const bench = grp(this.ptm, 5.55, -3.2, Math.PI / 2);
    bb(bench, PAL.wood, 0, 0.42, 0, 2.2, 0.05, 0.36);
    for (const a of [-0.95, 0.95]) bb(bench, PAL.woodDark, a, 0, 0, 0.06, 0.42, 0.3);
    this.ptm.visible = false;
  }

  update(dt: number, T: number, fanSpeed = 1) {
    for (const f of this.fans) f.rotation.y += dt * 7 * fanSpeed;
    for (const p of this.rigs.values()) p.update(dt, T);
  }
}
