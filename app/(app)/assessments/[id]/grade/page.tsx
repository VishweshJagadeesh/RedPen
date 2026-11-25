import { notFound } from "next/navigation";
import { GradingProgressContainer } from "@/components/containers/GradingProgressContainer";
import { PageHeader } from "@/components/shared/States";
import { prisma } from "@/lib/db/prisma";
import { aiMode } from "@/lib/ai/mode";
import { formatDate } from "@/lib/format";
import { getGradingProgress } from "@/lib/grading/pipeline";
import { assessmentHome } from "@/lib/ui/back";

export const metadata = { title: "Grading" };

export default async function GradePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string }> }) {
  const { id } = await params;
  const { start } = await searchParams;
  const a = await prisma.assessment.findUnique({ where: { id }, include: { section: true } });
  if (!a) notFound();
  const progress = await getGradingProgress(id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={`Class ${a.section.name} · ${formatDate(a.date)}`} title={a.title} back={assessmentHome(a.id, a.title)} description="Grading runs answer by answer. You review everything before it becomes final." />
      <GradingProgressContainer assessmentId={id} initial={progress} autoStart={start === "1" || a.status === "grading"} mode={aiMode()} />
    </div>
  );
}
