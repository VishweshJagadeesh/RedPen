import { handle, type RouteCtx } from "@/lib/api";
import { assignRemedial } from "@/lib/remedial/service";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { assessmentId: await assignRemedial(id) };
});
