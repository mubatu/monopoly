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

export interface GameState {
  board: Board;
  players: PlayerState[];
  chance: Deck;
  chest: Deck;
  rng: RandomSource;
  stats: Stats;
  jailPayProbability: number;
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
