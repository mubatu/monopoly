/**
 * Board geometry in board units. The origin is the top-left corner seen from above,
 * x grows to the right and y towards the viewer. Square 0 (Go) is the bottom-right
 * corner and indices run clockwise, as on the real board.
 */
export const EDGE = 1;
export const CORNER = 1.6;
export const BOARD_SIDE = 9 * EDGE + 2 * CORNER;
export const SQUARE_COUNT = 40;
export const JAIL_SQUARE = 10;
export const PAWN_RADIUS = 0.14;
export const MAX_PAWNS = 6;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = "bottom" | "left" | "top" | "right";

/** Where a pawn is: on a square, or locked in the jail cell (square is then the jail corner). */
export interface Place {
  square: number;
  inJail: boolean;
}

const SIDES: readonly Side[] = ["bottom", "left", "top", "right"];
const FAR = BOARD_SIDE - CORNER;

export function isCorner(index: number): boolean {
  return index % 10 === 0;
}

/** The side a square lies on; a corner belongs to the side that starts at it. */
export function squareSide(index: number): Side {
  return SIDES[Math.floor(index / 10)]!;
}

export function squareRect(index: number): Rect {
  const side = squareSide(index);
  const step = index % 10;
  if (step === 0) {
    switch (side) {
      case "bottom":
        return { x: FAR, y: FAR, w: CORNER, h: CORNER };
      case "left":
        return { x: 0, y: FAR, w: CORNER, h: CORNER };
      case "top":
        return { x: 0, y: 0, w: CORNER, h: CORNER };
      case "right":
        return { x: FAR, y: 0, w: CORNER, h: CORNER };
    }
  }
  switch (side) {
    case "bottom":
      return { x: FAR - step * EDGE, y: FAR, w: EDGE, h: CORNER };
    case "left":
      return { x: 0, y: FAR - step * EDGE, w: CORNER, h: EDGE };
    case "top":
      return { x: CORNER + (step - 1) * EDGE, y: 0, w: EDGE, h: CORNER };
    case "right":
      return { x: FAR, y: CORNER + (step - 1) * EDGE, w: CORNER, h: EDGE };
  }
}

export function squareCenter(index: number): Point {
  const rect = squareRect(index);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/**
 * Clockwise rotation (radians, canvas convention) of a square's content. Edge squares
 * read from outside the board; corners read along the diagonal from their corner.
 */
export function squareRotation(index: number): number {
  const side = squareSide(index);
  if (isCorner(index)) {
    switch (side) {
      case "bottom":
        return -Math.PI / 4;
      case "left":
        return Math.PI / 4;
      case "top":
        return (3 * Math.PI) / 4;
      case "right":
        return (-3 * Math.PI) / 4;
    }
  }
  switch (side) {
    case "bottom":
      return 0;
    case "left":
      return Math.PI / 2;
    case "top":
      return Math.PI;
    case "right":
      return -Math.PI / 2;
  }
}

/** The barred cell inside the jail corner; the rest of that corner is "just visiting". */
export const JAIL_CELL: Rect = { x: 0.5, y: FAR, w: CORNER - 0.5, h: CORNER - 0.5 };

const EDGE_COLUMNS = [-0.24, 0.24];
// Local depth offsets from the square's centre; the colour band occupies the inner end.
const EDGE_ROWS = [-0.15, 0.2, 0.55];
const CORNER_COLUMNS = [-0.4, 0, 0.4];
const CORNER_ROWS = [-0.25, 0.25];

const VISITOR_SLOTS: readonly Point[] = [
  { x: 0.25, y: FAR + 0.2 },
  { x: 0.25, y: FAR + 0.55 },
  { x: 0.25, y: FAR + 0.9 },
  { x: 0.25, y: FAR + 1.35 },
  { x: 0.7, y: FAR + 1.35 },
  { x: 1.15, y: FAR + 1.35 },
];

const JAIL_COLUMNS = [0.72, 1.05, 1.38];
const JAIL_ROWS = [FAR + 0.3, FAR + 0.78];

/** Where pawn number `slot` (0..5) stands on a square; pawns never share a slot. */
export function pawnSlot(index: number, slot: number): Point {
  if (index === JAIL_SQUARE) return VISITOR_SLOTS[slot]!;
  const center = squareCenter(index);
  if (isCorner(index)) {
    return {
      x: center.x + CORNER_COLUMNS[slot % 3]!,
      y: center.y + CORNER_ROWS[Math.floor(slot / 3)]!,
    };
  }
  const lx = EDGE_COLUMNS[slot % 2]!;
  const ly = EDGE_ROWS[Math.floor(slot / 2)]!;
  const angle = squareRotation(index);
  return {
    x: center.x + lx * Math.cos(angle) - ly * Math.sin(angle),
    y: center.y + lx * Math.sin(angle) + ly * Math.cos(angle),
  };
}

/** Where pawn number `slot` stands inside the jail cell. */
export function jailSlot(slot: number): Point {
  return { x: JAIL_COLUMNS[slot % 3]!, y: JAIL_ROWS[Math.floor(slot / 3)]! };
}

export function placePoint(place: Place, slot: number): Point {
  return place.inJail ? jailSlot(slot) : pawnSlot(place.square, slot);
}

/** Squares passed when moving forward from `from` to `to`, excluding `from`, including `to`. */
export function pathForward(from: number, to: number): number[] {
  const path: number[] = [];
  let square = from;
  do {
    square = (square + 1) % SQUARE_COUNT;
    path.push(square);
  } while (square !== to);
  return path;
}

/** Squares passed when moving backward from `from` to `to`, excluding `from`, including `to`. */
export function pathBackward(from: number, to: number): number[] {
  const path: number[] = [];
  let square = from;
  do {
    square = (square - 1 + SQUARE_COUNT) % SQUARE_COUNT;
    path.push(square);
  } while (square !== to);
  return path;
}

export interface Hit {
  square: number;
  /** True when the point is inside the jail cell rather than the visiting strip. */
  inJailCell: boolean;
}

function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** The square under a board-space point, or null over the centre or outside the board. */
export function squareAt(x: number, y: number): Hit | null {
  for (let index = 0; index < SQUARE_COUNT; index++) {
    if (contains(squareRect(index), x, y)) {
      return { square: index, inJailCell: index === JAIL_SQUARE && contains(JAIL_CELL, x, y) };
    }
  }
  return null;
}
