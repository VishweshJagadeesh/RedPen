import { z } from "zod";
import { handle, type RouteCtx } from "@/lib/api";
import { discardPlan, saveSections } from "@/lib/planner/service";
import type { PlanSection } from "@/lib/planner/types";

const Question = z.object({ text: z.string(), answer: z.string(), marks: z.number(), rubric: z.array(z.object({ step: z.string(), marks: z.number() })) });
const Section = z
  .object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    minutes: z.number().min(0),
    body: z.string(),
    citesMisconceptions: z.array(z.string()),
    questions: z.array(Question),
  })
  .passthrough();

export const PATCH = handle(async (req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const body = z.object({ sections: z.array(Section) }).parse(await req.json());
  await saveSections(id, body.sections as unknown as PlanSection[]);
  return { ok: true };
});

/** "Discard": deletes the plan. */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  await discardPlan(id);
  return { ok: true };
});
