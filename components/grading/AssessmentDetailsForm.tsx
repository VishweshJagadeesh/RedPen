"use client";
import { useState } from "react";
import { Camera, FileUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ASSESSMENT_TYPE_LABEL, ASSESSMENT_TYPES, type AssessmentType } from "@/lib/domain";

export interface AssessmentDetailsValues {
  sectionId: string;
  title: string;
  type: AssessmentType;
  date: string;
  paper: File[];
  key: File[];
  sample?: string;
}

export interface AssessmentDetailsFormProps {
  sections: { id: string; name: string }[];
  samples: { key: string; label: string; sectionId: string; title: string; type: AssessmentType }[];
  defaultDate: string;
  defaultType?: AssessmentType;
  defaultSectionId?: string;
  busy: boolean;
  error: string | null;
  onSubmit: (values: AssessmentDetailsValues) => void;
}

function FilePicker({ label, files, onChange, demoId }: { label: string; files: File[]; onChange: (f: File[]) => void; demoId: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted">
          <Camera className="h-4 w-4" /> Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" data-demo-id={`${demoId}-camera`} onChange={(e) => onChange([...files, ...Array.from(e.target.files ?? [])])} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted">
          <FileUp className="h-4 w-4" /> Photos or PDF
          <input type="file" accept="image/*,application/pdf" multiple className="sr-only" data-demo-id={`${demoId}-files`} onChange={(e) => onChange([...files, ...Array.from(e.target.files ?? [])])} />
        </label>
      </div>
      {files.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              {f.name} · {(f.size / 1024).toFixed(0)} KB
              <button type="button" className="text-primary underline" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Step 1 of the upload wizard: section, type, date, question paper and answer key. Mobile-first. */
export function AssessmentDetailsForm({ sections, samples, defaultDate, defaultType = "weekly_test", defaultSectionId, busy, error, onSubmit }: AssessmentDetailsFormProps) {
  const [sectionId, setSectionId] = useState(defaultSectionId ?? sections[0]?.id ?? "");
  const [type, setType] = useState<AssessmentType>(defaultType);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [paper, setPaper] = useState<File[]>([]);
  const [key, setKey] = useState<File[]>([]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ sectionId, title, type, date, paper, key });
      }}
    >
      {samples.length > 0 && (
        <Alert tone="info" className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4" /> Try it with a sample paper
          </div>
          <div className="flex flex-wrap gap-2">
            {samples.map((s) => (
              <Button
                key={s.key}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-auto whitespace-normal py-1.5 text-left"
                data-demo-id={`use-sample-paper-${s.key}`}
                onClick={() => onSubmit({ sectionId: s.sectionId, title: s.title, type: s.type, date, paper: [], key: [], sample: s.key })}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="section">Section</Label>
          <NativeSelect id="section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} data-demo-id="assessment-section">
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                Class {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <NativeSelect id="type" value={type} onChange={(e) => setType(e.target.value as AssessmentType)} data-demo-id="assessment-type">
            {ASSESSMENT_TYPES.filter((t) => t !== "remedial" && t !== "exit_ticket").map((t) => (
              <option key={t} value={t}>
                {ASSESSMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder={type === "homework" ? "Homework 4 — Mensuration" : "Weekly Test 5 — Mensuration"} value={title} onChange={(e) => setTitle(e.target.value)} data-demo-id="assessment-title" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-demo-id="assessment-date" />
        </div>
      </div>
      <FilePicker label="Question paper" files={paper} onChange={setPaper} demoId="upload-paper" />
      <FilePicker label="Answer key / marking scheme" files={key} onChange={setKey} demoId="upload-key" />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={busy || !title || paper.length === 0 || key.length === 0} data-demo-id="create-assessment" className="w-full sm:w-auto">
        {busy ? "Reading the paper…" : "Create and read the paper"}
      </Button>
    </form>
  );
}
