import type { CardSet } from "../../../src/cards.js";
import type { Card, CardEffect, DeckKind } from "../../../src/types.js";
import { DECK_THEME } from "../theme.js";
import { byId } from "./dom.js";

const NOTES: Partial<Record<CardEffect, string>> = {
  get_out_of_jail_free: "Kullanılana kadar oyuncuda kalır, sonra destenin altına döner.",
};

interface Entry {
  card: Card;
  count: number;
}

/** Identical cards (same text and effect) are listed once, with how many of them the deck has. */
function group(cards: readonly Card[]): Entry[] {
  const entries: Entry[] = [];
  for (const card of cards) {
    const same = entries.find((entry) => entry.card.text === card.text && entry.card.effect === card.effect);
    if (same === undefined) entries.push({ card, count: 1 });
    else same.count++;
  }
  return entries;
}

function deckColumn(kind: DeckKind, cards: readonly Card[]): HTMLElement {
  const theme = DECK_THEME[kind];
  const section = document.createElement("section");
  section.className = "deck";
  section.style.setProperty("--deck-color", theme.color);

  const title = document.createElement("h3");
  title.textContent = theme.label;
  const size = document.createElement("span");
  size.className = "muted";
  size.textContent = `${cards.length} kart`;
  title.append(size);

  const list = document.createElement("ul");
  for (const { card, count } of group(cards)) {
    const item = document.createElement("li");
    const text = document.createElement("span");
    text.className = "card-text";
    text.textContent = card.text;
    const note = NOTES[card.effect];
    if (note !== undefined) {
      const small = document.createElement("small");
      small.textContent = note;
      text.append(small);
    }
    const share = document.createElement("span");
    share.className = "card-count";
    share.textContent = count > 1 ? `×${count}` : "";
    share.title = `${count}/${cards.length}`;
    item.append(text, share);
    list.append(item);
  }

  section.append(title, list);
  return section;
}

/** Lists the contents of both decks. */
export class CardsView {
  private readonly root = byId("cards");

  constructor(cards: CardSet) {
    byId("cards-decks").append(deckColumn("chance", cards.chance), deckColumn("communityChest", cards.communityChest));
    byId("cards-close").addEventListener("click", () => this.close());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }
}
