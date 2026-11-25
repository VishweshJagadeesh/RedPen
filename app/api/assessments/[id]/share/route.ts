import { handle, type RouteCtx } from "@/lib/api";
import { shareToken } from "@/lib/services/assessments";

/** Returns the read-only student-copy link for this work (created on first use). */
export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { path: `/w/${await shareToken(id)}` };
});
