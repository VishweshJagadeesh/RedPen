"use client";
import Link from "next/link";
import { ArrowRight, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Progress } from "@/components/ui/misc";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import type { ConfidenceBand } from "@/lib/domain";
import { formatMarks } from "@/lib/format";

export interface GradingProgressView {
  totalSheets: number;
  gradedSheets: number;
  totalAnswers: number;
  answersGraded: number;
  bands: Record<ConfidenceBand, number>;
  sheetBands: Record<ConfidenceBand, number>;
  recent: { submissionId: string; studentName: string; band: ConfidenceBand; marks: number; maxMarks: number }[];
  errorSheets: { id: string; studentName: string | null; error: string }[];
  done: boolean;
}

export interface GradingProgressProps {
  progress: GradingProgressView;
  running: boolean;
  error: string | null;
  reviewHref: string;
  mode: "live" | "mock";
  onStart: () => void;
  onPause: () => void;
  onRetry: (submissionId: string) => void;
}

const BANDS: ConfidenceBand[] = ["high", "medium", "low"];

/** Live count of answers graded, with counts per confidence band (answers and whole sheets). */
export function GradingProgress({ progress, running, error, reviewHref, mode, onStart, onPause, onRetry }: GradingProgressProps) {
  const pct = progress.totalAnswers ? (progress.answersGraded / progress.totalAnswers) * 100 : 0;
  const needsReview = progress.bands.low + progress.bands.medium;
  return (
    <div className="space-y-6" data-demo-id="grading-progress">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {progress.done ? "Grading complete" : running ? "Grading answer sheets…" : "Ready to grade"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-3xl font-semibold tabular-nums" data-demo-id="answers-graded-count">
                {progress.answersGraded}
                <span className="text-lg text-muted-foreground"> / {progress.totalAnswers} answers</span>
              </div>
              <div className="text-sm text-muted-foreground" data-demo-id="sheets-graded-count">
                {progress.gradedSheets} of {progress.totalSheets} sheets
              </div>
            </div>
            <Progress value={pct} label="Answers graded" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {BANDS.map((b) => (
              <div key={b} className="rounded-lg border p-3" data-demo-id={`band-count-${b}`}>
                <ConfidenceBadge band={b} />
                <div className="mt-2 text-2xl font-semibold tabular-nums">{progress.sheetBands[b]}</div>
                <div className="text-xs text-muted-foreground">
                  sheets · {progress.bands[b]} answers
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            A sheet takes the band of its least certain answer. Every answer gets two independent grading passes; disagreement, handwriting legibility,
            transcription doubts and key ambiguity lower confidence.{mode === "mock" && " Mock AI: results come from the sample fixtures."}
          </p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            {!progress.done &&
              (running ? (
                <Button variant="outline" onClick={onPause} data-demo-id="pause-grading">
                  <Pause /> Pause
                </Button>
              ) : (
                <Button onClick={onStart} data-demo-id="start-grading">
                  <Play /> {progress.gradedSheets > 0 ? "Resume grading" : "Start grading"}
                </Button>
              ))}
            {(progress.done || progress.gradedSheets > 0) && (
              <Button asChild variant={progress.done ? "default" : "outline"} data-demo-id="go-to-review">
                <Link href={reviewHref}>
                  Review {needsReview} answer{needsReview === 1 ? "" : "s"} that need you <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {progress.errorSheets.length > 0 && (
        <Alert tone="error" className="space-y-2">
          <div className="font-medium">{progress.errorSheets.length} sheet(s) could not be graded</div>
          {progress.errorSheets.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="flex-1">
                {e.studentName ?? "Sheet"}: {e.error}
              </span>
              <Button size="sm" variant="outline" onClick={() => onRetry(e.id)} data-demo-id={`retry-sheet-${e.id}`}>
                <RotateCcw /> Retry
              </Button>
            </div>
          ))}
        </Alert>
      )}

      {progress.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recently graded</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {progress.recent.map((r) => (
                <li key={r.submissionId} className="flex items-center gap-3 py-2">
                  <span className="flex-1">{r.studentName}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMarks(r.marks)}/{formatMarks(r.maxMarks)}
                  </span>
                  <ConfidenceBadge band={r.band} showScore={false} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
