import { ASSESSMENT_FILTERS, AssessmentList, NewAssessmentButton, type AssessmentFilter } from "@/components/grading/AssessmentList";
import { PageHeader } from "@/components/shared/States";
import { listAssessments } from "@/lib/queries/assessments";
import { requireTeacherId } from "@/lib/session";

export const metadata = { title: "Assessments" };

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const items = await listAssessments(await requireTeacherId());
  const f = (ASSESSMENT_FILTERS.find((x) => x.id === filter)?.id ?? "all") as AssessmentFilter;
  return (
    <div>
      <PageHeader title="Assessments" description="Every test, homework, exit ticket and remedial sheet goes through the same grading flow." actions={<NewAssessmentButton />} />
      <AssessmentList items={items} filter={f} />
    </div>
  );
}
