/** Flow 3 — Remediate: who slipped and why, targeted practice, and the sheet coming back. */
import { formatDate } from "@/lib/format";
import type { SceneCtx, SceneDef } from "../engine/scene";
import { walk } from "../world/person";
import { PAL, bb } from "../world/kit";
import { V, cam, reviewAccept, reviewAcceptHigh, reviewScreen, reviewUi, seatClass, shots } from "./helpers";

const FRONT_Z = -4.3;

function flagLabel(ctx: SceneCtx, name: string) {
  const f = ctx.data.remediate.flags.find((x) => x.studentName === name)!;
  const ev = (name === "Rohan Kumar" ? ctx.data.remediate.rohan : name === "Sneha Iyer" ? ctx.data.remediate.sneha : null)?.evidence;
  if (ev?.scores) return `${Math.round(ev.scores.previousAverage)}% → ${Math.round(ev.scores.latest.pct)}% in ${ev.scores.latest.shortTitle}`;
  const m = /Missed (\d+) of the last (\d+)/.exec(f.summary);
  return m ? `missed ${m[1]} of the last ${m[2]} tests` : "flagged";
}

/** A sheet of paper held in a hand (child of the hand's item group). */
function paperIn(group: import("three").Group) {
  group.clear();
  const p = bb(group, PAL.paper, 0, -0.02, 0.02, 0.2, 0.004, 0.27);
  p.rotation.x = Math.PI / 2;
  return p;
}

export const FLOW3: SceneDef[] = [
  {
    title: "WHO SLIPPED",
    chapter: 2,
    dur: 14,
    pre: 3,
    banner: "Not everyone slips for the same reason",
    caption: "Three alerts, each saying why it fired. Rohan and Sneha slipped for different reasons.",
    stages: [[0, "diagnose"]],
    light: "day",
    set: "classroom",
    cam: (t) =>
      shots(t, cam([0.2, 9.4, 11.6], [0, 0.4, 0.8]), [
        [2.4, 6.2, cam([3.4, 6.6, 9.6], [0.6, 0.6, 3.6])],
        [8.6, 11.2, cam([-3.2, 6.4, 6.2], [-0.8, 0.6, 0.6])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      seatClass(ctx);
      world.people.anjali.place(-2.7, -5.4, 0.3, "idle");
      const { rohan, sneha, imran } = world.people;
      const who: [typeof rohan, string, number][] = [
        [rohan, "Rohan Kumar", 0.8],
        [sneha, "Sneha Iyer", 1.3],
        [imran, "Imran Shaikh", 1.8],
      ];
      for (const [p, name, t] of who) {
        // a halo at desk height reads from every angle (floor rings hide under the desks)
        const ring = world.fx.ring(world.classroom.seatPos(name).add(V(0, 0, -0.2)), PAL.amber, 0.62, 0.84);
        const lbl = world.overlay.add(`${name.split(" ")[0]}<small>${flagLabel(ctx, name)}</small>`, "lbl amber", () => p.top(0.12), { priority: 2 });
        ctx.at(t, () => {
          ring.on = true;
          lbl.show();
        });
      }
      const m = data.remediate;
      store.show({ key: "laptop-alerts", device: "laptop", owner: "Anjali · laptop", note: "Every alert explains why it fired.", screen: { kind: "flags" } });
      ctx.at(0.5, () => store.patchSlot({ noteOn: true }));
      pointer.hover("flag-row-sneha-iyer", 1.6, 2.2);
      pointer.click("flag-row-rohan-kumar", 3.0);
      ctx.at(3.15, () => store.screen({ kind: "why", flag: m.rohan }));
      pointer.scroll(null, 3.15, 3.15);
      pointer.hover("flag-summary", 3.6, 4.2);
      pointer.scroll("flag-scores", 4.8, 5.6, 80);
      pointer.scroll("flag-mistake-mix", 6.4, 7.2, 80);
      pointer.hover("flag-mistake-mix", 6.9, 7.6);
      pointer.scroll(null, 8.0, 8.5);
      pointer.click("back-link", 9.0);
      ctx.at(9.15, () => store.screen({ kind: "flags" }));
      pointer.click("flag-row-sneha-iyer", 10.1);
      ctx.at(10.25, () => store.screen({ kind: "why", flag: m.sneha }));
      pointer.scroll(null, 10.25, 10.25);
      pointer.hover("flag-summary", 10.8, 11.6);
      pointer.scroll("flag-mistake-mix", 12.2, 13.0, 80);
    },
    update(_t, _dt, T, ctx) {
      ctx.world.classroom.updateStudents(T, 0.3);
    },
  },
  {
    title: "TARGETED PRACTICE",
    chapter: 2,
    dur: 14,
    caption: "Practice for Rohan, and every question cites a mistake he actually made.",
    stages: [[0, "act"]],
    decides: 8.8,
    light: "day",
    set: "classroom",
    cam: (t, ctx) => {
      const a = ctx.world.people.anjali.g.position;
      return shots(t, cam([-0.6, 3.0, -1.4], [-3.2, 1.0, -5.2]), [
        [2.6, 5.0, cam([a.x + 3.2, 4.6, a.z + 4.4], [a.x, 1.0, a.z])],
        [5.0, 14, cam([a.x + 3.0, 4.4, a.z + 4.6], [a.x, 1.0, a.z + 0.6])],
      ]);
    },
    stillCam: () => cam([3.2, 9.4, 10.4], [0, 0.4, 0.6]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const m = data.remediate;
      seatClass(ctx);
      const d = world.classroom.teacherDesk;
      const a = world.people.anjali.place(d.x, d.z - 0.66, 0, "sitType");
      a.anim = "type";
      const cr = world.classroom;
      const seat = (n: string) => cr.seatOf(n);
      const order = ["Imran Shaikh", "Sneha Iyer", "Rohan Kumar"];
      const stops = order.map((n) => ({ name: n, z: seat(n).z - 0.05, face: seat(n).x > 0 ? Math.PI / 2 : -Math.PI / 2 }));
      const path: [number, number][] = [
        [d.x, d.z - 0.66],
        [d.x + 0.95, d.z - 0.4],
        [d.x + 1.2, FRONT_Z],
        [0, FRONT_Z],
      ];
      const legs: { pts: [number, number][]; t0: number; t1: number; give: number; name: string; face: number }[] = [];
      let tt = 3.0;
      let from: [number, number][] = path;
      for (const s of stops) {
        const pts: [number, number][] = [...from, [0, s.z]];
        const len = pts.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
        const t1 = tt + len / 1.7;
        legs.push({ pts, t0: tt, t1, give: t1 + 0.15, name: s.name, face: s.face });
        tt = t1 + 0.8;
        from = [[0, s.z]];
      }
      ctx.state.legs = legs;
      ctx.at(3.0, () => {
        a.mode = "hold";
        a.anim = null;
        paperIn(a.itemR);
      });
      for (const leg of legs) {
        const st = seat(leg.name);
        const arc = world.fx.arc(V(0, 1.2, leg.pts[leg.pts.length - 1][1]), V(st.x, 1.05, st.z - 0.35), { height: 0.35, width: 0.8 });
        ctx.during(leg.give, leg.give + 0.5, (p) => arc.set(p));
        ctx.at(leg.give, () => {
          a.mode = "give";
          const paper = bb(world.classroom.root, PAL.paper, st.x, 0.79, st.deskZ + 0.02, 0.2, 0.004, 0.27);
          ctx.tl.onCleanup(() => {
            world.classroom.root.remove(paper);
          });
        });
        ctx.at(leg.give + 0.55, () => (a.mode = "hold"));
        const lbl = world.name(world.people[leg.name === "Rohan Kumar" ? "rohan" : leg.name === "Sneha Iyer" ? "sneha" : "imran"], leg.name.split(" ")[0], "practice sheet", 2);
        ctx.at(leg.give + 0.1, () => lbl.show());
      }
      // the builder
      store.show({ key: "laptop-alerts", device: "laptop", owner: "Anjali · laptop", note: "Nothing goes out until she assigns it.", screen: { kind: "why", flag: m.rohan } });
      ctx.at(0.4, () => store.patchSlot({ noteOn: true }));
      pointer.scroll("create-remedial-from-flag", 0.1, 0.7, 260);
      pointer.click("create-remedial-from-flag", 1.2);
      const setup0 = { studentIds: [m.rohan.student.id], conceptIds: m.builder.conceptIds, count: m.builder.defaultCount, mode: "group" as const };
      ctx.at(1.35, () => store.screen({ kind: "remedial", phase: "setup", setup: setup0, questions: [], status: "draft", dirty: false, busy: null }));
      pointer.scroll(null, 1.35, 1.35);
      pointer.scroll(`remedial-concept-${m.builder.conceptIds[0]}`, 1.6, 2.2, 160);
      pointer.hover(`remedial-concept-${m.builder.conceptIds[0]}`, 2.0, 2.6);
      pointer.scroll("remedial-count", 2.8, 3.3, 200);
      pointer.click("remedial-count", 3.7);
      ctx.at(3.95, () => store.update("remedial", (s) => ({ ...s, setup: { ...s.setup, count: m.builder.count } })));
      pointer.click("generate-remedial", 4.5);
      ctx.at(4.6, () => store.update("remedial", (s) => ({ ...s, busy: "generate" })));
      ctx.at(5.4, () => store.update("remedial", (s) => ({ ...s, phase: "review", busy: null, questions: m.builder.questions })));
      pointer.scroll("remedial-question-1", 5.6, 6.2, 90);
      pointer.hover("targets-mistake-1", 6.0, 6.8);
      pointer.scroll(`remedial-question-${m.builder.questions.length}`, 7.2, 8.0, 90);
      pointer.click(`remove-remedial-question-${m.builder.questions.length}`, 8.8);
      ctx.at(8.95, () => store.update("remedial", (s) => ({ ...s, dirty: true, questions: s.questions.slice(0, -1) })));
      pointer.scroll("remedial-builder", 9.3, 9.9, 60);
      pointer.scroll("save-remedial", 9.9, 10.1, 160);
      pointer.click("save-remedial", 10.5);
      ctx.at(10.65, () => store.update("remedial", (s) => ({ ...s, dirty: false })));
      pointer.click("assign-remedial", 11.4);
      ctx.at(11.55, () => store.update("remedial", (s) => ({ ...s, status: "assigned" })));
      pointer.click("print-remedial", 12.6);
    },
    update(t, _dt, T, ctx) {
      const a = ctx.world.people.anjali;
      const legs = ctx.state.legs as { pts: [number, number][]; t0: number; t1: number; give: number; face: number }[];
      if (t >= legs[0].t0) {
        const leg = [...legs].reverse().find((l) => t >= l.t0) ?? legs[0];
        walk(a, leg.pts, t, leg.t0, leg.t1, leg.face);
      }
      ctx.world.classroom.updateStudents(T, 0.5, a.g.position);
    },
  },
  {
    title: "SAME FLOW, BACK AGAIN",
    chapter: 2,
    dur: 10,
    caption: "His sheet comes back through the same flow: 8/10, and his alert moves to Improving.",
    stages: [[0, "track"]],
    light: "day",
    set: "classroom",
    cam: (t) => shots(t, cam([2.3, 2.45, -4.95], [-2.4, 1.05, -4.0]), [[4.6, 7.0, cam([1.6, 2.6, -4.7], [-2.9, 1.1, -4.6])]]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const s = data.remediate.sheet;
      seatClass(ctx);
      const d = world.classroom.teacherDesk;
      const a = world.people.anjali.place(d.x, d.z + 0.85, 0, "idle");
      a.phone.visible = true;
      const r = world.people.rohan;
      r.place(0, -0.9, Math.PI, "hold");
      paperIn(r.itemR);
      world.name(r, "Rohan", "his practice sheet", 2).show();
      ctx.state.rohanPath = [
        [0, -0.9],
        [0, FRONT_Z + 0.25],
        [d.x, d.z + 1.65],
      ];
      ctx.at(2.4, () => (r.mode = "give"));
      ctx.at(2.8, () => {
        r.itemR.clear();
        paperIn(a.itemL);
        a.mode = "hold";
      });
      ctx.at(3.3, () => {
        a.mode = "phoneShoot";
        a.phoneOn(true, "#ffe1cc", 0.6);
      });
      world.fx.flash(3.8, V(d.x, 1.4, d.z + 1.2));
      ctx.at(4.4, () => {
        a.mode = "idle";
        r.mode = "idle";
      });
      // phone: capture → review → final → alert
      store.show({ key: "phone-remedial", device: "phone", owner: "Anjali · phone", clock: "11:20", note: s.finaliseNote, screen: { kind: "wizard-sheets", sheets: 0, pages: 0, progress: null, title: s.title, sampleKind: null, eyebrow: `Class ${data.section.name} · Remedial · ${formatDate(s.assignedDate)}`, back: "the remedial sheet" } });
      pointer.tap("^capture-sheets", 3.2);
      ctx.at(3.95, () => store.update("wizard-sheets", (x) => ({ ...x, sheets: 1, pages: 1, progress: { done: 1, total: 1 } })));
      ctx.at(4.5, () => store.screen(reviewScreen(s.reviewItems, s.title, `Class ${data.section.name} · Remedial`)));
      pointer.scroll(null, 4.5, 4.5);
      pointer.scroll("answer-review-card", 4.7, 5.0, 60);
      pointer.scroll("accept-answer", 5.1, 5.4, 360);
      pointer.tap("accept-answer", 5.6);
      ctx.at(5.7, () => reviewAccept(store));
      pointer.scroll(null, 5.9, 6.2);
      pointer.tap("accept-all-high", 6.45);
      ctx.at(6.55, () => reviewUi(store, { confirmHigh: true }));
      pointer.tap("confirm-accept-high", 7.05);
      ctx.at(7.15, () => reviewAcceptHigh(store));
      pointer.tap("finalise-assessment", 7.6);
      ctx.at(7.7, () => {
        store.update("review", (x) => ({ ...x, isFinal: true, finaliseNotes: [s.finaliseNote] }));
        store.patchSlot({ noteOn: true });
      });
      pointer.scroll("finalise-notes", 7.8, 8.1, 90);
      ctx.at(8.6, () => store.screen({ kind: "why", flag: data.remediate.rohanAfter }));
      pointer.scroll(null, 8.6, 8.6);
      pointer.scroll("flag-history", 9.0, 9.7, 60);
    },
    update(t, _dt, T, ctx) {
      const r = ctx.world.people.rohan;
      const path = ctx.state.rohanPath as [number, number][];
      if (t < 4.6) walk(r, path, t, 0, 2.3, Math.PI);
      else walk(r, [...path].reverse(), t, 4.6, 7.4, Math.PI);
      if (t >= 4.6 && t < 4.65) r.mode = "idle";
      ctx.world.classroom.updateStudents(T, 0.4, r.g.position);
    },
  },
];
