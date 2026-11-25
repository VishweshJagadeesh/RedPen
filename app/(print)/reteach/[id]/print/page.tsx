import { notFound } from "next/navigation";
import { PrintablePlan } from "@/components/reteach/PrintablePlan";
import { PrintButton } from "@/components/shared/PrintButton";
import { BackLink } from "@/components/shared/States";
import { getPlan } from "@/lib/planner/service";

export const metadata = { title: "Print reteach plan" };

export default async function PrintPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return (
    <div>
      <div className="no-print flex items-center justify-between gap-2 p-4">
        <BackLink href={`/reteach/${plan.id}`} label="the plan" />
        <PrintButton />
      </div>
      <PrintablePlan sectionName={plan.section.name} evidence={plan.evidence} inputs={plan.inputs} sections={plan.sections} />
    </div>
  );
}
