import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { DatasetIndex, round } from "../diagnosis/dataset";
import { studentConceptMastery } from "../diagnosis/mastery";
import { loadSectionDataset } from "./dataset";

/** Roster with each student's current mastery on the first target concept, plus concepts covered in the section. */
export async function builderContext(sectionId: string, conceptId: string | undefined) {
  const section = await prisma.section.findUniqueOrThrow({ where: { id: sectionId } });
  const ds = await loadSectionDataset(sectionId);
  const idx = new DatasetIndex(ds);
  const covered = new Set(ds.assessments.flatMap((a) => a.questions.flatMap((q) => q.conceptIds)));
  return {
    section,
    roster: ds.students.map((s) => {
      const m = conceptId ? studentConceptMastery(idx, s.id, conceptId) : null;
      return { id: s.id, name: s.name, rollNumber: s.rollNumber, hint: m ? `${round(m.pct)}%` : undefined };
    }),
    concepts: ds.concepts.filter((c) => covered.has(c.id)),
  };
}

export async function listRemedials(teacherId: string) {
  const rows = await prisma.remedialAssignment.findMany({ where: { section: { teacherId } }, orderBy: { createdAt: "desc" }, include: { section: true } });
  const ids = rows.map((r) => r.assessmentId).filter((x): x is string => !!x);
  const asm = new Map((await prisma.assessment.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })).map((a) => [a.id, a]));
  return rows.map((r) => ({
    assessment: r.assessmentId ? (asm.get(r.assessmentId) ?? null) : null,
    id: r.id,
    title: r.title,
    status: r.status,
    section: r.section.name,
    students: parseJson<string[]>(r.studentIds, []).length,
    questions: parseJson<unknown[]>(r.questions, []).length,
    createdAt: r.createdAt.toISOString(),
  }));
}
