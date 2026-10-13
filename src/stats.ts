import type { Board } from "./board.js";
import {
  JAIL_ENTRY_REASONS,
  type GroupResult,
  type JailEntryReason,
  type PerGameResult,
  type SimulationConfig,
  type SimulationResult,
  type SquareResult,
  type Stats,
} from "./types.js";

const PCT_DECIMALS = 4;

export function createStats(boardSize: number): Stats {
  return {
    landings: new Float64Array(boardSize),
    finalLandings: new Float64Array(boardSize + 1),
    jailEntryReason: new Float64Array(JAIL_ENTRY_REASONS.length),
    diceSums: new Float64Array(13),
    jailEntries: 0,
    turnsInJail: 0,
    totalTurns: 0,
    totalRolls: 0,
    doubles: 0,
    chanceDraws: 0,
    chestDraws: 0,
  };
}

/** `part / total` as a percentage, rounded; 0 when there is nothing to divide by. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  const scale = 10 ** PCT_DECIMALS;
  return Math.round((part / total) * 100 * scale) / scale;
}

function sum(values: Float64Array, end: number): number {
  let total = 0;
  for (let i = 0; i < end; i++) total += values[i]!;
  return total;
}

export interface SummaryExtras {
  elapsedMs: number;
  generatedAt: string;
  perGame: PerGameResult[] | null;
}

/** Turns raw counters into the result object that is written out as JSON. */
export function summarize(board: Board, config: SimulationConfig, stats: Stats, extras: SummaryExtras): SimulationResult {
  const size = board.size;
  const totalLandings = sum(stats.landings, size) + stats.jailEntries;
  const totalFinalLandings = sum(stats.finalLandings, size + 1);

  const squares: SquareResult[] = board.squares.map((square) => {
    const landings = stats.landings[square.index]!;
    const finalLandings = stats.finalLandings[square.index]!;
    return {
      ...square,
      landings,
      landingPct: percent(landings, totalLandings),
      finalLandings,
      finalPct: percent(finalLandings, totalFinalLandings),
    };
  });

  const groups: GroupResult[] = board.groups.map((group) => {
    const members = squares.filter((square) => square.group === group);
    const landings = members.reduce((total, square) => total + square.landings, 0);
    const finalLandings = members.reduce((total, square) => total + square.finalLandings, 0);
    return {
      group,
      squares: members.map((square) => square.index),
      landings,
      landingPct: percent(landings, totalLandings),
      finalLandings,
      finalPct: percent(finalLandings, totalFinalLandings),
    };
  });

  const byReason = {} as Record<JailEntryReason, number>;
  JAIL_ENTRY_REASONS.forEach((reason, i) => {
    byReason[reason] = stats.jailEntryReason[i]!;
  });

  const diceSums: Record<string, number> = {};
  for (let total = 2; total <= 12; total++) diceSums[String(total)] = stats.diceSums[total]!;

  return {
    config,
    meta: {
      totalTurns: stats.totalTurns,
      totalRolls: stats.totalRolls,
      totalLandings,
      totalFinalLandings,
      elapsedMs: extras.elapsedMs,
      generatedAt: extras.generatedAt,
    },
    squares,
    jail: {
      entries: stats.jailEntries,
      entryPct: percent(stats.jailEntries, totalLandings),
      finalPct: percent(stats.jailEntries, totalFinalLandings),
      byReason,
      turnsInJail: stats.turnsInJail,
      turnsInJailPctOfTurns: percent(stats.turnsInJail, stats.totalTurns),
    },
    groups,
    cards: { chanceDraws: stats.chanceDraws, chestDraws: stats.chestDraws },
    dice: {
      doubles: stats.doubles,
      doublesPct: percent(stats.doubles, stats.totalRolls),
      sums: diceSums,
    },
    perGame: extras.perGame,
  };
}
