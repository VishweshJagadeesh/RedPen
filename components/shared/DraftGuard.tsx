"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";

export interface DraftGuardProps {
  /** Something was just created (a plan, a sheet, an assessment) and the teacher has not chosen to keep it yet. */
  isNew: boolean;
  /** Edits on the page that are not saved yet. */
  dirty: boolean;
  /** What was created, e.g. "reteach plan". */
  noun: string;
  /** Paths that count as staying with this work (e.g. its teaching mode or print view). */
  scope: string[];
  /** Keeps the work (and any unsaved edits) as a draft. */
  onSave: () => Promise<void>;
  /** Deletes what was created (only called when isNew). */
  onDiscard: () => Promise<void>;
}

function insideScope(pathname: string, scope: string[]) {
  return scope.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Asks before the teacher leaves unfinished work: "Save draft & leave", "Discard", or "Cancel" (stay).
 * It intercepts in-app links (back links, the sidebar, any other link) and warns on reload/close when
 * there are unsaved edits. The browser's own back button is not intercepted; nothing is lost then either,
 * because generated work is already stored as a draft and listed on Home.
 */
export function DraftGuard({ isNew, dirty, noun, scope, onSave, onDiscard }: DraftGuardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = isNew || dirty;
  const state = useRef({ active, scope });
  state.current = { active, scope };
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!state.current.active || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest("[data-guard-allow]")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname || insideScope(url.pathname, state.current.scope)) return;
      e.preventDefault();
      e.stopPropagation();
      setError(null);
      setPending(url.pathname + url.search + url.hash);
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  async function go(kind: "save" | "discard") {
    if (!pending) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "save") await onSave();
      else if (isNew) await onDiscard();
      state.current.active = false;
      dirtyRef.current = false;
      router.push(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  const title = isNew ? `You created a ${noun}` : "You have unsaved changes";
  const description = isNew
    ? `This ${noun} isn't finished yet. Save it as a draft to come back to it later (it waits on Home under Drafts), or discard it.`
    : `Your edits to this ${noun} are not saved yet.`;

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
      <DialogContent data-demo-id="draft-guard-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <Alert tone="error">{error}</Alert>}
        <DialogFooter>
          <Button variant="ghost" disabled={!!busy} onClick={() => setPending(null)} data-demo-id="draft-guard-cancel">
            Cancel
          </Button>
          <Button variant="outline" className="text-low" disabled={!!busy} onClick={() => go("discard")} data-demo-id="draft-guard-discard">
            {busy === "discard" && <Loader2 className="animate-spin" />}
            {isNew ? `Discard ${noun}` : "Discard changes & leave"}
          </Button>
          <Button disabled={!!busy} onClick={() => go("save")} data-demo-id="draft-guard-save">
            {busy === "save" && <Loader2 className="animate-spin" />}
            {isNew ? "Save draft & leave" : "Save changes & leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
