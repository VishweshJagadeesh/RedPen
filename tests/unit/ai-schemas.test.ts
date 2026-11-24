import { describe, expect, it } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as S from "@/lib/ai/schemas";
import { aiMode } from "@/lib/ai/mode";

describe("structured-output schemas", () => {
  it.each([
    ["ParsedPaper", S.ParsedPaperSchema],
    ["SheetHeader", S.SheetHeaderSchema],
    ["Transcription", S.TranscriptionSchema],
    ["GradingPass", S.GradingPassSchema],
    ["ReteachPlan", S.ReteachPlanSchema],
    ["PlanSection", S.PlanSectionSchema],
    ["RemedialSet", S.RemedialSetSchema],
    ["PtmSummary", S.PtmSummarySchema],
    ["PlanJudge", S.PlanJudgeSchema],
  ])("%s converts to an output format the SDK accepts", (_name, schema) => {
    const fmt = betaZodOutputFormat(schema) as unknown as { type: string; schema: Record<string, unknown> };
    expect(fmt.type).toBe("json_schema");
    expect(JSON.stringify(fmt.schema)).toContain('"type":"object"');
  });

  it("defaults to mock without an API key and honours AI_MODE", () => {
    const saved = { key: process.env.ANTHROPIC_API_KEY, mode: process.env.AI_MODE };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_MODE;
    expect(aiMode()).toBe("mock");
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(aiMode()).toBe("live");
    process.env.AI_MODE = "mock";
    expect(aiMode()).toBe("mock");
    process.env.ANTHROPIC_API_KEY = saved.key;
    process.env.AI_MODE = saved.mode;
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY;
    if (saved.mode === undefined) delete process.env.AI_MODE;
  });
});
