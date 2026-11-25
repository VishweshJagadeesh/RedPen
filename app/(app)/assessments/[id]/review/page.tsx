import { notFound } from "next/navigation";
import { ReviewQueueContainer } from "@/components/containers/ReviewQueueContainer";
import { PageHeader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/components/home/TeacherHome";
import { formatDate } from "@/lib/format";
import { getReviewQueue } from "@/lib/queries/review";
import { assessmentHome } from "@/lib/ui/back";

export const metadata = { title: "Review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReviewQueue(id);
  if (!data) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={`Class ${data.assessment.section} · ${formatDate(data.assessment.date)}`}
        title={`Review: ${data.assessment.title}`}
        back={assessmentHome(id, data.assessment.title)}
        description="Least certain answers first. Nothing is final until you accept it."
        actions={<Badge variant="secondary">{statusLabel(data.assessment.status)}</Badge>}
      />
      <ReviewQueueContainer data={data} />
    </div>
  );
}
