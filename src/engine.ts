import { ACTION_CHANCE, ACTION_CHEST, ACTION_GO_TO_JAIL, type Board } from "./board.js";
import {
  Deck,
  EFFECT_ADVANCE_TO,
  EFFECT_GO_BACK,
  EFFECT_GO_TO_JAIL,
  EFFECT_GOOJF,
  EFFECT_NEAREST_STATION,
  EFFECT_NEAREST_UTILITY,
  type CardSet,
} from "./cards.js";
import type { RandomSource } from "./rng.js";
import { createStats } from "./stats.js";
import type { GameState, PlayerState, Stats } from "./types.js";

// Indices into Stats.jailEntryReason; must match the order of JAIL_ENTRY_REASONS.
export const REASON_SQUARE = 0;
export const REASON_CHANCE_CARD = 1;
export const REASON_CHEST_CARD = 2;
export const REASON_THREE_DOUBLES = 3;

export const MAX_JAIL_ROLLS = 3;

export interface GameSetup {
  board: Board;
  cards: CardSet;
  players: number;
  rng: RandomSource;
  jailPayProbability: number;
  stats?: Stats;
}

function resetPlayer(player: PlayerState): void {
  player.pos = 0;
  player.inJail = false;
  player.jailTurns = 0;
  player.jailStrategy = "roll";
  player.heldChance = -1;
  player.heldChest = -1;
}

/** Builds a state with pawns on Go and both decks in file order (call `startGame` to shuffle). */
export function createGameState(setup: GameSetup): GameState {
  const players: PlayerState[] = [];
  for (let i = 0; i < setup.players; i++) {
    players.push({ pos: 0, inJail: false, jailTurns: 0, jailStrategy: "roll", heldChance: -1, heldChest: -1 });
  }
  return {
    board: setup.board,
    players,
    chance: new Deck(setup.cards.chance),
    chest: new Deck(setup.cards.communityChest),
    rng: setup.rng,
    stats: setup.stats ?? createStats(setup.board.size),
    jailPayProbability: setup.jailPayProbability,
  };
}

/** Starts a fresh game: freshly shuffled full decks, every pawn on Go. Stats keep accumulating. */
export function startGame(state: GameState): void {
  state.chance.shuffle(state.rng);
  state.chest.shuffle(state.rng);
  for (const player of state.players) resetPlayer(player);
}

/** Plays one turn of player `p`, including any extra rolls earned with doubles. */
export function playTurn(state: GameState, p: number): void {
  const player = state.players[p]!;
  state.stats.totalTurns++;
  if (player.inJail) jailTurn(state, player);
  else normalTurn(state, player);
}

export function sendToJail(state: GameState, player: PlayerState, reason: number): void {
  const stats = state.stats;
  player.inJail = true;
  player.pos = state.board.jailIndex;
  player.jailTurns = 0;
  // One decision per jail stay; it holds until the player gets out.
  player.jailStrategy = state.rng.nextFloat() < state.jailPayProbability ? "pay" : "roll";
  stats.jailEntries++;
  stats.jailEntryReason[reason]++;
  // Entering jail always ends the current move, so it is that roll's final position.
  stats.finalLandings[state.board.size]++;
}

function rollDice(state: GameState): number {
  const d1 = state.rng.rollDie();
  const d2 = state.rng.rollDie();
  const stats = state.stats;
  stats.totalRolls++;
  stats.diceSums[d1 + d2]++;
  if (d1 === d2) {
    stats.doubles++;
    return -(d1 + d2);
  }
  return d1 + d2;
}

function normalTurn(state: GameState, player: PlayerState): void {
  let doubles = 0;
  for (;;) {
    // rollDice returns the sum, negated when the dice are a double.
    const roll = rollDice(state);
    if (roll > 0) {
      moveBy(state, player, roll);
      return;
    }
    if (++doubles === 3) {
      sendToJail(state, player, REASON_THREE_DOUBLES);
      return;
    }
    moveBy(state, player, -roll);
    if (player.inJail) return;
  }
}

function jailTurn(state: GameState, player: PlayerState): void {
  if (player.heldChance >= 0) {
    state.chance.returnToBottom(player.heldChance);
    player.heldChance = -1;
    player.inJail = false;
    normalTurn(state, player);
    return;
  }
  if (player.heldChest >= 0) {
    state.chest.returnToBottom(player.heldChest);
    player.heldChest = -1;
    player.inJail = false;
    normalTurn(state, player);
    return;
  }
  if (player.jailStrategy === "pay") {
    player.inJail = false;
    normalTurn(state, player);
    return;
  }

  const roll = rollDice(state);
  if (roll < 0) {
    // Out on a double: moves with this roll but gets no extra roll.
    player.inJail = false;
    moveBy(state, player, -roll);
    return;
  }
  if (++player.jailTurns === MAX_JAIL_ROLLS) {
    // Third failed attempt: pays and moves with the same roll.
    player.inJail = false;
    moveBy(state, player, roll);
    return;
  }
  state.stats.turnsInJail++;
}

/** Moves forward, resolves whatever the pawn lands on and records where the roll ended. */
function moveBy(state: GameState, player: PlayerState, steps: number): void {
  const stats = state.stats;
  const pos = (player.pos + steps) % state.board.size;
  player.pos = pos;
  stats.landings[pos]++;
  resolveLanding(state, player);
  if (!player.inJail) stats.finalLandings[player.pos]++;
}

function resolveLanding(state: GameState, player: PlayerState): void {
  const actions = state.board.actions;
  // A card can move the pawn onto another card square, so keep resolving until it settles.
  for (;;) {
    switch (actions[player.pos]) {
      case ACTION_GO_TO_JAIL:
        sendToJail(state, player, REASON_SQUARE);
        return;
      case ACTION_CHANCE:
        if (!drawCard(state, player, state.chance, true)) return;
        break;
      case ACTION_CHEST:
        if (!drawCard(state, player, state.chest, false)) return;
        break;
      default:
        return;
    }
  }
}

/** Draws and applies a card. Returns true if the pawn moved to a square that still has to be resolved. */
function drawCard(state: GameState, player: PlayerState, deck: Deck, isChance: boolean): boolean {
  const { board, stats } = state;
  if (isChance) stats.chanceDraws++;
  else stats.chestDraws++;

  const card = deck.draw();
  let pos: number;
  switch (deck.effects[card]) {
    case EFFECT_ADVANCE_TO:
      pos = deck.params[card];
      break;
    case EFFECT_NEAREST_STATION:
      pos = board.nextStation[player.pos];
      break;
    case EFFECT_NEAREST_UTILITY:
      pos = board.nextUtility[player.pos];
      break;
    case EFFECT_GO_BACK:
      pos = (player.pos - deck.params[card] + board.size) % board.size;
      break;
    case EFFECT_GO_TO_JAIL:
      sendToJail(state, player, isChance ? REASON_CHANCE_CARD : REASON_CHEST_CARD);
      return false;
    case EFFECT_GOOJF:
      deck.removeHeld();
      if (isChance) player.heldChance = card;
      else player.heldChest = card;
      return false;
    default:
      return false;
  }
  player.pos = pos;
  stats.landings[pos]++;
  return true;
}
