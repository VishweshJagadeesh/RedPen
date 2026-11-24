"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GradingProgress, type GradingProgressView } from "@/components/grading/GradingProgress";
import { api } from "@/lib/client/api";

/** Drives grading from the browser: one short request per sheet, so it works on serverless hosts. */
export function GradingProgressContainer({ assessmentId, initial, autoStart, mode }: { assessmentId: string; initial: GradingProgressView; autoStart: boolean; mode: "live" | "mock" }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const active = useRef(false);

  const loop = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    stop.current = false;
    setRunning(true);
    setError(null);
    try {
      for (;;) {
        if (stop.current) break;
        const p = await api<GradingProgressView>(`/api/assessments/${assessmentId}/grade`, { method: "POST" });
        setProgress(p);
        if (p.done) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      active.current = false;
      setRunning(false);
      router.refresh();
    }
  }, [assessmentId, router]);

  useEffect(() => {
    // Safe under React strict mode: a remount resumes the running loop instead of starting a second one.
    stop.current = false;
    if (autoStart && !initial.done) void loop();
    return () => {
      stop.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GradingProgress
      progress={progress}
      running={running}
      error={error}
      mode={mode}
      reviewHref={`/assessments/${assessmentId}/review`}
      onStart={() => void loop()}
      onPause={() => {
        stop.current = true;
      }}
      onRetry={async (id) => {
        try {
          await api(`/api/submissions/${id}/retry`, { method: "POST" });
          void loop();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }}
    />
  );
}
