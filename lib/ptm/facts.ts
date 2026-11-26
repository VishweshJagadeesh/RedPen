/**
 * Facts about one student, extracted deterministically from graded data. PTM and profile text may
 * only use these facts, and every statement links to the fact's source assessment or question.
 * The extraction itself is pure (`./student-facts`); this module loads the student's data.
 */
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import type { FlagEvidence } from "../diagnosis/flags";
import type { FlagHistoryEntry } from "../services/followups";
import { loadSectionDataset } from "../queries/dataset";
import { studentFactsFrom, type StudentFacts } from "./student-facts";

export { studentFactsFrom };
export type { Fact, FactSource, StudentFacts, StudentFactsInput } from "./student-facts";

export async function studentFacts(studentId: string): Promise<StudentFacts | null> {
  const st = await prisma.student.findUnique({ where: { id: studentId }, include: { section: true } });
  if (!st) return null;
  const [ds, flags, remedials] = await Promise.all([
    loadSectionDataset(st.sectionId),
    prisma.flag.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } }),
    prisma.remedialAssignment.findMany({ where: { sectionId: st.sectionId, status: "assigned" } }),
  ]);
  return studentFactsFrom({
    student: { id: st.id, name: st.name, rollNumber: st.rollNumber, section: st.section.name, sectionId: st.sectionId },
    ds,
    flags: flags.map((f) => ({ id: f.id, type: f.type, status: f.status, evidence: parseJson<FlagEvidence | null>(f.evidence, null), history: parseJson<FlagHistoryEntry[]>(f.history, []) })),
    pendingRemedials: remedials
      .filter((r) => parseJson<string[]>(r.studentIds, []).includes(studentId))
      .map((r) => ({ id: r.id, title: r.title, questionCount: parseJson<unknown[]>(r.questions, []).length })),
  });
}
