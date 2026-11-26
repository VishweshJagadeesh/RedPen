"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanSection } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

export interface TeachingModeProps {
  conceptName: string;
  steps: PlanSection[];
  boardPlan: string | null;
  exitHref: string;
}

function mmss(sec: number) {
  const s = Math.max(0, Math.abs(sec));
  return `${sec < 0 ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface TeachingUi {
  index: number;
  /** Seconds left on the current step's timer (negative when over time). */
  remaining: number;
  running: boolean;
  showBoard: boolean;
}

export function initialTeachingUi(steps: PlanSection[]): TeachingUi {
  return { index: 0, remaining: steps[0] ? steps[0].minutes * 60 : 0, running: false, showBoard: false };
}

/** Moving to step `n` resets and stops its timer. */
export function teachingUiAt(steps: PlanSection[], n: number): Pick<TeachingUi, "index" | "remaining" | "running"> {
  const k = Math.max(0, Math.min(steps.length - 1, n));
  return { index: k, remaining: (steps[k]?.minutes ?? 0) * 60, running: false };
}

/** One step at a time, large text, with a timer per step. Arrow keys move between steps; space starts/pauses. */
export function TeachingMode(props: TeachingModeProps) {
  const { steps } = props;
  const [ui, setUiState] = useState<TeachingUi>(() => initialTeachingUi(steps));
  const setUi = useCallback((patch: Partial<TeachingUi>) => setUiState((u) => ({ ...u, ...patch })), []);

  useEffect(() => {
    if (!ui.running) return;
    const t = setInterval(() => setUiState((u) => ({ ...u, remaining: u.remaining - 1 })), 1000);
    return () => clearInterval(t);
  }, [ui.running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setUi(teachingUiAt(steps, ui.index + 1));
      else if (e.key === "ArrowLeft") setUi(teachingUiAt(steps, ui.index - 1));
      else if (e.key === " ") {
        e.preventDefault();
        setUi({ running: !ui.running });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <TeachingModeView {...props} ui={ui} onUiChange={setUi} />;
}

/** Teaching mode with its step and timer supplied by the caller (the stateful `TeachingMode`, or a scripted walkthrough). */
export function TeachingModeView({ conceptName, steps, boardPlan, exitHref, ui, onUiChange }: TeachingModeProps & { ui: TeachingUi; onUiChange: (patch: Partial<TeachingUi>) => void }) {
  const i = ui.index;
  const remaining = ui.remaining;
  const running = ui.running;
  const showBoard = ui.showBoard;
  const goTo = (n: number) => onUiChange(teachingUiAt(steps, n));
  const step = steps[i];
  const next = steps[i + 1];

  if (!step) return <p className="p-10 text-center">This plan has no timed steps.</p>;
  const total = step.minutes * 60;
  const overtime = remaining < 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbfaf6]" data-demo-id="teaching-mode">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <div className="text-sm text-muted-foreground">{conceptName}</div>
        <div className="flex flex-1 justify-center gap-1">
          {steps.map((s, k) => (
            <button key={s.id} onClick={() => goTo(k)} className={cn("h-2 w-10 rounded-full", k < i ? "bg-high" : k === i ? "bg-primary" : "bg-muted")} aria-label={`Step ${k + 1}: ${s.title}`} />
          ))}
        </div>
        {boardPlan && (
          <Button variant="outline" size="sm" onClick={() => onUiChange({ showBoard: !showBoard })} data-demo-id="toggle-board-plan">
            {showBoard ? "Hide" : "Show"} board plan
          </Button>
        )}
        <Button asChild variant="ghost" size="icon" aria-label="Exit teaching mode">
          <Link href={exitHref} data-demo-id="exit-teaching-mode">
            <X />
          </Link>
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-auto px-6 py-8 lg:flex-row lg:px-16">
        <div className="flex-1">
          <div className="text-lg font-medium text-muted-foreground">
            Step {i + 1} of {steps.length}
          </div>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight lg:text-5xl" data-demo-id="teaching-step-title">
            {step.title}
          </h1>
          <p className="mt-6 whitespace-pre-wrap text-2xl leading-relaxed lg:text-3xl" data-demo-id="teaching-step-body">
            {step.body}
          </p>
          {step.questions.length > 0 && (
            <ol className="mt-6 space-y-3 text-2xl lg:text-3xl">
              {step.questions.map((q, k) => (
                <li key={k}>
                  {k + 1}. {q.text}
                </li>
              ))}
            </ol>
          )}
          {next && (
            <div className="mt-8 border-t pt-4 text-lg text-muted-foreground" data-demo-id="teaching-next-step">
              Up next: <span className="font-medium text-foreground">{next.title}</span> · {next.minutes} min
            </div>
          )}
        </div>
        {showBoard && boardPlan && (
          <pre className="h-fit whitespace-pre-wrap rounded-xl bg-[#24352b] p-6 font-mono text-xl text-[#f1f5ef] lg:w-[420px]" data-demo-id="teaching-board-plan">
            {boardPlan}
          </pre>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t px-6 py-4">
        <div className={cn("text-5xl font-semibold tabular-nums", overtime ? "text-low" : remaining < 60 ? "text-[oklch(0.55_0.13_70)]" : "")} data-demo-id="step-timer" aria-live="polite">
          {mmss(remaining)}
        </div>
        <div className="text-sm text-muted-foreground">{overtime ? "Over time" : `of ${step.minutes} min`}</div>
        <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full", overtime ? "bg-low" : "bg-primary")} style={{ width: `${Math.min(100, ((total - remaining) / Math.max(1, total)) * 100)}%` }} />
        </div>
        <Button size="lg" variant="outline" onClick={() => goTo(i - 1)} disabled={i === 0} data-demo-id="prev-step">
          <ChevronLeft /> Back
        </Button>
        <Button size="lg" onClick={() => onUiChange({ running: !running })} data-demo-id="toggle-timer">
          {running ? <Pause /> : <Play />} {running ? "Pause" : "Start"}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => onUiChange({ remaining: total })} aria-label="Reset timer">
          <RotateCcw />
        </Button>
        <Button size="lg" onClick={() => goTo(i + 1)} disabled={i === steps.length - 1} data-demo-id="next-step">
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
