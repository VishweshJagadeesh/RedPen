"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ReviewQueue } from "@/components/grading/ReviewQueue";
import { api } from "@/lib/client/api";
import type { ReviewQueueData } from "@/lib/queries/review";
import type { ReviewItem } from "@/lib/queries/review";

export function ReviewQueueContainer({ data }: { data: ReviewQueueData }) {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>(data.items);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null);
  // Writes run one after another; finalise waits for every queued write to land first.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);
  useEffect(() => {
    if (inFlight.current === 0) setItems(data.items);
  }, [data.items]);

  const patch = (id: string, fn: (i: ReviewItem) => ReviewItem) => setItems((xs) => xs.map((x) => (x.id === id ? fn(x) : x)));

  function act(fn: () => Promise<unknown>, optimistic?: () => void): Promise<void> {
    setError(null);
    optimistic?.();
    inFlight.current++;
    const run = queue.current.then(fn).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    queue.current = run.finally(() => {
      inFlight.current--;
      if (inFlight.current === 0) router.refresh();
    });
    return queue.current.then(() => undefined);
  }

  const pendingHigh = items.filter((i) => i.status === "pending_review" && !i.needsRescan && i.band === "high").length;

  return (
    <ReviewQueue
      items={items}
      pendingHigh={pendingHigh}
      ungradedSheets={data.ungradedSheets}
      isFinal={data.assessment.status === "final"}
      busy={busy}
      error={error}
      finaliseNotes={notes}
      resultsHref={`/assessments/${data.assessment.id}/results`}
      onAccept={(id) =>
        act(
          () => api(`/api/grades/${id}`, { method: "POST", json: { action: "accept" } }),
          () => patch(id, (i) => ({ ...i, status: "accepted", teacherMarks: null, teacherSteps: null, finalMarks: i.awardedMarks })),
        )
      }
      onOverride={(id, awards, note) =>
        act(
          () => api(`/api/grades/${id}`, { method: "POST", json: { action: "override", awards, note } }),
          () =>
            patch(id, (i) => {
              const total = awards.reduce((s, a) => s + a, 0);
              const same = total === i.awardedMarks && awards.every((a, k) => a === i.steps[k]?.awarded);
              return {
                ...i,
                status: same ? "accepted" : "overridden",
                teacherMarks: same ? null : total,
                teacherSteps: same ? null : i.steps.map((s, k) => ({ ...s, awarded: awards[k] })),
                finalMarks: total,
                teacherNote: note || null,
              };
            }),
        )
      }
      onIllegible={(id) => act(() => api(`/api/grades/${id}`, { method: "POST", json: { action: "illegible", note: null } }))}
      onNeedsRescan={(id) => act(() => api(`/api/grades/${id}`, { method: "POST", json: { action: "rescan", note: null } }), () => patch(id, (i) => ({ ...i, needsRescan: true, status: "pending_review" })))}
      onUploadRescan={async (submissionId, files) => {
        setBusy(true);
        try {
          const form = new FormData();
          files.forEach((f) => form.append("file", f));
          await api(`/api/submissions/${submissionId}/rescan`, { method: "POST", body: form });
          router.push(`/assessments/${data.assessment.id}/grade?start=1`);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setBusy(false);
        }
      }}
      onAcceptAllHigh={async () => {
        setBusy(true);
        await act(
          () => api(`/api/assessments/${data.assessment.id}/accept-high`, { method: "POST" }),
          () => setItems((xs) => xs.map((x) => (x.status === "pending_review" && !x.needsRescan && x.band === "high" ? { ...x, status: "accepted", finalMarks: x.awardedMarks } : x))),
        );
        setBusy(false);
      }}
      onFinalise={async () => {
        setBusy(true);
        setError(null);
        try {
          await queue.current;
          const res = await api<{ followups: string[] }>(`/api/assessments/${data.assessment.id}/finalise`, { method: "POST" });
          setNotes(res.followups ?? []);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
    />
  );
}
