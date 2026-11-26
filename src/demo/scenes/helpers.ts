/** Helpers shared by the scenes: review-queue actions, classroom staging, camera utilities. */
import * as THREE from "three";
import { initialReviewUi, nextPendingReviewId, visibleReviewItems, type ReviewQueueUi } from "@/components/grading/ReviewQueue";
import type { ReviewItem } from "@/lib/grading/review-items";
import { clamp, ease } from "../engine/math";
import type { Cam, SceneCtx } from "../engine/scene";
import type { DemoStore, Screen } from "../device/store";
import { masteryRing, PAL } from "../world/kit";
import type { Seat } from "../world/classroom";
import { HOME_O } from "../world/home";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const H = (x: number, y: number, z: number) => V(HOME_O.x + x, y, HOME_O.z + z);

export function blend(a: Cam, b: Cam, u: number): Cam {
  return { p: a.p.clone().lerp(b.p, u), t: a.t.clone().lerp(b.t, u) };
}

/** Camera from a list of framings, each held until the next one blends in over [t0, t1]. */
export function shots(t: number, base: Cam, moves: [number, number, Cam][]): Cam {
  let c = base;
  for (const [t0, t1, to] of moves) c = blend(c, to, ease(clamp((t - t0) / (t1 - t0))));
  return c;
}

export const cam = (p: [number, number, number], t: [number, number, number]): Cam => ({ p: V(...p), t: V(...t) });

// ---------------------------------------------------------------- review queue (mirrors ReviewQueueContainer)

type ReviewScreen = Extract<Screen, { kind: "review" }>;

function patchItems(s: ReviewScreen, id: string, fn: (i: ReviewItem) => ReviewItem): ReviewScreen {
  return { ...s, items: s.items.map((x) => (x.id === id ? fn(x) : x)) };
}

/** "A" / Accept: optimistic accept, then move to the next answer still waiting. */
export function reviewAccept(store: DemoStore) {
  store.update("review", (s) => {
    const visible = visibleReviewItems(s.items, s.ui.filter);
    const cur = s.items.find((i) => i.id === s.ui.currentId) ?? visible[0];
    if (!cur) return s;
    const next = patchItems(s, cur.id, (i) => ({ ...i, status: "accepted", teacherMarks: null, teacherSteps: null, finalMarks: i.awardedMarks }));
    return { ...next, ui: { ...s.ui, currentId: nextPendingReviewId(visible, cur.id) } };
  });
}

/** "E" / Change marks: start editing with the current step marks. */
export function reviewEdit(store: DemoStore) {
  store.update("review", (s) => {
    const cur = s.items.find((i) => i.id === s.ui.currentId);
    if (!cur) return s;
    return { ...s, ui: { ...s.ui, editing: true, draft: { awards: (cur.teacherSteps ?? cur.steps).map((x) => x.awarded), note: cur.teacherNote ?? "" } } };
  });
}

export function reviewDraft(store: DemoStore, patch: Partial<ReviewQueueUi["draft"]>) {
  store.update("review", (s) => ({ ...s, ui: { ...s.ui, draft: { ...s.ui.draft, ...patch } } }));
}

/** Save marks: optimistic override (same rule as the container), then the next waiting answer. */
export function reviewSaveOverride(store: DemoStore) {
  store.update("review", (s) => {
    const visible = visibleReviewItems(s.items, s.ui.filter);
    const id = s.ui.currentId;
    if (!id) return s;
    const { awards, note } = s.ui.draft;
    const next = patchItems(s, id, (i) => {
      const total = awards.reduce((t, a) => t + a, 0);
      const same = total === i.awardedMarks && awards.every((a, k) => a === i.steps[k]?.awarded);
      return {
        ...i,
        status: same ? "accepted" : "overridden",
        teacherMarks: same ? null : total,
        teacherSteps: same ? null : i.steps.map((st, k) => ({ ...st, awarded: awards[k] })),
        finalMarks: total,
        teacherNote: note || null,
      };
    });
    return { ...next, ui: { ...s.ui, editing: false, currentId: nextPendingReviewId(visible, id) } };
  });
}

export function reviewUi(store: DemoStore, patch: Partial<ReviewQueueUi>) {
  store.update("review", (s) => ({ ...s, ui: { ...s.ui, ...patch } }));
}

/** Accept all High-confidence answers (closes the dialog). */
export function reviewAcceptHigh(store: DemoStore) {
  store.update("review", (s) => ({
    ...s,
    ui: { ...s.ui, confirmHigh: false },
    items: s.items.map((x) => (x.status === "pending_review" && !x.needsRescan && x.band === "high" ? { ...x, status: "accepted", finalMarks: x.awardedMarks } : x)),
  }));
}

export function reviewScreen(items: ReviewItem[], title: string, eyebrow: string, currentId?: string): ReviewScreen {
  return { kind: "review", items, ui: { ...initialReviewUi(), currentId: currentId ?? items[0]?.id ?? null }, isFinal: false, finaliseNotes: null, title, eyebrow };
}

// ---------------------------------------------------------------- classroom staging

/** Students seated, Anjali placed; rings optional. */
export function seatClass(ctx: SceneCtx) {
  ctx.world.classroom.seatRigs();
}

export function ringsFrom(ctx: SceneCtx, pct: Record<string, number>) {
  return (s: Seat) => {
    const v = pct[s.student.id];
    return v === undefined ? null : masteryRing(v);
  };
}

/** A wave of ring colours from the front of the room to the back between t0 and t1. */
export function ringWave(ctx: SceneCtx, t: number, t0: number, t1: number, from: (s: Seat) => string | null, to: (s: Seat) => string | null) {
  const cr = ctx.world.classroom;
  const zs = cr.seats.map((s) => s.z);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  cr.colourRings((s) => {
    const at = t0 + ((s.z - z0) / (z1 - z0 || 1)) * (t1 - t0) * 0.8;
    return t >= at ? to(s) : from(s);
  });
}

export const NONE = () => null;
export { PAL };
