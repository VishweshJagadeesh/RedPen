/** Flow 1 — Grade: the stack, snapping the sheets, grading, and the teacher's review. */
import { formatDate } from "@/lib/format";
import { ASSESSMENT_TYPE_LABEL } from "@/lib/domain";
import { clamp, prog } from "../engine/math";
import type { SceneDef } from "../engine/scene";
import { progressOf } from "../data/progress";
import { H, V, cam, reviewAccept, reviewAcceptHigh, reviewDraft, reviewEdit, reviewSaveOverride, reviewScreen, reviewUi, shots } from "./helpers";

const SEAT = H(0, 0, 0.62);
const STAND = H(0.05, 0, 0.78);

/** Anjali at the table: sitting (default) or standing over it with the phone. */
function anjaliAtTable(ctx: Parameters<SceneDef["setup"]>[0], mode: "sitDesk" | "sitType" | "phoneShoot" = "sitDesk") {
  const a = ctx.world.people.anjali;
  if (mode === "phoneShoot") a.place(STAND.x, STAND.z, Math.PI, "phoneShoot");
  else a.place(SEAT.x, SEAT.z, Math.PI, mode);
  return a;
}

function eyebrow(ctx: Parameters<SceneDef["setup"]>[0]) {
  return `Class ${ctx.data.section.name} · ${ASSESSMENT_TYPE_LABEL.weekly_test} · ${formatDate(ctx.data.grade.date)}`;
}

export const FLOW1: SceneDef[] = [
  {
    title: "THE STACK",
    chapter: 0,
    dur: 8,
    caption: "Three sections, 152 students, and a stack of answer sheets every week.",
    stages: [],
    light: "night",
    set: "home",
    cam: (t) => shots(t, cam([82.9, 2.35, -1.75], [79.9, 1.05, 0.6]), [[0, 8, cam([81.55, 1.7, -1.1], [80, 1.0, 0.45])]]),
    setup(ctx) {
      const { world, data, store } = ctx;
      const a = anjaliAtTable(ctx);
      const label = world.name(a, "Anjali", `Maths teacher · ${data.teacher.sections.length} sections, ${data.teacher.studentCount} students`, 2);
      ctx.at(0.7, () => label.show());
      store.show({ key: "phone-lock", device: "phone", owner: "Anjali · phone", screen: { kind: "lock", time: "9:40", date: "Thursday, 5 November", notification: false } });
      ctx.at(2.6, () => {
        store.update("lock", (s) => ({ ...s, notification: true }));
        world.home.phoneLit(1);
      });
      ctx.at(3.4, () => store.patchSlot({ note: `Weekly Test 4 · ${data.grade.sheetCount} sheets · ${data.grade.pageCount} pages`, noteOn: true }));
    },
    update(t, _dt, _T, ctx) {
      ctx.world.home.setClock(21, 40, Math.floor(12 + t));
      if (t > 2.6) ctx.world.home.phoneLit(0.75 + 0.25 * Math.sin(t * 6));
    },
  },
  {
    title: "SNAP THE SHEETS",
    chapter: 0,
    dur: 14,
    caption: "She photographs the paper, the key and all 52 sheets. Names are matched for her.",
    stages: [[0, "grade"]],
    light: "night",
    set: "home",
    cam: (t) =>
      shots(t, cam([81.9, 1.95, -1.4], [80, 1.05, 0.3]), [
        [3.6, 5.6, cam([81.25, 2.2, -1.05], [79.75, 0.85, 0.2])],
        [10.6, 12.6, cam([82.2, 2.15, -1.5], [80, 1.0, 0.35])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const g = data.grade;
      const a = anjaliAtTable(ctx, "phoneShoot");
      a.phone.visible = true;
      a.phoneOn(true, "#ffe1cc", 0.6);
      world.home.phone.visible = false;
      const shots: number[] = [1.25, 2.65];
      for (let i = 0; i < 10; i++) shots.push(6.3 + i * 0.4);
      for (const s of shots) world.fx.flash(s, H(-0.42, 1.25, -0.02));
      ctx.state.flashes = shots;
      const sneha = g.sheets.find((s) => s.detectedName === "Sneha I.")!;
      const studentOf = (id: string | null) => g.roster.find((r) => r.id === id);
      store.show({
        key: "phone-wizard",
        device: "phone",
        owner: "Anjali · phone",
        note: "A page with a name and roll number starts a new sheet.",
        screen: { kind: "wizard-details", values: { sectionId: data.section.id, type: "weekly_test", title: "", date: g.date, paper: 0, key: 0 }, busy: false },
      });
      ctx.type((title) => store.update("wizard-details", (s) => ({ ...s, values: { ...s.values, title } })), g.title, 0.15, 0.85);
      pointer.scroll("^upload-paper-camera", 0.5, 0.95, 260);
      pointer.tap("^upload-paper-camera", 1.05);
      ctx.at(1.45, () => store.update("wizard-details", (s) => ({ ...s, values: { ...s.values, paper: 1 } })));
      pointer.tap("^upload-key-camera", 2.45);
      ctx.at(2.85, () => store.update("wizard-details", (s) => ({ ...s, values: { ...s.values, key: 1 } })));
      pointer.scroll("create-assessment", 2.9, 3.3, 380);
      pointer.tap("create-assessment", 3.45);
      ctx.at(3.5, () => store.update("wizard-details", (s) => ({ ...s, busy: true })));
      ctx.at(4.1, () => store.screen({ kind: "wizard-questions" }));
      pointer.scroll(null, 4.1, 4.1);
      pointer.scroll("question-row-3", 4.5, 5.3, 120);
      pointer.scroll("confirm-questions", 5.35, 5.75, 420);
      pointer.tap("confirm-questions", 5.85);
      ctx.at(6.05, () => store.screen({ kind: "wizard-sheets", sheets: 0, pages: 0, progress: null, title: g.title, sampleKind: null }));
      pointer.scroll(null, 6.05, 6.05);
      pointer.tap("^capture-sheets", 6.15);
      ctx.during(6.3, 10.3, (p) => {
        const sheets = Math.max(1, Math.round(p * g.sheetCount));
        store.update("wizard-sheets", (s) => ({ ...s, sheets, pages: Math.round((sheets * g.pageCount) / g.sheetCount), progress: { done: Math.round((sheets * g.pageCount) / g.sheetCount), total: g.pageCount } }));
      });
      pointer.scroll("upload-summary", 6.4, 6.9, 420);
      ctx.at(10.7, () => {
        store.screen({ kind: "wizard-match", sheets: g.sheets, ready: false, title: g.title });
        store.patchSlot({ note: "2 sheets need a name check: names and rolls are read from page 1.", noteOn: true });
      });
      pointer.scroll(null, 10.7, 10.7);
      pointer.scroll("match-summary", 11.0, 11.5, 70);
      pointer.tap(`match-select-${sneha.id}`, 12.1);
      ctx.at(12.45, () =>
        store.update("wizard-match", (s) => ({
          ...s,
          sheets: s.sheets.map((x) => (x.id === sneha.id ? { ...x, studentId: studentOf(sneha.studentId)!.id, confidence: 1, reason: "Confirmed by you", needsReview: false } : x)),
        })),
      );
      ctx.at(0.4, () => store.patchSlot({ noteOn: true }));
    },
    update(t, _dt, _T, ctx) {
      const { world, data } = ctx;
      const done = clamp(prog(t, 6.3, 10.3));
      world.home.setStacks(data.grade.sheetCount * (1 - done), data.grade.sheetCount * done);
      world.home.setClock(21, 41, Math.floor(t * 4) % 60);
      const flashes = ctx.state.flashes as number[];
      const a = world.people.anjali;
      a.mode = flashes.some((f) => t >= f - 0.25 && t < f + 0.15) ? "phoneShoot" : t > 3.2 && t < 6.1 ? "phoneLook" : "phoneShoot";
    },
  },
  {
    title: "GRADING",
    chapter: 0,
    dur: 10,
    caption: "Every answer is graded twice, step by step, and given a confidence: High, Medium or Low.",
    stages: [[0, "grade"]],
    light: "night",
    set: "home",
    cam: (t) => shots(t, cam([82.05, 1.85, -1.75], [80.05, 0.9, 0.15]), [[0.5, 9.5, cam([81.75, 1.75, -1.55], [80.1, 0.88, 0.05])]]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const g = data.grade;
      const a = anjaliAtTable(ctx, "sitType");
      a.anim = "type";
      world.home.setStacks(0, g.sheetCount);
      world.home.phone.visible = true;
      const from = world.home.P.stackB.clone().setY(0.95);
      const to = world.home.P.laptop.clone().add(V(0, 0.2, -0.12));
      world.fx.sheetStream(from, to, 44, 1.2, 8.3, 1.1, 0.55, 3);
      const P = world.home.P;
      const sb = g.finalProgress.sheetBands;
      const names: [string, string, number][] = [
        ["tagH", "High", sb.high],
        ["tagM", "Medium", sb.medium],
        ["tagL", "Low", sb.low],
      ];
      names.forEach(([cls, label, n], k) => {
        const tag = world.overlay.add(`${label} ${n}`, `lbl ${cls}`, H(P.pileX[k] - 80, 0.8 + Math.min(40, n) * 0.0064, P.pileZ), { priority: 2 });
        ctx.at(8.3 + k * 0.15, () => tag.show());
      });
      store.show({
        key: "laptop-grade",
        device: "laptop",
        owner: "Anjali · laptop",
        note: "Every answer gets two independent grading passes.",
        screen: { kind: "grading", progress: progressOf(g.gradingOrder, 0, g.sheetCount, 5), running: true, title: g.title, eyebrow: eyebrow(ctx) },
      });
      ctx.at(0.6, () => store.patchSlot({ noteOn: true }));
      ctx.during(1.2, 8.3, (p) => {
        const n = Math.floor(p * g.sheetCount);
        store.update("grading", (s) => ({ ...s, progress: progressOf(g.gradingOrder, n, g.sheetCount, 5), running: n < g.sheetCount }));
      });
      pointer.hover("go-to-review", 8.9, 9.6);
    },
    update(t, _dt, _T, ctx) {
      const { world, data } = ctx;
      const g = data.grade;
      world.home.setLaptopOpen(clamp(prog(t, 0.1, 1.0)));
      const n = Math.floor(clamp(prog(t, 1.2, 8.3)) * g.sheetCount);
      const graded = g.gradingOrder.slice(0, n);
      world.home.setPiles([graded.filter((s) => s.band === "high").length, graded.filter((s) => s.band === "medium").length, graded.filter((s) => s.band === "low").length]);
      world.home.setStacks(0, g.sheetCount - n);
      world.home.setClock(21, 52, Math.floor(t * 6) % 60);
    },
  },
  {
    title: "SHE HAS THE FINAL SAY",
    chapter: 0,
    dur: 16,
    caption: "Unsure answers come first. Nothing is final until she accepts it.",
    stages: [[0, "grade"]],
    decides: 2.7,
    light: "night",
    set: "home",
    cam: (t) =>
      shots(t, cam([81.75, 1.75, -1.55], [80.1, 0.88, 0.05]), [
        [0, 3.0, cam([81.95, 1.85, -1.65], [80.05, 0.92, 0.2])],
        [10.5, 12.5, cam([81.6, 1.6, -1.35], [80.35, 0.85, -0.15])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const g = data.grade;
      const a = anjaliAtTable(ctx, "sitType");
      a.anim = "type";
      world.home.setStacks(0, 0);
      world.home.setLaptopOpen(1);
      const sb = g.finalProgress.sheetBands;
      world.home.setPiles([sb.high, sb.medium, sb.low]);
      const P = world.home.P;
      const pileTop = (k: number, n: number) => H(P.pileX[k] - 80, 0.8 + Math.min(40, n) * 0.0064, P.pileZ);
      const tags = [
        world.overlay.add(`High ${sb.high}`, "lbl tagH", pileTop(0, sb.high), { priority: 2 }).show(),
        world.overlay.add(`Medium ${sb.medium}`, "lbl tagM", pileTop(1, sb.medium), { priority: 2 }).show(),
        world.overlay.add(`Low ${sb.low}`, "lbl tagL", pileTop(2, sb.low), { priority: 2 }).show(),
      ];
      const check = world.check(pileTop(0, sb.high).add(V(-0.12, 0.02, 0)));
      store.show({ key: "laptop-grade", device: "laptop", owner: "Anjali · laptop", note: "AI-suggested marks stay labelled until she accepts them.", screen: { kind: "grading", progress: g.finalProgress, running: false, title: g.title, eyebrow: eyebrow(ctx) } });
      ctx.at(0.3, () => store.patchSlot({ noteOn: true }));
      pointer.click("go-to-review", 0.6, 0.5);
      ctx.at(0.75, () => store.screen(reviewScreen(g.reviewItems, g.title, eyebrow(ctx), g.messyId)));
      pointer.scroll(null, 0.75, 0.75);
      // the crossed-out answer: AI 2/4 → teacher 3/4 on step 3, with a note
      pointer.scroll("review-marks", 1.2, 2.1, 70);
      pointer.key("E", 2.6);
      ctx.at(2.7, () => reviewEdit(store));
      pointer.click("step-input-3", 3.4);
      ctx.at(3.75, () => reviewDraft(store, { awards: g.messyFinalAwards }));
      pointer.scroll("override-note", 4.1, 4.6, 230);
      pointer.click("override-note", 4.9);
      ctx.type((note) => reviewDraft(store, { note }), "working is correct, final line crossed out", 5.05, 6.6);
      pointer.scroll("save-override", 6.7, 7.0, 330);
      pointer.click("save-override", 7.3);
      ctx.at(7.4, () => reviewSaveOverride(store));
      ctx.at(7.45, () => tags[2].html(`Low ${sb.low} · 1 reviewed`));
      // the next one: accepted with the A key
      pointer.scroll(null, 7.6, 8.2);
      pointer.scroll("review-reasoning", 8.4, 8.9, 200);
      pointer.key("A", 9.4);
      ctx.at(9.5, () => {
        reviewAccept(store);
        tags[2].html(`Low ${sb.low} · 2 reviewed`);
      });
      // accept all High, with the confirmation dialog
      pointer.scroll(null, 9.8, 10.3);
      pointer.click("accept-all-high", 10.9);
      ctx.at(11.0, () => reviewUi(store, { confirmHigh: true }));
      pointer.click("confirm-accept-high", 12.6, 0.9);
      ctx.at(12.7, () => {
        reviewAcceptHigh(store);
        check.show();
        tags[0].html(`High ${sb.high} · accepted`);
      });
      pointer.hover("reviewed-count", 13.4, 14.2);
    },
    update(t, _dt, _T, ctx) {
      ctx.world.home.setClock(22, 3, Math.floor(t * 3) % 60);
    },
  },
];
