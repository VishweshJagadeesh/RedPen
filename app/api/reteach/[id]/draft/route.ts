import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { savePlanDraft } from "@/lib/planner/service";
import type { PlanSection } from "@/lib/planner/types";

/** "Save draft & leave": optional unsaved sections, then mark the draft as kept. */
export const POST = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = z.object({ sections: z.array(z.object({ id: z.string(), kind: z.string() }).passthrough()).optional() }).parse(await req.json().catch(() => ({})));
  await savePlanDraft(id, body.sections as unknown as PlanSection[] | undefined);
  return { ok: true };
});
