import { describe, expect, it } from "vitest";
import {
  BOARD_SIDE,
  CORNER,
  isCorner,
  JAIL_CELL,
  JAIL_SQUARE,
  jailSlot,
  MAX_PAWNS,
  pathBackward,
  pathForward,
  PAWN_RADIUS,
  pawnSlot,
  placePoint,
  squareAt,
  squareCenter,
  squareRect,
  squareRotation,
  squareSide,
  type Point,
  type Rect,
} from "../../web/src/layout.js";

const INDICES = Array.from({ length: 40 }, (_, i) => i);
const EPS = 1e-9;

function area(rect: Rect): number {
  return rect.w * rect.h;
}

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > EPS && h > EPS ? w * h : 0;
}

function inside(rect: Rect, p: Point, margin: number): boolean {
  return (
    p.x - margin >= rect.x - EPS &&
    p.x + margin <= rect.x + rect.w + EPS &&
    p.y - margin >= rect.y - EPS &&
    p.y + margin <= rect.y + rect.h + EPS
  );
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("kare dikdörtgenleri", () => {
  it("tahta kenarı 12,2 birimdir", () => {
    expect(BOARD_SIDE).toBeCloseTo(12.2, 10);
  });

  it("köşeler 0/10/20/30'dadır ve tahtanın köşelerine oturur", () => {
    expect(INDICES.filter(isCorner)).toEqual([0, 10, 20, 30]);
    expect(squareRect(0)).toEqual({ x: BOARD_SIDE - CORNER, y: BOARD_SIDE - CORNER, w: CORNER, h: CORNER });
    expect(squareRect(10)).toEqual({ x: 0, y: BOARD_SIDE - CORNER, w: CORNER, h: CORNER });
    expect(squareRect(20)).toEqual({ x: 0, y: 0, w: CORNER, h: CORNER });
    expect(squareRect(30)).toEqual({ x: BOARD_SIDE - CORNER, y: 0, w: CORNER, h: CORNER });
  });

  it("40 kare çevreyi çakışmasız ve boşluksuz kaplar", () => {
    for (const i of INDICES) {
      const rect = squareRect(i);
      expect(inside({ x: 0, y: 0, w: BOARD_SIDE, h: BOARD_SIDE }, { x: rect.x, y: rect.y }, 0)).toBe(true);
      expect(rect.x + rect.w).toBeLessThanOrEqual(BOARD_SIDE + EPS);
      expect(rect.y + rect.h).toBeLessThanOrEqual(BOARD_SIDE + EPS);
      for (const j of INDICES) if (j > i) expect(overlap(rect, squareRect(j))).toBe(0);
    }
    const inner = BOARD_SIDE - 2 * CORNER;
    const total = INDICES.reduce((sum, i) => sum + area(squareRect(i)), 0);
    expect(total).toBeCloseTo(BOARD_SIDE ** 2 - inner ** 2, 8);
  });

  it("indeksler saat yönünde ilerler: alt sıra sağdan sola, sol kenar aşağıdan yukarı", () => {
    expect(squareSide(5)).toBe("bottom");
    expect(squareSide(15)).toBe("left");
    expect(squareSide(25)).toBe("top");
    expect(squareSide(35)).toBe("right");
    expect(squareCenter(1).x).toBeGreaterThan(squareCenter(9).x);
    expect(squareCenter(11).y).toBeGreaterThan(squareCenter(19).y);
    expect(squareCenter(21).x).toBeLessThan(squareCenter(29).x);
    expect(squareCenter(31).y).toBeLessThan(squareCenter(39).y);
  });

  it("komşu kareler birbirine değer", () => {
    for (const i of INDICES) {
      const a = squareRect(i);
      const b = squareRect((i + 1) % 40);
      const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
      const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      expect(Math.max(gapX, gapY)).toBeCloseTo(0, 8);
    }
  });

  it("kenar karelerin içeriği tahtanın dışından okunacak yöne döner", () => {
    expect(squareRotation(5)).toBe(0);
    expect(squareRotation(15)).toBeCloseTo(Math.PI / 2, 10);
    expect(squareRotation(25)).toBeCloseTo(Math.PI, 10);
    expect(squareRotation(35)).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe("piyon yuvaları", () => {
  it("her karede 6 yuva kare sınırları içinde ve birbirinden ayrıktır", () => {
    for (const i of INDICES) {
      const rect = squareRect(i);
      const slots = Array.from({ length: MAX_PAWNS }, (_, s) => pawnSlot(i, s));
      for (const [a, slot] of slots.entries()) {
        expect(inside(rect, slot, PAWN_RADIUS), `kare ${i} yuva ${a}`).toBe(true);
        for (const other of slots.slice(a + 1)) {
          expect(distance(slot, other)).toBeGreaterThanOrEqual(2 * PAWN_RADIUS);
        }
      }
    }
  });

  it("Kodes yuvaları hücrenin içinde, ziyaretçi yuvaları dışındadır", () => {
    const cell = Array.from({ length: MAX_PAWNS }, (_, s) => jailSlot(s));
    const visitors = Array.from({ length: MAX_PAWNS }, (_, s) => pawnSlot(JAIL_SQUARE, s));
    for (const [a, slot] of cell.entries()) {
      expect(inside(JAIL_CELL, slot, PAWN_RADIUS)).toBe(true);
      for (const other of cell.slice(a + 1)) expect(distance(slot, other)).toBeGreaterThanOrEqual(2 * PAWN_RADIUS);
      for (const visitor of visitors) expect(distance(slot, visitor)).toBeGreaterThanOrEqual(2 * PAWN_RADIUS);
    }
    for (const visitor of visitors) {
      const clear =
        visitor.x + PAWN_RADIUS <= JAIL_CELL.x + EPS || visitor.y - PAWN_RADIUS >= JAIL_CELL.y + JAIL_CELL.h - EPS;
      expect(clear).toBe(true);
    }
  });

  it("placePoint Kodes'tekini hücreye, ziyaretçiyi şeride koyar", () => {
    expect(placePoint({ square: 10, inJail: true }, 2)).toEqual(jailSlot(2));
    expect(placePoint({ square: 10, inJail: false }, 2)).toEqual(pawnSlot(10, 2));
    expect(placePoint({ square: 24, inJail: false }, 0)).toEqual(pawnSlot(24, 0));
  });
});

describe("yollar ve isabet testi", () => {
  it("ileri yol ara kareleri sırayla verir ve başa sarar", () => {
    expect(pathForward(3, 6)).toEqual([4, 5, 6]);
    expect(pathForward(38, 1)).toEqual([39, 0, 1]);
    expect(pathForward(7, 5)).toHaveLength(38);
  });

  it("geri yol", () => {
    expect(pathBackward(7, 4)).toEqual([6, 5, 4]);
    expect(pathBackward(1, 38)).toEqual([0, 39, 38]);
  });

  it("squareAt kareyi ve Kodes hücresini ayırt eder", () => {
    for (const i of INDICES) {
      const center = squareCenter(i);
      expect(squareAt(center.x, center.y)?.square).toBe(i);
    }
    expect(squareAt(BOARD_SIDE / 2, BOARD_SIDE / 2)).toBeNull();
    expect(squareAt(-1, 3)).toBeNull();
    expect(squareAt(1.2, BOARD_SIDE - 1.2)).toEqual({ square: 10, inJailCell: true });
    expect(squareAt(0.2, BOARD_SIDE - 0.2)).toEqual({ square: 10, inJailCell: false });
  });
});
