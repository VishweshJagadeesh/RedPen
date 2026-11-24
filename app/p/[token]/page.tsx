import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StudentProfile } from "@/components/profile/StudentProfile";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/format";
import { studentFacts } from "@/lib/ptm/facts";
import { templateSummary } from "@/lib/ptm/summary";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student profile", robots: { index: false, follow: false } };

/** Public, read-only parent view behind an unguessable token. No login, no contact details. */
export default async function ParentProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{16,64}$/i.test(token)) notFound();
  const student = await prisma.student.findUnique({ where: { shareToken: token }, include: { section: { include: { teacher: true } } } });
  if (!student) notFound();
  const sf = await studentFacts(student.id);
  if (!sf) notFound();
  const summary = templateSummary(sf);
  const scores = sf.facts
    .filter((f) => f.kind === "score")
    .map((f) => ({ title: String(f.data.title), date: "", pct: f.data.absent ? null : (f.data.pct as number) }));
  const assessments = await prisma.assessment.findMany({ where: { sectionId: student.sectionId, status: "final" }, select: { title: true, date: true } });
  for (const s of scores) s.date = formatDate(assessments.find((a) => a.title === s.title)?.date ?? null);
  return (
    <StudentProfile
      student={{ name: student.name, section: student.section.name }}
      teacherName={student.section.teacher.name}
      trend={sf.trend}
      scores={scores}
      strengths={summary.strengths}
      focusAreas={summary.focusAreas}
      pending={sf.pending.map((p) => p.text)}
    />
  );
}
