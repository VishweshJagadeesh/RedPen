import { handle, type RouteCtx } from "@/lib/api";
import { discardAssessment } from "@/lib/services/assessments";

/** "Discard": deletes an assessment with nothing graded yet. */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await discardAssessment(id);
  return { ok: true };
});
