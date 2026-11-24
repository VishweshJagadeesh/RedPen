import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { setStatus } from "@/lib/planner/service";

export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = z.object({ status: z.enum(["draft", "ready", "taught"]), taughtAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(await req.json());
  await setStatus(id, body.status, body.taughtAt);
  return { ok: true };
});
