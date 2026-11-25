import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { setHandedOut } from "@/lib/services/assessments";

/** { handedOut: false } = "Yet to hand it to the class"; true = handed out. */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { handedOut } = z.object({ handedOut: z.boolean() }).parse(await req.json());
  await setHandedOut(id, handedOut);
  return { ok: true };
});
