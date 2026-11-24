import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { DatasetIndex, round } from "../diagnosis/dataset";
import { coveredConceptIds, sectionTrend, studentConceptMastery, studentConceptTimeline, studentScoreSeries } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import type { FlagHistoryEntry } from "../services/followups";
import { loadSectionDataset } from "./dataset";

export async function getStudentView(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { section: true } });
  if (!student) return null;
  const ds = await loadSectionDataset(student.sectionId);
  const idx = new DatasetIndex(ds);
  const classTrend = sectionTrend(idx);
  const series = studentScoreSeries(idx, studentId, { regularOnly: false });
  const trend = series
    .filter((s) => s.type !== "remedial")
    .map((s) => ({
      label: s.shortTitle,
      title: s.title,
      value: s.pct === null ? null : round(s.pct),
      compare: classTrend.find((c) => c.assessmentId === s.assessmentId)?.average ?? null,
    }));
  const concepts = coveredConceptIds(ds)
    .map((cid) => {
      const c = ds.concepts.find((x) => x.id === cid)!;
      const current = studentConceptMastery(idx, studentId, cid);
      const timeline = studentConceptTimeline(idx, studentId, cid);
      return {
        id: cid,
        name: c.name,
        chapter: c.chapter,
        current: current ? round(current.pct) : null,
        timeline: timeline.map((t) => ({ assessmentId: t.assessmentId, label: t.shortTitle, title: t.title, pct: round(t.pct), got: t.got, max: t.max })),
      };
    })
    .filter((c) => c.current !== null)
    .sort((a, b) => (a.current ?? 0) - (b.current ?? 0));

  const flags = await prisma.flag.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
  const remedials = (await prisma.remedialAssignment.findMany({ where: { sectionId: student.sectionId }, orderBy: { createdAt: "desc" } })).filter((r) =>
    parseJson<string[]>(r.studentIds, []).includes(studentId),
  );
  const remedialAssessments = remedials.map((r) => r.assessmentId).filter((x): x is string => !!x);
  const remAsm = remedialAssessments.length ? await prisma.assessment.findMany({ where: { id: { in: remedialAssessments } } }) : [];

  return {
    student: {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      shareToken: student.shareToken,
      sectionId: student.sectionId,
      section: student.section.name,
    },
    trend,
    assessments: series.map((s) => ({ ...s, pct: s.pct === null ? null : round(s.pct) })),
    concepts,
    flags: flags.map((f) => ({
      id: f.id,
      type: f.type,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      summary: parseJson<FlagEvidence | null>(f.evidence, null)?.summary ?? "",
      history: parseJson<FlagHistoryEntry[]>(f.history, []),
    })),
    remedials: remedials.map((r) => {
      const a = remAsm.find((x) => x.id === r.assessmentId);
      const score = a && a.status === "final" ? series.find((s) => s.assessmentId === a.id) : undefined;
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        assessmentId: r.assessmentId,
        assessmentStatus: a?.status ?? null,
        createdAt: r.createdAt.toISOString(),
        questions: parseJson<unknown[]>(r.questions, []).length,
        score: score ? { got: score.got, max: score.max, pct: score.pct === null ? null : round(score.pct) } : null,
      };
    }),
  };
}
export type StudentViewData = NonNullable<Awaited<ReturnType<typeof getStudentView>>>;
