import type { Board } from "./board.js";
import type { Deck } from "./cards.js";
import type { RandomSource } from "./rng.js";

export const EDITIONS = ["istanbul"] as const;
export type Edition = (typeof EDITIONS)[number];

export const SQUARE_TYPES = [
  "go",
  "property",
  "community_chest",
  "tax",
  "station",
  "chance",
  "jail",
  "utility",
  "free_parking",
  "go_to_jail",
] as const;
export type SquareType = (typeof SQUARE_TYPES)[number];

export interface Square {
  index: number;
  name: string;
  type: SquareType;
  group: string | null;
}

export const CARD_EFFECTS = [
  "none",
  "advance_to",
  "advance_to_nearest_station",
  "advance_to_nearest_utility",
  "go_back",
  "go_to_jail",
  "get_out_of_jail_free",
] as const;
export type CardEffect = (typeof CARD_EFFECTS)[number];

export interface Card {
  id: string;
  text: string;
  effect: CardEffect;
  /** Destination square, only for `advance_to`. */
  target?: number;
  /** Number of squares to move backwards, only for `go_back`. */
  steps?: number;
}

/** Order matters: `Stats.jailEntryReason` is indexed by position in this list. */
export const JAIL_ENTRY_REASONS = ["square", "chance_card", "chest_card", "three_doubles"] as const;
export type JailEntryReason = (typeof JAIL_ENTRY_REASONS)[number];

export type JailStrategy = "pay" | "roll";

export interface SimulationConfig {
  edition: Edition;
  /** 2..6 */
  players: number;
  /** ≥1 */
  games: number;
  /** Turns per player in each game, ≥1 */
  turnsPerGame: number;
  /** 0..1, share of jail stays that are ended by paying at the first opportunity */
  jailPayProbability: number;
  /** Unsigned 32-bit integer */
  seed: number;
  /** Keep per-game final counts (for variance analysis) */
  trackPerGame: boolean;
}

export interface PlayerState {
  /** Seat number (0-based); fixed for the lifetime of the state */
  id: number;
  pos: number;
  inJail: boolean;
  /** Failed escape rolls in the current jail stay */
  jailTurns: number;
  /** Decided once per jail stay, on entry */
  jailStrategy: JailStrategy;
  /** Card index of the held "get out of jail free" card of each deck, or -1 */
  heldChance: number;
  heldChest: number;
}

export interface Stats {
  /** Every stop on a square, including intermediate ones (length = board size) */
  landings: Float64Array;
  /** Where each roll ended up; the extra last bucket is "in jail" (length = board size + 1) */
  finalLandings: Float64Array;
  /** Indexed like JAIL_ENTRY_REASONS */
  jailEntryReason: Float64Array;
  /** Indexed by the sum of the two dice (2..12) */
  diceSums: Float64Array;
  jailEntries: number;
  /** Turns that ended with the player still in jail */
  turnsInJail: number;
  totalTurns: number;
  totalRolls: number;
  doubles: number;
  chanceDraws: number;
  chestDraws: number;
}

/** How a pawn reached a square: 0 = dice roll, 1 = card moving it forward, 2 = card moving it back. */
export type MoveVia = 0 | 1 | 2;
export const VIA_ROLL = 0;
export const VIA_CARD_FORWARD = 1;
export const VIA_CARD_BACK = 2;

/** How a player left jail: 0 = "get out of jail free" card, 1 = paid, 2 = rolled a double, 3 = third failed roll. */
export type JailExit = 0 | 1 | 2 | 3;
export const EXIT_CARD = 0;
export const EXIT_PAY = 1;
export const EXIT_DOUBLE = 2;
export const EXIT_THIRD_ROLL = 3;

export type DeckKind = "chance" | "communityChest";

/**
 * Receives what happens during a turn, in order. Meant for animation; the engine
 * never allocates for these calls and behaves identically with or without an observer.
 */
export interface TurnObserver {
  /** Dice were rolled (including escape attempts in jail). */
  roll(player: number, d1: number, d2: number): void;
  /** The pawn stopped on a square; one call per `Stats.landings` increment. */
  land(player: number, from: number, to: number, via: MoveVia): void;
  /** A card was drawn; `cardIndex` is its position in that deck's `cards`. */
  card(player: number, deck: DeckKind, cardIndex: number): void;
  /** The player went to jail; `reason` indexes JAIL_ENTRY_REASONS. */
  jailEnter(player: number, reason: number): void;
  /** The player got out of jail; a move follows in the same turn. */
  jailExit(player: number, how: JailExit): void;
  /** The player failed to roll a double and stays in jail. */
  jailStay(player: number): void;
}

export interface GameState {
  board: Board;
  players: PlayerState[];
  chance: Deck;
  chest: Deck;
  rng: RandomSource;
  stats: Stats;
  jailPayProbability: number;
  observer: TurnObserver | null;
}

export interface SquareResult extends Square {
  landings: number;
  landingPct: number;
  finalLandings: number;
  finalPct: number;
}

export interface JailResult {
  entries: number;
  /** entries / totalLandings */
  entryPct: number;
  /** entries / totalFinalLandings */
  finalPct: number;
  byReason: Record<JailEntryReason, number>;
  turnsInJail: number;
  turnsInJailPctOfTurns: number;
}

export interface GroupResult {
  group: string;
  squares: number[];
  landings: number;
  landingPct: number;
  finalLandings: number;
  finalPct: number;
}

export interface PerGameResult {
  /** Final counts per square for this game (length = board size) */
  finalLandings: number[];
  jailEntries: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  meta: {
    totalTurns: number;
    totalRolls: number;
    /** Σ squares.landings + jail.entries */
    totalLandings: number;
    /** Σ squares.finalLandings + jail.entries */
    totalFinalLandings: number;
    elapsedMs: number;
    generatedAt: string;
  };
  squares: SquareResult[];
  jail: JailResult;
  groups: GroupResult[];
  cards: { chanceDraws: number; chestDraws: number };
  dice: { doubles: number; doublesPct: number; sums: Record<string, number> };
  perGame: PerGameResult[] | null;
}
