import { NewAssessmentContainer } from "@/components/containers/NewAssessmentContainer";
import { PageHeader } from "@/components/shared/States";
import { prisma } from "@/lib/db/prisma";
import { requireTeacherId } from "@/lib/session";

export const metadata = { title: "New assessment" };

export default async function NewAssessmentPage({ searchParams }: { searchParams: Promise<{ type?: string; sectionId?: string }> }) {
  const q = await searchParams;
  const teacherId = await requireTeacherId();
  const sections = await prisma.section.findMany({ where: { teacherId }, orderBy: { name: "asc" } });
  const s8b = sections.find((s) => s.name === "8B");
  const samples = s8b
    ? [{ key: "c8-wt4", label: "Sample: Weekly Test 4 (Linear Equations) paper + key", sectionId: s8b.id, title: "Weekly Test 4 (sample re-upload) — Linear Equations", type: "weekly_test" as const }]
    : [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={q.type === "homework" ? "Grade a homework" : "New assessment"} eyebrow="Grade" description={q.type === "homework" ? "Homework goes through the same grading flow and tells you whether the lesson landed." : undefined} />
      <NewAssessmentContainer sections={sections.map((s) => ({ id: s.id, name: s.name }))} samples={samples} defaultDate={new Date().toISOString().slice(0, 10)}
        defaultType={q.type === "homework" ? "homework" : "weekly_test"}
        defaultSectionId={sections.some((s) => s.id === q.sectionId) ? q.sectionId : undefined}
      />
    </div>
  );
}
