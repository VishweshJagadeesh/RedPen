import { handle, type RouteCtx } from "@/lib/api";
import { reshufflePairs } from "@/lib/planner/service";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await reshufflePairs(id);
  return { ok: true };
});
