"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReteachPlanEditor } from "@/components/reteach/ReteachPlanEditor";
import { api } from "@/lib/client/api";
import type { PlanData } from "@/lib/planner/service";
import type { PlanSection } from "@/lib/planner/types";

export function ReteachPlanContainer({ plan }: { plan: PlanData }) {
  const router = useRouter();
  const [sections, setSections] = useState<PlanSection[]>(plan.sections);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSections(plan.sections);
    setDirty(false);
  }, [plan.sections, plan.updatedAt]);

  async function run(tag: string, fn: () => Promise<unknown>) {
    setBusy(tag);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ReteachPlanEditor
      evidence={plan.evidence}
      inputs={plan.inputs}
      sections={sections}
      status={plan.status}
      taughtAt={plan.taughtAt}
      exitTicket={plan.exitTicket}
      students={plan.students}
      dirty={dirty}
      busy={busy}
      error={error}
      teachHref={`/reteach/${plan.id}/teach`}
      printHref={`/reteach/${plan.id}/print`}
      onChange={(s) => {
        setSections(s);
        setDirty(true);
      }}
      onSave={() => run("save", () => api(`/api/reteach/${plan.id}`, { method: "PATCH", json: { sections } }))}
      onRegenerate={(sectionId) => run(sectionId, () => api(`/api/reteach/${plan.id}/regenerate`, { method: "POST", json: { sectionId } }))}
      onReshufflePairs={() => run("pairs", () => api(`/api/reteach/${plan.id}/pairs`, { method: "POST" }))}
      onStatus={(status, taughtAt) => run("status", () => api(`/api/reteach/${plan.id}/status`, { method: "POST", json: { status, taughtAt } }))}
      onCreateExitTicket={() =>
        run("exit", async () => {
          const { assessmentId } = await api<{ assessmentId: string }>(`/api/reteach/${plan.id}/exit-ticket`, { method: "POST" });
          router.push(`/assessments/${assessmentId}`);
        })
      }
    />
  );
}
