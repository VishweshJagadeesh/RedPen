import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import type { FlagEvidence } from "../diagnosis/flags";
import type { FlagHistoryEntry } from "../services/followups";

export async function listFlags(teacherId: string) {
  const flags = await prisma.flag.findMany({
    where: { section: { teacherId } },
    orderBy: [{ createdAt: "desc" }],
    include: { student: true, section: true },
  });
  return flags.map((f) => ({
    id: f.id,
    studentId: f.studentId,
    studentName: f.student.name,
    section: f.section.name,
    sectionId: f.sectionId,
    type: f.type,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
    summary: parseJson<FlagEvidence | null>(f.evidence, null)?.summary ?? "",
  }));
}

export async function getFlag(flagId: string) {
  const f = await prisma.flag.findUnique({ where: { id: flagId }, include: { student: true, section: true } });
  if (!f) return null;
  const remedials = (await prisma.remedialAssignment.findMany({ where: { flagId } })).map((r) => ({ id: r.id, title: r.title, status: r.status, assessmentId: r.assessmentId }));
  return {
    id: f.id,
    type: f.type,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
    student: { id: f.student.id, name: f.student.name, rollNumber: f.student.rollNumber },
    section: { id: f.section.id, name: f.section.name },
    evidence: parseJson<FlagEvidence | null>(f.evidence, null),
    history: parseJson<FlagHistoryEntry[]>(f.history, []),
    remedials,
  };
}
export type FlagDetail = NonNullable<Awaited<ReturnType<typeof getFlag>>>;
