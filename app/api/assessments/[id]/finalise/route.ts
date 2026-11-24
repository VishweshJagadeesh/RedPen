import { handle, type RouteCtx } from "@/lib/api";
import { finaliseAssessment } from "@/lib/services/review";

export const maxDuration = 60;

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return finaliseAssessment(id);
});
