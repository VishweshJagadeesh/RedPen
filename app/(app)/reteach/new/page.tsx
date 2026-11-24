import Link from "next/link";
import { redirect } from "next/navigation";
import { ReteachSetupContainer } from "@/components/containers/ReteachSetupContainer";
import { EvidenceSummary } from "@/components/reteach/EvidenceSummary";
import { ErrorState, PageHeader } from "@/components/shared/States";
import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";
import { buildEvidence } from "@/lib/planner/service";

export const metadata = { title: "Plan a reteach" };

export default async function NewReteachPage({ searchParams }: { searchParams: Promise<{ sectionId?: string; conceptId?: string }> }) {
  const { sectionId, conceptId } = await searchParams;
  if (!sectionId || !conceptId) return <ErrorState title="Choose a weak concept first" description={<Link href="/dashboard">Go to a class dashboard</Link>} />;
  const existing = await prisma.lessonPlan.findFirst({ where: { sectionId, conceptId }, orderBy: { createdAt: "desc" } });
  if (existing) redirect(`/reteach/${existing.id}`);
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  let evidence;
  try {
    evidence = (await buildEvidence(sectionId, conceptId)).evidence;
  } catch (e) {
    return <ErrorState title="Cannot plan this reteach yet" description={e instanceof Error ? e.message : String(e)} />;
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow={`Class ${section?.name} · ${evidence.chapter}`} title={`Plan a reteach: ${evidence.conceptName}`} description="One period, built around the mistakes this class actually made." />
      <EvidenceSummary evidence={evidence} />
      <ReteachSetupContainer sectionId={sectionId} conceptId={conceptId} defaultPeriod={config.planner.defaultPeriodMinutes} />
    </div>
  );
}
