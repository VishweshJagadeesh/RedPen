/** Live reteach planning with PLANNING_MODEL, grounded in the class's evidence and checked after generation. */
import { AiError, callStructured } from "../ai/client";
import { planningModel } from "../ai/mode";
import { PlanSectionSchema, ReteachPlanSchema, type PlanSectionOut } from "../ai/schemas";
import type { PlanEvidence, PlanInputs, PlanSection } from "./types";
import { TIMED_KINDS } from "./types";

const LANG: Record<PlanInputs["language"], string> = {
  en: "English",
  hi: "Hindi (Devanagari script); keep mathematical expressions as they are",
  mixed: "a natural mix of Hindi and English as spoken in Indian classrooms (Hinglish, Latin script)",
};

const SYSTEM = `You help a mathematics teacher in an Indian school (CBSE) plan how to reteach ONE concept in ONE period, based only on the evidence from her own class.
Rules:
- Use only the facts in the evidence. Do not invent students, names, numbers of students, scores or quotes. Quotes from student work must come from the provided snippets.
- Every section that deals with a misconception must cite it in citesMisconceptions using the exact label from the evidence.
- Keep it practical for a 40–60 student class with limited resources.`;

function evidenceText(ev: PlanEvidence) {
  return JSON.stringify(
    {
      concept: `${ev.chapter} › ${ev.conceptName}`,
      fromTest: ev.assessmentTitle,
      studentsAssessed: ev.studentsAssessed,
      studentsUnder50: ev.studentsUnder,
      classMasteryPct: Math.round(ev.meanPct),
      misconceptions: ev.misconceptions,
      snippets: ev.snippets,
      mentorsAvailable: ev.mentors,
      learners: ev.learners,
      questionsFromTheTest: ev.sourceQuestions.map((q) => ({ text: q.text, answer: q.answer, marks: q.marks })),
    },
    null,
    2,
  );
}

export function checkPlan(sections: Omit<PlanSection, "id">[], ev: PlanEvidence, inputs: PlanInputs): string[] {
  const problems: string[] = [];
  const labels = new Set(ev.misconceptions.map((m) => m.label));
  const timed = sections.filter((s) => TIMED_KINDS.includes(s.kind)).reduce((t, s) => t + s.minutes, 0);
  if (timed > inputs.periodMinutes) problems.push(`timed steps add up to ${timed} minutes, more than the ${inputs.periodMinutes}-minute period`);
  const exit = sections.find((s) => s.kind === "exit_ticket");
  if (!exit || exit.questions.length < 3 || exit.questions.length > 5) problems.push("the exit ticket must have 3 to 5 questions");
  const pre = sections.find((s) => s.kind === "prerequisite_check");
  if (!pre || pre.questions.length !== 2) problems.push("the prerequisite check must have exactly 2 questions");
  const named = ev.misconceptions.filter((m) => !/unattempted/i.test(m.label));
  if (named.length > 0) {
    const cited = new Set(sections.flatMap((s) => s.citesMisconceptions));
    if (!cited.has(named[0].label)) problems.push(`no section cites the top misconception "${named[0].label}"`);
    if (named[1] && !cited.has(named[1].label)) problems.push(`no section cites the second misconception "${named[1].label}"`);
  }
  for (const s of sections) {
    const bad = s.citesMisconceptions.filter((c) => !labels.has(c));
    if (bad.length) problems.push(`section "${s.title}" cites misconceptions that are not in the evidence: ${bad.join(", ")}`);
  }
  return problems;
}

function normalise(out: PlanSectionOut): Omit<PlanSection, "id"> {
  return {
    kind: out.kind,
    title: out.title,
    minutes: TIMED_KINDS.includes(out.kind) ? Math.max(1, Math.round(out.minutes)) : 0,
    body: out.body,
    citesMisconceptions: out.citesMisconceptions,
    questions: out.questions.map((q) => ({ ...q, marks: q.rubric.reduce((s, r) => s + r.marks, 0) || q.marks })),
  };
}

export async function livePlanSections(ev: PlanEvidence, inputs: PlanInputs): Promise<Omit<PlanSection, "id">[]> {
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await callStructured({
      label: "reteach plan",
      model: planningModel(),
      system: SYSTEM,
      effort: "medium",
      content: [
        {
          type: "text",
          text: `Evidence from this class:\n${evidenceText(ev)}

Inputs: period ${inputs.periodMinutes} minutes; resources: ${inputs.resources}; language: ${LANG[inputs.language]}.${inputs.note ? `\nTeacher's note: ${inputs.note}` : ""}

Write the plan as sections in this order: objective; prerequisite_check (exactly 2 questions); hook; explanation that tackles misconception #1; worked_example; misconception (tackles misconception #2); guided_practice (in peer pairs); exit_ticket_step; board_plan (exactly what to write on the board, one line per row); peer_pairs (how to run the pairs — the app fills in the names); extension (for students who already understand it); exit_ticket (3–5 questions with answers and step rubrics).
Timed steps (prerequisite_check through exit_ticket_step) must fit in ${inputs.periodMinutes} minutes; give 0 minutes to the other sections.${feedback}`,
        },
      ],
      schema: ReteachPlanSchema,
    });
    const sections = res.data.sections.map(normalise);
    if (!sections.some((s) => s.kind === "objective")) sections.unshift({ kind: "objective", title: "Learning objective", minutes: 0, body: res.data.objective, citesMisconceptions: [], questions: [] });
    const problems = checkPlan(sections, ev, inputs);
    if (problems.length === 0) return sections;
    feedback = `\n\nYour previous plan failed these checks; fix them: ${problems.join("; ")}.`;
  }
  throw new AiError("The AI's reteach plan failed the evidence checks twice (citations, timing or exit ticket). Nothing was saved; try again.", "reteach plan", 2);
}

export async function liveRegenerateSection(ev: PlanEvidence, inputs: PlanInputs, plan: PlanSection[], section: PlanSection): Promise<Omit<PlanSection, "id">> {
  const res = await callStructured({
    label: "plan section",
    model: planningModel(),
    system: SYSTEM,
    effort: "medium",
    content: [
      {
        type: "text",
        text: `Evidence from this class:\n${evidenceText(ev)}

Current plan outline: ${plan.map((s) => `${s.kind} (${s.minutes} min): ${s.title}`).join("; ")}.
Rewrite ONLY the "${section.kind}" section ("${section.title}") with a fresh approach, in ${LANG[inputs.language]}, keeping it to ${section.minutes} minutes. Current version:\n${section.body}${
          section.questions.length ? `\nQuestions: ${JSON.stringify(section.questions)}` : ""
        }`,
      },
    ],
    schema: PlanSectionSchema,
  });
  const out = normalise({ ...res.data, kind: section.kind });
  const labels = new Set(ev.misconceptions.map((m) => m.label));
  out.citesMisconceptions = out.citesMisconceptions.filter((c) => labels.has(c));
  if (section.citesMisconceptions.length && out.citesMisconceptions.length === 0) {
    throw new AiError("The regenerated section dropped its misconception citation. Nothing was changed; try again.", "plan section", 1);
  }
  if (section.kind === "exit_ticket" && (out.questions.length < 3 || out.questions.length > 5)) {
    throw new AiError("The regenerated exit ticket did not have 3–5 questions. Nothing was changed; try again.", "plan section", 1);
  }
  out.minutes = section.minutes;
  return out;
}
