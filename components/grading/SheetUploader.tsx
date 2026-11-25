"use client";
import { Camera, Images, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/misc";

export interface SheetUploaderProps {
  uploaded: { sheets: number; pages: number };
  progress: { done: number; total: number } | null;
  /** "fixture": bundled handwriting photos; "synthetic": generated practice sheets (mock AI); null: none. */
  sampleKind: "fixture" | "synthetic" | null;
  busy: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onUseSamples: () => void;
}

/** Step 3: bulk upload by multi-photo capture or multiple files, in sheet order. */
export function SheetUploader({ uploaded, progress, sampleKind, busy, error, onFiles, onUseSamples }: SheetUploaderProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Photograph or select every page, one student after another. A page with a name and roll number starts a new sheet; pages without
        one are added to the sheet before it.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/50">
          <Camera className="h-6 w-6 text-primary" />
          <span className="font-medium">Capture pages</span>
          <span className="text-xs text-muted-foreground">Opens the camera on a phone</span>
          <input type="file" accept="image/*" capture="environment" multiple className="sr-only" disabled={busy} data-demo-id="capture-sheets" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
        </label>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/50">
          <Images className="h-6 w-6 text-primary" />
          <span className="font-medium">Choose photos</span>
          <span className="text-xs text-muted-foreground">JPG, PNG or WebP, in order</span>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} data-demo-id="upload-sheets" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
        </label>
      </div>
      {sampleKind && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onUseSamples} data-demo-id="use-sample-sheets" data-sample-kind={sampleKind}>
            <Sparkles /> {busy ? "Attaching sample sheets…" : "Use the sample answer sheets"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {sampleKind === "fixture"
              ? "Handwritten sample sheets for this demo test."
              : "Generates a practice sheet for every student from the answer key and their past work, graded by the mock AI. For trying the flow only."}
          </span>
        </div>
      )}
      {progress && (
        <div className="space-y-1" data-demo-id="upload-progress">
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} label="Upload progress" />
          <div className="text-xs text-muted-foreground">
            Uploaded {progress.done} of {progress.total} pages
          </div>
        </div>
      )}
      <div className="text-sm" data-demo-id="upload-summary">
        <span className="font-semibold">{uploaded.sheets}</span> sheets · <span className="font-semibold">{uploaded.pages}</span> pages so far
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
