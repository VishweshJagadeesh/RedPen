import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = "details" | "questions" | "sheets" | "match" | "grade";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "details", label: "Paper & key" },
  { id: "questions", label: "Questions" },
  { id: "sheets", label: "Answer sheets" },
  { id: "match", label: "Match students" },
  { id: "grade", label: "Grade" },
];

export interface UploadWizardProps {
  step: WizardStep;
  heading: ReactNode;
  description?: ReactNode;
  /** The panel for the current step (AssessmentDetailsForm, QuestionConfirmTable, SheetUploader, SheetMatcher…). */
  children: ReactNode;
  aside?: ReactNode;
}

/** The mobile-first upload flow: create → parse & confirm questions → upload sheets → match → grade. */
export function UploadWizard({ step, heading, description, children, aside }: UploadWizardProps) {
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="space-y-6" data-demo-id="upload-wizard" data-step={step}>
      <ol className="flex gap-1 overflow-x-auto text-xs sm:gap-2 sm:text-sm" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            data-demo-id={`wizard-step-${s.id}`}
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1",
              i < current && "border-transparent bg-high-bg text-high",
              i === current && "border-primary bg-accent font-medium text-accent-foreground",
              i > current && "text-muted-foreground",
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
            {s.label}
          </li>
        ))}
      </ol>
      <div>
        <h2 className="text-lg font-semibold">{heading}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid gap-6", aside && "lg:grid-cols-[1fr_280px]")}>
        <div className="min-w-0">{children}</div>
        {aside && <aside className="space-y-3">{aside}</aside>}
      </div>
    </div>
  );
}
