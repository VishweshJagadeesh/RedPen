import { notFound } from "next/navigation";
import { TeachingMode } from "@/components/reteach/TeachingMode";
import { getPlan } from "@/lib/planner/service";
import { TIMED_KINDS } from "@/lib/planner/types";

export const metadata = { title: "Teaching mode" };

export default async function TeachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  const steps = plan.sections.filter((s) => TIMED_KINDS.includes(s.kind));
  const board = plan.sections.find((s) => s.kind === "board_plan")?.body ?? null;
  return <TeachingMode conceptName={plan.evidence.conceptName} steps={steps} boardPlan={board} exitHref={`/reteach/${plan.id}`} />;
}
