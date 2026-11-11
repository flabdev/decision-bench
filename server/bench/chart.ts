import type { BenchSummary, LiveDecisions, ModelSummary } from "./results";

// Renders the bench results as two self-contained SVGs (light or dark):
// "choices", a scatter of good-move rate against typical answer time (best corner: top left), and
// "decisions", bars of decisions per live run, drawn to scale and split into correct, other and too late.
// Baselines (the heuristic) are yardsticks, not entrants, so they are left out.

export type ChartTheme = "light" | "dark";
export type ChartPart = "choices" | "decisions";
export const CHART_PARTS: readonly ChartPart[] = ["choices", "decisions"];

interface Palette {
  bg: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  decision: string;
  language: string;
  correct: string;
  other: string;
  late: string;
}

const PALETTES: Record<ChartTheme, Palette> = {
  light: {
    bg: "#fcfcfb",
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    decision: "#2a78d6",
    language: "#eb6834",
    correct: "#1a7f4b",
    other: "#a8dcbc",
    late: "#d9433f",
  },
  dark: {
    bg: "#1a1a19",
    ink: "#f0efec",
    ink2: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    axis: "#383835",
    decision: "#3987e5",
    language: "#d95926",
    correct: "#3fb36d",
    other: "#2a5a40",
    late: "#f06a64",
  },
};

const W = 1000;
/** Top of each chart's body, below the title, subtitle and legend. */
const BODY_TOP = 136;
/** Scatter plot area. Labels sit to the right of their points, so the right edge keeps room for them. */
const PX0 = 80;
const PX1 = W - 220;
const P1_TOP = BODY_TOP + 14;
const P1_H = 300;
const P1_BOT = P1_TOP + P1_H;
const POINT_R = 8;
/** Bars. */
const LABEL_W = 170;
const BAR_X0 = LABEL_W + 18;
const ROW_H = 42;
const BAR_H = 24;
/** Surface-coloured gap between the segments of a bar. */
const SEG_GAP = 2;
/** Smallest room kept to the right of the longest bar for its value label. */
const MIN_VALUE_ROOM = 70;
/** Approximate advance of one character of the 14 px labels. */
const CHAR_W = 7.7;
const LABEL_MAX = 20;
/** Marks a mock row when chart drew it (--allow-mock). */
const MOCK_TAG = " (mock)";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif";
/** Widest likely glyph, as a share of the font size: text is laid out so a wide fallback font still fits. */
const WIDE = 0.6;
const FOOTER_LINE = 18;
/** Font sizes: title, subtitle, legend and labels, axis ticks, row names, footer. */
const FS = { title: 22, sub: 14, label: 14, axis: 13, row: 15, footer: 13 };
/** Candidate ticks of the answer-time axis, in ms. */
const TIME_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
/** Display names of environment ids. */
const ENVIRONMENTS: Record<string, string> = { tetris: "Deadline Tetris" };

const HEADINGS: Record<ChartPart, { title: string; sub: string; aria: string }> = {
  choices: {
    title: "Quality vs speed",
    sub: "How good are the choices, and how fast? Each mark is a model. Best is the top-left corner ↖",
    aria: "Good-move rate against typical answer time, one mark per model",
  },
  decisions: {
    title: "Decisions per run: on time and correct",
    sub: "Green arrived on time, red too late.",
    aria: "Decisions per live run, split into correct and on time, other move, and too late",
  },
};

type Kind = "decision" | "language";

const LEGEND: [Kind, string][] = [
  ["decision", "Decision model"],
  ["language", "Language model"],
];

/** One part of the results as a self-contained SVG: title, legend, body, footer. Pure: same input, same string. */
export function renderChart(summary: BenchSummary, theme: ChartTheme, part: ChartPart): string {
  const c = PALETTES[theme];
  const rows = summary.models.filter((m) => m.kind !== "baseline");
  const notes = wrap(footer(summary), Math.floor((W - 48) / (FS.footer * WIDE)));
  const bodyBottom = part === "choices" ? P1_BOT + 46 : BODY_TOP + rows.length * ROW_H - 14;
  const H = bodyBottom + 46 + (notes.length - 1) * FOOTER_LINE;
  const heading = HEADINGS[part];
  const present = new Set(rows.map(kindOf));

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" rx="8" fill="${c.bg}"/>`);
  parts.push(text(24, 40, FS.title, 600, c.ink, heading.title));
  parts.push(text(24, 66, FS.sub, 400, c.muted, part === "decisions" ? `${heading.sub}${deadlineNote(summary)}` : heading.sub));

  let lx = 24;
  if (part === "choices") {
    for (const [kind, name] of LEGEND) {
      if (!present.has(kind)) continue;
      parts.push(marker(kind, lx + 6, 96, 6, c[kind]));
      parts.push(text(lx + 20, 101, FS.label, 400, c.ink2, name));
      lx += 20 + name.length * CHAR_W + 28;
    }
  } else {
    for (const seg of SEGMENTS) {
      parts.push(`<rect x="${lx}" y="89" width="12" height="12" rx="3" fill="${c[seg]}"/>`);
      parts.push(text(lx + 20, 101, FS.label, 400, c.ink2, SEGMENT_NAMES[seg]));
      lx += 20 + SEGMENT_NAMES[seg].length * CHAR_W + 28;
    }
  }

  parts.push(...(part === "choices" ? scatter(rows, c) : decisionBars(rows, c)));

  notes.forEach((line, i) => {
    parts.push(text(24, H - 18 - (notes.length - 1 - i) * FOOTER_LINE, FS.footer, 400, c.muted, line));
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="${esc(heading.aria)}">\n${parts.join("\n")}\n</svg>\n`;
}

/** Good-move rate (0-100%, up is better) against median answer time (log scale, left is faster). */
function scatter(rows: ModelSummary[], c: Palette): string[] {
  const parts: string[] = [];
  parts.push(text(PX0, P1_TOP - 12, FS.axis, 400, c.ink2, "↑ Good-move rate (higher is better)"));

  for (const pct of [0, 25, 50, 75, 100]) {
    const y = yOf(pct);
    parts.push(`<line x1="${PX0}" y1="${y}" x2="${PX1}" y2="${y}" stroke="${pct === 0 ? c.axis : c.grid}" stroke-width="1"/>`);
    parts.push(text(PX0 - 10, y + 4, FS.axis, 400, c.muted, `${pct}%`, 'text-anchor="end"'));
  }

  const points = rows.filter((m) => m.goodMoveRate !== null && m.medianMs !== null && m.medianMs > 0);
  if (points.length === 0) {
    parts.push(text(PX0 + 12, P1_TOP + P1_H / 2, FS.label, 400, c.muted, "No graded answers in these logs"));
    return parts;
  }
  const [lo, hi] = timeDomain(points.map((m) => m.medianMs ?? 0));
  const xOf = (ms: number) => PX0 + ((Math.log10(ms) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (PX1 - PX0);
  for (const tick of TIME_TICKS.filter((t) => t >= lo && t <= hi)) {
    const x = xOf(tick).toFixed(1);
    parts.push(`<line x1="${x}" y1="${P1_TOP}" x2="${x}" y2="${P1_BOT}" stroke="${c.grid}" stroke-width="1"/>`);
    parts.push(text(x, P1_BOT + 20, FS.axis, 400, c.muted, duration(tick), 'text-anchor="middle"'));
  }
  parts.push(text(PX0, P1_BOT + 42, FS.axis, 400, c.ink2, "← Typical answer time, log scale (faster is better)"));

  // Labels go right of their point; one that would overlap a label already placed moves down a line.
  const placed: { x: number; y: number; w: number }[] = [];
  const ordered = [...points].sort((a, b) => (b.goodMoveRate ?? 0) - (a.goodMoveRate ?? 0));
  for (const m of ordered) {
    const kind = kindOf(m);
    const x = xOf(m.medianMs ?? 0);
    const y = yOf(m.goodMoveRate ?? 0);
    const tip = `${esc(rowLabel(m))}: ${Math.round(m.goodMoveRate ?? 0)}% good moves, ${duration(m.medianMs ?? 0)}`;
    parts.push(marker(kind, x, y, POINT_R, c[kind], tip));
    const label = rowLabel(m);
    const w = Array.from(label).length * CHAR_W;
    const lx = x + POINT_R + 7;
    let ly = y + 4;
    while (placed.some((p) => Math.abs(p.y - ly) < 17 && lx < p.x + p.w && p.x < lx + w)) ly += 17;
    placed.push({ x: lx, y: ly, w });
    parts.push(text(lx.toFixed(1), ly, FS.label, 400, c.ink, label));
  }
  return parts;
}

/**
 * Decisions per live run, to scale: a bar's length is the pieces the model had to place in a run, split into
 * correct and on time, on time but another move, and too late. Sorted by correct decisions, most first.
 */
function decisionBars(rows: ModelSummary[], c: Palette): string[] {
  const parts: string[] = [];
  const top = BODY_TOP;
  const sorted = [...rows].sort((a, b) => (b.live?.correct ?? -1) - (a.live?.correct ?? -1));
  const widest = Math.max(0, ...sorted.map((m) => (m.live === null ? 0 : Array.from(decisionLabel(m.live)).length)));
  // Room for the widest label even in a wide fallback font, so it never runs past the edge.
  const span = W - 24 - BAR_X0 - Math.max(MIN_VALUE_ROOM, Math.ceil(widest * FS.label * WIDE) + 12);
  const max = Math.max(0, ...sorted.map((m) => (m.live === null ? 0 : total(m.live))));
  parts.push(`<line x1="${BAR_X0}" y1="${top - 8}" x2="${BAR_X0}" y2="${top + sorted.length * ROW_H - 10}" stroke="${c.axis}" stroke-width="1"/>`);
  sorted.forEach((m, i) => {
    const y = top + i * ROW_H;
    parts.push(text(LABEL_W, y + BAR_H / 2 + 5, FS.row, 400, c.ink, rowLabel(m), 'text-anchor="end"'));
    if (m.live === null || max === 0) {
      parts.push(text(BAR_X0 + 6, y + BAR_H / 2 + 5, FS.label, 400, c.muted, "—"));
      return;
    }
    const live = m.live;
    const drawn = SEGMENTS.filter((seg) => live[seg] > 0);
    let x = BAR_X0;
    drawn.forEach((seg, k) => {
      const w = (live[seg] / max) * span;
      // A thin gap before the next segment keeps neighbours apart; a sliver is never swallowed by it.
      const gap = k < drawn.length - 1 && w > SEG_GAP * 2 ? SEG_GAP : 0;
      const tip = `${esc(rowLabel(m))}: ${perRun(live[seg])} ${SEGMENT_NAMES[seg].toLowerCase()} per run (${share(live[seg], live)}%)`;
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, w - gap).toFixed(1)}" height="${BAR_H}" fill="${c[seg]}"><title>${tip}</title></rect>`,
      );
      x += w;
    });
    parts.push(text((x + 8).toFixed(1), y + BAR_H / 2 + 5, FS.label, 400, c.ink2, decisionLabel(live)));
  });
  return parts;
}

const SEGMENTS = ["correct", "other", "late"] as const;
type Segment = (typeof SEGMENTS)[number];
const SEGMENT_NAMES: Record<Segment, string> = { correct: "On time, correct", other: "On time, other move", late: "Too late" };

/** " A piece lands 19.5 s after it appears at the start, 0.5 s at the fastest." Empty without live runs. */
function deadlineNote(summary: BenchSummary): string {
  const d = summary.deadlines;
  return d === null ? "" : ` Time to answer: ${duration(d.maxMs)} at the start, down to ${duration(d.minMs)}.`;
}

function total(live: LiveDecisions): number {
  return live.correct + live.other + live.late;
}

/** A segment as a whole-number percentage of the model's decisions. */
function share(n: number, live: LiveDecisions): number {
  const t = total(live);
  return t > 0 ? Math.round((100 * n) / t) : 0;
}

function perRun(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "100% on time · 60% correct · 119 decisions": shares of all the model's decisions, then their count per run. */
function decisionLabel(live: LiveDecisions): string {
  const n = Math.round(total(live));
  return `${100 - share(live.late, live)}% on time · ${share(live.correct, live)}% correct · ${n} ${n === 1 ? "decision" : "decisions"}`;
}

function yOf(pct: number): number {
  return P1_BOT - (pct / 100) * P1_H;
}

/** The answer-time axis: the nearest ticks a step beyond the fastest and slowest answers, so no mark sits on an edge. */
function timeDomain(values: number[]): [number, number] {
  const min = Math.min(...values) / 1.3;
  const max = Math.max(...values) * 1.3;
  const lo = [...TIME_TICKS].reverse().find((t) => t <= min) ?? TIME_TICKS[0];
  const hi = TIME_TICKS.find((t) => t >= max) ?? TIME_TICKS[TIME_TICKS.length - 1];
  return [lo, hi > lo ? hi : lo * 10];
}

function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
}

/** A circle for a decision model, a square for a language model, so the kind never rests on colour alone. */
function marker(kind: Kind, x: number, y: number, r: number, fill: string, tip?: string): string {
  const title = tip === undefined ? "" : `<title>${tip}</title>`;
  const end = title ? `>${title}</${kind === "decision" ? "circle" : "rect"}>` : "/>";
  if (kind === "decision") return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"${end}`;
  const s = r * 1.8;
  return `<rect x="${(x - s / 2).toFixed(1)}" y="${(y - s / 2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="2" fill="${fill}"${end}`;
}

function kindOf(m: ModelSummary): Kind {
  return m.kind === "system-one" ? "decision" : "language";
}

/** The label of a model: a mock row keeps its (mock) tag, cutting the name to make room for it. */
function rowLabel(m: ModelSummary): string {
  return m.mock ? `${shortLabel(m.label, LABEL_MAX - MOCK_TAG.length)}${MOCK_TAG}` : shortLabel(m.label, LABEL_MAX);
}

/** Lines of at most `max` characters, breaking only between " · " clauses. */
function wrap(clauses: string[], max: number): string[] {
  const lines: string[] = [];
  for (const clause of clauses) {
    const last = lines.at(-1);
    if (last !== undefined && Array.from(`${last} · ${clause}`).length <= max) lines[lines.length - 1] = `${last} · ${clause}`;
    else lines.push(clause);
  }
  return lines;
}

/** One short line of what was played. The README carries the rest. */
function footer(summary: BenchSummary): string[] {
  const id = summary.environment.split(" ")[0];
  const clauses = [ENVIRONMENTS[id] ?? summary.environment];
  const live = summary.games.realtime;
  const paused = summary.games.frozen;
  if (live > 0) clauses.push(`${runs(live, "Live")}${summary.realtimeSeconds === null ? "" : `, up to ${gameLength(summary.realtimeSeconds)} each`}`);
  if (paused > 0) clauses.push(`${runs(paused, "Paused")}${summary.frozenPieces === null ? "" : `, ${summary.frozenPieces} pieces each`}`);
  const left = summary.skipped.length;
  if (left > 0) clauses.push(`${left} unfinished ${left === 1 ? "run" : "runs"} left out`);
  clauses.push("no error bars yet");
  return clauses;
}

function runs(n: number, mode: string): string {
  return `${n} ${mode} ${n === 1 ? "run" : "runs"}`;
}

/** A live game's time limit in words; whole minutes read as minutes. */
function gameLength(seconds: number): string {
  const whole = seconds % 60 === 0;
  const n = whole ? seconds / 60 : seconds;
  const unit = whole ? "minute" : "second";
  return `${n} ${n === 1 ? unit : `${unit}s`}`;
}

function shortLabel(label: string, max: number): string {
  const chars = Array.from(label);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : label;
}

function text(x: number | string, y: number, size: number, weight: number, fill: string, content: string, extra = ""): string {
  const w = weight === 400 ? "" : ` font-weight="${weight}"`;
  const anchor = extra ? ` ${extra}` : "";
  return `<text x="${x}" y="${y}" font-size="${size}"${w}${anchor} fill="${fill}">${esc(content)}</text>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
