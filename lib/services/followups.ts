/**
 * What happens after an assessment becomes final: mastery is computed on read, so here we only
 * evaluate alerts (new flags, updates on open ones) and move flags along when follow-up work
 * (remedial sheets, later tests) shows improvement — always with the evidence.
 */
import crypto from "node:crypto";
import { prisma } from "../db/prisma";
import { parseJson } from "../db/json";
import { audit } from "../audit";
import { config } from "../config";
import { DatasetIndex, isRegular, pct, round } from "../diagnosis/dataset";
import { evaluateSection, updateSummary, type FlagEvidence } from "../diagnosis/flags";
import type { FlagStatus } from "../domain";
import { loadSectionDataset } from "../queries/dataset";

export interface FlagHistoryEntry {
  status: FlagStatus;
  at: string;
  note: string;
  assessmentId?: string;
}

export async function addFlagHistory(flagId: string, status: FlagStatus, note: string, assessmentId?: string) {
  const f = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
  const history = parseJson<FlagHistoryEntry[]>(f.history, []);
  history.push({ status, at: new Date().toISOString(), note, assessmentId });
  await prisma.flag.update({ where: { id: flagId }, data: { status, history: JSON.stringify(history) } });
  await audit("system", "flag.status", "Flag", flagId, { status, note });
}

export async function onAssessmentFinalised(assessmentId: string): Promise<string[]> {
  const a = await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  const ds = await loadSectionDataset(a.sectionId);
  const idx = new DatasetIndex(ds);
  const asm = ds.assessments.find((x) => x.id === assessmentId);
  if (!asm) return [];
  const notes: string[] = [];
  const students = new Map(ds.students.map((s) => [s.id, s]));
  const unresolved = await prisma.flag.findMany({ where: { sectionId: a.sectionId, status: { not: "resolved" } } });

  if (a.type === "remedial" && a.remedialAssignmentId) {
    const r = await prisma.remedialAssignment.findUnique({ where: { id: a.remedialAssignmentId } });
    if (r) {
      await prisma.remedialAssignment.update({ where: { id: r.id }, data: { status: "graded" } });
      const conceptIds = parseJson<string[]>(r.conceptIds, []);
      for (const studentId of parseJson<string[]>(r.studentIds, [])) {
        let got = 0;
        let max = 0;
        for (const q of asm.questions) {
          if (conceptIds.length && !q.conceptIds.some((c) => conceptIds.includes(c))) continue;
          const sub = idx.submission(asm.id, studentId);
          const ans = sub?.answers.find((x) => x.questionId === q.id);
          if (!sub || sub.absent) continue;
          got += ans?.marks ?? 0;
          max += q.maxMarks;
        }
        if (max === 0) continue;
        const score = pct(got, max);
        const flag = unresolved.find((f) => (r.flagId ? f.id === r.flagId : f.studentId === studentId) && f.studentId === studentId);
        if (!flag) continue;
        const ev = parseJson<FlagEvidence | null>(flag.evidence, null);
        const conceptNames = conceptIds.map((c) => ds.concepts.find((x) => x.id === c)?.name ?? c).join(", ");
        const before = ev?.conceptBreakdown.find((c) => conceptIds.includes(c.conceptId));
        const scoreText = `${fmt(got)}/${fmt(max)} (${round(score)}%) on ${conceptNames}`;
        const name = students.get(studentId)?.name ?? "Student";
        if (score >= config.diagnosis.improvingScore) {
          await addFlagHistory(flag.id, "improving", `Remedial sheet: ${scoreText}${before ? `, up from ${before.afterPct}% in ${ev?.trigger.shortTitle}` : ""}.`, asm.id);
          notes.push(`${name}'s alert moved to Improving (${scoreText}).`);
        } else {
          await addFlagHistory(flag.id, flag.status === "open" ? "action_taken" : (flag.status as FlagStatus), `Remedial sheet: ${scoreText} — still below ${config.diagnosis.improvingScore}%.`, asm.id);
          notes.push(`${name}'s remedial sheet scored ${round(score)}%; the alert stays open.`);
        }
      }
    }
    return notes;
  }

  if (!isRegular(asm)) return notes;

  // Follow-up on unresolved flags: did the student recover on this test?
  for (const f of unresolved) {
    const ev = parseJson<FlagEvidence | null>(f.evidence, null);
    if (!ev || ev.trigger.id === asm.id || ev.trigger.date >= asm.date) continue;
    const score = idx.scorePct(asm.id, f.studentId);
    const baseline = ev.scores?.previousAverage ?? ev.lastScore?.pct;
    if (score === null || baseline === undefined) continue;
    const name = students.get(f.studentId)?.name ?? "Student";
    if (score >= baseline - config.diagnosis.resolveWithin) {
      const next: FlagStatus = f.status === "improving" ? "resolved" : "improving";
      await addFlagHistory(f.id, next, `${asm.shortTitle}: ${round(score)}%, within ${config.diagnosis.resolveWithin} points of the ${round(baseline)}% baseline.`, asm.id);
      notes.push(`${name}'s alert moved to ${next === "resolved" ? "Resolved" : "Improving"} after ${asm.shortTitle}.`);
    }
  }

  // New alerts, or updates on ones that are still open.
  const results = evaluateSection(ds);
  const fresh = await prisma.flag.findMany({ where: { sectionId: a.sectionId, status: { not: "resolved" } } });
  for (const r of results) {
    const existing = fresh.find((f) => f.studentId === r.studentId);
    const name = students.get(r.studentId)?.name ?? "Student";
    if (existing) {
      const ev = parseJson<FlagEvidence | null>(existing.evidence, null);
      if (ev && ev.trigger.id !== asm.id && !ev.updates.some((u) => u.assessmentId === asm.id)) {
        ev.updates.push({ assessmentId: asm.id, title: asm.title, date: asm.date, summary: updateSummary(r) });
        await prisma.flag.update({ where: { id: existing.id }, data: { evidence: JSON.stringify(ev) } });
      }
      continue;
    }
    const id = `flag_${crypto.randomBytes(5).toString("hex")}`;
    await prisma.flag.create({
      data: {
        id,
        studentId: r.studentId,
        sectionId: a.sectionId,
        type: r.type,
        evidence: JSON.stringify(r.evidence),
        status: "open",
        triggerAssessmentId: asm.id,
        history: JSON.stringify([{ status: "open", at: new Date().toISOString(), note: `Flagged automatically when ${asm.title} was finalised.` }]),
      },
    });
    await audit("system", "flag.created", "Flag", id, { type: r.type, studentId: r.studentId });
    notes.push(`New alert: ${name} (${r.type.replace("_", " ")}).`);
  }
  return notes;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
