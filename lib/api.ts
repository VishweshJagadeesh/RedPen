import { NextResponse } from "next/server";
import { AiError } from "./ai/client";

/** Wraps a route handler: JSON errors with a readable message, AI failures as 502. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A): Promise<Response> => {
    try {
      const out = await fn(...args);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof AiError) return NextResponse.json({ error: err.message, kind: "ai" }, { status: 502 });
      const message = err instanceof Error ? err.message : "Unexpected error";
      console.error("[api]", message);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}

export type RouteCtx<P extends Record<string, string | string[]>> = { params: Promise<P> };
