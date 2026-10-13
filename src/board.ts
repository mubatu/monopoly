import istanbulBoard from "../data/board.istanbul.json" with { type: "json" };
import { SQUARE_TYPES, type Edition, type Square, type SquareType } from "./types.js";

export const BOARD_SIZE = 40;

/** What the engine has to do when a pawn stops on a square. */
export const ACTION_NONE = 0;
export const ACTION_GO_TO_JAIL = 1;
export const ACTION_CHANCE = 2;
export const ACTION_CHEST = 3;

export interface Board {
  readonly edition: string;
  readonly size: number;
  readonly squares: readonly Square[];
  readonly jailIndex: number;
  /** ACTION_* per square */
  readonly actions: Uint8Array;
  /** First station strictly ahead of each square, or -1 if the board has none */
  readonly nextStation: Int8Array;
  /** First utility strictly ahead of each square, or -1 if the board has none */
  readonly nextUtility: Int8Array;
  /** Group names in order of first appearance */
  readonly groups: readonly string[];
}

const BOARD_DATA: Record<Edition, unknown> = {
  istanbul: istanbulBoard,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nextOfType(squares: readonly Square[], type: SquareType): Int8Array {
  const size = squares.length;
  const table = new Int8Array(size).fill(-1);
  for (let pos = 0; pos < size; pos++) {
    for (let step = 1; step <= size; step++) {
      const candidate = (pos + step) % size;
      if (squares[candidate]!.type === type) {
        table[pos] = candidate;
        break;
      }
    }
  }
  return table;
}

/** Validates raw board data and precomputes the lookup tables the engine uses. */
export function buildBoard(raw: unknown): Board {
  if (!isRecord(raw) || typeof raw.edition !== "string" || !Array.isArray(raw.squares)) {
    throw new Error("Tahta verisi geçersiz: { edition, squares[] } bekleniyor.");
  }
  if (raw.squares.length !== BOARD_SIZE) {
    throw new Error(`Tahta ${BOARD_SIZE} kare olmalı, ${raw.squares.length} kare bulundu.`);
  }

  const squares: Square[] = raw.squares.map((item: unknown, i: number) => {
    if (!isRecord(item)) throw new Error(`Kare ${i}: nesne bekleniyor.`);
    const { index, name, type, group } = item;
    if (index !== i) throw new Error(`Kare ${i}: index ${i} olmalı, ${String(index)} bulundu.`);
    if (typeof name !== "string" || name.length === 0) throw new Error(`Kare ${i}: name boş olamaz.`);
    if (typeof type !== "string" || !(SQUARE_TYPES as readonly string[]).includes(type)) {
      throw new Error(`Kare ${i} (${name}): geçersiz type "${String(type)}".`);
    }
    if (group !== null && typeof group !== "string") {
      throw new Error(`Kare ${i} (${name}): group metin veya null olmalı.`);
    }
    return { index: i, name, type: type as SquareType, group };
  });

  const jails = squares.filter((s) => s.type === "jail");
  if (jails.length !== 1) throw new Error(`Tahtada tam bir Kodes karesi olmalı, ${jails.length} bulundu.`);
  if (squares[0]!.type !== "go") throw new Error("0 numaralı kare Başlangıç (go) olmalı.");

  const actions = new Uint8Array(BOARD_SIZE);
  const groups: string[] = [];
  for (const square of squares) {
    if (square.type === "go_to_jail") actions[square.index] = ACTION_GO_TO_JAIL;
    else if (square.type === "chance") actions[square.index] = ACTION_CHANCE;
    else if (square.type === "community_chest") actions[square.index] = ACTION_CHEST;
    if (square.group !== null && !groups.includes(square.group)) groups.push(square.group);
  }

  return {
    edition: raw.edition,
    size: BOARD_SIZE,
    squares,
    jailIndex: jails[0]!.index,
    actions,
    nextStation: nextOfType(squares, "station"),
    nextUtility: nextOfType(squares, "utility"),
    groups,
  };
}

export function loadBoard(edition: Edition = "istanbul"): Board {
  const raw = BOARD_DATA[edition];
  if (raw === undefined) throw new Error(`Bilinmeyen baskı: "${String(edition)}".`);
  return buildBoard(raw);
}

/** First station ahead of `pos` in the direction of play. */
export function nearestStation(board: Board, pos: number): number {
  return board.nextStation[pos]!;
}

/** First utility ahead of `pos` in the direction of play. */
export function nearestUtility(board: Board, pos: number): number {
  return board.nextUtility[pos]!;
}

export function indicesOfType(board: Board, type: SquareType): number[] {
  return board.squares.filter((s) => s.type === type).map((s) => s.index);
}
