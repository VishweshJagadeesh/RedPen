/**
 * Server-side Anthropic client. Every call requests JSON matching a zod schema (structured outputs);
 * output that fails validation is retried once, then surfaced as an AiError — never silently guessed.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export class AiError extends Error {
  constructor(
    message: string,
    readonly label: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CallResult<T> {
  data: T;
  usage: CallUsage;
  latencyMs: number;
  costUsd: number;
  model: string;
  attempts: number;
}

/** USD per million tokens (input, output). */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-2": [8, 40],
};

export function estimateCost(model: string, usage: CallUsage): number {
  const [pin, pout] = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  return (usage.inputTokens * pin + usage.outputTokens * pout) / 1_000_000;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 180_000 });
  return client;
}

export type UserContent = Anthropic.Beta.BetaContentBlockParam[];

export interface StructuredCall<S extends z.ZodType> {
  label: string;
  model: string;
  system: string;
  content: UserContent;
  schema: S;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

export async function callStructured<S extends z.ZodType>(call: StructuredCall<S>): Promise<CallResult<z.infer<S>>> {
  const api = getClient();
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const msg = await api.beta.messages.parse({
        model: call.model,
        max_tokens: call.maxTokens ?? 16000,
        system: call.system,
        messages: [{ role: "user", content: call.content }],
        // Server-side fallback if a request is declined by a safety classifier.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: call.effort ?? "medium", format: betaZodOutputFormat(call.schema) },
      });
      const usage = { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
      if (msg.stop_reason === "refusal") {
        throw new AiError(`The model declined the ${call.label} request.`, call.label, attempt);
      }
      if (msg.stop_reason === "max_tokens") {
        lastError = "the response was cut off (max_tokens)";
        continue;
      }
      const parsed = call.schema.safeParse(msg.parsed_output);
      if (!parsed.success) {
        lastError = `output did not match the expected schema (${parsed.error.issues[0]?.message ?? "invalid"})`;
        continue;
      }
      return {
        data: parsed.data,
        usage,
        latencyMs: Date.now() - started,
        costUsd: estimateCost(call.model, usage),
        model: msg.model,
        attempts: attempt,
      };
    } catch (err) {
      if (err instanceof AiError) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new AiError("The Anthropic API key was rejected.", call.label, attempt);
      if (err instanceof Anthropic.BadRequestError) throw new AiError(`The AI request was invalid: ${err.message}`, call.label, attempt);
      if (err instanceof Anthropic.RateLimitError) lastError = "rate limited by the API";
      else if (err instanceof Anthropic.APIError) lastError = `API error ${err.status ?? ""}: ${err.message}`;
      else lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new AiError(`AI ${call.label} failed twice: ${lastError}. Nothing was saved; try again.`, call.label, 2);
}

/** Builds an image or PDF content block from stored bytes. */
export function fileBlock(data: Buffer, contentType: string): Anthropic.Beta.BetaContentBlockParam {
  if (contentType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") } };
  }
  const media = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(contentType) ? contentType : "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif";
  return { type: "image", source: { type: "base64", media_type: media, data: data.toString("base64") } };
}
