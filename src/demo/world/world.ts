/**
 * The 3D world: renderer, camera, sky, lighting presets with smooth transitions, the sets (home at night,
 * classroom 8B, PTM afternoon), the people, effects and the HTML overlay.
 */
import * as THREE from "three";
import { lerp, rng } from "../engine/math";
import { Classroom, ROOM } from "./classroom";
import { Fx } from "./fx";
import { Home } from "./home";
import { M, PAL, V3 } from "./kit";
import { Overlay } from "./overlay";
import { Person } from "./person";
import type { DemoData } from "../data/types";

/** The 3D view's designed size (stage units). The stage grows to the window's shape, so the live size can be larger. */
export const VIEW_W = 1114;
export const VIEW_H = 900;
const BASE_FOV = 38;

export type SetName = "home" | "classroom" | "ptm";
export type LightName = "night" | "day" | "afternoon";

interface Preset {
  top: string;
  bot: string;
  fog: string;
  fogN: number;
  fogF: number;
  sun: string;
  sunI: number;
  dir: [number, number, number];
  hs: string;
  hg: string;
  hi: number;
  exp: number;
  win: string;
  fill: string;
  fillI: number;
}

const PRESETS: Record<LightName, Preset> = {
  night: { top: "#060b1e", bot: "#16203f", fog: "#0e1430", fogN: 14, fogF: 40, sun: "#8fa3e8", sunI: 0.35, dir: [0.3, 0.8, 0.5], hs: "#3a4677", hg: "#120f0d", hi: 0.55, exp: 1.12, win: "#0e1838", fill: "#ffd2a8", fillI: 1.1 },
  day: { top: "#9cc8ea", bot: "#f6ecd6", fog: "#efe6d2", fogN: 40, fogF: 110, sun: "#fff0d8", sunI: 2.6, dir: [-0.62, 0.74, 0.22], hs: "#f4f1ea", hg: "#8f7a5c", hi: 1.05, exp: 1.0, win: "#d6ecf7", fill: "#fff6ea", fillI: 0.55 },
  afternoon: { top: "#8fb0d6", bot: "#ffd29c", fog: "#f2d4ac", fogN: 40, fogF: 110, sun: "#ffc27a", sunI: 2.4, dir: [-0.82, 0.45, 0.32], hs: "#ffe7c8", hg: "#7a5f45", hi: 0.92, exp: 1.02, win: "#ffd9a3", fill: "#ffe7cf", fillI: 0.6 },
};

interface LightState {
  top: THREE.Color;
  bot: THREE.Color;
  fog: THREE.Color;
  fogN: number;
  fogF: number;
  sun: THREE.Color;
  sunI: number;
  dir: THREE.Vector3;
  hs: THREE.Color;
  hg: THREE.Color;
  hi: number;
  exp: number;
  win: THREE.Color;
  fill: THREE.Color;
  fillI: number;
}

function vals(name: LightName): LightState {
  const p = PRESETS[name];
  return {
    top: new THREE.Color(p.top),
    bot: new THREE.Color(p.bot),
    fog: new THREE.Color(p.fog),
    fogN: p.fogN,
    fogF: p.fogF,
    sun: new THREE.Color(p.sun),
    sunI: p.sunI,
    dir: new THREE.Vector3(...p.dir).normalize(),
    hs: new THREE.Color(p.hs),
    hg: new THREE.Color(p.hg),
    hi: p.hi,
    exp: p.exp,
    win: new THREE.Color(p.win),
    fill: new THREE.Color(p.fill),
    fillI: p.fillI,
  };
}

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(BASE_FOV, VIEW_W / VIEW_H, 0.05, 400);
  target = V3(0, 0, 0);
  hemi = new THREE.HemisphereLight("#ffffff", "#776655", 1);
  sun = new THREE.DirectionalLight("#ffffff", 2);
  /** Soft fill from the camera's side, so faces never go black against a lamp or window. */
  fill = new THREE.DirectionalLight("#ffffff", 0.5);
  sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private cur = vals("day");
  private tgt = vals("day");
  home: Home;
  classroom: Classroom;
  fx: Fx;
  overlay: Overlay;
  set: SetName = "classroom";
  people: { anjali: Person; mother: Person; parents: Person[]; rohan: Person; sneha: Person; imran: Person };
  private outside = new THREE.Group();

  constructor(canvas: HTMLCanvasElement, overlayEl: HTMLElement, data: DemoData, reduced: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog("#efe6d2", 40, 110);
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -11;
    sc.right = 11;
    sc.top = 11;
    sc.bottom = -11;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.fill, this.fill.target);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
      vertexShader: "varying float vy;void main(){vy=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "uniform vec3 top;uniform vec3 bot;varying float vy;void main(){float t=pow(clamp(vy,0.,1.),.55);gl_FragColor=vec4(mix(bot,top,t),1.);}",
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), this.skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    this.home = new Home(this.scene);
    this.classroom = new Classroom(this.scene, data.section.students);
    this.buildOutside();
    this.fx = new Fx(this.scene);
    this.fx.reduced = reduced;
    this.overlay = new Overlay(overlayEl, VIEW_W, VIEW_H);
    const anjali = new Person(this.scene, { skin: "#a86d48", sari: "#8e1f2a", sariAccent: "#d4a537", top: "#d4a537", bun: true, hair: "#1a1411", glasses: true }, 1);
    const mother = new Person(this.scene, { skin: "#9c6544", kurta: true, top: "#3f7d8c", bottom: "#e8dfc8", dupatta: "#e2b94a", bun: true }, 2);
    const parents = [
      new Person(this.scene, { skin: "#8d5a3b", top: "#c9b48a", bottom: "#3b3a45" }, 3),
      new Person(this.scene, { skin: "#b97f57", sari: "#2f6f5a", sariAccent: "#e8c35a", top: "#e8c35a", bun: true }, 4),
      new Person(this.scene, { skin: "#9c6544", kurta: true, top: "#f2efe6", bottom: "#f2efe6", hair: "#9d9a95" }, 5),
    ];
    this.people = { anjali, mother, parents, rohan: this.classroom.rigs.get("Rohan Kumar")!, sneha: this.classroom.rigs.get("Sneha Iyer")!, imran: this.classroom.rigs.get("Imran Shaikh")! };
    this.applyLight();
  }

  private buildOutside() {
    const g = this.outside;
    this.scene.add(g);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), M("#cdb995"));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    g.add(ground);
    // a corridor along the right side and trees around the block
    const corridor = new THREE.Mesh(new THREE.PlaneGeometry(2.4, ROOM.z1 - ROOM.z0 + 6), M("#b8a88a"));
    corridor.rotation.x = -Math.PI / 2;
    corridor.position.set(ROOM.x1 + 1.5, 0.005, 0);
    g.add(corridor);
    const r = rng(21);
    const pos: [number, number, number][] = [];
    while (pos.length < 26) {
      const x = -26 + r() * 52;
      const z = -24 + r() * 50;
      if (x > ROOM.x0 - 3 && x < ROOM.x1 + 4 && z > ROOM.z0 - 3 && z < ROOM.z1 + 3) continue;
      pos.push([x, z, 0.8 + r() * 0.7]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), M("#7a5638"), pos.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 0.9 }), pos.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    pos.forEach(([x, z, k], i) => {
      m.compose(V3(x, 1.1 * k, z), new THREE.Quaternion(), V3(0.3 * k, 2.2 * k, 0.3 * k));
      trunk.setMatrixAt(i, m);
      m.compose(V3(x, 2.9 * k, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i, 0)), V3(1.6 * k, 1.4 * k, 1.6 * k));
      crown.setMatrixAt(i, m);
      crown.setColorAt(i, c.setHSL(0.25 + r() * 0.06, 0.4, 0.33 + r() * 0.06));
    });
    trunk.castShadow = crown.castShadow = true;
    g.add(trunk, crown);
  }

  setLight(name: LightName, instant = false) {
    this.tgt = vals(name);
    if (instant) this.cur = vals(name);
  }

  private applyLight() {
    const L = this.cur;
    (this.skyMat.uniforms.top.value as THREE.Color).copy(L.top);
    (this.skyMat.uniforms.bot.value as THREE.Color).copy(L.bot);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(L.fog);
    fog.near = L.fogN;
    fog.far = L.fogF;
    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.hemi.color.copy(L.hs);
    this.hemi.groundColor.copy(L.hg);
    this.hemi.intensity = L.hi;
    this.renderer.toneMappingExposure = L.exp;
    this.classroom.windowMat.color.copy(L.win);
    this.fill.color.copy(L.fill);
    this.fill.intensity = L.fillI;
  }

  stepLight(dt: number) {
    const k = 1 - Math.exp(-dt * 1.8);
    const C = this.cur;
    const T = this.tgt;
    for (const key of ["top", "bot", "fog", "sun", "hs", "hg", "win", "fill"] as const) C[key].lerp(T[key], k);
    for (const key of ["fogN", "fogF", "sunI", "hi", "exp", "fillI"] as const) C[key] = lerp(C[key], T[key], k);
    C.dir.lerp(T.dir, k).normalize();
    this.applyLight();
  }

  useSet(name: SetName) {
    this.set = name;
    const inClass = name !== "home";
    this.classroom.root.visible = inClass;
    this.outside.visible = inClass;
    this.home.root.visible = name === "home";
    this.classroom.ptm.visible = name === "ptm";
    this.classroom.setStudentsVisible(name === "classroom");
    this.home.lamp.intensity = name === "home" ? 7 : 0;
    (this.home.lampGlow.material as THREE.SpriteMaterial).opacity = name === "home" ? 0.55 : 0;
  }

  /** Reset everything a scene may have changed. */
  resetForScene() {
    this.fx.clear();
    this.overlay.clear();
    const { anjali, mother, parents, rohan, sneha, imran } = this.people;
    for (const p of [anjali, mother, ...parents]) p.reset();
    for (const p of [rohan, sneha, imran]) {
      p.reset();
      p.g.visible = false;
    }
    this.classroom.rings.visible = this.classroom.tiles.visible = false;
    this.classroom.exitStack.visible = false;
    this.classroom.laptop.rotation.y = Math.PI;
    this.classroom.laptopScreen.color.set("#f3efe6");
    this.classroom.board.set("", []);
    this.home.setStacks(52, 0);
    this.home.setPiles([0, 0, 0]);
    this.home.setLaptopOpen(0);
    this.home.phoneLit(0);
    this.home.phone.visible = true;
  }

  name(p: Person, name: string, role?: string, priority = 1) {
    return this.overlay.add(`${name}${role ? `<small>${role}</small>` : ""}`, "lbl", () => (p.g.visible ? p.top(0.12) : null), { priority });
  }

  place(text: string, pos: THREE.Vector3, cls = "") {
    return this.overlay.add(text, `lbl place ${cls}`, pos);
  }

  check(pos: THREE.Vector3 | (() => THREE.Vector3 | null)) {
    return this.overlay.add('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>', "chk", pos, { anchor: "center", priority: 2 });
  }

  say(text: string, p: Person, cls = "") {
    return this.overlay.add(text, `say ${cls}`, () => (p.g.visible ? p.top(0.35) : null), { priority: 3 });
  }

  update(dt: number, T: number, focus: THREE.Vector3) {
    this.stepLight(Math.max(dt, 1 / 120));
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.cur.dir, 40);
    this.sky.position.copy(this.camera.position);
    // fill from slightly above and to the side of the camera
    this.fill.target.position.copy(focus);
    this.fill.position.copy(this.camera.position).add(new THREE.Vector3(0, 1.5, 0));
    const { anjali, mother, parents } = this.people;
    for (const p of [anjali, mother, ...parents]) p.update(dt, T);
    this.classroom.update(dt, T);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.overlay.update(this.camera);
  }

  /** w×h: the view's size in stage units (VIEW_W×VIEW_H or larger, matching the window's shape). */
  resize(stageScale: number, w = VIEW_W, h = VIEW_H) {
    this.renderer.setPixelRatio(Math.min(2, Math.max(0.5, stageScale * (window.devicePixelRatio || 1))));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const designed = VIEW_W / VIEW_H;
    // a wider view shows more at the sides; a taller one widens the vertical angle so nothing framed is cut off
    const half = Math.tan(((BASE_FOV / 2) * Math.PI) / 180);
    this.camera.fov = aspect >= designed ? BASE_FOV : (2 * Math.atan((half * designed) / aspect) * 180) / Math.PI;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.overlay.setSize(w, h);
  }

  dispose() {
    this.renderer.dispose();
  }
}

export { PAL };
