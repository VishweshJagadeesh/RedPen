"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReteachInputsForm } from "@/components/reteach/ReteachInputsForm";
import { GenerationProgress, type GenerationStep } from "@/components/shared/GenerationProgress";
import { PLAN_STEPS, type PlanInputs } from "@/lib/planner/types";

type StreamEvent =
  | { type: "step"; step: string; status: "active" | "done"; detail?: string }
  | { type: "done"; id: string }
  | { type: "error"; error: string };

// Rough share of the total time each step takes (the AI draft dominates in live mode).
const WEIGHT: Record<string, number> = { evidence: 1, misconceptions: 1, draft: 6, checks: 1, pairs: 1, save: 0.5 };
const TOTAL = Object.values(WEIGHT).reduce((a, b) => a + b, 0);

const fresh = (): GenerationStep[] => PLAN_STEPS.map((s) => ({ id: s.id, label: s.label, status: "pending" }));

/** Generates the plan and shows each step as the server reports it (streamed NDJSON). */
export function ReteachSetupContainer({ sectionId, conceptId, defaultPeriod }: { sectionId: string; conceptId: string; defaultPeriod: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<GenerationStep[]>(fresh);
  const [started, setStarted] = useState<number | null>(null);
  const [stepStarted, setStepStarted] = useState<number>(0);
  const [now, setNow] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function apply(ev: StreamEvent) {
    if (ev.type !== "step") return;
    setSteps((cur) => cur.map((s) => (s.id === ev.step ? { ...s, status: ev.status, detail: ev.detail ?? s.detail } : s)));
    if (ev.status === "active") setStepStarted(Date.now());
  }

  async function generate(inputs: PlanInputs) {
    setBusy(true);
    setError(null);
    setSteps(fresh());
    const t0 = Date.now();
    setStarted(t0);
    setStepStarted(t0);
    setNow(t0);
    timer.current = setInterval(() => setNow(Date.now()), 250);
    try {
      const res = await fetch("/api/reteach", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ sectionId, conceptId, inputs }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "error") throw new Error(ev.error);
          if (ev.type === "done") {
            router.push(`/reteach/${ev.id}`);
            return;
          }
          apply(ev);
        }
        if (done) break;
      }
      throw new Error("The connection closed before the plan was saved. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSteps((cur) => cur.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
      setBusy(false);
      if (timer.current) clearInterval(timer.current);
    }
  }

  const elapsed = started ? Math.max(0, Math.round((now - started) / 1000)) : 0;
  const doneWeight = steps.filter((s) => s.status === "done").reduce((t, s) => t + WEIGHT[s.id], 0);
  const active = steps.find((s) => s.status === "active");
  // The active step creeps forward (never past 90% of its share) so a long AI call still shows movement.
  const creep = active ? WEIGHT[active.id] * 0.9 * (1 - Math.exp(-(now - stepStarted) / (active.id === "draft" ? 20000 : 1500))) : 0;
  const percent = Math.min(100, ((doneWeight + creep) / TOTAL) * 100);
  const showProgress = started !== null && (busy || error);

  return (
    <div className="space-y-4">
      {showProgress && (
        <GenerationProgress
          title={error ? "Plan generation stopped" : "Building your reteach plan"}
          steps={steps}
          percent={percent}
          elapsedSeconds={elapsed}
          hint={busy ? "You can keep this tab open; the draft opens as soon as it is saved. Nothing is shown to students until you print or teach it." : undefined}
          demoId="plan-progress"
        />
      )}
      <ReteachInputsForm defaultPeriod={defaultPeriod} busy={busy} error={error} onSubmit={generate} />
    </div>
  );
}
