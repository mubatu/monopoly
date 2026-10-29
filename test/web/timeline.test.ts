import { describe, expect, it } from "vitest";
import { describeTurn } from "../../web/src/narrate.js";
import { buildQuickTimeline, buildTimeline, samplePath, type Step, type TurnEvent } from "../../web/src/timeline.js";

const GO = { square: 0, inJail: false };
const JAIL = { square: 10, inJail: true };

function kinds(steps: readonly Step[]): string[] {
  return steps.map((step) => step.kind);
}

function squares(step: Step | undefined): number[] {
  if (step?.kind !== "move") throw new Error("move adımı bekleniyordu");
  return step.path.map((place) => place.square);
}

describe("buildTimeline", () => {
  it("düz hamle: zar, sonra kare kare zıplama", () => {
    const events: TurnEvent[] = [
      { type: "roll", player: 0, d1: 1, d2: 2 },
      { type: "land", player: 0, from: 0, to: 3, via: 0 },
    ];
    const timeline = buildTimeline(events, GO, 2);

    expect(kinds(timeline.steps)).toEqual(["dice", "move"]);
    expect(squares(timeline.steps[1])).toEqual([0, 1, 2, 3]);
    expect(timeline.steps[1]).toMatchObject({ style: "hops" });
    expect(timeline.endPlace).toEqual({ square: 3, inJail: false });
    expect(timeline.duration).toBe(2);
  });

  it("adımlar art arda dizilir ve toplam süreye sığar", () => {
    const events: TurnEvent[] = [
      { type: "roll", player: 1, d1: 3, d2: 4 },
      { type: "land", player: 1, from: 29, to: 36, via: 0 },
      { type: "card", player: 1, deck: "chance", cardIndex: 8 },
      { type: "land", player: 1, from: 36, to: 33, via: 2 },
      { type: "card", player: 1, deck: "communityChest", cardIndex: 0 },
      { type: "land", player: 1, from: 33, to: 0, via: 1 },
    ];
    const timeline = buildTimeline(events, { square: 29, inJail: false }, 1);

    expect(kinds(timeline.steps)).toEqual(["dice", "move", "card", "move", "card", "move"]);
    let at = 0;
    for (const step of timeline.steps) {
      expect(step.start).toBeCloseTo(at, 10);
      expect(step.duration).toBeGreaterThan(0);
      at += step.duration;
    }
    expect(at).toBeLessThan(timeline.duration);
    expect(timeline.duration).toBe(1);

    expect(squares(timeline.steps[1])).toEqual([29, 30, 31, 32, 33, 34, 35, 36]);
    expect(squares(timeline.steps[3])).toEqual([36, 35, 34, 33]);
    expect(timeline.steps[3]).toMatchObject({ style: "hops" });
    expect(squares(timeline.steps[5])).toEqual([33, 0]);
    expect(timeline.steps[5]).toMatchObject({ style: "flight" });
    expect(timeline.endPlace).toEqual(GO);
  });

  it("39'dan başa sararken ara kareler doğrudur", () => {
    const timeline = buildTimeline(
      [
        { type: "roll", player: 0, d1: 2, d2: 3 },
        { type: "land", player: 0, from: 38, to: 3, via: 0 },
      ],
      { square: 38, inJail: false },
      1,
    );
    expect(squares(timeline.steps[1])).toEqual([38, 39, 0, 1, 2, 3]);
  });

  it("çiftle gelen ek atış süreyi uzatır", () => {
    const events: TurnEvent[] = [
      { type: "roll", player: 0, d1: 2, d2: 2 },
      { type: "land", player: 0, from: 0, to: 4, via: 0 },
      { type: "roll", player: 0, d1: 1, d2: 2 },
      { type: "land", player: 0, from: 4, to: 7, via: 0 },
    ];
    expect(buildTimeline(events, GO, 0.5).duration).toBe(1);
  });

  it("üç çift: son adım Kodes hücresine uçuştur", () => {
    const events: TurnEvent[] = [
      { type: "roll", player: 0, d1: 1, d2: 1 },
      { type: "land", player: 0, from: 0, to: 2, via: 0 },
      { type: "roll", player: 0, d1: 2, d2: 2 },
      { type: "land", player: 0, from: 2, to: 6, via: 0 },
      { type: "roll", player: 0, d1: 3, d2: 3 },
      { type: "jailEnter", player: 0, reason: 3 },
    ];
    const timeline = buildTimeline(events, GO, 1);
    const last = timeline.steps.at(-1)!;

    expect(last).toMatchObject({ kind: "move", style: "flight" });
    expect(last.kind === "move" && last.path).toEqual([{ square: 6, inJail: false }, JAIL]);
    expect(timeline.endPlace).toEqual(JAIL);
  });

  it("Kodes'te kalma ve Kodes'ten çıkış", () => {
    const stay = buildTimeline(
      [
        { type: "roll", player: 0, d1: 1, d2: 2 },
        { type: "jailStay", player: 0 },
      ],
      JAIL,
      1,
    );
    expect(kinds(stay.steps)).toEqual(["dice", "stay"]);
    expect(stay.endPlace).toEqual(JAIL);

    const exit = buildTimeline(
      [
        { type: "roll", player: 0, d1: 4, d2: 4 },
        { type: "jailExit", player: 0, how: 2 },
        { type: "land", player: 0, from: 10, to: 18, via: 0 },
      ],
      JAIL,
      1,
    );
    expect(kinds(exit.steps)).toEqual(["dice", "move"]);
    // The first point of the move is the cell, not the visiting strip.
    expect(exit.steps[1]!.kind === "move" && exit.steps[1]!.path[0]).toEqual(JAIL);
    expect(squares(exit.steps[1])).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
});

describe("buildQuickTimeline", () => {
  it("son zarı ve son konuma tek kaymayı verir", () => {
    const events: TurnEvent[] = [
      { type: "roll", player: 0, d1: 2, d2: 2 },
      { type: "land", player: 0, from: 0, to: 4, via: 0 },
      { type: "roll", player: 0, d1: 1, d2: 2 },
      { type: "land", player: 0, from: 4, to: 7, via: 0 },
      { type: "card", player: 0, deck: "chance", cardIndex: 9 },
      { type: "jailEnter", player: 0, reason: 1 },
    ];
    const timeline = buildQuickTimeline(events, GO, 0.05);

    expect(kinds(timeline.steps)).toEqual(["dice", "move"]);
    expect(timeline.steps[0]).toMatchObject({ d1: 1, d2: 2, duration: 0 });
    expect(timeline.steps[1]).toMatchObject({ style: "slide", path: [GO, JAIL] });
    expect(timeline.duration).toBe(0.05);
    expect(timeline.endPlace).toEqual(JAIL);
  });

  it("piyon yerinden oynamadıysa hareket adımı yoktur", () => {
    const timeline = buildQuickTimeline(
      [
        { type: "roll", player: 0, d1: 1, d2: 2 },
        { type: "jailStay", player: 0 },
      ],
      JAIL,
      0.05,
    );
    expect(kinds(timeline.steps)).toEqual(["dice"]);
    expect(timeline.endPlace).toEqual(JAIL);
  });
});

describe("samplePath", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  it("uçlarda yerdedir ve tam konumdadır", () => {
    for (const style of ["hops", "flight", "slide"] as const) {
      expect(samplePath(points, 0, style)).toEqual({ x: 0, y: 0, lift: 0 });
      expect(samplePath(points, 1, style)).toEqual({ x: 2, y: 0, lift: 0 });
      expect(samplePath(points, 7, style)).toEqual({ x: 2, y: 0, lift: 0 });
    }
  });

  it("zıplamada her ara karede yere değer", () => {
    expect(samplePath(points, 0.5, "hops")).toEqual({ x: 1, y: 0, lift: 0 });
    const mid = samplePath(points, 0.25, "hops");
    expect(mid.x).toBeCloseTo(0.5, 10);
    expect(mid.lift).toBeGreaterThan(0);
  });

  it("uçuş tek ve daha yüksek bir yaydır", () => {
    const flight = samplePath(points, 0.5, "flight");
    expect(flight.x).toBeCloseTo(1, 10);
    expect(flight.lift).toBeGreaterThan(samplePath(points, 0.25, "hops").lift);
    expect(samplePath(points, 0.5, "slide").lift).toBeLessThan(flight.lift);
  });
});

describe("describeTurn", () => {
  const name = (index: number): string => `K${index}`;

  it("zar, kareler ve Kodes olaylarını tek satırda özetler", () => {
    expect(
      describeTurn(
        [
          { type: "roll", player: 1, d1: 4, d2: 3 },
          { type: "land", player: 1, from: 0, to: 7, via: 0 },
          { type: "card", player: 1, deck: "chance", cardIndex: 4 },
          { type: "land", player: 1, from: 7, to: 15, via: 1 },
        ],
        "Mavi",
        name,
      ),
    ).toBe("Mavi: 4+3 → K7 → K15");

    expect(
      describeTurn(
        [
          { type: "roll", player: 0, d1: 3, d2: 3 },
          { type: "jailExit", player: 0, how: 2 },
          { type: "land", player: 0, from: 10, to: 16, via: 0 },
        ],
        "Kırmızı",
        name,
      ),
    ).toBe("Kırmızı: 3+3 (çift) → çiftle çıktı → K16");

    expect(
      describeTurn(
        [
          { type: "roll", player: 0, d1: 1, d2: 2 },
          { type: "jailStay", player: 0 },
        ],
        "Sarı",
        name,
      ),
    ).toBe("Sarı: 1+2 → Kodes'te kaldı");
  });
});
