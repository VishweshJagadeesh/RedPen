import { handle, type RouteCtx } from "@/lib/api";
import { parseAssessmentPaper } from "@/lib/services/assessments";

export const maxDuration = 120;

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const paper = await parseAssessmentPaper(id);
  return { questions: paper.questions.length, warnings: paper.warnings };
});
