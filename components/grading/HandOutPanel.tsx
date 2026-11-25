import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export interface HandOutPanelProps {
  noun: string;
  handedOut: boolean;
  busy: boolean;
  printHref: string;
  /** The share control (ShareWorkButton). */
  share: ReactNode;
  listHref: string;
  onChange: (handedOut: boolean) => void;
}

/**
 * Answer-sheets step: "Yet to hand it to the class". Checking it keeps the work set up on RedPen (listed as
 * Ready to grade, tagged Not handed out) so it can be printed or shared before students get it.
 */
export function HandOutPanel({ noun, handedOut, busy, printHref, share, listHref, onChange }: HandOutPanelProps) {
  const pending = !handedOut;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4" data-demo-id="hand-out-panel">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={pending} disabled={busy} onCheckedChange={(v) => onChange(v !== true)} data-demo-id="not-handed-out-toggle" className="mt-0.5" />
        <span>
          <span className="font-medium">Yet to hand it to the class</span>
          <span className="block text-sm text-muted-foreground">
            Set it up now and hand it out later. It is saved as <b>Ready to grade</b>; upload the sheets here when they come back.
          </span>
        </span>
      </label>
      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent/60 p-3 text-sm" data-demo-id="not-handed-out-saved">
          <span className="min-w-0 flex-1">
            <CalendarClock className="mr-1.5 inline h-4 w-4 align-[-3px] text-primary" />
            Saved as <Badge variant="default">Ready to grade</Badge> <Badge variant="outline">Not handed out</Badge>. This {noun} is listed on Home and under Assessments.
          </span>
          <Button asChild size="sm" variant="ghost">
            <Link href={listHref} data-demo-id="hand-out-done">
              Done for now
            </Link>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={printHref} target="_blank" data-demo-id="print-student-copy">
            <Printer /> Print student copy
          </Link>
        </Button>
        {share}
      </div>
    </div>
  );
}
