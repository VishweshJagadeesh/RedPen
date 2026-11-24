import { notFound } from "next/navigation";
import { PtmSummary } from "@/components/profile/PtmSummary";
import { prisma } from "@/lib/db/prisma";
import { studentFacts } from "@/lib/ptm/facts";
import { ptmSummary } from "@/lib/ptm/summary";

export const metadata = { title: "PTM mode" };
export const maxDuration = 60;

export default async function PtmPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang } = await searchParams;
  const sf = await studentFacts(id);
  if (!sf) notFound();
  const [summary, section] = await Promise.all([ptmSummary(sf), prisma.section.findUnique({ where: { id: sf.student.sectionId }, include: { teacher: true } })]);
  const sources: Record<string, { label: string; href: string | null }> = {};
  for (const f of sf.facts) if (f.source) sources[f.id] = { label: f.source.label, href: `/assessments/${f.source.assessmentId}/results` };
  return (
    <PtmSummary
      student={sf.student}
      teacherName={section?.teacher.name ?? ""}
      trend={sf.trend}
      summary={summary}
      sources={sources}
      backHref={`/sections/${sf.student.sectionId}/students/${sf.student.id}`}
      initialLang={lang === "hi" ? "hi" : "en"}
    />
  );
}
