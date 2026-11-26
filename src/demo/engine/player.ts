/**
 * The player: owns the scene list and the clock. Entering a scene cleans up the previous one, runs its
 * setup (which schedules cues on a fresh Timeline), blends the camera from where it was, and fades when
 * the set changes. Seeking re-enters the scene and steps it forward at 30 fps, so every state is replayable.
 */
import * as THREE from "three";
import { clamp, ease } from "./math";
import { Timeline, typeInto } from "./timeline";
import { PointerRenderer, PointerScript, type FrameRef } from "../device/pointer";
import type { Cam, LoopStage, SceneCtx, SceneDef } from "./scene";
import type { DemoData } from "../data/types";
import type { DemoStore } from "../device/store";
import type { World } from "../world/world";

export interface Chrome {
  caption: HTMLElement;
  tag: HTMLElement;
  progress: HTMLElement;
  counter: HTMLElement;
  skip: HTMLSelectElement;
  chapters: HTMLElement[];
  pills: Record<LoopStage, HTMLElement>;
  decides: HTMLElement;
  banner: HTMLElement;
  bannerKicker: HTMLElement;
  bannerText: HTMLElement;
  fade: HTMLElement;
  play: HTMLElement;
}

export interface PlayerState {
  idx: number;
  t: number;
  playing: boolean;
  T: number;
}

const STAGES: LoopStage[] = ["grade", "diagnose", "act", "track"];
const CHAPTER_NAMES = ["Flow 1 · Grade", "Flow 2 · Reteach", "Flow 3 · Remediate", "Flow 4 · PTM"];

export class Player {
  state: PlayerState = { idx: 0, t: 0, playing: true, T: 0 };
  private tl = new Timeline();
  private ctx!: SceneCtx;
  private camFrom: Cam | null = null;
  private blend = 0;
  private setName: string | null = null;
  private first = true;
  private chapterShown: SceneDef["chapter"] | -1 = -1;
  private pointer: PointerRenderer;
  scale = 1;
  onChange: () => void = () => {};

  constructor(
    readonly scenes: SceneDef[],
    private world: World,
    private store: DemoStore,
    private data: DemoData,
    private chrome: Chrome,
    pointerDom: ConstructorParameters<typeof PointerRenderer>[0],
    private frame: () => FrameRef | null,
    private cursorAllowed: () => boolean,
    readonly reduced: boolean,
  ) {
    this.pointer = new PointerRenderer(pointerDom);
  }

  get scene() {
    return this.scenes[this.state.idx];
  }

  enter(i: number) {
    i = clamp(i, 0, this.scenes.length - 1);
    const sc = this.scenes[i];
    this.tl.dispose();
    this.world.resetForScene();
    this.pointer.reset();
    this.tl = new Timeline();
    const tl = this.tl;
    const pointer = new PointerScript();
    this.ctx = {
      data: this.data,
      world: this.world,
      store: this.store,
      reduced: this.reduced,
      tl,
      at: (t, fn) => tl.at(t, fn),
      during: (t0, t1, fn) => tl.during(t0, t1, fn),
      type: (set, text, t0, t1) => typeInto(tl, set, text, t0, t1),
      pointer,
      state: {},
    };
    const setChange = this.setName !== sc.set;
    this.state.idx = i;
    this.state.t = -(sc.pre ?? 0);
    this.world.useSet(sc.set);
    sc.setup(this.ctx);
    this.tl.ordered();
    this.world.setLight(sc.light, setChange || this.first);
    this.camFrom = { p: this.world.camera.position.clone(), t: this.world.target.clone() };
    this.blend = setChange || this.first || this.reduced ? 0 : 1.9;
    if (setChange && this.setName) {
      const f = this.chrome.fade;
      f.style.transition = "none";
      f.style.opacity = "1";
      void f.offsetWidth;
      f.style.transition = "opacity .7s ease";
      f.style.opacity = "0";
    }
    this.first = false;
    this.setName = sc.set;
    const c = this.chrome;
    c.caption.textContent = sc.caption;
    c.caption.classList.toggle("hide", !sc.caption);
    this.fitCaption();
    c.tag.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b><span>${sc.title}</span>`;
    c.counter.textContent = `${i + 1} / ${this.scenes.length}`;
    c.skip.value = String(i);
    c.decides.classList.toggle("show", sc.decides !== undefined);
    c.decides.classList.remove("on");
    if (sc.banner) {
      c.bannerKicker.textContent = sc.chapter === "all" ? "" : CHAPTER_NAMES[sc.chapter];
      c.bannerText.textContent = sc.banner;
    }
    c.banner.classList.remove("on");
    this.onChange();
  }

  fitCaption() {
    const el = this.chrome.caption;
    let f = 26;
    el.style.fontSize = `${f}px`;
    while (el.scrollWidth > el.clientWidth + 1 && f > 18) {
      f -= 0.5;
      el.style.fontSize = `${f}px`;
    }
  }

  private sceneCam(t: number): Cam {
    const sc = this.scene;
    if (this.reduced) return sc.stillCam ? sc.stillCam(this.ctx) : sc.cam(sc.dur, this.ctx);
    return sc.cam(Math.max(0, t), this.ctx);
  }

  step(dt: number) {
    const s = this.state;
    let sc = this.scene;
    if (s.playing) s.t += dt;
    else dt = 0;
    s.T += dt;
    if (s.playing && s.t >= sc.dur) {
      if (s.idx < this.scenes.length - 1) {
        this.enter(s.idx + 1);
        sc = this.scene;
      } else {
        s.t = sc.dur;
        s.playing = false;
        this.onChange();
      }
    }
    const local = Math.max(0, s.t);
    // chapter ribbon (the previous chapter stays lit for the first moments of a banner pre-roll)
    const pre = sc.pre ?? 0;
    const prevChapter = s.idx > 0 ? this.scenes[s.idx - 1].chapter : sc.chapter;
    this.setChapter(pre && s.t < -pre + 0.6 ? prevChapter : sc.chapter);
    this.chrome.banner.classList.toggle("on", !!(sc.banner && s.t < -0.25 && s.t > -pre + 0.1));
    // loop pills
    let st: LoopStage | "all" | null = sc.stages.length ? sc.stages[0][1] : null;
    for (const [t, name] of sc.stages) if (local >= t) st = name;
    const used = sc.stages.map((x) => x[1]);
    const cur = st ? used.indexOf(st) : -1;
    for (const name of STAGES) {
      const el = this.chrome.pills[name];
      el.classList.toggle("on", st === "all" || st === name);
      const i = used.indexOf(name);
      el.classList.toggle("done", st !== "all" && i >= 0 && i < cur);
    }
    this.chrome.decides.classList.toggle("on", sc.decides !== undefined && local >= sc.decides);
    // cues and spans
    if (s.t >= 0) this.tl.advance(local);
    sc.update?.(local, dt, s.T, this.ctx);
    // camera
    const want = this.sceneCam(s.t);
    const elapsed = s.t + pre;
    const c = this.blend > 0 && this.camFrom ? blendCam(this.camFrom, want, ease(clamp(elapsed / this.blend))) : want;
    this.world.camera.position.copy(c.p);
    this.world.target.copy(c.t);
    this.world.camera.lookAt(c.t);
    this.world.update(dt, s.T, c.t);
    this.world.fx.tick(local, s.T);
    this.chrome.progress.style.width = `${clamp((s.t + pre) / (sc.dur + pre)) * 100}%`;
  }

  render() {
    this.world.render();
    this.pointer.update(this.ctx.pointer, Math.max(0, this.state.t), this.frame(), this.scale, this.cursorAllowed());
  }

  private setChapter(ch: SceneDef["chapter"]) {
    if (this.chapterShown === ch) return;
    this.chapterShown = ch;
    this.chrome.chapters.forEach((el, i) => el.classList.toggle("on", ch === "all" || i === ch));
  }

  /** Jump to scene i at time t (seconds after its pre-roll), stepping at 30 fps. */
  seek(i: number, t: number) {
    this.enter(i);
    const pre = this.scene.pre ?? 0;
    const playing = this.state.playing;
    this.state.playing = true;
    const n = Math.round((Math.min(t, this.scene.dur - 0.001) + pre) * 30);
    for (let k = 0; k < n; k++) this.step(1 / 30);
    this.state.playing = playing;
    this.onChange();
  }

  go(i: number) {
    this.enter(i);
  }

  togglePlay() {
    const s = this.state;
    if (!s.playing && s.idx === this.scenes.length - 1 && s.t >= this.scene.dur) this.enter(0);
    s.playing = !s.playing;
    this.onChange();
  }

  restart() {
    this.enter(0);
    this.state.playing = true;
    this.onChange();
  }

  dispose() {
    this.tl.dispose();
  }
}

export function blendCam(a: Cam, b: Cam, u: number): Cam {
  return { p: a.p.clone().lerp(b.p, u), t: a.t.clone().lerp(b.t, u) };
}

/** Keyframed camera: [time, position, target][], eased between keys. */
export function camKeys(keys: [number, [number, number, number], [number, number, number]][]) {
  return (t: number): Cam => {
    const V = (a: [number, number, number]) => new THREE.Vector3(...a);
    if (t <= keys[0][0]) return { p: V(keys[0][1]), t: V(keys[0][2]) };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (t < b[0]) {
        const u = ease(clamp((t - a[0]) / (b[0] - a[0])));
        return { p: V(a[1]).lerp(V(b[1]), u), t: V(a[2]).lerp(V(b[2]), u) };
      }
    }
    const l = keys[keys.length - 1];
    return { p: V(l[1]), t: V(l[2]) };
  };
}
