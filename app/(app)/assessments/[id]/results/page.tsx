import { notFound } from "next/navigation";
import { ResultsTable } from "@/components/containers/ResultsTableContainer";
import { PageHeader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/components/home/TeacherHome";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/format";
import { getResults } from "@/lib/queries/review";
import { assessmentHome } from "@/lib/ui/back";

export const metadata = { title: "Results" };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, a] = await Promise.all([getResults(id), prisma.assessment.findUnique({ where: { id }, select: { sectionId: true } })]);
  if (!data || !a) notFound();
  return (
    <div>
      <PageHeader
        eyebrow={`Class ${data.assessment.section} · ${formatDate(data.assessment.date)}`}
        title={`Results: ${data.assessment.title}`}
        back={assessmentHome(id, data.assessment.title)}
        actions={<Badge variant={data.assessment.status === "final" ? "high" : "secondary"}>{statusLabel(data.assessment.status)}</Badge>}
      />
      <ResultsTable data={data} sectionId={a.sectionId} />
    </div>
  );
}
