import { handle, type RouteCtx } from "@/lib/api";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/audit";
import { storeUpload } from "@/lib/services/assessments";

/** Replace a sheet's photos with a re-scan and send it back through grading. */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id } });
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose the re-scanned page photo(s).");
  const keys = await Promise.all(files.map((f) => storeUpload(`sheets/${sub.assessmentId}`, f)));
  await prisma.$transaction([
    prisma.answerGrade.deleteMany({ where: { submissionId: id } }),
    prisma.submission.update({ where: { id }, data: { pageKeys: JSON.stringify(keys), sheetRef: null, status: "matched", gradingError: null } }),
    prisma.assessment.update({ where: { id: sub.assessmentId }, data: { status: "grading" } }),
  ]);
  await audit("teacher", "sheet.rescanned", "Submission", id, { pages: keys.length });
  return { ok: true, assessmentId: sub.assessmentId };
});
