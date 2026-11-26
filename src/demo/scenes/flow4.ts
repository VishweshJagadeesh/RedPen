/** Flow 4 — PTM, and the outro. */
import { clamp, ease, prog } from "../engine/math";
import type { SceneDef } from "../engine/scene";
import { V, cam, ringsFrom, seatClass, shots } from "./helpers";

export const FLOW4: SceneDef[] = [
  {
    title: "PTM DAY",
    chapter: 3,
    dur: 16,
    pre: 3,
    banner: "Specifics, not just marks",
    caption: "She walks into the PTM with specifics: what slipped, what she did, what helps at home.",
    stages: [[0, "track"]],
    light: "afternoon",
    set: "ptm",
    cam: (t) =>
      shots(t, cam([1.2, 9.6, 0.9], [1.2, 0.3, -5.0]), [
        [3.0, 5.8, cam([0.4, 2.4, -1.6], [-3.2, 1.0, -4.9])],
        [7.6, 10.4, cam([-1.0, 1.9, -2.6], [-3.4, 1.15, -5.0])],
      ]),
    setup(ctx) {
      const { world, data, store, pointer } = ctx;
      const d = world.classroom.teacherDesk;
      const { anjali, mother, parents } = world.people;
      const a = anjali.place(d.x, d.z - 0.66, 0, "sitTalk");
      a.anim = "talk";
      mother.place(d.x - 0.45, d.z + 1.0, Math.PI, "sitTalk");
      mother.anim = "nod";
      parents[0].place(5.62, -3.9, -Math.PI / 2, "sit");
      parents[1].place(5.62, -2.6, -Math.PI / 2, "sit");
      parents[2].place(5.3, -5.3, -Math.PI / 2 - 0.4, "idle");
      world.name(anjali, "Anjali", "", 2);
      const ml = world.name(mother, data.ptm.parentName, "PTM", 3);
      ctx.at(0.6, () => ml.show());
      const wl = world.place("Parents waiting", V(5.5, 2.3, -3.6));
      ctx.at(1.2, () => wl.show());
      // one talking point, summarised in short bubbles
      const tp = data.ptm.summary.talkingPoints[data.ptm.summary.talkingPoints.length - 1]?.en ?? "";
      const [first, second] = tp.split(" — ");
      const b1 = world.say(first.replace(/\.$/, "") + ".", anjali);
      ctx.at(8.8, () => b1.show());
      ctx.at(11.6, () => b1.show(false));
      if (second) {
        const b2 = world.say(second.charAt(0).toUpperCase() + second.slice(1), anjali);
        ctx.at(11.8, () => b2.show());
      }
      store.show({ key: "laptop-ptm", device: "laptop", owner: "Anjali's laptop · turned to the parent", note: "Every statement links to its source test or question.", screen: { kind: "ptm", lang: "en" } });
      ctx.at(0.5, () => store.patchSlot({ noteOn: true }));
      pointer.scroll("ptm-trend", 1.0, 1.7, 80);
      pointer.scroll("ptm-focus", 3.4, 4.2, 120);
      pointer.hover("ptm-focus", 3.9, 4.6);
      pointer.scroll("ptm-term", 5.6, 6.4, 90);
      pointer.hover("ptm-term", 6.0, 6.8);
      pointer.scroll("ptm-talking-points", 8.0, 8.8, 90);
      pointer.hover("ptm-talking-points", 8.6, 9.6);
      pointer.scroll(null, 10.4, 11.2);
      pointer.click("ptm-language-toggle", 12.0);
      ctx.at(12.15, () => store.update("ptm", (s) => ({ ...s, lang: "hi" })));
      pointer.scroll("ptm-talking-points", 13.0, 13.8, 90);
    },
    update(t, _dt, _T, ctx) {
      // she turns the laptop toward the parent
      ctx.world.classroom.laptop.rotation.y = Math.PI * (1 - ease(clamp(prog(t, 1.8, 3.2))));
    },
  },
  {
    title: "OUTRO",
    chapter: "all",
    dur: 10,
    caption: "",
    stages: [[0, "all"]],
    light: "day",
    set: "classroom",
    cam: (t) => shots(t, cam([0.3, 3.0, 9.6], [0, 1.0, 1.0]), [[0.4, 7.5, cam([0.4, 24, 9.5], [0, 0, -0.4])]]),
    stillCam: () => cam([0.4, 24, 9.5], [0, 0, -0.4]),
    setup(ctx) {
      const { world, data, store } = ctx;
      seatClass(ctx);
      world.people.anjali.place(1.6, -6.0, 0, "idle");
      const cr = world.classroom;
      cr.rings.visible = cr.tiles.visible = true;
      cr.colourRings(ringsFrom(ctx, data.reteach.after));
      cr.board.set(data.reteach.evidence.conceptName, ["Grade → Diagnose → Act → Track"]);
      const names: [string, string][] = [
        ["Rohan Kumar", "rohan"],
        ["Sneha Iyer", "sneha"],
        ["Imran Shaikh", "imran"],
      ];
      names.forEach(([n], i) => {
        const s = cr.seatOf(n);
        const arc = world.fx.arc(V(cr.teacherDesk.x, 1.2, cr.teacherDesk.z), V(s.x, 1.2, s.z), { height: 1.2 });
        ctx.during(1.2 + i * 0.35, 2.4 + i * 0.35, (p) => arc.set(p));
        const ck = world.check(V(s.x, 2.2, s.z));
        ctx.at(2.6 + i * 0.35, () => ck.show());
      });
      store.show({ key: "outro", device: "card", owner: "RedPen", screen: { kind: "outro", lit: 0, line: false } });
      ctx.at(3.6, () => store.update("outro", (s) => ({ ...s, line: true })));
    },
    update(t, _dt, T, ctx) {
      const lit = Math.floor(t / 0.9) % 4;
      ctx.store.update("outro", (s) => (s.lit === lit ? s : { ...s, lit }));
      ctx.world.classroom.updateStudents(T, 0.2);
    },
  },
];
