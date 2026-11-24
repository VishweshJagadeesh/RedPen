import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { DatasetIndex, round } from "../diagnosis/dataset";
import { classConceptSummary, classWeakConcepts, conceptHeatmap, sectionTrend, type ClassConceptSummary } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import { loadSectionDataset } from "./dataset";

export interface WeakConceptView {
  conceptId: string;
  conceptName: string;
  chapter: string;
  isWeak: boolean;
  studentsUnder: number;
  studentsAssessed: number;
  shareUnder: number;
  meanPct: number;
  assessmentTitle: string;
  misconceptions: { label: string; count: number }[];
  snippets: { text: string; misconception: string; source: string }[];
  weakStudentIds: string[];
  plan: null | {
    id: string;
    status: string;
    taughtAt: string | null;
    exitTicketAssessmentId: string | null;
    exitTicketStatus: string | null;
    beforePct: number;
    afterPct: number | null;
    afterUnder: number | null;
    afterAssessed: number | null;
  };
}

export function toWeakConceptView(s: ClassConceptSummary): Omit<WeakConceptView, "plan"> {
  return {
    conceptId: s.conceptId,
    conceptName: s.conceptName,
    chapter: s.chapter,
    isWeak: s.isWeak,
    studentsUnder: s.studentsUnder,
    studentsAssessed: s.studentsAssessed,
    shareUnder: s.shareUnder,
    meanPct: s.meanPct,
    assessmentTitle: s.assessmentTitle,
    misconceptions: s.misconceptions,
    snippets: s.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
    weakStudentIds: s.perStudent.filter((p) => p.pct < 50).map((p) => p.studentId),
  };
}

export async function getSectionDashboard(sectionId: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return null;
  const ds = await loadSectionDataset(sectionId);
  const idx = new DatasetIndex(ds);
  const trend = sectionTrend(idx);
  const heatmap = conceptHeatmap(idx);
  const plans = await prisma.lessonPlan.findMany({ where: { sectionId }, orderBy: { createdAt: "desc" } });
  const exitIds = plans.map((p) => p.exitTicketAssessmentId).filter((x): x is string => !!x);
  const exits = exitIds.length ? await prisma.assessment.findMany({ where: { id: { in: exitIds } } }) : [];

  const weak = classWeakConcepts(idx);
  const conceptIds = new Set([...weak.map((w) => w.conceptId), ...plans.map((p) => p.conceptId)]);
  const cards: WeakConceptView[] = [];
  for (const id of conceptIds) {
    const s = classConceptSummary(idx, id);
    if (!s) continue;
    const plan = plans.find((p) => p.conceptId === id);
    let planView: WeakConceptView["plan"] = null;
    if (plan) {
      const evidence = parseJson<{ meanPct: number; assessmentTitle?: string }>(plan.evidence, { meanPct: s.meanPct });
      const exit = exits.find((e) => e.id === plan.exitTicketAssessmentId);
      const exitHistory = exit && exit.status === "final" ? s.history.find((h) => h.assessmentId === exit.id) : undefined;
      const exitSummary = exitHistory ? s : null;
      planView = {
        id: plan.id,
        status: plan.status,
        taughtAt: plan.taughtAt?.toISOString() ?? null,
        exitTicketAssessmentId: plan.exitTicketAssessmentId,
        exitTicketStatus: exit?.status ?? null,
        beforePct: round(evidence.meanPct),
        afterPct: exitHistory ? round(exitHistory.meanPct) : null,
        afterUnder: exitSummary && exitSummary.assessmentId === exit?.id ? exitSummary.studentsUnder : null,
        afterAssessed: exitSummary && exitSummary.assessmentId === exit?.id ? exitSummary.studentsAssessed : null,
      };
    }
    cards.push({ ...toWeakConceptView(s), plan: planView });
  }
  cards.sort((a, b) => Number(!!a.plan?.afterPct) - Number(!!b.plan?.afterPct) || b.shareUnder - a.shareUnder);

  const flags = await prisma.flag.findMany({ where: { sectionId }, orderBy: { createdAt: "desc" }, include: { student: true } });
  return {
    section: { id: section.id, name: section.name, grade: section.grade, academicYear: section.academicYear },
    studentCount: ds.students.length,
    trend,
    heatmap,
    weakConcepts: cards,
    flags: flags.map((f) => ({
      id: f.id,
      studentId: f.studentId,
      studentName: f.student.name,
      section: section.name,
      type: f.type,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      summary: parseJson<FlagEvidence | null>(f.evidence, null)?.summary ?? "",
    })),
  };
}
export type SectionDashboardData = NonNullable<Awaited<ReturnType<typeof getSectionDashboard>>>;
