import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { AiError } from "@/lib/ai/client";
import { createPlan } from "@/lib/planner/service";

export const maxDuration = 120;

const Body = z.object({
  sectionId: z.string(),
  conceptId: z.string(),
  inputs: z.object({
    periodMinutes: z.number().int().min(20).max(90),
    resources: z.enum(["blackboard", "projector", "worksheets"]),
    language: z.enum(["en", "hi", "mixed"]),
    note: z.string().max(500).default(""),
  }),
});

/**
 * Creates a draft plan. With `Accept: application/x-ndjson` the response streams one JSON line per
 * progress step ({type:"step"}), then {type:"done", id} or {type:"error", error}.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid request" }, { status: 400 });
  }
  if (!req.headers.get("accept")?.includes("application/x-ndjson")) {
    return handle(async () => ({ id: await createPlan(body.sectionId, body.conceptId, body.inputs) }))();
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`));
      try {
        const id = await createPlan(body.sectionId, body.conceptId, body.inputs, (step, status, detail) => send({ type: "step", step, status, detail }));
        send({ type: "done", id });
      } catch (e) {
        if (!(e instanceof AiError)) console.error("[api]", e);
        send({ type: "error", error: e instanceof Error ? e.message : "Unexpected error", kind: e instanceof AiError ? "ai" : undefined });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
