import { cache } from "react";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { config } from "../config";
import { DatasetIndex, round } from "../diagnosis/dataset";
import {
  classConceptSummary,
  classHealth,
  classRoster,
  classWeakConcepts,
  conceptHeatmap,
  homeworkSummaries,
  sectionTrend,
  type ClassConceptSummary,
} from "../diagnosis/mastery";
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
  /** "homework" when the latest evidence came from homework rather than a test. */
  source: "test" | "homework" | "exit_ticket";
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
    source: s.assessmentType === "homework" ? "homework" : s.assessmentType === "exit_ticket" ? "exit_ticket" : "test",
    misconceptions: s.misconceptions,
    snippets: s.snippets.map((x) => ({ text: x.text, misconception: x.misconception, source: `${x.assessmentTitle}, Q${x.questionNumber}` })),
    weakStudentIds: s.perStudent.filter((p) => p.pct < config.diagnosis.weakScore).map((p) => p.studentId),
  };
}

/** Everything derived for one section. Cached per request so the shell, Home and class page share it. */
export const sectionInsights = cache(async (sectionId: string) => {
  // Independent reads run together: each round trip to a remote database counts.
  const [ds, plans, exits] = await Promise.all([
    loadSectionDataset(sectionId),
    prisma.lessonPlan.findMany({ where: { sectionId }, orderBy: { createdAt: "desc" } }),
    prisma.assessment.findMany({ where: { sectionId, lessonPlanId: { not: null } }, select: { id: true, status: true } }),
  ]);
  const idx = new DatasetIndex(ds);

  const weak = classWeakConcepts(idx);
  const conceptIds = new Set([...weak.map((w) => w.conceptId), ...plans.map((p) => p.conceptId)]);
  const cards: WeakConceptView[] = [];
  for (const id of conceptIds) {
    const s = classConceptSummary(idx, id);
    if (!s) continue;
    const plan = plans.find((p) => p.conceptId === id);
    let planView: WeakConceptView["plan"] = null;
    if (plan) {
      const evidence = parseJson<{ meanPct: number }>(plan.evidence, { meanPct: s.meanPct });
      const exit = exits.find((e) => e.id === plan.exitTicketAssessmentId);
      const exitHistory = exit && exit.status === "final" ? s.history.find((h) => h.assessmentId === exit.id) : undefined;
      const latestIsExit = !!exit && s.assessmentId === exit.id;
      planView = {
        id: plan.id,
        status: plan.status,
        taughtAt: plan.taughtAt?.toISOString() ?? null,
        exitTicketAssessmentId: plan.exitTicketAssessmentId,
        exitTicketStatus: exit?.status ?? null,
        beforePct: round(evidence.meanPct),
        afterPct: exitHistory ? round(exitHistory.meanPct) : null,
        afterUnder: exitHistory && latestIsExit ? s.studentsUnder : null,
        afterAssessed: exitHistory && latestIsExit ? s.studentsAssessed : null,
      };
    }
    cards.push({ ...toWeakConceptView(s), plan: planView });
  }
  // Open problems first (most students affected), then concepts already reteached.
  cards.sort((a, b) => Number(!a.isWeak) - Number(!b.isWeak) || b.shareUnder - a.shareUnder);
  return { ds, idx, cards };
});

/** Class-wide weak concepts across all of a teacher's sections (for sidebar badges and Home). */
export const teacherWeakConcepts = cache(async (teacherId: string) => {
  const sections = await prisma.section.findMany({ where: { teacherId }, orderBy: { name: "asc" } });
  return Promise.all(
    sections.map(async (s) => {
      const { cards } = await sectionInsights(s.id);
      return { sectionId: s.id, sectionName: s.name, weak: cards.filter((c) => c.isWeak) };
    }),
  );
});

export async function getSectionDashboard(sectionId: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return null;
  const { ds, idx, cards } = await sectionInsights(sectionId);
  const trend = sectionTrend(idx);
  const heatmap = conceptHeatmap(idx);
  const homework = homeworkSummaries(idx);
  const weakIds = cards.filter((c) => c.isWeak).map((c) => c.conceptId);
  const roster = classRoster(idx, weakIds);

  const flags = await prisma.flag.findMany({ where: { sectionId }, orderBy: { createdAt: "desc" }, include: { student: true } });
  // Work set up on RedPen but not handed to the class yet (or handed out, sheets not back).
  const upcoming = await prisma.assessment.findMany({
    where: { sectionId, status: "questions_ready", submissions: { none: {} }, remedialAssignmentId: null },
    orderBy: { date: "asc" },
    select: { id: true, title: true, type: true, date: true, handedOut: true },
  });
  const latest = trend.at(-1) ?? null;
  const previous = trend.at(-2) ?? null;
  const openFlags = flags.filter((f) => f.status !== "resolved");
  const flaggedIds = new Set(openFlags.map((f) => f.studentId));
  return {
    section: { id: section.id, name: section.name, grade: section.grade, academicYear: section.academicYear },
    studentCount: ds.students.length,
    kpis: {
      latestAverage: latest?.average ?? null,
      latestTitle: latest?.title ?? null,
      latestShort: latest?.shortTitle ?? null,
      change: latest && previous ? round(latest.average - previous.average, 1) : null,
      previousShort: previous?.shortTitle ?? null,
      health: classHealth(latest?.average ?? null),
      weakConcepts: weakIds.length,
      openFlags: openFlags.length,
      latestHomework: homework[0] ? { title: homework[0].title, average: homework[0].average, submitted: homework[0].submitted, expected: homework[0].expected } : null,
    },
    bands: { healthy: config.diagnosis.classHealthy, critical: config.diagnosis.classCritical, notable: config.diagnosis.notableChange },
    trend,
    heatmap,
    homework,
    upcoming: upcoming.map((u) => ({ ...u, date: u.date.toISOString() })),
    roster: roster.map((r) => ({ ...r, flagged: flaggedIds.has(r.studentId) })),
    rosterLabels: idx.ds.assessments.filter((a) => ["weekly_test", "periodic_test", "term_exam"].includes(a.type)).map((a) => a.shortTitle),
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
