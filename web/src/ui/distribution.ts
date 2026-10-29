import type { Board } from "../../../src/board.js";
import type { SimulationResult } from "../../../src/types.js";
import { drawBoard } from "../boardArt.js";
import { formatCount, formatPct, HEAT_STOPS } from "../heat.js";
import { BOARD_SIDE, JAIL_SQUARE, squareAt } from "../layout.js";
import { groupColor } from "../theme.js";
import { byId } from "./dom.js";

type Mode = "landings" | "final";

const REFRESH_MS = 250;

interface Row {
  label: string;
  swatch: string | null;
  pct: number;
  count: number;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text;
  if (className !== undefined) td.className = className;
  return td;
}

function nameCell(row: Row): HTMLTableCellElement {
  const td = document.createElement("td");
  if (row.swatch !== null) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = row.swatch;
    td.append(swatch);
  }
  td.append(row.label);
  return td;
}

/**
 * The distribution view: the board from above, tinted by how often each square is
 * visited, with the same numbers as a sorted table. Updates while the simulation runs.
 */
export class DistributionView {
  private readonly root = byId("dist");
  private readonly canvas = byId<HTMLCanvasElement>("dist-canvas");
  private readonly empty = byId("dist-empty");
  private readonly summary = byId("dist-summary");
  private readonly legendMin = byId("dist-legend-min");
  private readonly legendMax = byId("dist-legend-max");
  private readonly squaresBody = byId("dist-squares");
  private readonly groupsBody = byId("dist-groups");
  private readonly tooltip = byId("dist-tooltip");
  private mode: Mode = "landings";
  private result: SimulationResult | null = null;
  private lastRefresh = -Infinity;
  private drawnTurns = -1;
  private dirty = true;

  constructor(
    private readonly board: Board,
    private readonly snapshot: () => SimulationResult,
  ) {
    byId("dist-legend-bar").style.background = `linear-gradient(to right, ${HEAT_STOPS.join(", ")})`;

    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[name="dist-mode"]')) {
      input.addEventListener("change", () => {
        if (input.checked) this.mode = input.value as Mode;
        this.dirty = true;
      });
    }
    byId("dist-close").addEventListener("click", () => this.close());
    byId("dist-download").addEventListener("click", () => this.download());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) this.close();
    });
    this.canvas.addEventListener("pointermove", (event) => this.hover(event));
    this.canvas.addEventListener("pointerleave", () => {
      this.tooltip.hidden = true;
    });
    new ResizeObserver(() => {
      this.dirty = true;
    }).observe(this.canvas);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.root.hidden = false;
    this.dirty = true;
  }

  close(): void {
    this.root.hidden = true;
    this.tooltip.hidden = true;
  }

  /** Forces a redraw on the next update (after a reset, for example). */
  invalidate(): void {
    this.dirty = true;
  }

  /** Called every frame; redraws a few times a second while open and something changed. */
  update(now: number, totalTurns: number): void {
    if (!this.isOpen) return;
    if (!this.dirty && (totalTurns === this.drawnTurns || now - this.lastRefresh < REFRESH_MS)) return;
    this.lastRefresh = now;
    this.drawnTurns = totalTurns;
    this.dirty = false;
    this.render();
  }

  private values(result: SimulationResult): { squares: number[]; jail: number; counts: number[]; jailCount: number } {
    const landings = this.mode === "landings";
    return {
      squares: result.squares.map((square) => (landings ? square.landingPct : square.finalPct)),
      counts: result.squares.map((square) => (landings ? square.landings : square.finalLandings)),
      jail: landings ? result.jail.entryPct : result.jail.finalPct,
      jailCount: result.jail.entries,
    };
  }

  private render(): void {
    const result = this.snapshot();
    this.result = result;
    const { squares, jail, counts, jailCount } = this.values(result);
    const hasData = result.meta.totalFinalLandings > 0;
    this.empty.hidden = hasData;

    const cssSize = this.canvas.clientWidth;
    const px = Math.max(1, Math.round(cssSize * Math.min(window.devicePixelRatio, 2)));
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    // The scale spans the data, not 0..max: squares differ by a percentage point or two,
    // and starting at zero would paint them all nearly the same shade.
    const min = Math.min(jail, ...squares);
    const max = Math.max(jail, ...squares);
    drawBoard(this.canvas.getContext("2d")!, px, this.board, { overlay: { values: squares, jail, min, max } });

    const total = this.mode === "landings" ? result.meta.totalLandings : result.meta.totalFinalLandings;
    const noun = this.mode === "landings" ? "geliş" : "final";
    this.summary.textContent = `${formatCount(result.meta.totalTurns)} tur · ${formatCount(total)} ${noun}`;
    this.legendMin.textContent = formatPct(min);
    this.legendMax.textContent = formatPct(max);

    const rows: Row[] = result.squares.map((square, i) => ({
      label: square.index === JAIL_SQUARE ? "Sadece Ziyaretçi" : square.name,
      swatch: square.group === null ? null : groupColor(square.group),
      pct: squares[i]!,
      count: counts[i]!,
    }));
    rows.push({ label: "Kodes (içeride)", swatch: null, pct: jail, count: jailCount });
    rows.sort((a, b) => b.pct - a.pct);
    this.squaresBody.replaceChildren(
      ...rows.map((row, i) => {
        const tr = document.createElement("tr");
        tr.append(cell(String(i + 1), "num muted"), nameCell(row), cell(formatPct(row.pct), "num"), cell(formatCount(row.count), "num muted"));
        return tr;
      }),
    );

    const groups: Row[] = result.groups.map((group) => ({
      label: group.group,
      swatch: groupColor(group.group),
      pct: this.mode === "landings" ? group.landingPct : group.finalPct,
      count: this.mode === "landings" ? group.landings : group.finalLandings,
    }));
    groups.sort((a, b) => b.pct - a.pct);
    this.groupsBody.replaceChildren(
      ...groups.map((row) => {
        const tr = document.createElement("tr");
        tr.append(nameCell(row), cell(formatPct(row.pct), "num"), cell(formatCount(row.count), "num muted"));
        return tr;
      }),
    );
  }

  private hover(event: PointerEvent): void {
    const result = this.result;
    const size = this.canvas.clientWidth;
    const hit = squareAt((event.offsetX / size) * BOARD_SIDE, (event.offsetY / size) * BOARD_SIDE);
    if (result === null || hit === null) {
      this.tooltip.hidden = true;
      return;
    }

    const square = result.squares[hit.square]!;
    const lines = hit.inJailCell
      ? [
          "Kodes (içeride)",
          `Giriş: ${formatCount(result.jail.entries)}`,
          `Gelişlerin ${formatPct(result.jail.entryPct)} · finallerin ${formatPct(result.jail.finalPct)}`,
        ]
      : [
          hit.square === JAIL_SQUARE ? "Sadece Ziyaretçi" : square.name,
          `Geliş: ${formatCount(square.landings)} (${formatPct(square.landingPct)})`,
          `Final: ${formatCount(square.finalLandings)} (${formatPct(square.finalPct)})`,
        ];
    this.tooltip.replaceChildren(
      ...lines.map((line, i) => {
        const div = document.createElement("div");
        div.textContent = line;
        if (i === 0) div.className = "tooltip-title";
        return div;
      }),
    );
    this.tooltip.hidden = false;
    const bounds = this.root.getBoundingClientRect();
    const x = Math.min(event.clientX - bounds.left + 14, bounds.width - this.tooltip.offsetWidth - 8);
    const y = Math.min(event.clientY - bounds.top + 14, bounds.height - this.tooltip.offsetHeight - 8);
    this.tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  private download(): void {
    const result = this.snapshot();
    const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monopoly-${result.config.seed}-${result.meta.totalTurns}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
