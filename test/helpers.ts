import { loadBoard } from "../src/board.js";
import { loadCards } from "../src/cards.js";
import { createGameState } from "../src/engine.js";
import type { RandomSource } from "../src/rng.js";
import type { GameState } from "../src/types.js";

/** Dice come from a fixed script; running past its end fails the test (catches unexpected extra rolls). */
export class ScriptedRng implements RandomSource {
  private readonly dice: number[];
  private readonly float: number;

  constructor(dice: readonly number[], float = 0.5) {
    this.dice = [...dice];
    this.float = float;
  }

  get remaining(): number {
    return this.dice.length;
  }

  rollDie(): number {
    const value = this.dice.shift();
    if (value === undefined) throw new Error("Zar senaryosu tükendi: beklenmeyen bir atış yapıldı.");
    return value;
  }

  nextFloat(): number {
    return this.float;
  }

  nextInt(): number {
    return 0;
  }
}

export interface ScriptedGame {
  state: GameState;
  rng: ScriptedRng;
}

/** A two-player game with unshuffled decks, scripted dice and a fixed jail strategy (1 = pay, 0 = roll). */
export function scriptedGame(dice: readonly number[], jailPayProbability = 0): ScriptedGame {
  const board = loadBoard("istanbul");
  const rng = new ScriptedRng(dice);
  const state = createGameState({
    board,
    cards: loadCards("istanbul", board),
    players: 2,
    rng,
    jailPayProbability,
  });
  // Plain cards on top so that card squares do nothing unless a test stacks the deck.
  state.chance.stackTop(["C12"]);
  state.chest.stackTop(["K04"]);
  return { state, rng };
}

export function sum(values: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i]!;
  return total;
}
