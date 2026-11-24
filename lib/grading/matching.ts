/**
 * Proposes which student an answer sheet belongs to, from the name and roll number read off page 1.
 * The teacher confirms or fixes every low-confidence proposal before grading.
 */
export interface RosterEntry {
  id: string;
  name: string;
  rollNumber: number;
}

export interface MatchProposal {
  studentId: string | null;
  confidence: number;
  reason: string;
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-zऀ-ॿ ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Similarity between a written name and a roster name, 0..1. Handles initials ("Sneha I."). */
export function nameSimilarity(written: string, roster: string): number {
  const a = normalise(written).split(" ").filter(Boolean);
  const b = normalise(roster).split(" ").filter(Boolean);
  if (a.length === 0 || b.length === 0) return 0;
  let score = 0;
  for (const part of a) {
    if (b.includes(part)) score += 1;
    else if (part.length === 1 && b.some((x) => x.startsWith(part))) score += 0.6;
    else if (b.some((x) => x.length > 3 && (x.startsWith(part) || part.startsWith(x)))) score += 0.7;
  }
  return score / Math.max(a.length, b.length);
}

export function proposeMatch(detected: { name: string | null; roll: number | null }, roster: RosterEntry[]): MatchProposal {
  const byRoll = detected.roll !== null ? roster.find((s) => s.rollNumber === detected.roll) : undefined;
  const ranked = detected.name
    ? roster.map((s) => ({ s, sim: nameSimilarity(detected.name!, s.name) })).sort((x, y) => y.sim - x.sim)
    : [];
  const bestName = ranked[0];
  const secondName = ranked[1];

  if (byRoll) {
    const sim = detected.name ? nameSimilarity(detected.name, byRoll.name) : 0;
    if (sim >= 0.8) return { studentId: byRoll.id, confidence: 0.99, reason: "Name and roll number match" };
    if (!detected.name) return { studentId: byRoll.id, confidence: 0.8, reason: "Matched by roll number only (name unreadable)" };
    if (bestName && bestName.sim >= 0.8 && bestName.s.id !== byRoll.id) {
      return { studentId: bestName.s.id, confidence: 0.6, reason: `Roll ${detected.roll} belongs to ${byRoll.name}, but the name matches ${bestName.s.name}` };
    }
    return { studentId: byRoll.id, confidence: 0.55, reason: "Roll number matches but the name does not" };
  }
  if (bestName && bestName.sim >= 0.5) {
    const ambiguous = secondName && secondName.sim >= bestName.sim - 0.05;
    return {
      studentId: bestName.s.id,
      confidence: ambiguous ? 0.5 : bestName.sim >= 0.95 ? 0.85 : 0.72,
      reason: detected.roll === null ? "Roll number unreadable; matched by name" : `Roll ${detected.roll} not in this section; matched by name`,
    };
  }
  return { studentId: null, confidence: 0, reason: "Could not read a name or roll number" };
}

export const MATCH_REVIEW_THRESHOLD = 0.9;
