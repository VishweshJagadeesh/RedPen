import { notFound } from "next/navigation";
import { AssessmentWizardContainer } from "@/components/containers/AssessmentWizardContainer";
import { PageHeader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/components/home/TeacherHome";
import { ASSESSMENT_TYPE_LABEL, type AssessmentType } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getAssessmentWizard } from "@/lib/queries/assessments";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAssessmentWizard(id);
  if (!data) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={`Class ${data.section.name} · ${ASSESSMENT_TYPE_LABEL[data.type as AssessmentType]} · ${formatDate(data.date)}`}
        title={data.title}
        actions={<Badge variant="secondary" data-demo-id="assessment-status">{statusLabel(data.status)}</Badge>}
      />
      <AssessmentWizardContainer data={data} />
    </div>
  );
}
