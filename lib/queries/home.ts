import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { DatasetIndex } from "../diagnosis/dataset";
import { classWeakConcepts, sectionTrend } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import { loadSectionDataset } from "./dataset";

export async function getHomeData(teacherId: string) {
  const sections = await prisma.section.findMany({ where: { teacherId }, orderBy: { name: "asc" }, include: { _count: { select: { students: true } } } });
  const sectionCards = await Promise.all(
    sections.map(async (s) => {
      const ds = await loadSectionDataset(s.id);
      const idx = new DatasetIndex(ds);
      const trend = sectionTrend(idx);
      const weak = classWeakConcepts(idx);
      const openFlags = await prisma.flag.count({ where: { sectionId: s.id, status: { not: "resolved" } } });
      return {
        id: s.id,
        name: s.name,
        students: s._count.students,
        latestAverage: trend.at(-1)?.average ?? null,
        latestTitle: trend.at(-1)?.shortTitle ?? null,
        trend: trend.map((t) => ({ label: t.shortTitle, value: t.average })),
        weakConcepts: weak.map((w) => ({ id: w.conceptId, name: w.conceptName, shareUnder: w.shareUnder })),
        openFlags,
      };
    }),
  );

  const pending = await prisma.assessment.findMany({
    where: { section: { teacherId }, status: { not: "final" } },
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
      date: a.date.toISOString(),
      sheets: a.submissions.filter((s) => s.status !== "absent").length,
      graded: a.submissions.filter((s) => s.status === "graded").length,
      pendingReview: answers.filter((g) => g.status === "pending_review").length,
    };
  });

  const flags = await prisma.flag.findMany({
    where: { section: { teacherId }, status: { not: "resolved" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { student: true, section: true },
  });
  return {
    sections: sectionCards,
    toDo,
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
