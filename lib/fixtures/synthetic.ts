/**
 * Synthetic sample sheets for ANY assessment in mock mode.
 *
 * The bundled handwriting samples only cover the seeded stories (8B Weekly Test 4, the transposing exit
 * ticket and Rohan's remedial sheet). For every other assessment — homework, new tests, other exit
 * tickets, remedial sheets for other students — "Use the sample answer sheets" generates a practice sheet
 * per student instead: what each student "wrote" is derived deterministically from the question's answer
 * key and the student's own track record, rendered as a handwritten SVG page, and graded by the mock AI.
 *
 * Everything here is pure and deterministic (same assessment + student → same sheet, same grades).
 */
import type { Crop, MistakeType, RubricStep } from "../domain";
import { GENERIC_MISCONCEPTION, MISCONCEPTIONS } from "./concepts";
import { createRng, hashString, type Rng } from "./rng";

export const SYNTHETIC_PREFIX = "SYN:";
export const SYNTHETIC_KEY_PREFIX = "synthetic/";
export const QUESTIONS_PER_PAGE = 5;
export const PAGE = { width: 850, height: 1202 };

export interface SyntheticRef {
  assessmentId: string;
  studentId: string;
  /** 0–1: the student's average on graded work so far; drives how well the synthetic answers go. */
  ability: number;
}

export function syntheticSheetRef(r: SyntheticRef): string {
  return `${SYNTHETIC_PREFIX}${r.assessmentId}:${r.studentId}:${Math.round(Math.max(0, Math.min(1, r.ability)) * 100)}`;
}

export function parseSyntheticRef(ref: string | null | undefined): SyntheticRef | null {
  if (!ref || !ref.startsWith(SYNTHETIC_PREFIX)) return null;
  const [assessmentId, studentId, ability] = ref.slice(SYNTHETIC_PREFIX.length).split(":");
  if (!assessmentId || !studentId) return null;
  const a = Number(ability);
  return { assessmentId, studentId, ability: Number.isFinite(a) ? a / 100 : 0.65 };
}

export function isSyntheticKey(key: string) {
  return key.startsWith(SYNTHETIC_KEY_PREFIX);
}

export function syntheticPageKeys(submissionId: string, questionCount: number): string[] {
  const pages = Math.max(1, Math.ceil(questionCount / QUESTIONS_PER_PAGE));
  return Array.from({ length: pages }, (_, i) => `${SYNTHETIC_KEY_PREFIX}${submissionId}/p${i + 1}.svg`);
}

/** `synthetic/<submissionId>/p<n>.svg` → { submissionId, page (0-based) } */
export function parseSyntheticKey(key: string): { submissionId: string; page: number } | null {
  const m = key.match(/^synthetic\/([A-Za-z0-9_-]+)\/p(\d+)\.svg$/);
  return m ? { submissionId: m[1], page: Number(m[2]) - 1 } : null;
}

/** A small share of students is absent on any given day (never in tiny groups such as a remedial). */
export function syntheticAbsent(assessmentId: string, studentId: string, rosterSize: number) {
  if (rosterSize < 10) return false;
  return createRng(hashString(`syn-absent:${assessmentId}:${studentId}`)).chance(0.04);
}

export interface SyntheticQuestion {
  number: number;
  text: string;
  rubric: RubricStep[];
  answerKey: string;
  conceptIds: string[];
}

export interface SyntheticAnswer {
  questionNumber: number;
  pageIndex: number;
  crop: Crop;
  lines: string[];
  crossedOut: string[];
  awards: number[];
  passBAwards: number[];
  mistakeType: MistakeType;
  misconception: string | null;
  legibility: number;
  uncertainSpans: string[];
  selfConfidence: number;
  keyAmbiguity: number;
  reasoning: string;
}

function slot(index: number, total: number): { page: number; crop: Crop } {
  const page = Math.floor(index / QUESTIONS_PER_PAGE);
  const onPage = Math.min(QUESTIONS_PER_PAGE, total - page * QUESTIONS_PER_PAGE);
  const i = index % QUESTIONS_PER_PAGE;
  const top = page === 0 ? 0.14 : 0.04;
  const h = (0.98 - top) / onPage;
  return { page, crop: { x: 0.05, y: top + i * h, w: 0.9, h } };
}

function keyLines(answerKey: string): string[] {
  return answerKey
    .split(/\n|;\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** Changes the last number in a line, the way a slip or a sign error would. */
function perturb(line: string, rng: Rng, signError: boolean): string {
  const nums = [...line.matchAll(/[−-]?\d+(?:\.\d+)?/g)];
  if (nums.length === 0) return `${line} ?`;
  const last = nums[nums.length - 1];
  const raw = last[0].replace("−", "-");
  const v = Number(raw);
  const next = signError && v !== 0 ? -v : v + (rng.chance(0.5) ? 1 : -1) * rng.int(1, 3);
  const shown = String(Math.round(next * 100) / 100).replace("-", "−");
  return line.slice(0, last.index) + shown + line.slice((last.index ?? 0) + last[0].length);
}

function stepAwards(rubric: RubricStep[], correctSteps: number): number[] {
  return rubric.map((r, i) => (i < correctSteps ? r.marks : 0));
}

/** What the student wrote and what the two mock grading passes give, per question. */
export function syntheticAnswers(ref: SyntheticRef, questions: SyntheticQuestion[]): SyntheticAnswer[] {
  const sorted = [...questions].sort((a, b) => a.number - b.number);
  return sorted.map((q, index) => {
    const rng = createRng(hashString(`syn:${ref.assessmentId}:${ref.studentId}:${q.number}`));
    const { page, crop } = slot(index, sorted.length);
    const rubric = q.rubric.length ? q.rubric : [{ step: "Correct answer", marks: 1 }];
    const n = rubric.length;
    const ability = Math.max(0.15, Math.min(0.97, ref.ability));
    const unattempted = rng.chance(0.1 * (1 - ability));
    const target = Math.max(0, Math.min(1, ability + rng.noise(0.22)));
    const correct = unattempted ? 0 : Math.max(0, Math.min(n, Math.round(target * n + 0.15)));
    const key = keyLines(q.answerKey);
    const conceptId = q.conceptIds[0];
    const known = conceptId ? (MISCONCEPTIONS[conceptId] ?? []) : [];

    let mistakeType: MistakeType = "none";
    let misconception: string | null = null;
    let lines: string[];
    const crossedOut: string[] = [];
    if (unattempted) {
      mistakeType = "unattempted";
      lines = [];
    } else if (correct === n) {
      lines = key.length ? key : ["Answer written in full"];
    } else {
      const named = known.length > 0 && rng.chance(0.65) ? rng.pick(known) : null;
      if (named) {
        mistakeType = named.mistakeType;
        misconception = named.label;
      } else if (correct >= n - 1 && n > 1) {
        mistakeType = "calculation";
        misconception = GENERIC_MISCONCEPTION.calculation;
      } else if (correct > 0) {
        mistakeType = "incomplete";
        misconception = GENERIC_MISCONCEPTION.incomplete;
      } else {
        mistakeType = "procedural";
      }
      if (key.length === 0) {
        lines = [correct > 0 ? "Partial working shown" : "Working does not lead to the answer"];
      } else {
        const keep = Math.max(0, Math.min(key.length - 1, Math.round((key.length * correct) / n)));
        const wrong = perturb(key[keep] ?? key[key.length - 1], rng, /sign/i.test(misconception ?? ""));
        lines = mistakeType === "incomplete" ? key.slice(0, Math.max(1, keep)) : [...key.slice(0, keep), wrong];
        if (rng.chance(0.12)) crossedOut.push(perturb(key[0], rng, false));
      }
    }

    // Most answers are clean; a few are hard to read or split the two passes, so the review queue has work.
    const roll = rng.next();
    let legibility = rng.range(0.91, 0.98);
    const uncertainSpans: string[] = [];
    let passBCorrect = correct;
    if (!unattempted && roll < 0.025) {
      legibility = rng.range(0.55, 0.66);
      uncertainSpans.push(`"${(lines[lines.length - 1] ?? "").slice(0, 24)}" is smudged`);
    } else if (!unattempted && roll < 0.06) {
      legibility = rng.range(0.78, 0.86);
    } else if (!unattempted && roll < 0.08 && n > 1) {
      passBCorrect = correct === n ? n - 1 : correct + 1;
    }
    const awards = stepAwards(rubric, correct);
    const marks = awards.reduce((s, v) => s + v, 0);
    const max = rubric.reduce((s, r) => s + r.marks, 0);
    const reasoning = unattempted
      ? "No answer written for this question."
      : correct === n
        ? `Every rubric step is shown and the final answer matches the key (${marks}/${max}).`
        : `Steps ${correct > 0 ? `1–${correct}` : "none"} match the key; ${misconception ? misconception.toLowerCase() : "the working goes wrong after that"} (${marks}/${max}).`;
    return {
      questionNumber: q.number,
      pageIndex: page,
      crop,
      lines,
      crossedOut,
      awards,
      passBAwards: stepAwards(rubric, passBCorrect),
      mistakeType,
      misconception,
      legibility: Math.round(legibility * 100) / 100,
      uncertainSpans,
      selfConfidence: Math.round(rng.range(0.82, 0.95) * 100) / 100,
      keyAmbiguity: 0,
      reasoning: `Mock AI (sample sheet): ${reasoning}`,
    };
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Renders one page of a synthetic sheet as a handwritten SVG on ruled paper. */
export function renderSyntheticPage(opts: {
  ref: SyntheticRef;
  studentName: string;
  rollNumber: number;
  sectionName: string;
  title: string;
  questions: SyntheticQuestion[];
  page: number;
  fontDataUrl: string | null;
}): string {
  const { width: W, height: H } = PAGE;
  const answers = syntheticAnswers(opts.ref, opts.questions).filter((a) => a.pageIndex === opts.page);
  const rng = createRng(hashString(`syn-style:${opts.ref.studentId}`));
  const ink = rng.pick(["#1d3a8a", "#22305e", "#1f2937", "#0f3b66"]);
  const size = Math.round(rng.range(25, 29));
  const tilt = rng.range(-0.6, 0.6).toFixed(2);
  const font = opts.fontDataUrl ? `@font-face{font-family:Hand;src:url(${opts.fontDataUrl}) format("woff2");}` : "";
  const rules: string[] = [];
  for (let y = 96; y < H - 20; y += 34) rules.push(`<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#b9cbe6" stroke-width="1"/>`);
  const header =
    opts.page === 0
      ? `<text x="60" y="60" class="h">Name: ${esc(opts.studentName)}</text><text x="${W - 320}" y="60" class="h">Roll: ${opts.rollNumber} · Class ${esc(opts.sectionName)}</text>`
      : `<text x="${W - 160}" y="40" class="h" font-size="20">p. ${opts.page + 1}</text>`;
  const body = answers
    .map((a) => {
      const top = a.crop.y * H;
      const x = a.crop.x * W + 14;
      const rows: string[] = [`<text x="${x}" y="${top + 36}" class="h"><tspan font-weight="700">Q${a.questionNumber}.</tspan></text>`];
      let y = top + 36;
      for (const c of a.crossedOut) {
        rows.push(`<text x="${x + 70}" y="${y}" class="h">${esc(c)}</text>`);
        rows.push(`<line x1="${x + 66}" x2="${x + 80 + c.length * size * 0.42}" y1="${y - size * 0.3}" y2="${y - size * 0.35}" stroke="${ink}" stroke-width="2"/>`);
        y += 34;
      }
      if (a.lines.length === 0) rows.push(`<text x="${x + 70}" y="${y}" class="h" opacity="0.35">—</text>`);
      for (const line of a.lines) {
        rows.push(`<text x="${x + 70}" y="${y}" class="h" ${a.legibility < 0.7 ? 'opacity="0.55" filter="url(#smudge)"' : ""}>${esc(line)}</text>`);
        y += 34;
      }
      return rows.join("");
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${font}.h{font-family:Hand,"Kalam","Comic Sans MS",cursive;font-size:${size}px;fill:${ink};}</style>
<defs><filter id="smudge"><feGaussianBlur stdDeviation="1.1"/></filter></defs>
<rect width="${W}" height="${H}" fill="#fbfaf6"/>
${rules.join("")}
<line x1="44" x2="44" y1="0" y2="${H}" stroke="#e8a3a3" stroke-width="1.5"/>
<g transform="rotate(${tilt} ${W / 2} ${H / 2})">${header}${body}</g>
<text x="${W - 16}" y="${H - 10}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#9a9a9a">Practice sheet · ${esc(opts.title).slice(0, 60)}</text>
</svg>`;
}
