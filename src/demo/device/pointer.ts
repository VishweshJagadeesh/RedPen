/**
 * Simulated input on the device screens: a cursor that moves to a `data-demo-id` and clicks (laptop),
 * tap ripples (phone), key presses, and smooth scrolling. Declared per scene on a timeline and resolved
 * every frame from the live layout, so seeking anywhere lands in the right place.
 */
import { clamp, ease } from "../engine/math";

type Target = string | null;

interface Move {
  id: Target;
  t0: number;
  t1: number;
  hover?: boolean;
}
interface Press {
  id: Target;
  t: number;
  kind: "click" | "tap";
}
interface Key {
  label: string;
  t: number;
}
interface Scroll {
  id: Target;
  t0: number;
  t1: number;
  offset: number;
  start?: number;
}

export class PointerScript {
  moves: Move[] = [];
  presses: Press[] = [];
  keys: Key[] = [];
  scrolls: Scroll[] = [];

  /** Move the cursor onto `id` (arriving shortly before t) and click at t. */
  click(id: string, t: number, travel = 0.7) {
    this.moves.push({ id, t0: t - travel, t1: t - 0.08 });
    this.presses.push({ id, t, kind: "click" });
  }

  /** Move without clicking. */
  hover(id: string, t0: number, t1: number) {
    this.moves.push({ id, t0, t1, hover: true });
  }

  /** A finger tap (phone): ripple on the element at t. */
  tap(id: string, t: number) {
    this.presses.push({ id, t, kind: "tap" });
  }

  /** A keyboard shortcut shown as a key cap. */
  key(label: string, t: number) {
    this.keys.push({ label, t });
  }

  /** Scroll the screen so `id` sits `offset` px from the top (null: back to the top). */
  scroll(id: string | null, t0: number, t1: number, offset = 90) {
    this.scrolls.push({ id, t0, t1, offset });
  }

  get usesCursor() {
    return this.moves.length > 0;
  }
}

export interface PointerDom {
  panel: HTMLElement;
  cursor: HTMLElement;
  fx: HTMLElement;
  key: HTMLElement;
}

export interface FrameRef {
  iframe: HTMLIFrameElement;
  doc: Document;
}

const REST = { x: 0.78, y: 0.86 };

/** Applies a PointerScript to the DOM at scene time `now`. */
export class PointerRenderer {
  private last: { x: number; y: number } | null = null;
  private pressEls = new Map<Press, HTMLElement>();
  private known = new Map<string, { x: number; y: number }>();

  constructor(private dom: PointerDom) {}

  reset() {
    this.last = null;
    this.known.clear();
    for (const el of this.pressEls.values()) el.remove();
    this.pressEls.clear();
    this.dom.cursor.style.opacity = "0";
    this.dom.key.classList.remove("on");
  }

  private frameOffset(frame: FrameRef, scale: number) {
    const fr = frame.iframe.getBoundingClientRect();
    const pr = this.dom.panel.getBoundingClientRect();
    return { x: (fr.left - pr.left) / scale, y: (fr.top - pr.top) / scale, w: fr.width / scale, h: fr.height / scale };
  }

  /** `^id` targets the element's parent (e.g. the visible label around a hidden file input). */
  private rect(frame: FrameRef, id: Target) {
    if (!id) return null;
    const parent = id.startsWith("^");
    let el = frame.doc.querySelector(`[data-demo-id="${CSS.escape(parent ? id.slice(1) : id)}"]`) as HTMLElement | null;
    if (el && parent) el = el.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
  }

  private onScreen(frame: FrameRef, r: DOMRect) {
    const win = frame.doc.defaultView;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return !!win && cx >= 0 && cy >= 0 && cx <= win.innerWidth && cy <= win.innerHeight;
  }

  /** Nothing else (a dialog, an overlay) sits on top of the element's centre. */
  private uncovered(frame: FrameRef, id: Target, r: DOMRect) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const parent = id!.startsWith("^");
    let el = frame.doc.querySelector(`[data-demo-id="${CSS.escape(parent ? id!.slice(1) : id!)}"]`) as HTMLElement | null;
    if (el && parent) el = el.parentElement;
    const top = frame.doc.elementFromPoint(cx, cy);
    return !!el && !!top && (el === top || el.contains(top) || top.contains(el));
  }

  private point(frame: FrameRef | null, id: Target, scale: number, hover = false): { x: number; y: number } | null {
    if (!frame || !id) return null;
    const r = this.rect(frame, id);
    const key = `${id}${hover ? "~h" : ""}`;
    if (!r) return this.known.get(key) ?? null;
    const o = this.frameOffset(frame, scale);
    const el = frame.doc.querySelector(`[data-demo-id="${CSS.escape(id.replace(/^\^/, ""))}"]`);
    const field = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !id.startsWith("^");
    // fields: rest the pointer near the bottom-right so the value stays readable;
    // buttons: a little left of centre, like a person would
    // hovering over content: rest just under it, pointing up at it
    const p = hover
      ? { x: o.x + r.left + Math.min(r.width * 0.55, 200), y: o.y + r.top + r.height + 4 }
      : field
        ? { x: o.x + r.left + r.width - 12, y: o.y + r.top + r.height - 6 }
        : { x: o.x + r.left + Math.min(r.width / 2, 46), y: o.y + r.top + r.height / 2 };
    this.known.set(key, p);
    return p;
  }

  update(script: PointerScript | null, now: number, frame: FrameRef | null, scale: number, cursorAllowed: boolean) {
    if (!script) return;
    if (frame) this.applyScroll(script, now, frame);
    // cursor
    const o = frame ? this.frameOffset(frame, scale) : null;
    const rest = o ? { x: o.x + o.w * REST.x, y: o.y + o.h * REST.y } : { x: 600, y: 700 };
    let pos = rest;
    const started = script.moves.filter((m) => m.t0 <= now);
    if (started.length) {
      const cur = started[started.length - 1];
      const prev = started.length > 1 ? started[started.length - 2] : null;
      const from = (prev && this.point(frame, prev.id, scale, prev.hover)) ?? this.last ?? rest;
      const to = this.point(frame, cur.id, scale, cur.hover) ?? from;
      const u = ease(clamp((now - cur.t0) / Math.max(0.01, cur.t1 - cur.t0)));
      pos = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * -18 };
      if (u >= 1) this.last = to;
    }
    // the cursor never leaves the device screen (a target that is gone falls back to an older point)
    if (o) pos = { x: clamp(pos.x, o.x + 6, o.x + o.w - 14), y: clamp(pos.y, o.y + 6, o.y + o.h - 18) };
    const first = script.moves[0];
    const visible = cursorAllowed && script.usesCursor && first && now >= first.t0 - 0.4;
    const pressing = script.presses.some((p) => p.kind === "click" && now >= p.t && now < p.t + 0.18);
    this.dom.cursor.style.opacity = visible ? "1" : "0";
    this.dom.cursor.style.transform = `translate(${pos.x.toFixed(1)}px,${pos.y.toFixed(1)}px) scale(${pressing ? 0.82 : 1})`;
    // presses: ripple + pressed highlight over the element
    for (const p of script.presses) {
      const age = now - p.t;
      let el = this.pressEls.get(p);
      if (age < 0 || age > 0.65 || !frame) {
        if (el) {
          el.remove();
          this.pressEls.delete(p);
        }
        continue;
      }
      const r = this.rect(frame, p.id);
      // only mark what is on screen: nothing for an element that is gone or scrolled away
      const onScreen = !!r && !!o && this.onScreen(frame, r);
      if (!r || !o || !onScreen) {
        if (el) el.style.opacity = "0";
        continue;
      }
      if (!el) {
        el = document.createElement("div");
        el.className = `ptr-press ${p.kind}`;
        el.innerHTML = '<i class="ptr-hl"></i><i class="ptr-ripple"></i>';
        this.dom.fx.appendChild(el);
        this.pressEls.set(p, el);
      }
      el.style.opacity = "1";
      el.style.transform = `translate(${(o.x + r.left).toFixed(1)}px,${(o.y + r.top).toFixed(1)}px)`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      const hl = el.firstElementChild as HTMLElement;
      const rip = el.lastElementChild as HTMLElement;
      const press = age < 0.22 ? 1 : Math.max(0, 1 - (age - 0.22) / 0.3);
      // the box only while nothing (say, the dialog this click opened) covers the element; the ripple stays
      hl.style.opacity = String(this.uncovered(frame, p.id, r) ? 0.9 * press : 0);
      const rx = p.kind === "click" && this.last ? this.last.x - (o.x + r.left) : r.width / 2;
      const ry = p.kind === "click" && this.last ? this.last.y - (o.y + r.top) : r.height / 2;
      const k = clamp(age / 0.6);
      rip.style.left = `${rx}px`;
      rip.style.top = `${ry}px`;
      rip.style.transform = `translate(-50%,-50%) scale(${0.2 + k * 1.6})`;
      rip.style.opacity = String(0.55 * (1 - k));
    }
    // key caps
    const key = script.keys.find((k) => now >= k.t && now < k.t + 0.9);
    if (key) {
      if (this.dom.key.textContent !== key.label) this.dom.key.textContent = key.label;
      this.dom.key.classList.add("on");
      this.dom.key.classList.toggle("down", now < key.t + 0.2);
    } else this.dom.key.classList.remove("on", "down");
  }

  private applyScroll(script: PointerScript, now: number, frame: FrameRef) {
    const active = script.scrolls.filter((s) => s.t0 <= now);
    if (!active.length) return;
    const s = active[active.length - 1];
    const doc = frame.doc;
    let box = doc.scrollingElement as HTMLElement | null;
    let target = 0;
    if (s.id) {
      const parent = s.id.startsWith("^");
      let el = doc.querySelector(`[data-demo-id="${CSS.escape(parent ? s.id.slice(1) : s.id)}"]`) as HTMLElement | null;
      if (el && parent) el = el.parentElement;
      if (!el) return;
      // the nearest scrolling container (e.g. teaching mode's panel), else the page
      for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
        const oy = doc.defaultView!.getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 2) {
          box = p;
          break;
        }
      }
      if (!box) return;
      const top = box === doc.scrollingElement ? 0 : box.getBoundingClientRect().top;
      target = el.getBoundingClientRect().top - top + box.scrollTop - s.offset;
    }
    if (!box) return;
    target = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, target));
    if (s.start === undefined) s.start = now >= s.t1 ? target : box.scrollTop;
    const u = ease(clamp((now - s.t0) / Math.max(0.01, s.t1 - s.t0)));
    box.scrollTop = s.start + (target - s.start) * u;
  }
}
