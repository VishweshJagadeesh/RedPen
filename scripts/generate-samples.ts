/**
 * npm run samples:generate
 *
 * Renders synthetic handwritten answer sheets (and the printed question papers / answer keys) for the
 * demo, from the same fixtures the mock AI uses. Students' answers are written in a handwriting font
 * (Kalam / Caveat) on lined paper with slight rotation, noise, crossed-out lines and faint pencil.
 * If samples/<path> contains a real photo for a page, it is copied instead of rendered.
 * Also writes the eval gold set to evals/gold/*.json.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { mockSheets, layoutFor, type MockSheet } from "../lib/fixtures/sheets";
import { C8_EXIT_TICKET_TRANSPOSING, paper, type PaperFixture } from "../lib/fixtures/papers";
import { createRng, hashString } from "../lib/fixtures/rng";
import { buildGoldSet } from "../lib/evals/gold";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public");
const W = 850;
const H = 1202;

function font(file: string) {
  const p = path.join(ROOT, "node_modules/@fontsource", file);
  return `data:font/woff2;base64,${fs.readFileSync(p).toString("base64")}`;
}

const FONT_CSS = `
@font-face { font-family: Kalam; src: url(${font("kalam/files/kalam-latin-400-normal.woff2")}) format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+2212, U+00D7, U+00BD, U+221A, U+00B2; }
@font-face { font-family: Kalam; src: url(${font("kalam/files/kalam-latin-ext-400-normal.woff2")}) format("woff2"); unicode-range: U+0100-024F, U+2070-218F, U+2190-22FF; }
@font-face { font-family: Kalam; src: url(${font("kalam/files/kalam-devanagari-400-normal.woff2")}) format("woff2"); unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF; }
@font-face { font-family: KalamLight; src: url(${font("kalam/files/kalam-latin-300-normal.woff2")}) format("woff2"); }
@font-face { font-family: Caveat; src: url(${font("caveat/files/caveat-latin-400-normal.woff2")}) format("woff2"); }
@font-face { font-family: Caveat; src: url(${font("caveat/files/caveat-latin-ext-400-normal.woff2")}) format("woff2"); unicode-range: U+0100-024F, U+2070-218F, U+2190-22FF; }
`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Style {
  family: string;
  size: number;
  ink: string;
  slant: number;
  rotate: number;
  spacing: number;
}

function styleFor(seedKey: string, opts: { faint?: boolean; messy?: boolean } = {}): Style {
  const rng = createRng(hashString(`style:${seedKey}`));
  const caveat = rng.chance(0.35);
  return {
    family: caveat ? "Caveat, Kalam" : "Kalam, Caveat",
    size: caveat ? rng.range(30, 34) : rng.range(22, 26),
    ink: opts.faint ? "rgba(90,90,95,0.42)" : rng.pick(["#1c2f8a", "#1d3b9c", "#1b1b2f", "#203a7a"]),
    slant: rng.range(-5, 4),
    rotate: rng.range(-1.1, 1.1),
    spacing: opts.messy ? rng.range(0.2, 0.8) : rng.range(-0.3, 0.4),
  };
}

function pageShell(inner: string, style: Style, opts: { printed?: boolean; seed: string }) {
  const rng = createRng(hashString(`page:${opts.seed}`));
  const lines = opts.printed
    ? ""
    : `background-image: linear-gradient(to right, transparent 74px, rgba(220,70,70,0.45) 74px, rgba(220,70,70,0.45) 76px, transparent 76px), repeating-linear-gradient(to bottom, transparent 0, transparent 33px, rgba(110,150,210,0.38) 33px, rgba(110,150,210,0.38) 34px);`;
  const tint = opts.printed ? "#fdfdfb" : `hsl(${rng.range(40, 52)}, ${rng.range(25, 45)}%, ${rng.range(95, 97.5)}%)`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${FONT_CSS}
html,body{margin:0;padding:0;background:#6b6b6b;}
#stage{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#7a7a78;}
#page{position:absolute;inset:6px;background:${tint};${lines}transform:rotate(${style.rotate}deg) scale(0.985);box-shadow:0 2px 12px rgba(0,0,0,.35);}
#noise{position:absolute;inset:0;opacity:${opts.printed ? 0.05 : 0.11};pointer-events:none;mix-blend-mode:multiply;}
.hand{font-family:${style.family};color:${style.ink};font-size:${style.size}px;line-height:34px;letter-spacing:${style.spacing}px;transform:skewX(${style.slant}deg);transform-origin:left top;white-space:pre;}
.region{position:absolute;overflow:hidden;}
.qlabel{font-weight:700;margin-right:8px;}
.struck{position:relative;display:inline-block;opacity:.85}
.struck::after{content:"";position:absolute;left:-4px;right:-6px;top:52%;height:2.5px;background:currentColor;transform:rotate(-3deg);}
.struck::before{content:"";position:absolute;left:-2px;right:-4px;top:40%;height:2px;background:currentColor;transform:rotate(4deg);}
.printed{font-family:"Times New Roman",Georgia,serif;color:#111;font-size:19px;line-height:1.5;}
.printed h1{font-size:24px;margin:0 0 4px;text-align:center}
.printed h2{font-size:17px;margin:0 0 14px;text-align:center;font-weight:normal}
.printed .q{margin:10px 0}
.printed .marks{float:right;font-weight:bold}
.printed .rub{font-size:15px;color:#333;margin-left:22px}
</style></head><body><div id="stage"><div id="page">${inner}
<svg id="noise" width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${rng.range(0.7, 0.95)}" numOctaves="3" seed="${rng.int(1, 999)}"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
</div></div></body></html>`;
}

function box(c: { x: number; y: number; w: number; h: number }) {
  return `left:${(c.x * 100).toFixed(2)}%;top:${(c.y * 100).toFixed(2)}%;width:${(c.w * 100).toFixed(2)}%;height:${(c.h * 100).toFixed(2)}%;`;
}

function numberline(style: Style, wrong: boolean) {
  const ticks = Array.from({ length: 13 }, (_, i) => i);
  const x = (v: number) => 30 + (v + 2) * 110;
  const mark = (v: number, label: string) =>
    `<circle cx="${x(v)}" cy="60" r="5" fill="${style.ink}"/><text x="${x(v) - 16}" y="40" font-family="Kalam" font-size="20" fill="${style.ink}">${label}</text>`;
  return `<svg width="560" height="110" style="display:block;margin:8px 0 0 30px">
<line x1="20" y1="60" x2="540" y2="60" stroke="${style.ink}" stroke-width="2"/>
${ticks.map((i) => `<line x1="${30 + i * 36.6}" y1="${(i % 3 === 0 ? 50 : 54)}" x2="${30 + i * 36.6}" y2="${(i % 3 === 0 ? 70 : 66)}" stroke="${style.ink}" stroke-width="${i % 3 === 0 ? 2 : 1.2}"/>`).join("")}
${[-2, -1, 0, 1, 2].map((v) => `<text x="${x(v) - 6}" y="95" font-family="Kalam" font-size="18" fill="${style.ink}">${v}</text>`).join("")}
${mark(wrong ? -0.75 : -1.25, "−5/4")}${mark(1.75, "7/4")}
</svg>`;
}

function sheetPageHtml(sheet: MockSheet, pageIndex: number): string {
  const messy = sheet.answers.some((a) => a.render.crossedOut.length > 0);
  const style = styleFor(sheet.sheetRef.replace(/-.*$/, "") + sheet.studentId, { messy });
  const parts: string[] = [];
  if (pageIndex === 0) {
    const h = sheet.layout.header;
    parts.push(`<div class="region" style="${box(h)}"><div class="printed" style="font-size:16px;color:#333">${esc(sheet.title)}</div>
<div class="hand" style="margin-top:4px">Name: ${esc(sheet.written.name)}     Roll No: ${esc(sheet.written.roll)}     Class: 8B</div></div>`);
  }
  for (const a of sheet.answers.filter((x) => x.pageIndex === pageIndex)) {
    const faint = a.render.faint;
    const s = faint ? { ...style, ink: "rgba(95,95,100,0.45)", family: "KalamLight, Kalam" } : style;
    const lines: string[] = [];
    for (const l of a.render.crossedOut) lines.push(`<span class="struck">${esc(l)}</span>`);
    for (const l of a.render.lines) lines.push(esc(l));
    const body = a.render.diagram
      ? numberline(s, a.gold.awards[1] === 0)
      : lines.length
        ? lines.map((l, i) => `<div style="margin-left:${i === 0 ? 0 : 34}px">${l}</div>`).join("")
        : "";
    parts.push(`<div class="region" style="${box(a.crop)}"><div class="hand" style="color:${s.ink};font-family:${s.family}"><span class="qlabel">Q${a.questionNumber}.</span>${
      a.render.diagram ? "" : ""
    }${body}</div></div>`);
  }
  return pageShell(parts.join("\n"), style, { seed: `${sheet.sheetRef}:${pageIndex}` });
}

function printedPaperHtml(p: PaperFixture, kind: "paper" | "key"): string {
  const total = p.questions.reduce((s, q) => s + q.maxMarks, 0);
  const qs = p.questions
    .map((q) =>
      kind === "paper"
        ? `<div class="q"><span class="marks">[${q.maxMarks}]</span><b>Q${q.number}.</b> ${esc(q.text)}</div>`
        : `<div class="q"><span class="marks">[${q.maxMarks}]</span><b>Q${q.number}.</b> ${esc(q.answerKey.split("\n").slice(-1)[0])}
<div class="rub">${q.solution.flat().map(esc).join("<br/>")}</div>
<div class="rub"><i>Marking:</i> ${q.rubric.map((r) => `${esc(r.step)} (${r.marks})`).join("; ")}</div></div>`,
    )
    .join("");
  const inner = `<div class="printed" style="position:absolute;inset:50px 56px">
<h1>${kind === "paper" ? "" : "ANSWER KEY — "}${esc(p.title)}</h1>
<h2>Class ${p.gradeLevel} · Mathematics · Maximum marks: ${total}</h2>
${kind === "paper" ? `<div style="font-size:15px;margin-bottom:10px">Show all working. Marks are given for each correct step.</div>` : ""}
${qs}</div>`;
  return pageShell(inner, styleFor("printed"), { printed: true, seed: `${p.key}:${kind}` });
}

async function shoot(page: Page, html: string, key: string) {
  const real = path.join(ROOT, key);
  const out = path.join(OUT, key);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (fs.existsSync(real)) {
    fs.copyFileSync(real, out);
    return "copied";
  }
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const el = await page.$("#stage");
  await el!.screenshot({ path: out, type: "jpeg", quality: 58 });
  return "rendered";
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  let rendered = 0;
  let copied = 0;
  const tally = (r: string) => (r === "copied" ? copied++ : rendered++);

  for (const [p, keyBase] of [
    [paper("c8-wt4"), "samples/papers/c8-wt4"],
    [C8_EXIT_TICKET_TRANSPOSING, "samples/papers/c8-et-transposing"],
  ] as const) {
    tally(await shoot(page, printedPaperHtml(p, "paper"), `${keyBase}-paper.jpg`));
    tally(await shoot(page, printedPaperHtml(p, "key"), `${keyBase}-key.jpg`));
  }

  const sheets = [...mockSheets().values()];
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.pageKeys.length; i++) tally(await shoot(page, sheetPageHtml(sheet, i), sheet.pageKeys[i]));
  }
  await browser.close();
  console.log(`[samples] ${rendered} pages rendered, ${copied} real photos copied into public/samples`);

  const gold = buildGoldSet();
  fs.mkdirSync(path.join(ROOT, "evals/gold"), { recursive: true });
  for (const [name, entries] of Object.entries(gold)) {
    fs.writeFileSync(path.join(ROOT, "evals/gold", `${name}.json`), JSON.stringify(entries, null, 2) + "\n");
    console.log(`[samples] evals/gold/${name}.json: ${entries.length} entries`);
  }
}

void layoutFor;
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
