/** Flow 2 — Reteach: the class-wide pattern, the plan, teaching it, and checking it landed. */
import { formatDate } from "@/lib/format";
import { initialTeachingUi } from "@/components/reteach/TeachingMode";
import type { GenerationStep } from "@/components/shared/GenerationProgress";
import { clamp, prog } from "../engine/math";
import type { SceneCtx, SceneDef } from "../engine/scene";
import { progressOf } from "../data/progress";
import { PAL } from "../world/kit";
import { NONE, V, cam, ringWave, ringsFrom, seatClass, shots } from "./helpers";

const WEIGHT: Record<string, number> = { evidence: 1, misconceptions: 1, draft: 6, checks: 1, pairs: 1, save: 0.5 };

/** Anjali at the teacher's desk, facing the class. */
function atDesk(ctx: SceneCtx, mode: "sitType" | "sitTalk" = "sitType") {
  const d = ctx.world.classroom.teacherDesk;
  return ctx.world.people.anjali.place(d.x, d.z - 0.66, 0, mode);
}

/** Arcs between each mentor and their learners (the plan's peer pairs). */
function pairArcs(ctx: SceneCtx, t0: number, t1: number, width = 0.7) {
  const sec = ctx.data.reteach.sections.find((s) => s.kind === "peer_pairs");
  const cr = ctx.world.classroom;
  const byId = (id: string) => cr.seats.find((s) => s.student.id === id);
  const links: [ReturnType<typeof byId>, ReturnType<typeof byId>][] = [];
  // one link per mentor group (to the first learner) keeps the room readable
  for (const g of sec?.pairs?.groups ?? []) if (g.learners[0]) links.push([byId(g.mentorId), byId(g.learners[0].id)]);
  const arcs = links
    .filter(([a, b]) => a && b)
    .map(([a, b]) => ctx.world.fx.arc(V(a!.x, 1.32, a!.z), V(b!.x, 1.32, b!.z), { height: 0.45, color: "#ffb36b", width }));
  arcs.forEach((arc, i) => ctx.during(t0 + ((t1 - t0) * i) / Math.max(1, arcs.length), t0 + ((t1 - t0) * i) / Math.max(1, arcs.length) + 0.8, (p) => arc.set(p)));
  return arcs;
}

export const FLOW2: SceneDef[] = [
  {
    title: "THE PATTERN",
    chapter: 1,
    dur: 12,
    pre: 3,
    banner: "From marks to a lesson plan",
    caption: "Every reviewed answer is data: 33 of 52 are below 50% on transposing terms.",
    stages: [[0, "diagnose"]],
    light: "day",
    set: "classroom",
    cam: (t) =>
      shots(t, cam([-6.4, 7.2, 11.5], [0, 0.4, 0.2]), [
        [0, 6.5, cam([5.2, 8.4, 10.2], [-0.2, 0.5, 0.4])],
        [6.5, 12, cam([3.2, 9.2, 9.6], [-0.2, 0.4, 0.2])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const r = data.reteach;
      seatClass(ctx);
      world.people.anjali.place(2.2, -6.0, -0.2, "idle");
      const cr = world.classroom;
      cr.rings.visible = cr.tiles.visible = true;
      cr.colourRings(NONE);
      const label = world.place(`${r.evidence.conceptName} · ${r.card.studentsUnder} of ${r.card.studentsAssessed} below 50%`, V(0, 2.9, 1.0), "hot big");
      ctx.at(4.6, () => label.show());
      store.show({ key: "laptop-class", device: "laptop", owner: "Anjali · laptop", note: "Snippets come from her students' answers, anonymised.", screen: { kind: "heatmap" } });
      pointer.hover(`heatmap-concept-${r.conceptId}`, 1.6, 2.4);
      pointer.scroll("class-concept-heatmap", 0.4, 1.2, 60);
      pointer.scroll("heatmap-row-20", 3.0, 4.4, 200);
      ctx.at(6.2, () => {
        store.screen({ kind: "weak-card", card: r.card });
        store.patchSlot({ noteOn: true });
      });
      pointer.scroll(null, 6.2, 6.2);
      pointer.scroll("weak-concept-affected", 6.6, 7.2, 160);
      pointer.hover("weak-concept-affected", 6.8, 7.4);
      pointer.scroll("weak-concept-misconceptions", 8.2, 9.0, 120);
      pointer.hover("weak-concept-misconceptions", 8.6, 9.3);
      pointer.scroll("weak-concept-snippet-0", 10.0, 10.8, 120);
      pointer.hover("weak-concept-snippet-1", 10.4, 11.1);
    },
    update(t, _dt, T, ctx) {
      const r = ctx.data.reteach;
      ringWave(ctx, t, 1.4, 4.4, NONE, ringsFrom(ctx, r.before));
      ctx.world.classroom.updateStudents(T, 0.2);
    },
  },
  {
    title: "PLAN THE RETEACH",
    chapter: 1,
    dur: 16,
    caption: "A reteach plan built from her class's own mistakes, and she edits it before teaching.",
    stages: [[0, "act"]],
    decides: 12.8,
    light: "day",
    set: "classroom",
    cam: (t) =>
      shots(t, cam([-0.5, 2.45, -3.85], [-3.3, 1.0, -5.45]), [
        [0, 9, cam([0.2, 2.75, -3.7], [-3.3, 0.95, -5.5])],
        [10.2, 12.4, cam([3.4, 9.6, 9.8], [-0.2, 0.3, 0.2])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const r = data.reteach;
      seatClass(ctx);
      const a = atDesk(ctx);
      a.anim = "type";
      const cr = world.classroom;
      cr.rings.visible = cr.tiles.visible = true;
      cr.colourRings(ringsFrom(ctx, r.before));
      const arcs = pairArcs(ctx, 10.9, 12.6);
      const pairsLabel = world.place(`Peer pairs · ${r.evidence.mentors} mentors`, V(0, 2.6, 2.2), "big");
      ctx.at(11.2, () => pairsLabel.show());
      void arcs;
      store.show({ key: "laptop-class", device: "laptop", owner: "Anjali · laptop", note: "Nothing reaches students until she prints or teaches it.", screen: { kind: "weak-card", card: r.card } });
      pointer.scroll("plan-reteach", 0.1, 0.6, 260);
      pointer.click("plan-reteach", 1.1);
      ctx.at(1.25, () => store.screen({ kind: "reteach-setup", values: { periodMinutes: r.defaultPeriod, resources: "blackboard", language: "en", note: "" }, steps: null, percent: 0, elapsed: 0 }));
      pointer.scroll(null, 1.25, 1.25);
      pointer.scroll("reteach-period", 1.4, 1.9, 150);
      pointer.hover("reteach-period", 1.8, 2.3);
      pointer.hover("reteach-resources", 2.5, 2.9);
      pointer.click("reteach-language", 3.4);
      ctx.at(3.55, () => store.update("reteach-setup", (s) => ({ ...s, values: { ...r.inputs } })));
      ctx.at(1.4, () => store.patchSlot({ noteOn: true }));
      pointer.click("generate-plan", 4.3);
      // generation steps as the server streams them
      const steps = r.generation;
      const times = [4.4, 4.9, 5.4, 6.2, 6.7, 7.1, 7.35];
      const stateAt = (k: number, active: boolean): GenerationStep[] =>
        steps.map((s, i) => ({ id: s.id, label: s.label, status: i < k ? "done" : i === k && active ? "active" : "pending", detail: i < k ? s.detail : undefined }));
      steps.forEach((_, k) => {
        ctx.at(times[k], () => {
          const st = stateAt(k, true);
          const done = st.filter((s) => s.status === "done").reduce((t, s) => t + WEIGHT[s.id], 0);
          const total = Object.values(WEIGHT).reduce((a, b) => a + b, 0);
          store.update("reteach-setup", (s) => ({ ...s, steps: st, percent: (done / total) * 100, elapsed: Math.round(times[k] - times[0]) }));
        });
      });
      pointer.scroll("plan-progress", 4.5, 5.0, 120);
      ctx.at(7.5, () => store.screen({ kind: "plan", sections: r.sections, shown: 0, editingId: null, dirty: false, status: "draft" }));
      pointer.scroll(null, 7.5, 7.5);
      ctx.during(7.6, 10.6, (p) => store.update("plan", (s) => ({ ...s, shown: Math.max(1, Math.round(p * r.sections.length)) })));
      pointer.scroll("plan-section-explanation", 8.1, 8.8, 120);
      pointer.hover("cites-explanation", 8.6, 9.2);
      pointer.scroll("plan-section-misconception", 9.4, 10.0, 120);
      pointer.hover("cites-misconception", 9.8, 10.3);
      pointer.scroll("peer-pairs", 10.7, 11.4, 120);
      // she edits one line of the guided practice
      const gp = r.sections.find((s) => s.kind === "guided_practice")!;
      pointer.scroll("plan-section-guided_practice", 11.9, 12.4, 110);
      pointer.click("edit-section-guided_practice", 12.8);
      ctx.at(12.9, () => store.update("plan", (s) => ({ ...s, editingId: gp.id })));
      const extra = " Pehle 2 minute khud try karein, phir pair mein.";
      ctx.type((add) => store.update("plan", (s) => ({ ...s, dirty: add.length > 0, sections: s.sections.map((x) => (x.id === gp.id ? { ...x, body: gp.body + add } : x)) })), extra, 13.3, 14.6);
      pointer.click("edit-section-guided_practice", 15.0, 0.4);
      ctx.at(15.1, () => store.update("plan", (s) => ({ ...s, editingId: null })));
      pointer.hover("plan-section-guided_practice", 15.4, 15.9);
    },
    update(_t, _dt, T, ctx) {
      ctx.world.classroom.updateStudents(T, 0.3);
    },
  },
  {
    title: "TEACH IT",
    chapter: 1,
    dur: 14,
    caption: "She teaches it in one period, step by step, with mentors paired with learners.",
    stages: [[0, "act"]],
    light: "day",
    set: "classroom",
    cam: (t) =>
      shots(t, cam([3.9, 2.7, -0.4], [0.1, 1.6, -6.6]), [
        [0, 7, cam([3.3, 2.5, -1.3], [0.2, 1.65, -6.7])],
        [7, 9.5, cam([-2.5, 3.0, 2.4], [0.2, 1.35, -5.2])],
        [9.5, 14, cam([-1.7, 2.9, 1.4], [0.3, 1.5, -5.7])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const r = data.reteach;
      seatClass(ctx);
      const a = world.people.anjali.place(1.25, -6.45, Math.PI, "write");
      a.anim = "write";
      ctx.at(4.0, () => {
        a.mode = "point";
        a.anim = "talk";
        a.yaw = 0.3;
      });
      ctx.at(6.2, () => {
        a.mode = "write";
        a.anim = "write";
        a.yaw = Math.PI;
      });
      ctx.at(10.0, () => {
        a.mode = "point";
        a.anim = "talk";
        a.yaw = 0.2;
      });
      const arcs = pairArcs(ctx, 0, 0.01, 0.55);
      arcs.forEach((x) => x.set(1));
      const steps = r.teachingSteps;
      const start = steps.findIndex((s) => s.kind === "explanation");
      const ui0 = initialTeachingUi(steps);
      store.show({ key: "laptop-teach", device: "laptop", owner: "Anjali · laptop · teaching mode", note: "One step at a time, with a timer for each.", screen: { kind: "teach", ui: { ...ui0, index: start, remaining: steps[start].minutes * 60, running: true } } });
      ctx.at(0.4, () => store.patchSlot({ noteOn: true }));
      ctx.during(0, 8.1, (p) => store.update("teach", (s) => (s.ui.index === start ? { ...s, ui: { ...s.ui, remaining: steps[start].minutes * 60 - Math.floor(p * 8.1) } } : s)));
      pointer.click("next-step", 8.2);
      ctx.at(8.3, () => store.update("teach", (s) => ({ ...s, ui: { ...s.ui, index: start + 1, remaining: steps[start + 1].minutes * 60, running: false } })));
      pointer.click("toggle-timer", 9.2, 0.6);
      ctx.at(9.3, () => store.update("teach", (s) => ({ ...s, ui: { ...s.ui, running: true } })));
      ctx.during(9.3, 14, (p) => store.update("teach", (s) => ({ ...s, ui: { ...s.ui, remaining: steps[start + 1].minutes * 60 - Math.floor(p * 4.7) } })));
      pointer.scroll("teaching-next-step", 10.3, 11.0, 220);
      pointer.hover("teaching-next-step", 11.0, 11.8);
      ctx.state.header = `${r.evidence.conceptName} · ${formatDate(r.taughtDate)}`;
      ctx.state.lines = (r.boardPlan ?? "").split("\n").filter((l) => !/^LHS/.test(l));
    },
    update(t, _dt, T, ctx) {
      const lines = ctx.state.lines as string[];
      const shown = Math.floor(clamp((t - 2.4) / 1.25, 0, lines.length));
      ctx.world.classroom.board.set(ctx.state.header as string, lines.slice(0, shown), clamp(prog(t, 0.4, 2.2)) || 0.001);
      const a = ctx.world.people.anjali;
      ctx.world.classroom.updateStudents(T, 0.85, a.g.position);
    },
  },
  {
    title: "DID IT LAND?",
    chapter: 1,
    dur: 10,
    caption: "The exit ticket comes back through the same grading flow: mastery 36% → 71%.",
    stages: [[0, "track"]],
    light: "day",
    set: "classroom",
    cam: (t) => shots(t, cam([-0.2, 4.6, 0.6], [-2.8, 0.8, -4.9]), [[3.2, 6.0, cam([2.6, 8.8, 9.6], [-0.3, 0.3, 0.2])]]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const r = data.reteach;
      seatClass(ctx);
      const a = atDesk(ctx);
      a.anim = "type";
      const cr = world.classroom;
      cr.rings.visible = cr.tiles.visible = true;
      // exit tickets travel to the teacher's desk
      const desk = cr.teacherDesk.clone().setY(0.95);
      const picks = cr.seats.filter((_, i) => i % 4 === 0);
      picks.forEach((s, i) => world.fx.sheetStream(V(s.x, 0.95, s.z - 0.3), desk.clone().add(V(0.18, 0.05, 0.12)), 1, 0.3 + i * 0.2, 0.3 + i * 0.2 + 1.0, 1.0, 0.9 + (s.z + 7) * 0.05, 40 + i));
      ctx.at(2.6, () => (cr.exitStack.visible = true));
      const label = world.place(`${r.evidence.conceptName} · ${r.cardAfter.plan?.beforePct}% → ${r.cardAfter.plan?.afterPct}%`, V(0, 2.9, 1.0), "good big");
      ctx.at(7.4, () => label.show());
      store.show({ key: "laptop-exit", device: "laptop", owner: "Anjali · laptop", note: "Exit tickets go through the same review before they count.", screen: { kind: "grading", progress: progressOf([], 0, r.exitTicket.sheets, 4), running: true, title: r.exitTicket.title, eyebrow: `Class ${data.section.name} · Exit ticket · ${formatDate(r.taughtDate)}` } });
      ctx.at(0.4, () => store.patchSlot({ noteOn: true }));
      ctx.state.order = r.exitTicket.progress;
      ctx.during(0.6, 3.8, (p) => {
        const full = r.exitTicket.progress;
        const n = Math.floor(p * full.totalSheets);
        const frac = n / full.totalSheets;
        store.update("grading", (s) => ({
          ...s,
          running: n < full.totalSheets,
          progress:
            n >= full.totalSheets
              ? full
              : {
                  ...full,
                  gradedSheets: n,
                  answersGraded: Math.round(frac * full.totalAnswers),
                  bands: { high: Math.round(frac * full.bands.high), medium: Math.round(frac * full.bands.medium), low: Math.round(frac * full.bands.low) },
                  sheetBands: { high: Math.round(frac * full.sheetBands.high), medium: Math.round(frac * full.sheetBands.medium), low: Math.round(frac * full.sheetBands.low) },
                  recent: full.recent.slice(0, Math.min(8, n)),
                  done: false,
                },
        }));
      });
      ctx.at(4.6, () => store.screen({ kind: "weak-card", card: r.cardAfter }));
      pointer.scroll(null, 4.6, 4.6);
      pointer.scroll("reteach-outcome", 5.2, 6.0, 150);
      pointer.hover("mastery-before-after", 6.4, 7.2);
    },
    update(t, _dt, T, ctx) {
      const r = ctx.data.reteach;
      ringWave(ctx, t, 4.6, 7.6, ringsFrom(ctx, r.before), ringsFrom(ctx, r.after));
      ctx.world.classroom.updateStudents(T, 0.4);
      void PAL;
    },
  },
];
