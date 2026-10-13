import istanbulCards from "../data/cards.istanbul.json" with { type: "json" };
import type { Board } from "./board.js";
import { shuffle, type RandomSource } from "./rng.js";
import { CARD_EFFECTS, type Card, type CardEffect, type Edition } from "./types.js";

export const DECK_SIZE = 16;

export const EFFECT_NONE = 0;
export const EFFECT_ADVANCE_TO = 1;
export const EFFECT_NEAREST_STATION = 2;
export const EFFECT_NEAREST_UTILITY = 3;
export const EFFECT_GO_BACK = 4;
export const EFFECT_GO_TO_JAIL = 5;
export const EFFECT_GOOJF = 6;

const EFFECT_CODES: Record<CardEffect, number> = {
  none: EFFECT_NONE,
  advance_to: EFFECT_ADVANCE_TO,
  advance_to_nearest_station: EFFECT_NEAREST_STATION,
  advance_to_nearest_utility: EFFECT_NEAREST_UTILITY,
  go_back: EFFECT_GO_BACK,
  go_to_jail: EFFECT_GO_TO_JAIL,
  get_out_of_jail_free: EFFECT_GOOJF,
};

export interface CardSet {
  readonly chance: readonly Card[];
  readonly communityChest: readonly Card[];
}

const CARD_DATA: Record<Edition, unknown> = {
  istanbul: istanbulCards,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildDeck(raw: unknown, label: string, board: Board, seenIds: Set<string>): Card[] {
  if (!Array.isArray(raw)) throw new Error(`${label} destesi bir dizi olmalı.`);
  if (raw.length !== DECK_SIZE) {
    throw new Error(`${label} destesi tam ${DECK_SIZE} kart olmalı, ${raw.length} kart bulundu.`);
  }

  let jailFreeCards = 0;
  return raw.map((item: unknown, i: number) => {
    if (!isRecord(item)) throw new Error(`${label} kartı ${i}: nesne bekleniyor.`);
    const { id, text, effect, target, steps } = item;
    if (typeof id !== "string" || id.length === 0) throw new Error(`${label} kartı ${i}: id boş olamaz.`);
    if (seenIds.has(id)) throw new Error(`Kart id'si tekrar ediyor: "${id}".`);
    seenIds.add(id);
    if (typeof text !== "string") throw new Error(`Kart ${id}: text metin olmalı.`);
    if (typeof effect !== "string" || !(CARD_EFFECTS as readonly string[]).includes(effect)) {
      throw new Error(`Kart ${id}: geçersiz effect "${String(effect)}".`);
    }

    const card: Card = { id, text, effect: effect as CardEffect };
    switch (card.effect) {
      case "advance_to": {
        if (typeof target !== "number" || !Number.isInteger(target) || target < 0 || target >= board.size) {
          throw new Error(`Kart ${id}: advance_to hedefi 0–${board.size - 1} arasında bir tam sayı olmalı.`);
        }
        const targetType = board.squares[target]!.type;
        if (targetType === "go_to_jail" || targetType === "chance" || targetType === "community_chest") {
          throw new Error(`Kart ${id}: advance_to hedefi "${targetType}" türünde bir kare olamaz.`);
        }
        card.target = target;
        break;
      }
      case "go_back":
        if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1 || steps >= board.size) {
          throw new Error(`Kart ${id}: go_back için steps 1–${board.size - 1} arasında bir tam sayı olmalı.`);
        }
        card.steps = steps;
        break;
      case "advance_to_nearest_station":
        if (board.nextStation[0] === -1) throw new Error(`Kart ${id}: tahtada ulaşım aracı karesi yok.`);
        break;
      case "advance_to_nearest_utility":
        if (board.nextUtility[0] === -1) throw new Error(`Kart ${id}: tahtada kamu kuruluşu karesi yok.`);
        break;
      case "get_out_of_jail_free":
        if (++jailFreeCards > 1) {
          throw new Error(`${label} destesinde en fazla bir "Kodes'ten Ücretsiz Çık" kartı olabilir.`);
        }
        break;
      default:
        break;
    }
    return card;
  });
}

/** Validates raw card data against the board it will be played on. */
export function buildCards(raw: unknown, board: Board): CardSet {
  if (!isRecord(raw)) throw new Error("Kart verisi geçersiz: { chance[], communityChest[] } bekleniyor.");
  const seenIds = new Set<string>();
  return {
    chance: buildDeck(raw.chance, "Şans", board, seenIds),
    communityChest: buildDeck(raw.communityChest, "Kamu Fonu", board, seenIds),
  };
}

export function loadCards(edition: Edition, board: Board): CardSet {
  const raw = CARD_DATA[edition];
  if (raw === undefined) throw new Error(`Bilinmeyen baskı: "${String(edition)}".`);
  return buildCards(raw, board);
}

/**
 * A deck of cards as a circular buffer of card indices (positions in `cards`).
 * No allocation happens while drawing.
 */
export class Deck {
  readonly cards: readonly Card[];
  /** EFFECT_* per card index */
  readonly effects: Uint8Array;
  /** `target` for advance_to, `steps` for go_back, otherwise 0 */
  readonly params: Int8Array;

  private readonly slots: Uint8Array;
  private head = 0;
  private count: number;

  constructor(cards: readonly Card[]) {
    const n = cards.length;
    this.cards = cards;
    this.effects = new Uint8Array(n);
    this.params = new Int8Array(n);
    this.slots = new Uint8Array(n);
    this.count = n;
    for (let i = 0; i < n; i++) {
      const card = cards[i]!;
      this.effects[i] = EFFECT_CODES[card.effect];
      this.params[i] = card.target ?? card.steps ?? 0;
      this.slots[i] = i;
    }
  }

  /** Number of cards currently in the deck (held cards are not counted). */
  get size(): number {
    return this.count;
  }

  /** Puts every card back (including held ones) and shuffles. */
  shuffle(rng: RandomSource): void {
    const n = this.slots.length;
    for (let i = 0; i < n; i++) this.slots[i] = i;
    this.head = 0;
    this.count = n;
    shuffle(this.slots, rng);
  }

  /** Takes the top card, puts it at the bottom and returns its card index. */
  draw(): number {
    if (this.count === 0) throw new Error("Boş desteden kart çekilemez.");
    const slots = this.slots;
    const n = slots.length;
    const card = slots[this.head]!;
    slots[(this.head + this.count) % n] = card;
    this.head = (this.head + 1) % n;
    return card;
  }

  /** Takes the card that was just drawn (now at the bottom) out of the deck and returns its index. */
  removeHeld(): number {
    if (this.count === 0) throw new Error("Boş desteden kart alınamaz.");
    this.count--;
    return this.slots[(this.head + this.count) % this.slots.length]!;
  }

  /** Puts a held card back at the bottom of the deck. */
  returnToBottom(cardIndex: number): void {
    const n = this.slots.length;
    if (this.count === n) throw new Error("Deste zaten tam; kart iade edilemez.");
    this.slots[(this.head + this.count) % n] = cardIndex;
    this.count++;
  }

  /** Card indices from top to bottom. */
  order(): number[] {
    const n = this.slots.length;
    const result: number[] = [];
    for (let i = 0; i < this.count; i++) result.push(this.slots[(this.head + i) % n]!);
    return result;
  }

  /** Card ids from top to bottom. */
  orderIds(): string[] {
    return this.order().map((i) => this.cards[i]!.id);
  }

  /** Moves the given cards to the top, in the given order; the rest keep their relative order. */
  stackTop(ids: readonly string[]): void {
    const wanted = ids.map((id) => {
      const index = this.cards.findIndex((card) => card.id === id);
      if (index === -1) throw new Error(`Destede "${id}" kartı yok.`);
      return index;
    });
    const current = this.order();
    for (const index of wanted) {
      if (!current.includes(index)) throw new Error(`"${this.cards[index]!.id}" kartı şu anda destede değil.`);
    }
    const next = [...wanted, ...current.filter((index) => !wanted.includes(index))];
    this.head = 0;
    for (let i = 0; i < next.length; i++) this.slots[i] = next[i]!;
  }
}
