"use client";
import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";

/**
 * Shares the read-only student copy of an assessment (/w/[token]): the phone's share sheet where
 * available (so the teacher can post it to the class group herself), otherwise copy the link.
 */
export function ShareWorkButton({ assessmentId, title, size = "sm", variant = "outline" }: { assessmentId: string; title: string; size?: "sm" | "default"; variant?: "outline" | "ghost" | "default" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    try {
      const link = url ?? `${window.location.origin}${(await api<{ path: string }>(`/api/assessments/${assessmentId}/share`, { method: "POST" })).path}`;
      setUrl(link);
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, text: `${title} — questions for the class`, url: link }).catch(() => {});
        return;
      }
      await navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" size={size} variant={variant} onClick={share} data-demo-id={`share-work-${assessmentId}`}>
        {copied ? <Check /> : <Share2 />} {copied ? "Link copied" : "Share with students"}
      </Button>
      {url && (
        <span className="flex max-w-xs items-center gap-1 text-xs text-muted-foreground" data-demo-id="share-work-url">
          <Copy className="h-3 w-3 shrink-0" />
          <a href={url} target="_blank" className="truncate underline-offset-2 hover:underline">
            {url}
          </a>
        </span>
      )}
      {error && <span className="text-xs text-low">{error}</span>}
    </span>
  );
}
