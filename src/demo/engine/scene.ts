/** Scene definitions and the context a scene's setup receives. */
import type * as THREE from "three";
import type { DemoData } from "../data/types";
import type { DemoStore } from "../device/store";
import type { LightName, SetName, World } from "../world/world";
import type { Timeline } from "./timeline";
import type { PointerScript } from "../device/pointer";

export type LoopStage = "grade" | "diagnose" | "act" | "track";
export type Chapter = 0 | 1 | 2 | 3 | "all";

export interface Cam {
  p: THREE.Vector3;
  t: THREE.Vector3;
}

export interface SceneCtx {
  data: DemoData;
  world: World;
  store: DemoStore;
  reduced: boolean;
  tl: Timeline;
  at(t: number, fn: () => void): void;
  during(t0: number, t1: number, fn: (p: number) => void): void;
  /** Typing into a store field: `set` receives the growing prefix of `text`. */
  type(set: (value: string) => void, text: string, t0: number, t1: number): void;
  pointer: PointerScript;
  /** Scene-local state shared between setup and update. */
  state: Record<string, unknown>;
}

export interface SceneDef {
  title: string;
  chapter: Chapter;
  /** Seconds, excluding the pre-roll. */
  dur: number;
  /** Seconds before t = 0 (the chapter banner shows during it). */
  pre?: number;
  banner?: string;
  caption: string;
  /** [time, stage] cues for the loop pills. */
  stages: [number, LoopStage | "all"][];
  /** Time at which the "Teacher decides" pill lights up (the pill shows only in scenes that set this). */
  decides?: number;
  light: LightName;
  set: SetName;
  cam(t: number, ctx: SceneCtx): Cam;
  /** Camera with reduced motion (default: the scene's final framing, held still). */
  stillCam?(ctx: SceneCtx): Cam;
  setup(ctx: SceneCtx): void;
  update?(t: number, dt: number, T: number, ctx: SceneCtx): void;
}
