import { prisma } from "../db/prisma";
import { aiMode } from "../ai/mode";

export async function getShellData(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, include: { sections: { orderBy: { name: "asc" } } } });
  if (!teacher) return null;
  const openFlags = await prisma.flag.count({ where: { section: { teacherId }, status: { not: "resolved" } } });
  return {
    teacherName: teacher.name,
    subject: teacher.subject,
    sections: teacher.sections.map((s) => ({ id: s.id, name: s.name })),
    openFlags,
    mode: aiMode(),
  };
}
