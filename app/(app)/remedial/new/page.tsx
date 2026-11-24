import { RemedialNewContainer } from "@/components/containers/RemedialContainers";
import { ErrorState, PageHeader } from "@/components/shared/States";
import { builderContext } from "@/lib/queries/remedial";
import { prefillForStudents, prefillFromFlag, prefillFromGroup } from "@/lib/remedial/service";

export const metadata = { title: "New remedial sheet" };

export default async function NewRemedialPage({ searchParams }: { searchParams: Promise<{ flagId?: string; sectionId?: string; conceptId?: string; studentIds?: string; group?: string }> }) {
  const q = await searchParams;
  let prefill;
  if (q.flagId) prefill = await prefillFromFlag(q.flagId);
  else if (q.sectionId && q.conceptId && q.group) prefill = await prefillFromGroup(q.sectionId, q.conceptId);
  else if (q.sectionId && q.studentIds) prefill = await prefillForStudents(q.sectionId, q.studentIds.split(","));
  else if (q.sectionId) prefill = { sectionId: q.sectionId, studentIds: [], conceptIds: q.conceptId ? [q.conceptId] : [], flagId: null };
  if (!prefill) return <ErrorState title="Start from an alert, a weak concept or a student" description="Open a student's alert and choose “Create a remedial sheet”." />;
  const ctx = await builderContext(prefill.sectionId, prefill.conceptIds[0]);
  const isGroup = prefill.studentIds.length > 1;
  return (
    <div>
      <PageHeader
        eyebrow={`Class ${ctx.section.name}`}
        title="New remedial sheet"
        description={isGroup ? `Prefilled with the ${prefill.studentIds.length} students under 50% on this concept.` : "Prefilled from the evidence. Change anything before generating."}
      />
      <RemedialNewContainer
        roster={ctx.roster}
        concepts={ctx.concepts}
        fromFlag={!!prefill.flagId}
        flagId={prefill.flagId}
        sectionId={prefill.sectionId}
        initial={{ studentIds: prefill.studentIds, conceptIds: prefill.conceptIds, count: isGroup ? 6 : 5, mode: "group" }}
      />
    </div>
  );
}
