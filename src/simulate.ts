import { loadBoard } from "./board.js";
import { loadCards } from "./cards.js";
import { createGameState, playTurn, startGame } from "./engine.js";
import { Rng, type RandomSource } from "./rng.js";
import { summarize } from "./stats.js";
import { EDITIONS, type PerGameResult, type SimulationConfig, type SimulationResult } from "./types.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Defaults for everything except the seed, which is taken from the clock when missing. */
export const DEFAULT_CONFIG: Omit<SimulationConfig, "seed"> = {
  edition: "istanbul",
  players: 4,
  games: 100,
  turnsPerGame: 1000,
  jailPayProbability: 0.5,
  trackPerGame: false,
};

export interface SimulationOptions {
  /** Called after every finished game (meant for progress reporting from a Web Worker). */
  onProgress?: (gamesDone: number, totalGames: number) => void;
  /** Replaces the seeded generator; the result is then no longer determined by `config.seed`. */
  rng?: RandomSource;
}

/** Thrown for an invalid configuration value; `field` names the offending key. */
export class ConfigError extends Error {
  readonly field: keyof SimulationConfig;

  constructor(field: keyof SimulationConfig, message: string) {
    super(message);
    this.name = "ConfigError";
    this.field = field;
  }
}

function requireInteger(field: keyof SimulationConfig, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    const range = max === Infinity ? `en az ${min} olan` : `${min}–${max} arasında`;
    throw new ConfigError(field, `${field} ${range} bir tam sayı olmalı (verilen: ${String(value)}).`);
  }
  return value;
}

/** Fills in defaults and validates; throws an explanatory error on the first invalid value. */
export function resolveConfig(input: Partial<SimulationConfig> = {}): SimulationConfig {
  const edition = input.edition ?? DEFAULT_CONFIG.edition;
  if (!(EDITIONS as readonly string[]).includes(edition)) {
    throw new ConfigError("edition", `edition şunlardan biri olmalı: ${EDITIONS.join(", ")} (verilen: ${String(edition)}).`);
  }

  const jailPayProbability = input.jailPayProbability ?? DEFAULT_CONFIG.jailPayProbability;
  if (typeof jailPayProbability !== "number" || !(jailPayProbability >= 0 && jailPayProbability <= 1)) {
    throw new ConfigError("jailPayProbability", `jailPayProbability 0–1 arasında bir sayı olmalı (verilen: ${String(jailPayProbability)}).`);
  }

  const trackPerGame = input.trackPerGame ?? DEFAULT_CONFIG.trackPerGame;
  if (typeof trackPerGame !== "boolean") {
    throw new ConfigError("trackPerGame", `trackPerGame true veya false olmalı (verilen: ${String(trackPerGame)}).`);
  }

  const seed = input.seed ?? Date.now() >>> 0;
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < -0x80000000 || seed > 0xffffffff) {
    throw new ConfigError("seed", `seed 32-bit bir tam sayı olmalı (verilen: ${String(seed)}).`);
  }

  return {
    edition,
    players: requireInteger("players", input.players ?? DEFAULT_CONFIG.players, MIN_PLAYERS, MAX_PLAYERS),
    games: requireInteger("games", input.games ?? DEFAULT_CONFIG.games, 1, Infinity),
    turnsPerGame: requireInteger("turnsPerGame", input.turnsPerGame ?? DEFAULT_CONFIG.turnsPerGame, 1, Infinity),
    jailPayProbability,
    seed: seed >>> 0,
    trackPerGame,
  };
}

/**
 * Runs `games` independent games and returns the accumulated square statistics.
 * Every game starts with freshly shuffled decks and all pawns on Go.
 */
export function runSimulation(input: Partial<SimulationConfig> = {}, options: SimulationOptions = {}): SimulationResult {
  const config = resolveConfig(input);
  const board = loadBoard(config.edition);
  const cards = loadCards(config.edition, board);
  const state = createGameState({
    board,
    cards,
    players: config.players,
    rng: options.rng ?? new Rng(config.seed),
    jailPayProbability: config.jailPayProbability,
  });
  const { stats } = state;
  const { players, games, turnsPerGame } = config;
  const onProgress = options.onProgress;

  const perGame: PerGameResult[] | null = config.trackPerGame ? [] : null;
  const before = new Float64Array(stats.finalLandings.length);

  const startedAt = performance.now();
  for (let game = 0; game < games; game++) {
    startGame(state);
    for (let turn = 0; turn < turnsPerGame; turn++) {
      for (let p = 0; p < players; p++) playTurn(state, p);
    }
    if (perGame !== null) {
      const finalLandings: number[] = [];
      for (let i = 0; i < board.size; i++) finalLandings.push(stats.finalLandings[i]! - before[i]!);
      perGame.push({ finalLandings, jailEntries: stats.finalLandings[board.size]! - before[board.size]! });
      before.set(stats.finalLandings);
    }
    if (onProgress !== undefined) onProgress(game + 1, games);
  }
  const elapsedMs = Math.round(performance.now() - startedAt);

  return summarize(board, config, stats, { elapsedMs, generatedAt: new Date().toISOString(), perGame });
}
