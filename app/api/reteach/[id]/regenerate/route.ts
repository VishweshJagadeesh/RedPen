import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { regenerateSection } from "@/lib/planner/service";

export const maxDuration = 120;

export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const { sectionId } = z.object({ sectionId: z.string() }).parse(await req.json());
  await regenerateSection(id, sectionId);
  return { ok: true };
});
