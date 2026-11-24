import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { acceptGrade, markIllegible, markNeedsRescan, overrideGrade } from "@/lib/services/review";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("override"), awards: z.array(z.number()), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("illegible"), note: z.string().nullable().optional() }),
  z.object({ action: z.literal("rescan"), note: z.string().nullable().optional() }),
]);

export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  if (body.action === "accept") await acceptGrade(id);
  else if (body.action === "override") await overrideGrade(id, body.awards, body.note ?? null);
  else if (body.action === "illegible") await markIllegible(id, body.note ?? null);
  else await markNeedsRescan(id, body.note ?? null);
  return { ok: true };
});
