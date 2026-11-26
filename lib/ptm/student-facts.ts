/** Pure fact extraction for one student (no database): shared by PTM/profile pages and the scripted walkthrough. */
import { config } from "../config";
import { DatasetIndex, isRegular, round, type SectionDataset } from "../diagnosis/dataset";
import { coveredConceptIds, studentConceptMastery, studentScoreSeries } from "../diagnosis/mastery";
import type { FlagEvidence } from "../diagnosis/flags";
import type { FlagHistoryEntry } from "../services/followups";

export interface FactSource {
  assessmentId: string;
  label: string; // e.g. "PT1 Q7"
  questionNumber?: number;
}

export interface Fact {
  id: string;
  kind: "score" | "trend" | "strength" | "focus" | "flag" | "action" | "result" | "pending" | "class";
  text: string;
  source: FactSource | null;
  data: Record<string, unknown>;
}

export interface StudentFacts {
  student: { id: string; name: string; firstName: string; rollNumber: number; section: string; sectionId: string };
  facts: Fact[];
  trend: { label: string; title: string; value: number | null; compare: number | null }[];
  strengths: Fact[];
  focus: Fact[];
  term: Fact[];
  pending: Fact[];
}

export interface StudentFactsInput {
  student: { id: string; name: string; rollNumber: number; section: string; sectionId: string };
  ds: SectionDataset;
  /** The student's alerts, oldest first. */
  flags: { id: string; type: string; status: string; evidence: FlagEvidence | null; history: FlagHistoryEntry[] }[];
  /** Remedial sheets assigned to the student and not yet graded. */
  pendingRemedials: { id: string; title: string; questionCount: number }[];
}

/** `studentFacts` over already-loaded data (pure). */
export function studentFactsFrom({ student: st, ds, flags, pendingRemedials }: StudentFactsInput): StudentFacts {
  const studentId = st.id;
  const idx = new DatasetIndex(ds);
  const facts: Fact[] = [];
  const first = st.name.split(" ")[0];
  const short = (aid: string) => ds.assessments.find((a) => a.id === aid)?.shortTitle ?? "";

  // Scores per regular test, plus the class average for context.
  const series = studentScoreSeries(idx, studentId, { regularOnly: true });
  const trend = series.map((s) => {
    const a = ds.assessments.find((x) => x.id === s.assessmentId)!;
    const scores = ds.students.map((x) => idx.scorePct(a.id, x.id)).filter((v): v is number => v !== null);
    const classAvg = scores.length ? round(scores.reduce((t, v) => t + v, 0) / scores.length) : null;
    if (s.pct !== null) {
      facts.push({
        id: `score:${s.assessmentId}`,
        kind: "score",
        text: `${first} scored ${fmt(s.got)}/${fmt(s.max)} (${round(s.pct)}%) in ${s.title}; class average ${classAvg}%.`,
        source: { assessmentId: s.assessmentId, label: s.shortTitle },
        data: { pct: round(s.pct), classAvg, title: s.title },
      });
    } else {
      facts.push({ id: `absent:${s.assessmentId}`, kind: "score", text: `${first} did not submit ${s.title}.`, source: { assessmentId: s.assessmentId, label: s.shortTitle }, data: { absent: true, title: s.title } });
    }
    return { label: s.shortTitle, title: s.title, value: s.pct === null ? null : round(s.pct), compare: classAvg };
  });

  // Concept mastery → strengths and focus areas, each sourced to the latest test that covered it.
  for (const cid of coveredConceptIds(ds)) {
    const w = studentConceptMastery(idx, studentId, cid);
    // Only speak about concepts with enough evidence behind them.
    if (!w || w.max < config.diagnosis.minConceptMarks) continue;
    const c = ds.concepts.find((x) => x.id === cid)!;
    const latestId = w.assessmentIds[0];
    const pct = round(w.pct);
    if (pct >= config.diagnosis.strengthScore) {
      facts.push({ id: `strength:${cid}`, kind: "strength", text: `${c.name}: ${pct}%.`, source: { assessmentId: latestId, label: short(latestId) }, data: { concept: c.name, chapter: c.chapter, pct } });
    } else if (pct < config.diagnosis.weakScore) {
      // The clearest example of what went wrong on this concept.
      let example: { q: number; misconception: string | null; written: string; assessmentId: string } | null = null;
      for (const aid of w.assessmentIds) {
        for (const { q, ans } of idx.answersOnConcept(aid, studentId, cid)) {
          if (ans.marks < ans.maxMarks && (!example || (!example.misconception && ans.misconception))) {
            example = { q: q.number, misconception: ans.misconception, written: ans.transcription.split("\n")[0] ?? "", assessmentId: aid };
          }
        }
      }
      facts.push({
        id: `focus:${cid}`,
        kind: "focus",
        text: `${c.name}: ${pct}%${example?.misconception ? ` — ${example.misconception.toLowerCase()}` : example ? " — questions left blank or unfinished" : ""}.`,
        source: example ? { assessmentId: example.assessmentId, label: `${short(example.assessmentId)} Q${example.q}`, questionNumber: example.q } : { assessmentId: latestId, label: short(latestId) },
        data: { concept: c.name, chapter: c.chapter, pct, misconception: example?.misconception ?? null, written: example?.written ?? "", blank: !!example && !example.misconception },
      });
    }
  }

  // Alerts, actions and results this term.
  for (const f of flags) {
    const ev = f.evidence;
    if (!ev) continue;
    facts.push({
      id: `flag:${f.id}`,
      kind: "flag",
      text: ev.summary,
      source: { assessmentId: ev.trigger.id, label: ev.trigger.shortTitle },
      data: {
        type: f.type,
        status: f.status,
        trigger: ev.trigger.shortTitle,
        prevAvg: ev.scores ? Math.round(ev.scores.previousAverage) : null,
        latestPct: ev.scores ? Math.round(ev.scores.latest.pct) : null,
        missedCount: ev.missed?.missedCount ?? null,
        windowSize: ev.missed?.window.length ?? null,
        regression: ev.regressions[0] ?? null,
      },
    });
    for (const h of f.history.slice(1)) {
      facts.push({ id: `action:${f.id}:${h.at}`, kind: h.status === "improving" || h.status === "resolved" ? "result" : "action", text: h.note, source: h.assessmentId ? { assessmentId: h.assessmentId, label: short(h.assessmentId) || "Remedial" } : null, data: { status: h.status } });
    }
  }
  for (const r of pendingRemedials) facts.push({ id: `pending:${r.id}`, kind: "pending", text: `${r.title.replace(/ — [^—]+$/, "")} (${r.questionCount} questions) is pending.`, source: null, data: { title: r.title } });

  // Class-level reteach the student took part in (exit tickets).
  for (const a of ds.assessments.filter((x) => x.type === "exit_ticket")) {
    const m = idx.marks(a.id, studentId);
    if (!m) continue;
    facts.push({ id: `exit:${a.id}`, kind: "class", text: `After a class reteach, ${first} scored ${fmt(m.got)}/${fmt(m.max)} on the ${a.title.toLowerCase()}.`, source: { assessmentId: a.id, label: "Exit ticket" }, data: { pct: round((m.got / m.max) * 100), got: m.got, max: m.max } });
  }

  const byPct = (dir: 1 | -1) => (a: Fact, b: Fact) => dir * (((a.data.pct as number) ?? 0) - ((b.data.pct as number) ?? 0));
  const strengths = facts.filter((f) => f.kind === "strength").sort(byPct(-1)).slice(0, 3);
  // Focus areas with a named misconception first (most actionable), then the lowest scores.
  const focus = facts
    .filter((f) => f.kind === "focus")
    .sort((a, b) => Number(!!b.data.misconception) - Number(!!a.data.misconception) || byPct(1)(a, b))
    .slice(0, 3);
  const term = facts.filter((f) => ["flag", "action", "result", "class"].includes(f.kind));
  const pending = facts.filter((f) => f.kind === "pending");
  void isRegular;
  return {
    student: { id: st.id, name: st.name, firstName: first, rollNumber: st.rollNumber, section: st.section, sectionId: st.sectionId },
    facts,
    trend,
    strengths,
    focus,
    term,
    pending,
  };
}

function fmt(n: number | null) {
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
