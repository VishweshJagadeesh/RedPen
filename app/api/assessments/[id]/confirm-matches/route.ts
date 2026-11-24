import { handle, type RouteCtx } from "@/lib/api";
import { confirmMatches } from "@/lib/services/assessments";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await confirmMatches(id);
  return { ok: true };
});
