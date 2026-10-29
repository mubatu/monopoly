import type { DeckKind, JailExit, MoveVia } from "../../src/types.js";
import { JAIL_SQUARE, pathBackward, pathForward, type Place, type Point } from "./layout.js";

/** One thing that happened during a turn, as reported by the engine's TurnObserver. */
export type TurnEvent =
  | { type: "roll"; player: number; d1: number; d2: number }
  | { type: "land"; player: number; from: number; to: number; via: MoveVia }
  | { type: "card"; player: number; deck: DeckKind; cardIndex: number }
  | { type: "jailEnter"; player: number; reason: number }
  | { type: "jailExit"; player: number; how: JailExit }
  | { type: "jailStay"; player: number };

/** hops: square by square; flight: one high arc; slide: one low, quick move. */
export type MoveStyle = "hops" | "flight" | "slide";

export type Step =
  | { kind: "dice"; start: number; duration: number; d1: number; d2: number }
  | { kind: "move"; start: number; duration: number; path: Place[]; style: MoveStyle }
  | { kind: "card"; start: number; duration: number; deck: DeckKind; cardIndex: number }
  | { kind: "stay"; start: number; duration: number };

export interface Timeline {
  /** In playing order; a step starts when the previous one ends. */
  steps: Step[];
  /** Seconds */
  duration: number;
  endPlace: Place;
}

// Relative lengths of the steps; they are scaled so that a turn takes the requested time.
const WEIGHT_DICE = 3;
const WEIGHT_HOPS = 4;
const WEIGHT_BACK = 2.5;
const WEIGHT_FLIGHT = 3;
const WEIGHT_CARD = 2.5;
const WEIGHT_STAY = 2;
const WEIGHT_REST = 1;

const JAIL_PLACE: Place = { square: JAIL_SQUARE, inJail: true };

function onSquare(square: number): Place {
  return { square, inJail: false };
}

function schedule(steps: Step[], weights: number[], total: number): number {
  const weightSum = weights.reduce((a, b) => a + b, WEIGHT_REST);
  let at = 0;
  steps.forEach((step, i) => {
    step.start = at;
    step.duration = (weights[i]! / weightSum) * total;
    at += step.duration;
  });
  return total;
}

/**
 * Full animation of a turn: dice, square-by-square hops, card moves and jail.
 * Takes `turnDuration` seconds per roll, so a turn with doubles runs longer.
 */
export function buildTimeline(events: readonly TurnEvent[], startPlace: Place, turnDuration: number): Timeline {
  const steps: Step[] = [];
  const weights: number[] = [];
  let place = startPlace;
  let rolls = 0;

  const move = (path: Place[], style: MoveStyle, weight: number): void => {
    steps.push({ kind: "move", start: 0, duration: 0, path: [place, ...path], style });
    weights.push(weight);
    place = path[path.length - 1]!;
  };

  for (const event of events) {
    switch (event.type) {
      case "roll":
        rolls++;
        steps.push({ kind: "dice", start: 0, duration: 0, d1: event.d1, d2: event.d2 });
        weights.push(WEIGHT_DICE);
        break;
      case "land":
        if (event.via === 0) move(pathForward(event.from, event.to).map(onSquare), "hops", WEIGHT_HOPS);
        else if (event.via === 2) move(pathBackward(event.from, event.to).map(onSquare), "hops", WEIGHT_BACK);
        else move([onSquare(event.to)], "flight", WEIGHT_FLIGHT);
        break;
      case "card":
        steps.push({ kind: "card", start: 0, duration: 0, deck: event.deck, cardIndex: event.cardIndex });
        weights.push(WEIGHT_CARD);
        break;
      case "jailEnter":
        move([JAIL_PLACE], "flight", WEIGHT_FLIGHT);
        break;
      case "jailStay":
        steps.push({ kind: "stay", start: 0, duration: 0 });
        weights.push(WEIGHT_STAY);
        break;
      case "jailExit":
        // Nothing to show by itself: the move that follows starts from the cell.
        break;
    }
  }

  const duration = schedule(steps, weights, turnDuration * Math.max(1, rolls));
  return { steps, duration, endPlace: place };
}

/** Quick version: the last dice shown at once and a single slide to where the turn ended. */
export function buildQuickTimeline(events: readonly TurnEvent[], startPlace: Place, turnDuration: number): Timeline {
  const steps: Step[] = [];
  let place = startPlace;
  let dice: Step | null = null;

  for (const event of events) {
    if (event.type === "roll") dice = { kind: "dice", start: 0, duration: 0, d1: event.d1, d2: event.d2 };
    else if (event.type === "land") place = onSquare(event.to);
    else if (event.type === "jailEnter") place = JAIL_PLACE;
  }

  if (dice !== null) steps.push(dice);
  if (place.square !== startPlace.square || place.inJail !== startPlace.inJail) {
    steps.push({ kind: "move", start: 0, duration: turnDuration * 0.8, path: [startPlace, place], style: "slide" });
  }
  return { steps, duration: turnDuration, endPlace: place };
}

export interface PathSample extends Point {
  /** Height above the board, in board units */
  lift: number;
}

const HOP_HEIGHT = 0.35;
const FLIGHT_HEIGHT = 1.6;
const SLIDE_HEIGHT = 0.25;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Position along a move at progress t (0..1). */
export function samplePath(points: readonly Point[], t: number, style: MoveStyle): PathSample {
  const clamped = Math.min(1, Math.max(0, t));
  const last = points[points.length - 1]!;
  if (points.length < 2 || clamped >= 1) return { x: last.x, y: last.y, lift: 0 };

  if (style === "hops") {
    const segments = points.length - 1;
    const scaled = clamped * segments;
    const i = Math.min(Math.floor(scaled), segments - 1);
    const f = scaled - i;
    const a = points[i]!;
    const b = points[i + 1]!;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, lift: HOP_HEIGHT * 4 * f * (1 - f) };
  }

  const first = points[0]!;
  const eased = smooth(clamped);
  const height = style === "flight" ? FLIGHT_HEIGHT : SLIDE_HEIGHT;
  return {
    x: first.x + (last.x - first.x) * eased,
    y: first.y + (last.y - first.y) * eased,
    lift: height * 4 * clamped * (1 - clamped),
  };
}
