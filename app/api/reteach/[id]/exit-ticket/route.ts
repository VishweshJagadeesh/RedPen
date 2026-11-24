import { handle, type RouteCtx } from "@/lib/api";
import { createExitTicket } from "@/lib/planner/service";

export const POST = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  return { assessmentId: await createExitTicket(id) };
});
