import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { classHealth, sectionTrend } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import { sectionInsights } from "./section";

export async function getHomeData(teacherId: string) {
  const sections = await prisma.section.findMany({ where: { teacherId }, orderBy: { name: "asc" }, include: { _count: { select: { students: true } } } });
  const sectionCards = await Promise.all(
    sections.map(async (s) => {
      const { idx, cards } = await sectionInsights(s.id);
      const trend = sectionTrend(idx);
      const weak = cards.filter((c) => c.isWeak);
      const openFlags = await prisma.flag.count({ where: { sectionId: s.id, status: { not: "resolved" } } });
      const latest = trend.at(-1);
      const prev = trend.at(-2);
      return {
        id: s.id,
        name: s.name,
        students: s._count.students,
        latestAverage: latest?.average ?? null,
        latestTitle: latest?.shortTitle ?? null,
        change: latest && prev ? Math.round((latest.average - prev.average) * 10) / 10 : null,
        health: classHealth(latest?.average ?? null),
        trend: trend.map((t) => ({ label: t.shortTitle, value: t.average })),
        weakConcepts: weak.map((w) => ({
          id: w.conceptId,
          name: w.conceptName,
          chapter: w.chapter,
          shareUnder: w.shareUnder,
          studentsUnder: w.studentsUnder,
          studentsAssessed: w.studentsAssessed,
          meanPct: w.meanPct,
          source: w.source,
          assessmentTitle: w.assessmentTitle,
          topMisconception: w.misconceptions[0] ?? null,
          plan: w.plan ? { id: w.plan.id, status: w.plan.status } : null,
        })),
        openFlags,
      };
    }),
  );

  const pending = await prisma.assessment.findMany({
    where: { section: { teacherId }, status: { notIn: ["final", "draft"] } },
    orderBy: { date: "desc" },
    include: { section: true, submissions: { select: { status: true, answerGrades: { select: { status: true } } } } },
  });
  const toDo = pending.map((a) => {
    const answers = a.submissions.flatMap((s) => s.answerGrades);
    return {
      id: a.id,
      title: a.title,
      section: a.section.name,
      type: a.type,
      status: a.status,
      handedOut: a.handedOut,
      date: a.date.toISOString(),
      sheets: a.submissions.filter((s) => s.status !== "absent").length,
      graded: a.submissions.filter((s) => s.status === "graded").length,
      pendingReview: answers.filter((g) => g.status === "pending_review").length,
    };
  });

  // Unfinished work the teacher can come back to (saved from the "leave this page?" dialog, or just left).
  const [draftPlans, draftRemedials, draftAssessments] = await Promise.all([
    prisma.lessonPlan.findMany({ where: { section: { teacherId }, status: "draft" }, orderBy: { updatedAt: "desc" }, include: { section: true } }),
    prisma.remedialAssignment.findMany({ where: { section: { teacherId }, status: "draft" }, orderBy: { createdAt: "desc" }, include: { section: true } }),
    prisma.assessment.findMany({ where: { section: { teacherId }, status: "draft" }, orderBy: { createdAt: "desc" }, include: { section: true } }),
  ]);
  const conceptNames = new Map(
    (await prisma.concept.findMany({ where: { id: { in: draftPlans.map((p) => p.conceptId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]),
  );
  const drafts = [
    ...draftPlans.map((p) => ({ kind: "Reteach plan", id: p.id, title: `Reteach: ${conceptNames.get(p.conceptId) ?? p.conceptId}`, section: p.section.name, at: p.updatedAt.toISOString(), href: `/reteach/${p.id}`, saved: !!p.draftSavedAt })),
    ...draftRemedials.map((r) => ({ kind: "Remedial sheet", id: r.id, title: r.title, section: r.section.name, at: r.createdAt.toISOString(), href: `/remedial/${r.id}`, saved: !!r.draftSavedAt })),
    ...draftAssessments.map((a) => ({ kind: a.type === "homework" ? "Homework" : "Assessment", id: a.id, title: a.title, section: a.section.name, at: a.createdAt.toISOString(), href: `/assessments/${a.id}`, saved: !!a.draftSavedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const flags = await prisma.flag.findMany({
    where: { section: { teacherId }, status: { not: "resolved" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { student: true, section: true },
  });
  return {
    sections: sectionCards,
    toDo,
    drafts,
    flags: flags.map((f) => ({
      id: f.id,
      studentName: f.student.name,
      section: f.section.name,
      type: f.type,
      status: f.status,
      summary: parseJson<FlagEvidence | null>(f.evidence, null)?.summary ?? "",
    })),
  };
}

export type HomeData = Awaited<ReturnType<typeof getHomeData>>;
