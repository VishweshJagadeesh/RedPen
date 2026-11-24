"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { LoadingState } from "@/components/shared/States";
import { QuestionConfirmTable, type QuestionDraftView } from "@/components/grading/QuestionConfirmTable";
import { SheetMatcher } from "@/components/grading/SheetMatcher";
import { SheetUploader } from "@/components/grading/SheetUploader";
import { UploadWizard, type WizardStep } from "@/components/grading/UploadWizard";
import { api } from "@/lib/client/api";
import { downscaleImage } from "@/lib/client/image";
import type { AssessmentWizardData } from "@/lib/queries/assessments";

function stepFor(d: AssessmentWizardData): WizardStep {
  if (d.status === "draft") return "questions";
  if (d.status === "questions_ready") return d.sheets.length ? "match" : "sheets";
  if (d.status === "sheets_uploaded") return "match";
  return "grade";
}

export function AssessmentWizardContainer({ data }: { data: AssessmentWizardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const autoParsed = useRef(false);
  const step = stepFor(data);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const parse = () => run(() => api(`/api/assessments/${data.id}/parse`, { method: "POST" }));

  useEffect(() => {
    if (step === "questions" && data.questions.length === 0 && !autoParsed.current) {
      autoParsed.current = true;
      void parse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data.questions.length]);

  async function uploadPages(files: File[]) {
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.set("file", await downscaleImage(files[i]));
        await api(`/api/assessments/${data.id}/pages`, { method: "POST", body: form });
        setProgress({ done: i + 1, total: files.length });
        if ((i + 1) % 5 === 0) router.refresh();
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const paperLinks = (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <div className="mb-2 font-medium">Uploaded papers</div>
      <div className="space-y-1">
        {data.paperUrls.map((u, i) => (
          <a key={u} href={u} target="_blank" className="flex items-center gap-2 text-primary underline-offset-2 hover:underline">
            <FileText className="h-4 w-4" /> Question paper {data.paperUrls.length > 1 ? i + 1 : ""}
          </a>
        ))}
        {data.keyUrls.map((u, i) => (
          <a key={u} href={u} target="_blank" className="flex items-center gap-2 text-primary underline-offset-2 hover:underline">
            <FileText className="h-4 w-4" /> Answer key {data.keyUrls.length > 1 ? i + 1 : ""}
          </a>
        ))}
      </div>
    </div>
  );

  if (step === "questions") {
    return (
      <UploadWizard step="questions" heading="Check the questions" description="The AI split the paper into questions with step marks and concept tags. Edit anything before grading." aside={paperLinks}>
        {data.questions.length === 0 ? (
          busy ? (
            <LoadingState label="Reading the question paper and answer key…" />
          ) : (
            <div className="space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              <Button onClick={parse} data-demo-id="parse-paper">Read the paper</Button>
            </div>
          )
        ) : (
          <QuestionConfirmTable
            questions={data.questions as QuestionDraftView[]}
            concepts={data.concepts}
            warnings={data.warnings}
            confirmed={false}
            busy={busy}
            error={error}
            onSave={(questions, confirm) => run(() => api(`/api/assessments/${data.id}/questions`, { method: "PUT", json: { questions, confirm } }))}
            onReparse={parse}
          />
        )}
      </UploadWizard>
    );
  }

  if (step === "grade") {
    return (
      <UploadWizard step="grade" heading="Grading and review" aside={paperLinks}>
        <div className="flex flex-wrap gap-2">
          <Button asChild data-demo-id="open-grading">
            <Link href={`/assessments/${data.id}/grade`}>Grading progress</Link>
          </Button>
          <Button asChild variant="outline" data-demo-id="open-review">
            <Link href={`/assessments/${data.id}/review`}>Review queue</Link>
          </Button>
          <Button asChild variant="outline" data-demo-id="open-results">
            <Link href={`/assessments/${data.id}/results`}>Results</Link>
          </Button>
        </div>
      </UploadWizard>
    );
  }

  const pages = data.sheets.reduce((s, x) => s + x.pageCount, 0);
  const ready = data.status === "sheets_uploaded";
  return (
    <UploadWizard
      step={step}
      heading={step === "sheets" ? "Upload the answer sheets" : "Match sheets to students"}
      description={
        step === "match"
          ? "Names and roll numbers were read from page 1 of each sheet. Check the highlighted rows, then start grading."
          : undefined
      }
      aside={paperLinks}
    >
      <div className="space-y-8">
        {!ready && (
          <SheetUploader
            uploaded={{ sheets: data.sheets.length, pages }}
            progress={progress}
            canUseSamples={!!data.sampleSet && data.sheets.length === 0}
            busy={busy}
            error={step === "sheets" ? error : null}
            onFiles={uploadPages}
            onUseSamples={() => run(() => api(`/api/assessments/${data.id}/sample-sheets`, { method: "POST" }))}
          />
        )}
        {data.sheets.length > 0 && (
          <SheetMatcher
            sheets={data.sheets}
            roster={data.roster}
            missingStudents={data.missingStudents}
            busy={busy}
            error={step === "match" ? error : null}
            confirmLabel={ready ? "Start grading" : "Confirm matches"}
            onChange={(sheetId, studentId) => run(() => api(`/api/submissions/${sheetId}`, { method: "PATCH", json: { studentId } }))}
            onRemove={(sheetId) => run(() => api(`/api/submissions/${sheetId}`, { method: "DELETE" }))}
            onConfirm={() =>
              ready
                ? router.push(`/assessments/${data.id}/grade?start=1`)
                : run(() => api(`/api/assessments/${data.id}/confirm-matches`, { method: "POST" }))
            }
          />
        )}
        {ready && (
          <Button asChild variant="ghost">
            <Link href={`/assessments/${data.id}/grade?start=1`} data-demo-id="start-grading-link">
              Go to grading <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </UploadWizard>
  );
}
