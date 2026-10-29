import { loadBoard, type Board } from "./board.js";
import { loadCards } from "./cards.js";
import { createGameState, playTurn, startGame } from "./engine.js";
import { Rng, type RandomSource } from "./rng.js";
import { DEFAULT_CONFIG, resolveConfig } from "./simulate.js";
import { summarize } from "./stats.js";
import type { Edition, GameState, SimulationResult } from "./types.js";

export { ConfigError } from "./simulate.js";

export interface SessionConfig {
  edition: Edition;
  /** 2..6 */
  players: number;
  /** 0..1 */
  jailPayProbability: number;
  /** Unsigned 32-bit integer */
  seed: number;
  /** Turns per player before pawns and decks are reset; null = one endless game */
  turnsPerGame: number | null;
}

export interface SessionOptions {
  /** Replaces the seeded generator; the session is then no longer determined by `config.seed`. */
  rng?: RandomSource;
}

/** Fills in defaults and validates with the same rules (and ConfigError) as `resolveConfig`. */
export function resolveSessionConfig(input: Partial<SessionConfig> = {}): SessionConfig {
  const turnsPerGame = input.turnsPerGame ?? null;
  if (turnsPerGame === null) {
    const { edition, players, jailPayProbability, seed } = resolveConfig({ ...input, turnsPerGame: 1 });
    return { edition, players, jailPayProbability, seed, turnsPerGame: null };
  }
  const { edition, players, jailPayProbability, seed } = resolveConfig({ ...input, turnsPerGame });
  return { edition, players, jailPayProbability, seed, turnsPerGame };
}

/**
 * A simulation that is driven one turn at a time (for interactive front ends).
 * Plays the same turns, in the same order, as `runSimulation` with the same seed.
 */
export class Session {
  readonly config: SessionConfig;
  readonly board: Board;
  readonly state: GameState;

  private turnsInGame = 0;
  private readonly turnsPerGameAllPlayers: number;
  private _nextPlayer = 0;
  private _gamesStarted = 1;

  constructor(input: Partial<SessionConfig> = {}, options: SessionOptions = {}) {
    this.config = resolveSessionConfig(input);
    this.board = loadBoard(this.config.edition);
    this.state = createGameState({
      board: this.board,
      cards: loadCards(this.config.edition, this.board),
      players: this.config.players,
      rng: options.rng ?? new Rng(this.config.seed),
      jailPayProbability: this.config.jailPayProbability,
    });
    const { turnsPerGame, players } = this.config;
    this.turnsPerGameAllPlayers = turnsPerGame === null ? Infinity : turnsPerGame * players;
    startGame(this.state);
  }

  /** Seat of the player who moves next. */
  get nextPlayer(): number {
    return this._nextPlayer;
  }

  /** Games begun so far, including the current one (≥ 1). */
  get gamesStarted(): number {
    return this._gamesStarted;
  }

  /** Turns played so far, across all games. */
  get totalTurns(): number {
    return this.state.stats.totalTurns;
  }

  /** Plays the next player's turn, starting a fresh game first if the current one is over. */
  playNextTurn(): void {
    if (this.turnsInGame === this.turnsPerGameAllPlayers) {
      startGame(this.state);
      this._gamesStarted++;
      this.turnsInGame = 0;
      this._nextPlayer = 0;
    }
    playTurn(this.state, this._nextPlayer);
    this._nextPlayer = (this._nextPlayer + 1) % this.config.players;
    this.turnsInGame++;
  }

  playTurns(count: number): void {
    for (let i = 0; i < count; i++) this.playNextTurn();
  }

  /**
   * Current statistics in the same shape the CLI writes. In an endless session
   * `config.turnsPerGame` reports the rounds completed so far.
   */
  snapshot(elapsedMs = 0): SimulationResult {
    const { edition, players, jailPayProbability, seed, turnsPerGame } = this.config;
    return summarize(
      this.board,
      {
        edition,
        players,
        games: this._gamesStarted,
        turnsPerGame: turnsPerGame ?? Math.floor(this.turnsInGame / players),
        jailPayProbability,
        seed,
        trackPerGame: DEFAULT_CONFIG.trackPerGame,
      },
      this.state.stats,
      { elapsedMs, generatedAt: new Date().toISOString(), perGame: null },
    );
  }
}
