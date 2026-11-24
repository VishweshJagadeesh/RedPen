import { handle, type RouteCtx } from "@/lib/api";
import { getGradingProgress, gradeNext } from "@/lib/grading/pipeline";

export const maxDuration = 300;

/** Grades the next sheet(s) and returns progress. The progress screen calls this in a loop. */
export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return gradeNext(id);
});

export const GET = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return getGradingProgress(id);
});
