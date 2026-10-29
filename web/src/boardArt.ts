import type { Board } from "../../src/board.js";
import type { Square } from "../../src/types.js";
import { arrowLeft, bars, bulb, car, chest, diamond, faucet, ferry, ring, train, type Glyph } from "./glyphs.js";
import { formatPct, heatColor, heatScale, inkFor } from "./heat.js";
import {
  BOARD_SIDE,
  CORNER,
  isCorner,
  JAIL_CELL,
  JAIL_SQUARE,
  SQUARE_COUNT,
  squareRect,
  squareRotation,
  type Rect,
} from "./layout.js";
import {
  ACCENT_RED,
  BOARD_BG,
  BOARD_INK,
  BOARD_LINE,
  BOARD_TITLE,
  DECK_THEME,
  FONT_STACK,
  groupColor,
  JAIL_CELL_COLOR,
  upper,
} from "./theme.js";

/** Percentages to paint over the board (the distribution view). */
export interface HeatOverlay {
  /** Percentage per square, indexed by square */
  values: ArrayLike<number>;
  /** Percentage for "in jail" */
  jail: number;
  /** Values that map to the lightest and the darkest colour */
  min: number;
  max: number;
}

export interface DrawOptions {
  overlay?: HeatOverlay | null;
}

type Ctx = CanvasRenderingContext2D;

const BAND_DEPTH = 0.34;
/** Centre of the two deck spots, as an offset from the board centre along the diagonal. */
export const DECK_OFFSET = 2.15;
export const DECK_SIZE = { w: 1.9, h: 1.2 };

interface LabelOptions {
  size: number;
  maxWidth: number;
  maxLines: number;
  color: string;
  weight?: number;
  /** "top": y is the top of the first line; "middle": the block is centred on y; "bottom": y is the bottom of the last line. */
  anchor?: "top" | "middle" | "bottom";
  letterSpacing?: number;
}

function wrap(ctx: Ctx, words: readonly string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** Draws centred text, wrapping at spaces and shrinking the font until it fits. Returns the block height. */
function label(ctx: Ctx, text: string, x: number, y: number, options: LabelOptions): number {
  const weight = options.weight ?? 700;
  const words = text.split(/\s+/).filter((word) => word !== "");
  let size = options.size;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    lines = wrap(ctx, words, options.maxWidth);
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (lines.length <= options.maxLines && widest <= options.maxWidth) break;
    size *= 0.94;
  }

  const lineHeight = size * 1.12;
  const height = lines.length * lineHeight;
  const top = options.anchor === "middle" ? y - height / 2 : options.anchor === "bottom" ? y - height : y;
  ctx.fillStyle = options.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, x, top + lineHeight * (i + 0.5)));
  return height;
}

function fillRect(ctx: Ctx, rect: Rect, k: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x * k, rect.y * k, rect.w * k, rect.h * k);
}

function strokeRect(ctx: Ctx, rect: Rect, k: number): void {
  ctx.strokeRect(rect.x * k, rect.y * k, rect.w * k, rect.h * k);
}

interface SquareArt {
  title: string;
  glyph?: Glyph;
  glyphColor?: string;
  glyphSize?: number;
  /** Big character drawn instead of a glyph */
  mark?: string;
}

const FERRY_PATTERN = /vapur|iskele/i;
const ELECTRIC_PATTERN = /elektrik/i;
const LUXURY_PATTERN = /lüks/i;

function artFor(square: Square): SquareArt {
  switch (square.type) {
    case "station":
      return { title: square.name, glyph: FERRY_PATTERN.test(square.name) ? ferry : train, glyphSize: 0.72 };
    case "utility":
      return { title: square.name, glyph: ELECTRIC_PATTERN.test(square.name) ? bulb : faucet, glyphSize: 0.62 };
    case "chance":
      return { title: square.name, mark: "?", glyphColor: ACCENT_RED };
    case "community_chest":
      return { title: square.name, glyph: chest, glyphColor: "#2b6fb3", glyphSize: 0.64 };
    case "tax":
      return { title: square.name, glyph: LUXURY_PATTERN.test(square.name) ? ring : diamond, glyphSize: 0.5 };
    default:
      return { title: square.name };
  }
}

/** Where the percentage sits in an edge square: distance from its centre towards the outer end. */
const PCT_OFFSET = 0.33;

/**
 * Draws an edge square in its own frame: origin at the centre, inner end up, outer end
 * down. In the distribution view (`heat`) the icon is left out to make room for the number.
 * `upright` turns the name half a turn in place, for squares whose frame is upside down.
 */
function drawEdgeSquare(ctx: Ctx, square: Square, k: number, bg: string, heat: boolean, upright: boolean): void {
  const ink = heat ? inkFor(bg) : BOARD_INK;
  const top = -CORNER / 2;
  const maxWidth = 0.9 * k;
  const name = (text: string, y: number): void => {
    const options: LabelOptions = { size: 0.135 * k, maxWidth, maxLines: 3, color: ink };
    if (!upright) {
      label(ctx, text, 0, y, options);
      return;
    }
    ctx.save();
    ctx.translate(0, y);
    ctx.rotate(Math.PI);
    label(ctx, text, 0, 0, { ...options, anchor: "bottom" });
    ctx.restore();
  };

  if (square.type === "property") {
    ctx.fillStyle = groupColor(square.group);
    ctx.fillRect(-0.5 * k, top * k, k, BAND_DEPTH * k);
    ctx.strokeStyle = BOARD_LINE;
    ctx.lineWidth = Math.max(1, 0.016 * k);
    ctx.beginPath();
    ctx.moveTo(-0.5 * k, (top + BAND_DEPTH) * k);
    ctx.lineTo(0.5 * k, (top + BAND_DEPTH) * k);
    ctx.stroke();
    name(upper(square.name), (top + BAND_DEPTH + 0.09) * k);
    return;
  }

  const art = artFor(square);
  name(upper(art.title), (top + 0.1) * k);
  if (heat) return;
  if (art.mark !== undefined) {
    ctx.font = `700 ${0.95 * k}px Georgia, "Times New Roman", serif`;
    ctx.fillStyle = art.glyphColor ?? BOARD_INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(art.mark, 0, 0.3 * k);
  } else if (art.glyph !== undefined) {
    art.glyph(ctx, 0, 0.26 * k, (art.glyphSize ?? 0.6) * k, art.glyphColor ?? BOARD_INK, bg);
  }
}

/** Corner content in the corner's diagonal frame (origin at its centre). */
function drawCorner(ctx: Ctx, square: Square, k: number, bg: string): void {
  const maxWidth = 1.5 * k;
  switch (square.type) {
    case "go":
      label(ctx, upper(square.name), 0, -0.2 * k, {
        size: 0.27 * k,
        maxWidth,
        maxLines: 1,
        color: BOARD_INK,
        weight: 800,
        anchor: "middle",
      });
      break;
    case "free_parking": {
      const words = upper(square.name).split(/\s+/);
      label(ctx, words[0] ?? "", 0, -0.47 * k, { size: 0.2 * k, maxWidth: 1.1 * k, maxLines: 1, color: BOARD_INK, anchor: "middle" });
      car(ctx, 0, 0, 0.7 * k, ACCENT_RED, bg);
      label(ctx, words.slice(1).join(" "), 0, 0.47 * k, { size: 0.2 * k, maxWidth: 1.1 * k, maxLines: 1, color: BOARD_INK, anchor: "middle" });
      break;
    }
    case "go_to_jail": {
      const words = upper(square.name).split(/\s+/);
      label(ctx, words[0] ?? "", 0, -0.47 * k, { size: 0.2 * k, maxWidth: 1.1 * k, maxLines: 1, color: BOARD_INK, anchor: "middle" });
      bars(ctx, 0, 0, 0.62 * k, "#2b4a8f", bg);
      label(ctx, words.slice(1).join(" "), 0, 0.47 * k, { size: 0.2 * k, maxWidth: 1.1 * k, maxLines: 1, color: BOARD_INK, anchor: "middle" });
      break;
    }
    default:
      label(ctx, upper(square.name), 0, 0, { size: 0.2 * k, maxWidth, maxLines: 2, color: BOARD_INK, anchor: "middle" });
  }
}

function drawGoArrow(ctx: Ctx, rect: Rect, k: number, bg: string): void {
  arrowLeft(ctx, (rect.x + rect.w / 2) * k, (rect.y + rect.h - 0.24) * k, 1.25 * k, ACCENT_RED, bg);
}

/** The jail corner: a barred cell towards the board centre and an L-shaped visiting strip. */
function drawJailCorner(ctx: Ctx, rect: Rect, k: number, overlay: HeatOverlay | null): void {
  const stripBg = overlay === null ? BOARD_BG : heatColor(heatScale(overlay.values[JAIL_SQUARE]!, overlay.min, overlay.max));
  const cellBg = overlay === null ? JAIL_CELL_COLOR : heatColor(heatScale(overlay.jail, overlay.min, overlay.max));
  fillRect(ctx, rect, k, stripBg);
  fillRect(ctx, JAIL_CELL, k, cellBg);
  ctx.strokeStyle = BOARD_LINE;
  ctx.lineWidth = Math.max(1, 0.02 * k);
  strokeRect(ctx, JAIL_CELL, k);

  const cellX = (JAIL_CELL.x + JAIL_CELL.w / 2) * k;
  const cellY = (JAIL_CELL.y + JAIL_CELL.h / 2) * k;
  const stripInk = overlay === null ? BOARD_INK : inkFor(stripBg);
  const cellInk = overlay === null ? BOARD_INK : inkFor(cellBg);
  const stripWidth = rect.w - JAIL_CELL.w;

  if (overlay === null) {
    bars(ctx, cellX, cellY - 0.1 * k, 0.72 * k, BOARD_INK, cellBg);
    label(ctx, "KODES", cellX, cellY + 0.42 * k, { size: 0.17 * k, maxWidth: k, maxLines: 1, color: cellInk, weight: 800, anchor: "middle" });
  } else {
    label(ctx, "KODES", cellX, cellY - 0.3 * k, { size: 0.15 * k, maxWidth: k, maxLines: 1, color: cellInk, anchor: "middle" });
    label(ctx, formatPct(overlay.jail), cellX, cellY + 0.08 * k, { size: 0.24 * k, maxWidth: k, maxLines: 1, color: cellInk, anchor: "middle" });
  }

  // "SADECE" runs up the left strip, "ZİYARETÇİ" along the bottom one.
  ctx.save();
  ctx.translate((rect.x + stripWidth / 2) * k, (JAIL_CELL.y + JAIL_CELL.h / 2) * k);
  ctx.rotate(Math.PI / 2);
  label(ctx, "SADECE", 0, 0, { size: 0.15 * k, maxWidth: k, maxLines: 1, color: stripInk, anchor: "middle" });
  ctx.restore();

  const bottomY = (JAIL_CELL.y + JAIL_CELL.h + stripWidth / 2) * k;
  if (overlay === null) {
    label(ctx, "ZİYARETÇİ", cellX, bottomY, { size: 0.15 * k, maxWidth: k, maxLines: 1, color: stripInk, anchor: "middle" });
  } else {
    label(ctx, `ZİYARETÇİ ${formatPct(overlay.values[JAIL_SQUARE]!)}`, (rect.x + rect.w / 2) * k, bottomY, {
      size: 0.15 * k,
      maxWidth: 1.5 * k,
      maxLines: 1,
      color: stripInk,
      anchor: "middle",
    });
  }
}

/** A corner in the distribution view: name on top, percentage in the middle, no decoration. */
function drawCornerOverlay(ctx: Ctx, square: Square, rect: Rect, k: number, bg: string, pct: string): void {
  const ink = inkFor(bg);
  const cx = (rect.x + rect.w / 2) * k;
  label(ctx, upper(square.name), cx, (rect.y + 0.14) * k, { size: 0.15 * k, maxWidth: 1.4 * k, maxLines: 2, color: ink });
  label(ctx, pct, cx, (rect.y + rect.h / 2 + 0.2) * k, { size: 0.27 * k, maxWidth: 1.4 * k, maxLines: 1, color: ink, anchor: "middle" });
}

function drawDeckSpot(ctx: Ctx, k: number, offset: number, deck: keyof typeof DECK_THEME): void {
  const centre = (BOARD_SIDE / 2 + offset) * k;
  const theme = DECK_THEME[deck];
  ctx.save();
  ctx.translate(centre, centre);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.roundRect((-DECK_SIZE.w / 2) * k, (-DECK_SIZE.h / 2) * k, DECK_SIZE.w * k, DECK_SIZE.h * k, 0.08 * k);
  ctx.fillStyle = theme.color;
  ctx.globalAlpha = 0.22;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([0.12 * k, 0.08 * k]);
  ctx.strokeStyle = BOARD_TITLE;
  ctx.lineWidth = Math.max(1, 0.025 * k);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, theme.label, 0, 0, { size: 0.24 * k, maxWidth: 1.7 * k, maxLines: 1, color: BOARD_TITLE, weight: 800, anchor: "middle" });
  ctx.restore();
}

function drawCentre(ctx: Ctx, k: number): void {
  drawDeckSpot(ctx, k, -DECK_OFFSET, "communityChest");
  drawDeckSpot(ctx, k, DECK_OFFSET, "chance");

  ctx.save();
  ctx.translate((BOARD_SIDE / 2) * k, (BOARD_SIDE / 2) * k);
  ctx.rotate(-Math.PI / 4);
  const size = 1.05 * k;
  ctx.font = `800 ${size}px ${FONT_STACK}`;
  // Spread the letters out; drawn one by one because canvas letter-spacing is not universal.
  const text = "İSTANBUL";
  const spacing = 0.16 * k;
  const widths = [...text].map((char) => ctx.measureText(char).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  ctx.fillStyle = BOARD_TITLE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let x = -total / 2;
  [...text].forEach((char, i) => {
    ctx.fillText(char, x, 0);
    x += widths[i]! + spacing;
  });
  ctx.restore();
}

/**
 * Draws the whole board on a square canvas of `sizePx` pixels. With an overlay it
 * becomes the distribution view: squares are tinted by value and show percentages.
 */
export function drawBoard(ctx: Ctx, sizePx: number, board: Board, options: DrawOptions = {}): void {
  const overlay = options.overlay ?? null;
  const k = sizePx / BOARD_SIDE;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, sizePx, sizePx);
  drawCentre(ctx, k);

  for (let index = 0; index < SQUARE_COUNT; index++) {
    const square = board.squares[index]!;
    const rect = squareRect(index);
    const bg = overlay === null ? BOARD_BG : heatColor(heatScale(overlay.values[index]!, overlay.min, overlay.max));
    const pct = overlay === null ? null : formatPct(overlay.values[index]!);

    if (index === JAIL_SQUARE) {
      drawJailCorner(ctx, rect, k, overlay);
      continue;
    }
    fillRect(ctx, rect, k, bg);

    if (isCorner(index)) {
      if (pct !== null) {
        drawCornerOverlay(ctx, square, rect, k, bg, pct);
        continue;
      }
      if (square.type === "go") drawGoArrow(ctx, rect, k, bg);
      ctx.save();
      ctx.translate((rect.x + rect.w / 2) * k, (rect.y + rect.h / 2) * k);
      ctx.rotate(squareRotation(index));
      drawCorner(ctx, square, k, bg);
      ctx.restore();
      continue;
    }

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const angle = squareRotation(index);
    ctx.save();
    ctx.translate(cx * k, cy * k);
    ctx.rotate(angle);
    // In the distribution view the top row's names are turned upright like the numbers.
    drawEdgeSquare(ctx, square, k, bg, pct !== null, pct !== null && Math.cos(angle) < -0.5);
    ctx.restore();

    if (pct !== null) {
      // Names follow the board's orientation, but the numbers stay upright so they can be read.
      label(ctx, pct, (cx - PCT_OFFSET * Math.sin(angle)) * k, (cy + PCT_OFFSET * Math.cos(angle)) * k, {
        size: 0.215 * k,
        maxWidth: 0.92 * k,
        maxLines: 1,
        color: inkFor(bg),
        anchor: "middle",
      });
    }
  }

  ctx.strokeStyle = BOARD_LINE;
  ctx.lineWidth = Math.max(1, 0.02 * k);
  for (let index = 0; index < SQUARE_COUNT; index++) strokeRect(ctx, squareRect(index), k);
  ctx.lineWidth = Math.max(2, 0.04 * k);
  ctx.strokeRect(0, 0, sizePx, sizePx);
  ctx.restore();
}
