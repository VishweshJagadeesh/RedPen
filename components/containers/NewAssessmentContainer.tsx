"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssessmentDetailsForm, type AssessmentDetailsFormProps, type AssessmentDetailsValues } from "@/components/grading/AssessmentDetailsForm";
import { UploadWizard } from "@/components/grading/UploadWizard";
import { api } from "@/lib/client/api";
import { downscaleImage } from "@/lib/client/image";

export function NewAssessmentContainer(props: Pick<AssessmentDetailsFormProps, "sections" | "samples" | "defaultDate">) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(v: AssessmentDetailsValues) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("sectionId", v.sectionId);
      form.set("title", v.title);
      form.set("type", v.type);
      form.set("date", v.date);
      if (v.sample) form.set("sample", v.sample);
      for (const f of v.paper) form.append("paper", await downscaleImage(f));
      for (const f of v.key) form.append("key", await downscaleImage(f));
      const { id } = await api<{ id: string }>("/api/assessments", { method: "POST", body: form });
      try {
        await api(`/api/assessments/${id}/parse`, { method: "POST" });
      } catch {
        // The wizard page shows the parse error and a retry button.
      }
      router.push(`/assessments/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <UploadWizard step="details" heading="Create the assessment" description="Photograph the question paper and the answer key, or upload a PDF.">
      <AssessmentDetailsForm {...props} busy={busy} error={error} onSubmit={submit} />
    </UploadWizard>
  );
}
