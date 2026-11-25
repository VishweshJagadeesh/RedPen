import Link from "next/link";
import { AlertTriangle, ArrowLeft, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className }: { title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div data-demo-id="empty-state" className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center", className)}>
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action, className }: { title?: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" data-demo-id="error-state" className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-[oklch(0.85_0.08_27)] bg-low-bg p-8 text-center", className)}>
      <AlertTriangle className="h-7 w-7 text-low" aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-lg text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div data-demo-id="loading-state" className={cn("flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export interface BackTarget {
  href: string;
  /** Where the link goes, e.g. "Class 8B" → "Back to Class 8B". */
  label: string;
}

/** "← Back to …" — an explicit parent route, so it works the same after a refresh or from a shared link. */
export function BackLink({ href, label, className }: BackTarget & { className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-muted-foreground hover:text-foreground", className)} data-demo-id="back-link">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to {label}
    </Link>
  );
}

export function PageHeader({ title, description, actions, eyebrow, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; back?: BackTarget }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <BackLink {...back} className="-ml-0.5 mb-2" />}
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
