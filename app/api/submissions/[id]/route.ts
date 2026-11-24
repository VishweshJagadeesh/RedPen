import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit";
import { setSubmissionStudent } from "@/lib/services/assessments";

const Body = z.object({ studentId: z.string().nullable() });

export const PATCH = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  await setSubmissionStudent(id, body.studentId);
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const graded = await prisma.answerGrade.count({ where: { submissionId: id } });
  if (graded) throw new Error("This sheet has already been graded.");
  await prisma.submission.delete({ where: { id } });
  await audit("teacher", "sheet.removed", "Submission", id);
  return { ok: true };
});
