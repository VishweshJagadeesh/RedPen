"use client";
/**
 * A device screen: an iframe whose document receives the page's stylesheets and into which the real
 * components are rendered through a portal. The iframe gives the components their own viewport, so their
 * responsive (viewport) breakpoints, `position: fixed` and dialogs behave as on a device of that size.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PortalContainerContext } from "@/components/ui/dialog";

/** Legibility at walkthrough scale: nothing under 14px on a device screen. */
const OVERRIDES = `
html:root { --text-xs: 0.875rem; --text-xs--line-height: calc(1.25 / 0.875); }
html, body { overflow-x: hidden; scrollbar-width: none; }
html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
.text-\\[9px\\], .text-\\[10px\\], .text-\\[11px\\], .text-\\[13px\\] { font-size: 14px !important; line-height: 1.3 !important; }
.text-\\[0\\.55em\\] { font-size: max(14px, 0.55em) !important; }
*, *::before, *::after { cursor: none !important; }
body { background: var(--background); }
`;

function syncStyles(from: Document, to: Document) {
  to.head.querySelectorAll("[data-demo-copied]").forEach((n) => n.remove());
  from.head.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    const c = n.cloneNode(true) as HTMLElement;
    c.setAttribute("data-demo-copied", "");
    to.head.appendChild(c);
  });
  let o = to.getElementById("demo-overrides");
  if (!o) {
    o = to.createElement("style");
    o.id = "demo-overrides";
  }
  o.textContent = OVERRIDES;
  to.head.appendChild(o);
}

export function ScreenFrame({ width, height, children, onDocument, demoKey }: { width: number; height: number; children: ReactNode; onDocument?: (doc: Document | null) => void; demoKey: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const frame = ref.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    doc.open();
    doc.write('<!doctype html><html lang="en-IN"><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();
    syncStyles(document, doc);
    // Dev mode injects styles later (and on hot reload): keep the frame in step.
    const mo = new MutationObserver(() => syncStyles(document, doc));
    mo.observe(document.head, { childList: true, subtree: true, characterData: true });
    // Keyboard shortcuts keep working when focus is inside a screen.
    const forward = (e: KeyboardEvent) => window.dispatchEvent(new KeyboardEvent("keydown", { key: e.key, code: e.code, bubbles: true }));
    doc.addEventListener("keydown", forward);
    setBody(doc.body);
    onDocument?.(doc);
    return () => {
      mo.disconnect();
      doc.removeEventListener("keydown", forward);
      onDocument?.(null);
      setBody(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <iframe ref={ref} title="Device screen" data-demo-frame={demoKey} tabIndex={-1} style={{ width, height, border: 0, display: "block", background: "#fff", pointerEvents: "none" }} />
      {body && createPortal(<PortalContainerContext.Provider value={body}>{children}</PortalContainerContext.Provider>, body)}
    </>
  );
}
