/**
 * A scene's timeline: one-shot cues (`at`), ranged animations (`during`), and cleanups. Pure (no DOM,
 * no three.js) so it can be unit-tested. The player creates one per scene and advances it with the
 * scene's local time; seeking replays from zero, so everything a cue does must be deterministic.
 */
import { clamp } from "./math";

export type Cue = { t: number; seq: number; fn: () => void };
export type Span = { t0: number; t1: number; fn: (p: number) => void; done: boolean };

export class Timeline {
  private cues: Cue[] = [];
  private spans: Span[] = [];
  private cleanups: (() => void)[] = [];
  private fired = 0;
  private seq = 0;
  private sorted = true;
  /** Latest local time this timeline was advanced to. */
  now = 0;

  /** Run `fn` once when the scene reaches time `t`. Cues at the same time run in the order they were added. */
  at(t: number, fn: () => void) {
    this.cues.push({ t, seq: this.seq++, fn });
    this.sorted = false;
  }

  /** Call `fn(p)` every frame while the scene is between t0 and t1, with p going 0 → 1; the last call is p = 1. */
  during(t0: number, t1: number, fn: (p: number) => void) {
    this.spans.push({ t0, t1, fn, done: false });
  }

  /** Run on scene exit (and before a seek replays the scene). */
  onCleanup(fn: () => void) {
    this.cleanups.push(fn);
  }

  /** Cues sorted by time, stable for equal times. */
  ordered(): readonly Cue[] {
    if (!this.sorted) {
      this.cues.sort((a, b) => a.t - b.t || a.seq - b.seq);
      this.sorted = true;
    }
    return this.cues;
  }

  /** Fires every cue up to `local` (in order), then runs the active spans. */
  advance(local: number) {
    this.now = local;
    const cues = this.ordered();
    while (this.fired < cues.length && cues[this.fired].t <= local) cues[this.fired++].fn();
    for (const s of this.spans) {
      if (s.done || local < s.t0) continue;
      const p = s.t1 <= s.t0 ? 1 : clamp((local - s.t0) / (s.t1 - s.t0));
      s.fn(p);
      if (p >= 1) s.done = true;
    }
  }

  get firedCount() {
    return this.fired;
  }

  dispose() {
    const fns = this.cleanups.splice(0);
    for (const fn of fns.reverse()) fn();
  }
}

/** Typing: calls `set` with the first n characters of `text`, n growing from 0 to all between t0 and t1. */
export function typeInto(tl: Timeline, set: (value: string) => void, text: string, t0: number, t1: number) {
  let last = -1;
  tl.during(t0, t1, (p) => {
    const n = Math.round(p * text.length);
    if (n === last) return;
    last = n;
    set(text.slice(0, n));
  });
}
