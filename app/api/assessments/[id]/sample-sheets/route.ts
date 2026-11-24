import { handle, type RouteCtx } from "@/lib/api";
import { attachSampleSheets } from "@/lib/services/assessments";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { attached: await attachSampleSheets(id) };
});
