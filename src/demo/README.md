# The walkthrough (`/demo`)

A scripted, auto-playing walkthrough of RedPen's four flows. The left of the 1920×1080 stage is a low-poly
three.js scene (Anjali, her class 8B, a PTM); the right is **the real product UI** — the app's own
presentational components — reacting at the same moment inside phone and laptop frames.

Open `/demo` (public, no sign-in). The landing page links to it as **Watch the walkthrough**.

## How it fits together

```
app/demo/page.tsx            the route (client-only stage)
app/demo/data.json/route.ts  the data snapshot, built at build time (force-static)
src/demo/
  data/build.ts              snapshot from the seed fixtures, via the app's own pure functions
  data/types.ts              DemoData (what the snapshot holds)
  engine/timeline.ts         at / during / typeInto / cleanup (pure, unit-tested)
  engine/player.ts           scene lifecycle, stepping, seeking, camera blending, chrome
  engine/hash.ts             deep links (pure, unit-tested)
  world/                     three.js: sets, people rig, students, effects, overlay labels
  device/store.ts            DemoStore: what each device screen shows
  device/Screens.tsx         store screen → real components (UploadWizard, ReviewQueueView, …)
  device/ScreenFrame.tsx     iframe device screens (own viewport for breakpoints, fixed, dialogs)
  device/pointer.ts          cursor, tap ripples, key caps and scrolling, declared per scene
  scenes/                    the 13 scenes (flow1.ts … flow4.ts), listed in scenes/index.ts
  Stage.tsx, stage.css       the stage chrome (top bar, panels, caption, controls, banner)
```

**Every number on screen comes from the seed data.** `data/build.ts` runs the four flows on the fixtures in
order — WT4 is graded by the mock AI and reviewed, transposing terms is reteached and the exit ticket graded,
Rohan's remedial sheet comes back, the PTM summary is built — using the same pure functions the app uses
(`lib/diagnosis`, `lib/planner/evidence`, `lib/planner/mock`, `lib/remedial/questions`, `lib/ptm/student-facts`,
`lib/grading/rows`, `lib/grading/review-items`). Only the thin database glue of each page is mirrored there,
with a pointer to the original. `tests/unit/demo-data.test.ts` pins the story numbers and checks that every
number in a caption exists in the snapshot.

**Real states only.** The device screens render the app's components with props from `DemoStore`. Components
that held view state the script needs to drive were split into a controlled view plus the original stateful
wrapper (same export, same behaviour in the app): `ReviewQueueView`, `TeachingModeView`; and
`AssessmentDetailsForm`, `ReteachInputsForm`, `ReteachPlanEditor` and `PtmSummary` take optional controlled
props. Each screen is an iframe, so the components lay out at the device's own width (their `sm:`/`lg:`
breakpoints are viewport-based), `position: fixed` (teaching mode) fills the device, and dialogs mount inside it
(`PortalContainerContext` in `components/ui/dialog.tsx`). Text on the screens is at least 14px at stage scale.

## Defining a scene

A scene is a `SceneDef` (`engine/scene.ts`):

```ts
{
  title: "SNAP THE SHEETS",          // scene tag (top-left of the 3D view)
  chapter: 0,                        // ribbon: 0 Grade, 1 Reteach, 2 Remediate, 3 PTM, "all"
  dur: 14,                           // seconds
  pre: 3, banner: "From marks to…",  // optional pre-roll with the chapter banner
  caption: "…",                      // ≤ 90 characters, numbers from the data
  stages: [[0, "grade"]],            // loop pills: [time, "grade" | "diagnose" | "act" | "track" | "all"]
  decides: 2.7,                      // optional: shows the "Teacher decides" pill, lit from this time
  light: "night", set: "home",       // lighting preset and set ("home" | "classroom" | "ptm")
  cam: (t, ctx) => shots(t, base, [[t0, t1, framing], …]),
  stillCam: (ctx) => framing,        // optional: camera with reduced motion
  setup(ctx) { … },                  // place people, show a device, schedule cues
  update(t, dt, T, ctx) { … },       // per frame (walking, rings, clocks)
}
```

Inside `setup`, schedule everything on the scene's timeline — never with `setTimeout` — so seeking can replay it:

| Helper | What it does |
|---|---|
| `ctx.at(t, fn)` | run once at time t (cues at equal times run in the order added) |
| `ctx.during(t0, t1, fn(p))` | every frame between t0 and t1, p from 0 to 1 (last call p = 1) |
| `ctx.type(set, text, t0, t1)` | typing: calls `set` with a growing prefix |
| `ctx.store.show / screen / update / patchSlot` | change the device, its screen, its owner chip or note |
| `ctx.pointer.click(id, t)` | laptop: move the cursor onto `[data-demo-id=id]` and click at t (ripple + pressed state) |
| `ctx.pointer.tap(id, t)` | phone: tap ripple (`^id` targets the element's parent, e.g. a file input's label) |
| `ctx.pointer.hover(id, t0, t1)`, `key("A", t)`, `scroll(id, t0, t1, offset)` | point, show a key cap, scroll the screen |
| `ctx.world.*` | people (`people.anjali`, `rohan`, …), `classroom`, `home`, `fx.arc / ring / flash / sheetStream`, `name / place / check / say` labels |

Cleanup is automatic: entering a scene resets the world (effects, labels, people) and replaces the timeline.
Register anything else you add with `ctx.tl.onCleanup(fn)`.

## Adding or retiming a scene

1. Add a `SceneDef` to one of `scenes/flow*.ts` (or a new file listed in `scenes/index.ts`).
2. To retime, change `dur` and shift the cue times in that scene's `setup`; scenes are independent, so
   nothing else moves. Keep the whole run at 2.5–3.5 minutes (`tests/unit/demo-data.test.ts` checks it).
3. If a scene needs a new screen, add a variant to `Screen` in `device/store.ts` and render it with the real
   component in `device/Screens.tsx`. If it needs new numbers, add them to `data/build.ts` (computed, not typed).
4. Run `npm run demo:check` and look at the screenshots in `demo-shots/`.

## Deep links and controls

`/demo#s=5&t=7.5&p=0` — `s` scene number (1-based), `t` seconds into the scene (after its pre-roll),
`p=0` start paused. Changing the hash re-seeks. `window.__demo` exposes `{ ready, state, scenes, go, seek,
play, pause, totalSeconds }`.

Keyboard: ←/→ previous/next scene, Space play/pause, R restart, H hide the controls.

Reduced motion (`prefers-reduced-motion`): the timeline is the same; each scene holds one still camera (its
`stillCam`, or its final framing), camera moves between scenes cut instead of blending, particles are cut to a
quarter, flashes are dimmed and rings stop pulsing.

## Checks and recording

- `npm run demo:check` — Playwright opens every scene at four timestamps, saves screenshots to `demo-shots/`,
  and fails on console errors, an overflowing or over-long caption, an empty device screen, or overlay labels
  that overlap or leave the 3D view. `DEMO_SIZES=1920x1080,1440x900,1366x768` checks other window sizes.
  `DEMO_BASE_URL=http://localhost:3000` uses a server that is already running (otherwise it starts `next dev`).
- `npm run demo:record` — records the full run at 1920×1080 to `demo.webm` (a backup if a live link fails).
  By default it is Playwright's video of the demo playing in real time, which needs a machine that renders the
  3D scene at full speed. `DEMO_RECORD_MODE=frames npm run demo:record` records frame by frame instead
  (`window.__demo.manual(true)` + `advance(1/30)`, CSS animations slowed to match, frames piped to `ffmpeg` with
  libvpx-vp9): smooth 30 fps on any machine, at roughly 0.3 s per frame with software WebGL.
  `DEMO_RECORD_SECONDS=10` records only the start.
- `npm test` includes the engine helpers (`demo-engine.test.ts`) and the snapshot (`demo-data.test.ts`).
