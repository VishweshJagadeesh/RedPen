"use client";
/**
 * The right-hand panel: the current device (phone or laptop) on a dotted paper background, with the owner
 * chip above, an optional privacy note below, and the "Sample data" chip. A new slot key slides the old
 * device out and the new one in. Screens are rendered by ScreenView inside each device's ScreenFrame.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FlaskConical, Laptop, ShieldCheck, Smartphone } from "lucide-react";
import { ScreenFrame } from "./ScreenFrame";
import { ScreenView } from "./Screens";
import type { DemoStore, Slot } from "./store";
import type { DemoData } from "../data/types";
import type { FrameRef } from "./pointer";

export const PHONE = { w: 352, h: 704 };
export const LAPTOP = { w: 744, h: 486 };

export interface FrameRegistry {
  current: FrameRef | null;
  device: Slot["device"] | null;
  key: string | null;
}

function StatusBar({ dark, time }: { dark: boolean; time: string }) {
  return (
    <div className={`dv-status${dark ? " dark" : ""}`}>
      <span>{time}</span>
      <span className="dv-status-icons">
        <svg viewBox="0 0 20 14" fill="currentColor" aria-hidden>
          <rect x="0" y="10" width="3" height="4" rx="1" />
          <rect x="5" y="7" width="3" height="7" rx="1" />
          <rect x="10" y="4" width="3" height="10" rx="1" />
          <rect x="15" y="1" width="3" height="13" rx="1" />
        </svg>
        <svg viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="1" y="1" width="21" height="12" rx="3" />
          <rect x="3.5" y="3.5" width="13" height="7" rx="1.5" fill="currentColor" stroke="none" />
          <path d="M24 5v4" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

function Device({ slot, data, registry, live }: { slot: Slot; data: DemoData; registry: FrameRegistry; live: boolean }) {
  const onDoc = (doc: Document | null) => {
    if (!doc) {
      if (registry.key === slot.key) {
        registry.current = null;
        registry.device = null;
        registry.key = null;
      }
      return;
    }
    if (!live) return;
    const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
    if (!iframe) return;
    registry.current = { doc, iframe };
    registry.device = slot.device;
    registry.key = slot.key;
  };
  const screen = slot.screen;
  const screenKey = screen.kind;
  const content = (
    <div key={screenKey} className="dv-screen-in">
      <ScreenView data={data} screen={screen} />
    </div>
  );
  if (slot.device === "card") {
    return (
      <div className="dv-card">
        <ScreenView data={data} screen={screen} />
      </div>
    );
  }
  if (slot.device === "phone") {
    const dark = screen.kind === "lock";
    const time = screen.kind === "lock" ? screen.time : (slot.clock ?? "21:52");
    return (
      <div className="dv-phone">
        <div className={`dv-phone-in${dark ? " dark" : ""}`}>
          <div className="dv-island" />
          <StatusBar dark={dark} time={time.replace(/\s?pm$/, "")} />
          <ScreenFrame width={PHONE.w} height={PHONE.h} onDocument={onDoc} demoKey={slot.key}>
            {content}
          </ScreenFrame>
          <div className={`dv-home${dark ? " dark" : ""}`} />
        </div>
      </div>
    );
  }
  return (
    <div className="dv-laptop">
      <div className="dv-lid">
        <div className="dv-cam" />
        <ScreenFrame width={LAPTOP.w} height={LAPTOP.h} onDocument={onDoc} demoKey={slot.key}>
          {content}
        </ScreenFrame>
      </div>
      <div className="dv-base">
        <div className="dv-notch" />
      </div>
    </div>
  );
}

interface Live {
  slot: Slot;
  phase: "enter" | "live" | "leave";
}

export function DevicePanel({ store, data, registry }: { store: DemoStore; data: DemoData; registry: FrameRegistry }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [slots, setSlots] = useState<Live[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const slot = state.slot;
    setSlots((cur) => {
      const top = cur.find((s) => s.phase !== "leave");
      if (slot && top && top.slot.key === slot.key) return cur.map((s) => (s === top ? { ...s, slot } : s));
      const leaving = cur.filter((s) => s.phase !== "leave").map((s) => ({ ...s, phase: "leave" as const }));
      const kept = cur.filter((s) => s.phase === "leave");
      if (!slot) return [...kept, ...leaving];
      return [...kept, ...leaving, { slot, phase: "enter" }];
    });
  }, [state.slot]);

  // Transitions depend only on which slots are entering/leaving, not on screen updates within a slot.
  const phases = slots.map((s) => `${s.slot.key}:${s.phase}`).join("|");
  useEffect(() => {
    if (phases.includes(":enter")) {
      let inner = 0;
      const outer = window.requestAnimationFrame(() => {
        inner = window.requestAnimationFrame(() => setSlots((cur) => cur.map((s) => (s.phase === "enter" ? { ...s, phase: "live" } : s))));
      });
      return () => {
        window.cancelAnimationFrame(outer);
        window.cancelAnimationFrame(inner);
      };
    }
    if (phases.includes(":leave")) {
      const t = window.setTimeout(() => setSlots((cur) => cur.filter((s) => s.phase !== "leave")), 700);
      timers.current.push(t);
      return () => window.clearTimeout(t);
    }
  }, [phases]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return (
    <div className="dv-panel" data-demo-panel>
      {slots.map(({ slot, phase }) => (
        <div key={slot.key} className={`dv-slot ${phase}`} aria-hidden={phase === "leave"}>
          {slot.device !== "card" && (
            <div className="dv-owner">
              {slot.device === "phone" ? <Smartphone aria-hidden /> : <Laptop aria-hidden />}
              <span>{slot.owner}</span>
            </div>
          )}
          <Device slot={slot} data={data} registry={registry} live={phase !== "leave"} />
          {slot.device !== "card" && (
            <div className={`dv-note${slot.note ? "" : " ghost"}${slot.noteOn ? " on" : ""}`}>
              <ShieldCheck aria-hidden />
              <span>{slot.note ?? "."}</span>
            </div>
          )}
        </div>
      ))}
      <div className="dv-sample" data-demo-id="sample-data-chip">
        <FlaskConical aria-hidden />
        Sample data
      </div>
    </div>
  );
}
