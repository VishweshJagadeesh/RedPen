import Link from "next/link";
import { notFound } from "next/navigation";
import { ReteachPlanContainer } from "@/components/containers/ReteachPlanContainer";
import { PageHeader } from "@/components/shared/States";
import { getPlan } from "@/lib/planner/service";

export const metadata = { title: "Reteach plan" };

export default async function ReteachPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href={`/sections/${plan.section.id}`} className="hover:underline">
            Class {plan.section.name} · {plan.evidence.chapter}
          </Link>
        }
        title={`Reteach: ${plan.evidence.conceptName}`}
      />
      <ReteachPlanContainer plan={plan} />
    </div>
  );
}
