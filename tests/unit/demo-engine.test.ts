import { describe, expect, it } from "vitest";
import { Timeline, typeInto } from "@/src/demo/engine/timeline";
import { formatDeepLink, parseDeepLink } from "@/src/demo/engine/hash";
import { clamp, ease, prog } from "@/src/demo/engine/math";

describe("walkthrough timeline", () => {
  it("fires cues in time order, stable for equal times, each exactly once", () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.at(2, () => log.push("c"));
    tl.at(0.5, () => log.push("a"));
    tl.at(2, () => log.push("d"));
    tl.at(1, () => log.push("b"));
    tl.advance(0.4);
    expect(log).toEqual([]);
    tl.advance(1);
    expect(log).toEqual(["a", "b"]);
    tl.advance(5);
    tl.advance(6);
    expect(log).toEqual(["a", "b", "c", "d"]);
    expect(tl.firedCount).toBe(4);
  });

  it("fires every skipped cue when a seek jumps past several at once", () => {
    const tl = new Timeline();
    const log: number[] = [];
    for (const t of [3, 1, 2, 0]) tl.at(t, () => log.push(t));
    tl.advance(10);
    expect(log).toEqual([0, 1, 2, 3]);
  });

  it("runs `during` with clamped progress, ending on exactly p = 1 once", () => {
    const tl = new Timeline();
    const seen: number[] = [];
    tl.during(1, 3, (p) => seen.push(p));
    tl.advance(0.5);
    tl.advance(1);
    tl.advance(2);
    tl.advance(3.5);
    tl.advance(4);
    expect(seen).toEqual([0, 0.5, 1]);
  });

  it("treats a zero-length span as instant", () => {
    const tl = new Timeline();
    const seen: number[] = [];
    tl.during(2, 2, (p) => seen.push(p));
    tl.advance(1.9);
    tl.advance(2);
    expect(seen).toEqual([1]);
  });

  it("types text progressively and only reports changes", () => {
    const tl = new Timeline();
    const seen: string[] = [];
    typeInto(tl, (v) => seen.push(v), "abcd", 0, 1);
    for (const t of [0, 0.1, 0.25, 0.5, 0.5, 0.75, 1, 2]) tl.advance(t);
    expect(seen[seen.length - 1]).toBe("abcd");
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.every((s, i) => i === 0 || s.length > seen[i - 1].length)).toBe(true);
  });

  it("runs cleanups once, newest first, on dispose", () => {
    const tl = new Timeline();
    const log: string[] = [];
    tl.onCleanup(() => log.push("first"));
    tl.onCleanup(() => log.push("second"));
    tl.dispose();
    tl.dispose();
    expect(log).toEqual(["second", "first"]);
  });
});

describe("deep links", () => {
  it("parses #s=5&t=7.5&p=0 as scene index 4, 7.5 s, paused", () => {
    expect(parseDeepLink("#s=5&t=7.5&p=0", 13)).toEqual({ scene: 4, time: 7.5, paused: true });
  });
  it("defaults to the first scene, no seek, playing", () => {
    expect(parseDeepLink("", 13)).toEqual({ scene: 0, time: null, paused: false });
    expect(parseDeepLink("#s=99", 13).scene).toBe(12);
    expect(parseDeepLink("#s=0&t=-3", 13)).toEqual({ scene: 0, time: null, paused: false });
  });
  it("round-trips", () => {
    const l = { scene: 3, time: 2.25, paused: true };
    expect(parseDeepLink(formatDeepLink(l), 13)).toEqual(l);
  });
});

describe("easing helpers", () => {
  it("clamp, prog and ease stay in range", () => {
    expect(clamp(2)).toBe(1);
    expect(prog(5, 2, 4)).toBe(1);
    expect(prog(3, 2, 4)).toBe(0.5);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
  });
});
