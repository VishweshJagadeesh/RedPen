/**
 * Tunable thresholds. Keep every number the evals or the product brief mention here so it can be
 * tuned in one place (and overridden by env vars where useful).
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  confidence: {
    /** score >= high → High band */
    high: num("CONFIDENCE_HIGH", 0.85),
    /** score >= medium → Medium band, below → Low band */
    medium: num("CONFIDENCE_MEDIUM", 0.6),
    /** Score cap when an answer contains instructions to the grader. */
    injectionCap: 0.35,
  },
  diagnosis: {
    /** A concept is class-wide weak when at least this share of students scored under `weakScore`. */
    classWeakShare: num("CLASS_WEAK_SHARE", 0.4),
    /** Per-student concept score (%) below which the student counts as weak on that concept. */
    weakScore: num("WEAK_SCORE", 50),
    /** Students at or above this concept score can mentor peers. */
    mentorScore: 60,
    maxLearnersPerMentor: 2,
    /** sudden_drop: latest score at least this many points below own average of previous N. */
    suddenDropPoints: num("SUDDEN_DROP_POINTS", 20),
    suddenDropWindow: 3,
    /** missed_submissions: at least `missedCount` missing in the last `missedWindow` assessments. */
    missedCount: 2,
    missedWindow: 4,
    /** concept_regression: concept mastery falls by at least this many points. */
    regressionPoints: num("REGRESSION_POINTS", 30),
    /** Ignore concept signals backed by fewer marks than this (too noisy). */
    minConceptMarks: 4,
    /** Remedial / follow-up score (%) on target concepts that moves a flag to "improving". */
    improvingScore: 70,
    /** A flag resolves when a later regular test is within this many points of the baseline. */
    resolveWithin: 10,
    /** Strengths / focus areas thresholds for profiles. */
    strengthScore: 75,
  },
  planner: {
    defaultPeriodMinutes: 40,
  },
  grading: {
    /** Answer sheets per grading request (keeps serverless requests short). */
    sheetsPerBatch: 1,
    /** Artificial latency per sheet in mock mode so the progress screen is visible. */
    mockLatencyMs: num("MOCK_LATENCY_MS", 120),
  },
} as const;

export type AppConfig = typeof config;
