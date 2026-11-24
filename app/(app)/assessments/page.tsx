import { AssessmentList, NewAssessmentButton } from "@/components/grading/AssessmentList";
import { PageHeader } from "@/components/shared/States";
import { listAssessments } from "@/lib/queries/assessments";
import { requireTeacherId } from "@/lib/session";

export const metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const items = await listAssessments(await requireTeacherId());
  return (
    <div>
      <PageHeader title="Assessments" description="Every test, exit ticket and remedial sheet goes through the same grading flow." actions={<NewAssessmentButton />} />
      <AssessmentList items={items} />
    </div>
  );
}
