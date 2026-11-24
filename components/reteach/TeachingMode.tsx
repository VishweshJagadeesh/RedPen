"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
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

/** One step at a time, large text, with a timer per step. Arrow keys move between steps; space starts/pauses. */
export function TeachingMode({ conceptName, steps, boardPlan, exitHref }: TeachingModeProps) {
  const [i, setI] = useState(0);
  const [remaining, setRemaining] = useState(steps[0] ? steps[0].minutes * 60 : 0);
  const [running, setRunning] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const step = steps[i];

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const goTo = (n: number) => {
    const k = Math.max(0, Math.min(steps.length - 1, n));
    setI(k);
    setRemaining(steps[k].minutes * 60);
    setRunning(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(i + 1);
      else if (e.key === "ArrowLeft") goTo(i - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
          <Button variant="outline" size="sm" onClick={() => setShowBoard((v) => !v)} data-demo-id="toggle-board-plan">
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
        <Button size="lg" onClick={() => setRunning((r) => !r)} data-demo-id="toggle-timer">
          {running ? <Pause /> : <Play />} {running ? "Pause" : "Start"}
        </Button>
        <Button size="lg" variant="ghost" onClick={() => setRemaining(total)} aria-label="Reset timer">
          <RotateCcw />
        </Button>
        <Button size="lg" onClick={() => goTo(i + 1)} disabled={i === steps.length - 1} data-demo-id="next-step">
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
