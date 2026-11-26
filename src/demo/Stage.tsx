"use client";
/**
 * The walkthrough stage (1920×1080, scaled to fit with letterboxing): top bar with the chapter ribbon and
 * loop pills, the 3D world on the left, the device panel on the right, and the caption and controls below.
 * The chrome is static markup; the player updates it directly each frame (no React renders per frame).
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DevicePanel, type FrameRegistry } from "./device/DevicePanel";
import { DemoStore } from "./device/store";
import { Player, type Chrome } from "./engine/player";
import { formatDeepLink, parseDeepLink } from "./engine/hash";
import { World } from "./world/world";
import { SCENES } from "./scenes";
import type { DemoData } from "./data/types";
import "./stage.css";

const STAGE_W = 1920;
const STAGE_H = 1080;

declare global {
  interface Window {
    __demo?: {
      ready: boolean;
      state: { idx: number; t: number; playing: boolean; scene: string; reduced: boolean };
      scenes: { title: string; dur: number; pre: number; caption: string }[];
      go(i: number): void;
      seek(i: number, t: number): void;
      play(): void;
      pause(): void;
      totalSeconds: number;
      /** Recording: stop following the wall clock; `advance(dt)` then moves the demo by exactly dt seconds. */
      manual(on: boolean): void;
      advance(dt: number): void;
      ended: boolean;
    };
  }
}

const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  ),
  prev: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15 5 7 12l8 7z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m9 5 8 7-8 7z" />
    </svg>
  ),
  restart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v5h5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  ),
  nib: (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M16 2 7 13l3 13 6 4 6-4 3-13z" fill="currentColor" />
      <path d="M16 13v9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="12" r="2.4" fill="#fff" />
    </svg>
  ),
};

const PILLS = [
  ["grade", "Grade"],
  ["diagnose", "Diagnose"],
  ["act", "Act"],
  ["track", "Track"],
] as const;

export default function Stage({ data }: { data: DemoData }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ptrFxRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const [store] = useState(() => new DemoStore());
  const [registry] = useState<FrameRegistry>(() => ({ current: null, device: null, key: null }));
  const [playing, setPlaying] = useState(true);
  const [webgl, setWebgl] = useState(true);
  const set = (k: string) => (el: HTMLElement | null) => {
    chromeRef.current[k] = el;
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let world: World;
    try {
      world = new World(canvas, overlayRef.current!, data, reduced);
    } catch {
      setWebgl(false);
      return;
    }
    world.overlay.keepOut = [{ x0: 0, y0: 0, x1: 520, y1: 78 }];
    const c = chromeRef.current;
    const chrome: Chrome = {
      caption: c.caption!,
      tag: c.tag!,
      progress: c.progress!,
      counter: c.counter!,
      skip: c.skip as HTMLSelectElement,
      chapters: [0, 1, 2, 3].map((i) => c[`ch${i}`]!),
      pills: { grade: c.grade!, diagnose: c.diagnose!, act: c.act!, track: c.track! },
      decides: c.decides!,
      banner: c.banner!,
      bannerKicker: c.bannerKicker!,
      bannerText: c.bannerText!,
      fade: c.fade!,
      play: c.play!,
    };
    const player = new Player(
      SCENES,
      world,
      store,
      data,
      chrome,
      { panel: deviceRef.current!, cursor: cursorRef.current!, fx: ptrFxRef.current!, key: keyRef.current! },
      () => registry.current,
      () => registry.device === "laptop",
      reduced,
    );
    player.onChange = () => setPlaying(player.state.playing);

    const fit = () => {
      const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      const stage = stageRef.current!;
      stage.style.transform = `translate(${(window.innerWidth - STAGE_W * s) / 2}px,${(window.innerHeight - STAGE_H * s) / 2}px) scale(${s})`;
      world.resize(s);
      player.scale = s;
      player.fitCaption();
    };
    fit();
    window.addEventListener("resize", fit);

    const link = parseDeepLink(window.location.hash, SCENES.length);
    if (link.time !== null) player.seek(link.scene, link.time);
    else player.enter(link.scene);
    if (link.paused) player.state.playing = false;
    setPlaying(player.state.playing);

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") {
        player.go(player.state.idx + 1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        player.go(player.state.idx - 1);
        e.preventDefault();
      } else if (e.key === " ") {
        player.togglePlay();
        e.preventDefault();
      } else if (e.key === "r" || e.key === "R") player.restart();
      else if (e.key === "h" || e.key === "H") {
        // hides the controls and the back link, for clean recordings
        const hidden = chromeRef.current.controls?.classList.toggle("hidden");
        chromeRef.current.back?.classList.toggle("hidden", hidden);
      }
    };
    window.addEventListener("keydown", onKey);

    const skip = chrome.skip;
    const onSkip = () => {
      player.go(Number(skip.value));
      skip.blur();
    };
    skip.addEventListener("change", onSkip);
    const clickers: [string, () => void][] = [
      ["prevBtn", () => player.go(player.state.idx - 1)],
      ["nextBtn", () => player.go(player.state.idx + 1)],
      ["play", () => player.togglePlay()],
      ["restartBtn", () => player.restart()],
    ];
    const buttons = clickers.map(([k, fn]) => [chromeRef.current[k], fn] as const);
    for (const [el, fn] of buttons) el?.addEventListener("click", fn);

    window.__demo = {
      ready: false,
      get state() {
        const s = player.state;
        return { idx: s.idx, t: s.t, playing: s.playing, scene: player.scene.title, reduced };
      },
      scenes: SCENES.map((s) => ({ title: s.title, dur: s.dur, pre: s.pre ?? 0, caption: s.caption })),
      go: (i) => player.go(i),
      seek: (i, t) => player.seek(i, t),
      play: () => {
        player.state.playing = true;
        setPlaying(true);
      },
      pause: () => {
        player.state.playing = false;
        setPlaying(false);
      },
      totalSeconds: SCENES.reduce((t, s) => t + s.dur + (s.pre ?? 0), 0),
      manual: (on) => {
        manual = on;
      },
      advance: (dt) => {
        player.step(dt);
        player.render();
      },
      get ended() {
        const s = player.state;
        return s.idx === SCENES.length - 1 && s.t >= SCENES[s.idx].dur;
      },
    };

    let raf = 0;
    let manual = false;
    let last = performance.now();
    let frames = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!manual) {
        player.step(dt);
        player.render();
      }
      if (++frames === 3 && window.__demo) window.__demo.ready = true;
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame((t) => {
      last = t;
      loop(t);
    });
    const onHash = () => {
      const l = parseDeepLink(window.location.hash, SCENES.length);
      if (l.time !== null) player.seek(l.scene, l.time);
      else player.go(l.scene);
      player.state.playing = !l.paused;
      setPlaying(player.state.playing);
    };
    window.addEventListener("hashchange", onHash);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
      skip.removeEventListener("change", onSkip);
      for (const [el, fn] of buttons) el?.removeEventListener("click", fn);
      player.dispose();
      world.dispose();
      store.reset();
      delete window.__demo;
    };
  }, [data, store, registry]);

  return (
    <div className="rp-root">
      <div className="rp-stage" ref={stageRef} id="rp-stage">
        <header className="rp-top">
          <Link href="/" className="rp-back" ref={set("back")} aria-label="Back to the RedPen home page">
            {Icon.back}
            Back
          </Link>
          <div className="rp-brand">
            <span className="rp-brand-icon">{Icon.nib}</span>
            RedPen
          </div>
          <nav className="rp-ribbon" aria-label="Chapters">
            {["Flow 1 · Grade", "Flow 2 · Reteach", "Flow 3 · Remediate", "Flow 4 · PTM"].map((label, i) => (
              <div key={label} className={`rp-ch c${i}`} ref={set(`ch${i}`)}>
                <b>{label}</b>
              </div>
            ))}
          </nav>
          <div className="rp-loop">
            <span className="rp-loop-label">Loop</span>
            {PILLS.map(([id, label], i) => (
              <span key={id} className="rp-loop-item">
                {i > 0 && <span className="rp-arr">›</span>}
                <span className="rp-pill" ref={set(id)}>
                  {label}
                </span>
              </span>
            ))}
            <span className="rp-pill decides" ref={set("decides")}>
              {Icon.check}Teacher decides
            </span>
          </div>
        </header>
        <main className="rp-main">
          <section className="rp-world" aria-label="Scene">
            <canvas ref={canvasRef} />
            <div className="rp-overlay" ref={overlayRef} />
            <div className="rp-tag" ref={set("tag")} />
            <div className="rp-fade" ref={set("fade")} />
            {!webgl && <div className="rp-nogl">This walkthrough needs WebGL. Try another browser, or watch the recording.</div>}
          </section>
          <section className="rp-device" ref={deviceRef} aria-label="Product screen">
            <DevicePanel store={store} data={data} registry={registry} />
            <div className="ptr-layer" aria-hidden>
              <div className="ptr-fx" ref={ptrFxRef} />
              <div className="ptr-cursor" ref={cursorRef}>
                <svg viewBox="0 0 28 28" aria-hidden>
                  <path d="M5 3.5 22.5 15l-7.6 1.6L19.6 25l-3.3 1.6-4.6-8.5L6 23.4z" fill="#1d2230" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="ptr-key" ref={keyRef} />
            </div>
          </section>
        </main>
        <footer className="rp-bottom">
          <div className="rp-progress" ref={set("progress")} />
          <div className="rp-caption" id="rp-caption" ref={set("caption")} />
          <div className="rp-controls" ref={set("controls")}>
            <button className="rp-btn" ref={set("prevBtn")} title="Previous (←)">
              {Icon.prev}Prev
            </button>
            <button className="rp-btn primary" ref={set("play")} title="Play / Pause (Space)">
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M7 5v14l12-7z" />
                </svg>
              )}
              {playing ? "Pause" : "Play"}
            </button>
            <button className="rp-btn" ref={set("nextBtn")} title="Next (→)">
              Next{Icon.next}
            </button>
            <div className="rp-counter" ref={set("counter")}>
              1 / {SCENES.length}
            </div>
            <select className="rp-skip" ref={set("skip")} title="Skip to scene" defaultValue="0">
              {SCENES.map((s, i) => (
                <option key={s.title} value={i}>
                  {i + 1} · {sentenceCase(s.title)}
                </option>
              ))}
            </select>
            <button className="rp-btn" ref={set("restartBtn")} title="Restart (R)">
              {Icon.restart}Restart
            </button>
          </div>
        </footer>
        <div className="rp-banner" ref={set("banner")}>
          <span className="rp-banner-k" ref={set("bannerKicker")} />
          <span className="rp-banner-t" ref={set("bannerText")} />
        </div>
      </div>
    </div>
  );
}

export { formatDeepLink };

/** "PTM DAY" → "PTM day", "DID IT LAND?" → "Did it land?" (acronyms stay upper case). */
function sentenceCase(title: string) {
  const keep = new Set(["PTM"]);
  return title
    .split(" ")
    .map((w, i) => (keep.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(" ");
}
