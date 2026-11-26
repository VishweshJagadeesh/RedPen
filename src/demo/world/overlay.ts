/**
 * HTML overlay on the 3D view: name labels, place tags, pins, check marks and speech bubbles, projected
 * from world positions every frame. Labels are nudged so they never overlap each other or the scene tag,
 * and are kept inside the view (so they never reach the caption bar or get clipped).
 */
import * as THREE from "three";

export type Anchor = "bottom" | "center";

export interface OverlayItem {
  el: HTMLDivElement;
  inner: HTMLDivElement;
  pos: THREE.Vector3 | (() => THREE.Vector3 | null);
  anchor: Anchor;
  priority: number;
  show(v?: boolean): OverlayItem;
  html(h: string): OverlayItem;
  remove(): void;
}

const MARGIN = 10;

export class Overlay {
  items = new Set<OverlayItem>();
  private v = new THREE.Vector3();
  /** Rects other labels must avoid (scene tag). */
  keepOut: { x0: number; y0: number; x1: number; y1: number }[] = [];

  constructor(
    private root: HTMLElement,
    private W: number,
    private H: number,
  ) {}

  add(html: string, cls: string, pos: OverlayItem["pos"], opts: { anchor?: Anchor; priority?: number } = {}): OverlayItem {
    const el = document.createElement("div");
    el.className = "ol";
    const inner = document.createElement("div");
    inner.className = cls;
    inner.innerHTML = html;
    el.appendChild(inner);
    this.root.appendChild(el);
    const items = this.items;
    const o: OverlayItem = {
      el,
      inner,
      pos,
      anchor: opts.anchor ?? (cls.startsWith("chk") ? "center" : "bottom"),
      priority: opts.priority ?? 0,
      show(v = true) {
        inner.classList.toggle("on", v);
        return o;
      },
      html(h: string) {
        if (inner.innerHTML !== h) inner.innerHTML = h;
        return o;
      },
      remove() {
        el.remove();
        items.delete(o);
      },
    };
    items.add(o);
    return o;
  }

  clear() {
    for (const o of [...this.items]) o.remove();
  }

  update(camera: THREE.Camera) {
    const list: { o: OverlayItem; x: number; y: number; w: number; h: number }[] = [];
    // read phase
    for (const o of this.items) {
      const p = typeof o.pos === "function" ? o.pos() : o.pos;
      if (!p) {
        o.el.style.display = "none";
        continue;
      }
      this.v.copy(p).project(camera);
      if (this.v.z > 1 || this.v.z < -1) {
        o.el.style.display = "none";
        continue;
      }
      const x = ((this.v.x + 1) / 2) * this.W;
      const y = ((1 - this.v.y) / 2) * this.H;
      // a label whose subject is out of shot would point at nothing: hide it
      if (x < -30 || x > this.W + 30 || y < -30 || y > this.H + 60) {
        o.el.style.display = "none";
        continue;
      }
      o.el.style.display = "";
      list.push({ o, x, y, w: o.inner.offsetWidth, h: o.inner.offsetHeight });
    }
    // place phase: higher priority first, then top to bottom
    list.sort((a, b) => b.o.priority - a.o.priority || a.y - b.y);
    const placed = this.keepOut.map((r) => ({ ...r }));
    for (const it of list) {
      const visible = it.o.inner.classList.contains("on");
      let x0 = it.o.anchor === "center" ? it.x - it.w / 2 : it.x - it.w / 2;
      let y0 = it.o.anchor === "center" ? it.y - it.h / 2 : it.y - it.h;
      // keep inside the view
      x0 = Math.min(this.W - MARGIN - it.w, Math.max(MARGIN, x0));
      y0 = Math.min(this.H - MARGIN - it.h, Math.max(MARGIN, y0));
      if (visible) {
        for (let pass = 0; pass < 8; pass++) {
          const hit = placed.find((r) => x0 < r.x1 + 4 && x0 + it.w > r.x0 - 4 && y0 < r.y1 + 4 && y0 + it.h > r.y0 - 4);
          if (!hit) break;
          // move up past the obstacle; if that leaves the view, move below it instead
          const up = hit.y0 - 6 - it.h;
          y0 = up >= MARGIN ? up : hit.y1 + 6;
          y0 = Math.min(this.H - MARGIN - it.h, Math.max(MARGIN, y0));
        }
        placed.push({ x0, y0, x1: x0 + it.w, y1: y0 + it.h });
      }
      it.o.el.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`;
    }
  }
}
