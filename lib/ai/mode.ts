/** AI_MODE=live|mock. Defaults to live when ANTHROPIC_API_KEY is set, otherwise mock. */
export type AiMode = "live" | "mock";

export function aiMode(): AiMode {
  const explicit = process.env.AI_MODE?.trim().toLowerCase();
  if (explicit === "live" || explicit === "mock") return explicit;
  return process.env.ANTHROPIC_API_KEY ? "live" : "mock";
}

export function gradingModel(): string {
  return process.env.GRADING_MODEL || "claude-sonnet-5-5";
}

export function planningModel(): string {
  return process.env.PLANNING_MODEL || "claude-sonnet-5-5";
}
