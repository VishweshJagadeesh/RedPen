import { handle, type RouteCtx } from "@/lib/api";
import { acceptAllHigh } from "@/lib/services/review";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { accepted: await acceptAllHigh(id) };
});
