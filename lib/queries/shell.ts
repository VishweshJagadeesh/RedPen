import { prisma } from "../db/prisma";
import { aiMode } from "../ai/mode";
import { teacherWeakConcepts } from "./section";

export async function getShellData(teacherId: string) {
  const [teacher, openFlags, weak] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, include: { sections: { orderBy: { name: "asc" } } } }),
    prisma.flag.count({ where: { section: { teacherId }, status: { not: "resolved" } } }),
    teacherWeakConcepts(teacherId),
  ]);
  if (!teacher) return null;
  return {
    teacherName: teacher.name,
    subject: teacher.subject,
    sections: teacher.sections.map((s) => ({ id: s.id, name: s.name, weakConcepts: weak.find((w) => w.sectionId === s.id)?.weak.length ?? 0 })),
    openFlags,
    mode: aiMode(),
  };
}
