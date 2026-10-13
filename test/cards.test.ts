import { describe, expect, it } from "vitest";
import cardData from "../data/cards.istanbul.json" with { type: "json" };
import { loadBoard } from "../src/board.js";
import { buildCards, Deck, loadCards } from "../src/cards.js";
import { Rng } from "../src/rng.js";
import type { Card } from "../src/types.js";

const board = loadBoard("istanbul");
const cards = loadCards("istanbul", board);

function countByKind(deck: readonly Card[]): { movement: number; jailFree: number; plain: number } {
  const jailFree = deck.filter((c) => c.effect === "get_out_of_jail_free").length;
  const plain = deck.filter((c) => c.effect === "none").length;
  return { movement: deck.length - jailFree - plain, jailFree, plain };
}

describe("İstanbul kart desteleri", () => {
  it("her deste 16 karttır", () => {
    expect(cards.chance).toHaveLength(16);
    expect(cards.communityChest).toHaveLength(16);
  });

  it("Şans: 10 hareket + 1 Kodes'ten Ücretsiz Çık + 5 düz", () => {
    expect(countByKind(cards.chance)).toEqual({ movement: 10, jailFree: 1, plain: 5 });
  });

  it("Kamu Fonu: 2 hareket + 1 Kodes'ten Ücretsiz Çık + 13 düz", () => {
    expect(countByKind(cards.communityChest)).toEqual({ movement: 2, jailFree: 1, plain: 13 });
  });

  it("kart id'leri benzersizdir", () => {
    const ids = [...cards.chance, ...cards.communityChest].map((c) => c.id);
    expect(new Set(ids).size).toBe(32);
  });

  it("Şans hareket kartları plandaki hedeflere gider", () => {
    const targets = cards.chance.filter((c) => c.effect === "advance_to").map((c) => c.target);
    expect(targets).toEqual([0, 24, 11, 5, 39]);
    expect(cards.chance.filter((c) => c.effect === "advance_to_nearest_station")).toHaveLength(2);
    expect(cards.chance.filter((c) => c.effect === "advance_to_nearest_utility")).toHaveLength(1);
    expect(cards.chance.find((c) => c.effect === "go_back")?.steps).toBe(3);
  });
});

describe("kart doğrulaması", () => {
  const clone = (): typeof cardData => structuredClone(cardData);

  it("16 karttan farklı desteyi reddeder", () => {
    const raw = clone();
    raw.chance.pop();
    expect(() => buildCards(raw, board)).toThrow(/tam 16 kart/);
  });

  it("tekrar eden id'yi reddeder", () => {
    const raw = clone();
    raw.communityChest[5]!.id = "C01";
    expect(() => buildCards(raw, board)).toThrow(/tekrar/);
  });

  it("tahta dışındaki advance_to hedefini reddeder", () => {
    const raw = clone();
    raw.chance[0]!.target = 40;
    expect(() => buildCards(raw, board)).toThrow(/0–39/);
  });

  it.each([30, 7, 33])("advance_to hedefi olarak %i numaralı kareyi reddeder", (target) => {
    const raw = clone();
    raw.chance[0]!.target = target;
    expect(() => buildCards(raw, board)).toThrow(/olamaz/);
  });

  it("aynı destede ikinci Kodes'ten Ücretsiz Çık kartını reddeder", () => {
    const raw = clone();
    raw.chance[15]!.effect = "get_out_of_jail_free";
    expect(() => buildCards(raw, board)).toThrow(/en fazla bir/);
  });

  it("bilinmeyen etkiyi reddeder", () => {
    const raw = clone();
    raw.chance[15]!.effect = "teleport";
    expect(() => buildCards(raw, board)).toThrow(/geçersiz effect/);
  });
});

describe("Deck", () => {
  it("çekilen kart destenin altına gider", () => {
    const deck = new Deck(cards.chance);
    expect(deck.draw()).toBe(0);
    expect(deck.size).toBe(16);
    expect(deck.order()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
  });

  it("16 çekimden sonra başlangıç sırasına döner", () => {
    const deck = new Deck(cards.chance);
    const drawn = Array.from({ length: 16 }, () => deck.draw());
    expect(drawn).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(deck.order()).toEqual(drawn);
  });

  it("elde tutulan kart desteden çıkar ve iade edilince en alta girer", () => {
    const deck = new Deck(cards.chance);
    deck.draw();
    const held = deck.draw();
    expect(deck.removeHeld()).toBe(held);
    expect(deck.size).toBe(15);
    expect(deck.order()).not.toContain(held);

    // The deck keeps cycling without the held card.
    const cycle = Array.from({ length: 15 }, () => deck.draw());
    expect(cycle).not.toContain(held);
    expect(new Set(cycle).size).toBe(15);

    deck.returnToBottom(held);
    expect(deck.size).toBe(16);
    expect(deck.order().at(-1)).toBe(held);
  });

  it("boş desteden çekim hata verir", () => {
    const deck = new Deck(cards.chance.slice(0, 1));
    deck.draw();
    deck.removeHeld();
    expect(deck.size).toBe(0);
    expect(() => deck.draw()).toThrow(/Boş deste/);
  });

  it("tam desteye kart iade edilemez", () => {
    const deck = new Deck(cards.chance);
    expect(() => deck.returnToBottom(0)).toThrow(/zaten tam/);
  });

  it("karıştırma tohuma göre deterministiktir ve bir permütasyondur", () => {
    const a = new Deck(cards.chance);
    const b = new Deck(cards.chance);
    const c = new Deck(cards.chance);
    a.shuffle(new Rng(7));
    b.shuffle(new Rng(7));
    c.shuffle(new Rng(8));
    expect(a.order()).toEqual(b.order());
    expect(a.order()).not.toEqual(c.order());
    expect([...a.order()].sort((x, y) => x - y)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("karıştırma elde tutulan kartı da desteye geri koyar", () => {
    const deck = new Deck(cards.chance);
    deck.draw();
    deck.removeHeld();
    deck.shuffle(new Rng(1));
    expect(deck.size).toBe(16);
  });

  it("stackTop istenen kartları en üste dizer", () => {
    const deck = new Deck(cards.chance);
    deck.stackTop(["C09", "C01"]);
    expect(deck.orderIds().slice(0, 3)).toEqual(["C09", "C01", "C02"]);
    expect(deck.size).toBe(16);
  });
});
