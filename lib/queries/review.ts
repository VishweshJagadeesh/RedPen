import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { config } from "../config";
import { bandFor } from "../grading/confidence";
import { reviewItemFrom, sortReviewItems, type ReviewItem } from "../grading/review-items";
import type { GradeStatus } from "../domain";
import { fileUrl } from "../storage";
import { effectiveMarks } from "./dataset";

export { reviewItemFrom, sortReviewItems };
export type { ReviewItem };

export async function getReviewQueue(assessmentId: string) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      section: true,
      questions: true,
      submissions: { include: { student: true, answerGrades: { omit: { signals: true } } } },
    },
  });
  if (!a) return null;
  const items: ReviewItem[] = [];
  for (const s of a.submissions) {
    const pageKeys = parseJson<string[]>(s.pageKeys, []);
    for (const g of s.answerGrades) {
      const q = a.questions.find((x) => x.id === g.questionId);
      if (!q) continue;
      items.push(reviewItemFrom(g, q, { id: s.id, student: s.student, pageUrl: pageKeys[g.pageIndex] ? fileUrl(pageKeys[g.pageIndex]) : null }));
    }
  }
  sortReviewItems(items);
  const pendingHigh = items.filter((i) => i.status === "pending_review" && !i.needsRescan && i.confidence >= config.confidence.high).length;
  return {
    assessment: { id: a.id, title: a.title, status: a.status, section: a.section.name, date: a.date.toISOString(), type: a.type },
    items,
    pendingHigh,
    ungradedSheets: a.submissions.filter((s) => ["matched", "grading", "error", "uploaded"].includes(s.status)).length,
  };
}
export type ReviewQueueData = NonNullable<Awaited<ReturnType<typeof getReviewQueue>>>;

export async function getResults(assessmentId: string) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      section: true,
      questions: { orderBy: { number: "asc" } },
      submissions: { include: { student: true, answerGrades: { select: { questionId: true, status: true, awardedMarks: true, teacherMarks: true, confidence: true } } } },
    },
  });
  if (!a) return null;
  const maxTotal = a.questions.reduce((s, q) => s + q.maxMarks, 0);
  const rows = a.submissions
    .map((s) => {
      const cells = a.questions.map((q) => {
        const g = s.answerGrades.find((x) => x.questionId === q.id);
        if (!g) return null;
        return { marks: effectiveMarks(g), max: q.maxMarks, band: bandFor(g.confidence), status: g.status as GradeStatus, overridden: g.status === "overridden" };
      });
      const absent = s.status === "absent";
      const total = cells.reduce((t, c) => t + (c?.marks ?? 0), 0);
      return {
        submissionId: s.id,
        studentId: s.studentId,
        name: s.student?.name ?? "Unmatched sheet",
        rollNumber: s.student?.rollNumber ?? 0,
        absent,
        cells,
        total: absent ? null : total,
        pct: absent ? null : (total / maxTotal) * 100,
        bands: [...new Set(cells.filter(Boolean).map((c) => c!.band))],
      };
    })
    .sort((x, y) => x.rollNumber - y.rollNumber);
  return {
    assessment: { id: a.id, title: a.title, status: a.status, section: a.section.name, date: a.date.toISOString(), type: a.type },
    questions: a.questions.map((q) => ({ id: q.id, number: q.number, maxMarks: q.maxMarks })),
    maxTotal,
    rows,
  };
}
export type ResultsData = NonNullable<Awaited<ReturnType<typeof getResults>>>;

export function resultsCsv(r: ResultsData): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Roll", "Name", ...r.questions.map((q) => `Q${q.number} (/${q.maxMarks})`), `Total (/${r.maxTotal})`, "Percent", "Status"];
  const lines = r.rows.map((row) =>
    [
      row.rollNumber,
      row.name,
      ...row.cells.map((c) => (row.absent ? "" : c ? c.marks : "")),
      row.total,
      row.pct === null ? "" : row.pct.toFixed(1),
      row.absent ? "Absent" : row.cells.some((c) => c?.status === "pending_review") ? "Pending review" : "Reviewed",
    ]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\n") + "\n";
}
