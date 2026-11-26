/**
 * DemoStore: what the device panel shows. Scenes set it from cues (synchronously, so seeking is just
 * replaying cues), and the panel renders it through the app's real presentational components.
 */
import type { AssessmentDetailsValues } from "@/components/grading/AssessmentDetailsForm";
import type { GradingProgressView } from "@/components/grading/GradingProgress";
import type { MatchSheetView } from "@/components/grading/SheetMatcher";
import type { ReviewQueueUi } from "@/components/grading/ReviewQueue";
import type { TeachingUi } from "@/components/reteach/TeachingMode";
import type { RemedialSetup } from "@/components/remedial/RemedialBuilder";
import type { GenerationStep } from "@/components/shared/GenerationProgress";
import type { ReviewItem } from "@/lib/grading/review-items";
import type { PlanInputs, PlanSection } from "@/lib/planner/types";
import type { RemedialQuestion } from "@/lib/remedial/questions";
import type { WeakConceptView } from "@/lib/queries/section";
import type { FlagDetail } from "@/lib/queries/alerts";

/** "card": a full-panel slate with no device frame (the outro). */
export type DeviceKind = "phone" | "laptop" | "card";

export type Screen =
  | { kind: "lock"; time: string; date: string; notification: boolean }
  | { kind: "wizard-details"; values: Omit<AssessmentDetailsValues, "paper" | "key"> & { paper: number; key: number }; busy: boolean }
  | { kind: "wizard-questions" }
  | { kind: "wizard-sheets"; sheets: number; pages: number; progress: { done: number; total: number } | null; title: string; sampleKind: "fixture" | null; eyebrow?: string; back?: string }
  | { kind: "wizard-match"; sheets: MatchSheetView[]; ready: boolean; title: string }
  | { kind: "grading"; progress: GradingProgressView; running: boolean; title: string; eyebrow: string }
  | { kind: "review"; items: ReviewItem[]; ui: ReviewQueueUi; isFinal: boolean; finaliseNotes: string[] | null; title: string; eyebrow: string }
  | { kind: "heatmap" }
  | { kind: "weak-card"; card: WeakConceptView }
  | { kind: "reteach-setup"; values: PlanInputs; steps: GenerationStep[] | null; percent: number; elapsed: number }
  | { kind: "plan"; sections: PlanSection[]; shown: number; editingId: string | null; dirty: boolean; status: "draft" | "ready" | "taught" }
  | { kind: "teach"; ui: TeachingUi }
  | { kind: "flags" }
  | { kind: "why"; flag: FlagDetail }
  | { kind: "remedial"; phase: "setup" | "review"; setup: RemedialSetup; questions: RemedialQuestion[]; status: "draft" | "assigned" | "graded"; dirty: boolean; busy: string | null }
  | { kind: "ptm"; lang: "en" | "hi" }
  | { kind: "outro"; lit: number; line: boolean };

export interface Slot {
  /** A new key slides the old device out and the new one in. */
  key: string;
  device: DeviceKind;
  owner: string;
  note: string | null;
  noteOn: boolean;
  /** Phone status-bar clock. */
  clock?: string;
  screen: Screen;
}

export interface DeviceState {
  slot: Slot | null;
}

type Listener = () => void;

export class DemoStore {
  private state: DeviceState = { slot: null };
  private listeners = new Set<Listener>();

  getSnapshot = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  reset() {
    this.state = { slot: null };
    this.emit();
  }

  /** Show a device (new key → slide transition). */
  show(slot: Omit<Slot, "noteOn" | "note"> & { note?: string | null; noteOn?: boolean }) {
    this.state = { slot: { note: null, noteOn: false, ...slot } };
    this.emit();
  }

  /** Change the current slot (same device, no transition). */
  patchSlot(patch: Partial<Omit<Slot, "screen">>) {
    if (!this.state.slot) return;
    this.state = { slot: { ...this.state.slot, ...patch } };
    this.emit();
  }

  /** Replace the screen on the current device. */
  screen(screen: Screen) {
    if (!this.state.slot) return;
    this.state = { slot: { ...this.state.slot, screen } };
    this.emit();
  }

  /** Update the current screen if it is of `kind`. */
  update<K extends Screen["kind"]>(kind: K, fn: (s: Extract<Screen, { kind: K }>) => Extract<Screen, { kind: K }>) {
    const s = this.state.slot?.screen;
    if (!s || s.kind !== kind) return;
    const next = fn(s as Extract<Screen, { kind: K }>);
    if (next !== s) this.screen(next);
  }

  current<K extends Screen["kind"]>(kind: K): Extract<Screen, { kind: K }> | null {
    const s = this.state.slot?.screen;
    return s && s.kind === kind ? (s as Extract<Screen, { kind: K }>) : null;
  }
}
