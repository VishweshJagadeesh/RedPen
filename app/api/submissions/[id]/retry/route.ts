import { handle, type RouteCtx } from "@/lib/api";
import { retrySheet } from "@/lib/grading/pipeline";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await retrySheet(id);
  return { ok: true };
});
