import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/board.js";
import { loadCards } from "../src/cards.js";
import {
  createGameState,
  playTurn,
  REASON_CHANCE_CARD,
  REASON_CHEST_CARD,
  REASON_SQUARE,
  REASON_THREE_DOUBLES,
  sendToJail,
  startGame,
} from "../src/engine.js";
import { Rng } from "../src/rng.js";
import { scriptedGame, sum } from "./helpers.js";

const JAIL = 40;

describe("normal tur", () => {
  it("zar toplamı kadar ilerler ve konaklamayı sayar", () => {
    const { state } = scriptedGame([1, 2]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(3);
    expect(state.stats.landings[3]).toBe(1);
    expect(state.stats.finalLandings[3]).toBe(1);
    expect(state.stats.totalTurns).toBe(1);
    expect(state.stats.totalRolls).toBe(1);
    expect(state.players[1]!.pos).toBe(0);
  });

  it("tahtanın sonundan başa sarar", () => {
    const { state } = scriptedGame([5, 6]);
    state.players[0]!.pos = 35;
    playTurn(state, 0);
    expect(state.players[0]!.pos).toBe(6);
  });

  it("çift atınca tekrar atar ve her atış ayrı final üretir", () => {
    const { state, rng } = scriptedGame([2, 2, 1, 2]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(7);
    expect(state.stats.landings[4]).toBe(1);
    expect(state.stats.landings[7]).toBe(1);
    expect(state.stats.finalLandings[4]).toBe(1);
    expect(state.stats.finalLandings[7]).toBe(1);
    expect(state.stats.totalTurns).toBe(1);
    expect(state.stats.totalRolls).toBe(2);
    expect(state.stats.doubles).toBe(1);
    expect(rng.remaining).toBe(0);
  });

  it("üst üste üç çift Kodes'e gönderir ve üçüncü atışta piyon ilerlemez", () => {
    const { state } = scriptedGame([1, 1, 2, 2, 3, 3]);
    const player = state.players[0]!;
    playTurn(state, 0);

    expect(player.inJail).toBe(true);
    expect(player.pos).toBe(10);
    // Only the first two rolls produced landings: 0 → 2 → 6.
    expect(state.stats.landings[2]).toBe(1);
    expect(state.stats.landings[6]).toBe(1);
    expect(sum(state.stats.landings)).toBe(2);
    expect(state.stats.jailEntries).toBe(1);
    expect(state.stats.jailEntryReason[REASON_THREE_DOUBLES]).toBe(1);
    expect(state.stats.finalLandings[JAIL]).toBe(1);
    expect(sum(state.stats.finalLandings)).toBe(3);
    expect(state.stats.totalRolls).toBe(3);
  });
});

describe("Kodes'e Gir karesi", () => {
  it("konaklamayı sayar ve oyuncuyu Kodes'e koyar", () => {
    const { state } = scriptedGame([2, 4]);
    const player = state.players[0]!;
    player.pos = 24;
    playTurn(state, 0);

    expect(state.stats.landings[30]).toBe(1);
    expect(state.stats.finalLandings[30]).toBe(0);
    expect(state.stats.finalLandings[JAIL]).toBe(1);
    // Being in jail is not a visit to square 10.
    expect(state.stats.landings[10]).toBe(0);
    expect(player.inJail).toBe(true);
    expect(player.pos).toBe(10);
    expect(state.stats.jailEntryReason[REASON_SQUARE]).toBe(1);
  });

  it("çiftle gelinse bile tekrar atış yoktur", () => {
    const { state, rng } = scriptedGame([2, 2]);
    state.players[0]!.pos = 26;
    playTurn(state, 0);

    expect(state.players[0]!.inJail).toBe(true);
    expect(rng.remaining).toBe(0);
  });

  it("ziyaretçi olarak 10'a gelmek Kodes'e girmek değildir", () => {
    const { state } = scriptedGame([4, 6]);
    playTurn(state, 0);

    expect(state.players[0]!.inJail).toBe(false);
    expect(state.stats.landings[10]).toBe(1);
    expect(state.stats.finalLandings[10]).toBe(1);
    expect(state.stats.jailEntries).toBe(0);
  });
});

describe("kartlar", () => {
  it("düz kart piyonu yerinde bırakır ve destenin altına gider", () => {
    const { state } = scriptedGame([3, 4]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(7);
    expect(state.stats.chanceDraws).toBe(1);
    expect(state.stats.finalLandings[7]).toBe(1);
    expect(state.chance.orderIds().at(-1)).toBe("C12");
    expect(state.chance.size).toBe(16);
  });

  it.each([
    { card: "C01", from: 7, to: 0 },
    { card: "C02", from: 36, to: 24 },
    { card: "C03", from: 22, to: 11 },
    { card: "C07", from: 7, to: 5 },
    { card: "C08", from: 22, to: 39 },
    { card: "C05", from: 7, to: 15 },
    { card: "C05", from: 22, to: 25 },
    { card: "C06", from: 36, to: 5 },
    { card: "C04", from: 7, to: 12 },
    { card: "C04", from: 22, to: 28 },
    { card: "C04", from: 36, to: 12 },
    { card: "C09", from: 7, to: 4 },
    { card: "C09", from: 22, to: 19 },
  ])("$card: $from → $to, ara konaklama da sayılır", ({ card, from, to }) => {
    const { state } = scriptedGame([1, 2]);
    state.players[0]!.pos = from - 3;
    state.chance.stackTop([card]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(to);
    expect(state.stats.landings[from]).toBe(1);
    expect(state.stats.landings[to]).toBe(1);
    expect(state.stats.finalLandings[from]).toBe(0);
    expect(state.stats.finalLandings[to]).toBe(1);
    expect(sum(state.stats.finalLandings)).toBe(1);
  });

  it("3 kare geri: 36 → 33 ve Kamu Fonu'ndan ikinci kart çekilir", () => {
    const { state } = scriptedGame([3, 4]);
    state.players[0]!.pos = 29;
    state.chance.stackTop(["C09"]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(33);
    expect(state.stats.landings[36]).toBe(1);
    expect(state.stats.landings[33]).toBe(1);
    expect(state.stats.finalLandings[33]).toBe(1);
    expect(state.stats.chanceDraws).toBe(1);
    expect(state.stats.chestDraws).toBe(1);
    // Both decks advanced by one card.
    expect(state.chance.orderIds().at(-1)).toBe("C09");
    expect(state.chest.orderIds().at(-1)).toBe("K04");
    expect(state.chest.orderIds()[0]).toBe("K01");
  });

  it("zincir: 36 → 33 (Kamu Fonu) → Başlangıç", () => {
    const { state } = scriptedGame([3, 4]);
    state.players[0]!.pos = 29;
    state.chance.stackTop(["C09"]);
    state.chest.stackTop(["K01"]);
    playTurn(state, 0);

    expect(state.players[0]!.pos).toBe(0);
    expect(state.stats.landings[36]).toBe(1);
    expect(state.stats.landings[33]).toBe(1);
    expect(state.stats.landings[0]).toBe(1);
    expect(state.stats.finalLandings[0]).toBe(1);
    expect(sum(state.stats.finalLandings)).toBe(1);
  });

  it("zincir: 36 → 33 (Kamu Fonu) → Kodes", () => {
    const { state } = scriptedGame([3, 4]);
    state.players[0]!.pos = 29;
    state.chance.stackTop(["C09"]);
    state.chest.stackTop(["K02"]);
    playTurn(state, 0);

    expect(state.players[0]!.inJail).toBe(true);
    expect(state.stats.jailEntryReason[REASON_CHEST_CARD]).toBe(1);
    expect(state.stats.finalLandings[JAIL]).toBe(1);
    expect(sum(state.stats.finalLandings)).toBe(1);
  });

  it("Şans'tan Kodes'e git kartı", () => {
    const { state } = scriptedGame([3, 4]);
    state.chance.stackTop(["C10"]);
    playTurn(state, 0);

    expect(state.players[0]!.inJail).toBe(true);
    expect(state.players[0]!.pos).toBe(10);
    expect(state.stats.landings[7]).toBe(1);
    expect(state.stats.jailEntryReason[REASON_CHANCE_CARD]).toBe(1);
    expect(state.stats.finalLandings[JAIL]).toBe(1);
  });

  it("Kamu Fonu'ndan Kodes'e git kartı çift atılmış olsa da turu bitirir", () => {
    const { state, rng } = scriptedGame([1, 1]);
    state.chest.stackTop(["K02"]);
    playTurn(state, 0);

    expect(state.players[0]!.inJail).toBe(true);
    expect(state.stats.jailEntryReason[REASON_CHEST_CARD]).toBe(1);
    expect(rng.remaining).toBe(0);
  });

  it("kart desteleri oyuncular arasında ortaktır", () => {
    const { state } = scriptedGame([3, 4, 3, 4]);
    state.chance.stackTop(["C12", "C01"]);
    playTurn(state, 0);
    playTurn(state, 1);

    expect(state.players[0]!.pos).toBe(7);
    expect(state.players[1]!.pos).toBe(0);
  });
});

describe("Kodes: zar atma stratejisi", () => {
  it("çift atınca çıkar, ilerler ve tekrar atmaz", () => {
    const { state, rng } = scriptedGame([3, 3], 0);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    expect(player.jailStrategy).toBe("roll");
    playTurn(state, 0);

    expect(player.inJail).toBe(false);
    expect(player.pos).toBe(16);
    expect(state.stats.finalLandings[16]).toBe(1);
    expect(state.stats.turnsInJail).toBe(0);
    expect(rng.remaining).toBe(0);
  });

  it("üçüncü başarısız atışta aynı zarla çıkar", () => {
    const { state } = scriptedGame([1, 2, 1, 3, 2, 3], 0);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);

    playTurn(state, 0);
    expect(player.inJail).toBe(true);
    expect(state.stats.turnsInJail).toBe(1);

    playTurn(state, 0);
    expect(player.inJail).toBe(true);
    expect(player.pos).toBe(10);
    expect(state.stats.turnsInJail).toBe(2);
    expect(sum(state.stats.landings)).toBe(0);

    playTurn(state, 0);
    expect(player.inJail).toBe(false);
    expect(player.pos).toBe(15);
    expect(state.stats.turnsInJail).toBe(2);
    expect(state.stats.finalLandings[15]).toBe(1);
    expect(state.stats.totalRolls).toBe(3);
  });

  it("ikinci denemede çift atarsa o zaman çıkar", () => {
    const { state } = scriptedGame([1, 2, 4, 4], 0);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    playTurn(state, 0);

    expect(player.inJail).toBe(false);
    expect(player.pos).toBe(18);
    expect(state.stats.turnsInJail).toBe(1);
  });

  it("yeni hapis dönemi deneme sayacını sıfırlar", () => {
    const { state } = scriptedGame([1, 2, 1, 2, 1, 2], 0);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    playTurn(state, 0);
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);

    expect(player.inJail).toBe(true);
    expect(player.jailTurns).toBe(1);
  });
});

describe("Kodes: ödeme stratejisi", () => {
  it("ilk turda çıkar ve çift atarsa tekrar atar", () => {
    const { state, rng } = scriptedGame([3, 3, 1, 2], 1);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    expect(player.jailStrategy).toBe("pay");
    playTurn(state, 0);

    expect(player.inJail).toBe(false);
    expect(player.pos).toBe(19);
    expect(state.stats.finalLandings[16]).toBe(1);
    expect(state.stats.finalLandings[19]).toBe(1);
    expect(state.stats.turnsInJail).toBe(0);
    expect(rng.remaining).toBe(0);
  });

  it("çıktıktan sonra üç çift atarsa yeniden Kodes'e girer", () => {
    const { state } = scriptedGame([1, 1, 2, 2, 3, 3], 1);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);

    expect(player.inJail).toBe(true);
    expect(state.stats.landings[12]).toBe(1);
    expect(state.stats.landings[16]).toBe(1);
    expect(state.stats.jailEntries).toBe(2);
    expect(state.stats.jailEntryReason[REASON_THREE_DOUBLES]).toBe(1);
  });
});

describe("Kodes'ten Ücretsiz Çık kartı", () => {
  it("desteden çıkar, oyuncuda kalır ve Kodes'te otomatik kullanılıp destenin altına döner", () => {
    const { state } = scriptedGame([2, 4, 2, 4, 1, 2], 0);
    const player = state.players[0]!;
    state.chance.stackTop(["C11"]);

    player.pos = 1;
    playTurn(state, 0);
    expect(player.pos).toBe(7);
    expect(state.stats.finalLandings[7]).toBe(1);
    expect(state.chance.size).toBe(15);
    expect(state.chance.orderIds()).not.toContain("C11");
    expect(state.chance.cards[player.heldChance]!.id).toBe("C11");

    player.pos = 24;
    playTurn(state, 0);
    expect(player.inJail).toBe(true);
    expect(player.jailStrategy).toBe("roll");

    // Not a double, yet the player leaves on the first turn thanks to the card.
    playTurn(state, 0);
    expect(player.inJail).toBe(false);
    expect(player.pos).toBe(13);
    expect(player.heldChance).toBe(-1);
    expect(state.chance.size).toBe(16);
    expect(state.chance.orderIds().at(-1)).toBe("C11");
    expect(state.stats.turnsInJail).toBe(0);
  });

  it("kartla çıkan oyuncu normal tur oynar: çift atarsa tekrar atar", () => {
    const { state, rng } = scriptedGame([2, 3, 2, 2, 1, 2], 0);
    const player = state.players[0]!;
    state.chest.stackTop(["K03"]);

    player.pos = 12;
    playTurn(state, 0);
    expect(state.chest.size).toBe(15);
    expect(state.chest.cards[player.heldChest]!.id).toBe("K03");

    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    expect(player.pos).toBe(17);
    expect(state.stats.finalLandings[14]).toBe(1);
    expect(state.chest.orderIds().slice(-2)).toEqual(["K03", "K04"]);
    expect(state.chest.size).toBe(16);
    expect(rng.remaining).toBe(0);
  });

  it("iki desteden birer kart tutulabilir ve kartlar kendi destesine döner", () => {
    const { state } = scriptedGame([1, 2, 1, 2], 0);
    const player = state.players[0]!;
    player.heldChance = state.chance.cards.findIndex((c) => c.id === "C11");
    player.heldChest = state.chest.cards.findIndex((c) => c.id === "K03");
    state.chance.stackTop(["C11"]);
    state.chance.draw();
    state.chance.removeHeld();
    state.chest.stackTop(["K03"]);
    state.chest.draw();
    state.chest.removeHeld();

    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    expect(player.inJail).toBe(false);
    expect(state.chance.orderIds().at(-1)).toBe("C11");
    expect(state.chance.size).toBe(16);
    expect(state.chest.size).toBe(15);

    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    expect(player.inJail).toBe(false);
    expect(state.chest.orderIds().at(-1)).toBe("K03");
    expect(state.chest.size).toBe(16);
    expect(state.stats.turnsInJail).toBe(0);
  });
});

describe("Kodes stratejisi kararı", () => {
  function payShare(jailPayProbability: number): number {
    const board = loadBoard("istanbul");
    const state = createGameState({
      board,
      cards: loadCards("istanbul", board),
      players: 2,
      rng: new Rng(99),
      jailPayProbability,
    });
    const player = state.players[0]!;
    const entries = 20000;
    let pays = 0;
    for (let i = 0; i < entries; i++) {
      sendToJail(state, player, REASON_SQUARE);
      if (player.jailStrategy === "pay") pays++;
    }
    return pays / entries;
  }

  it("olasılık 0 ise herkes zar atmayı dener, 1 ise herkes öder", () => {
    expect(payShare(0)).toBe(0);
    expect(payShare(1)).toBe(1);
  });

  it("ara değerlerde girişlerin o oranı öder", () => {
    expect(payShare(0.6)).toBeCloseTo(0.6, 1);
    expect(payShare(0.25)).toBeCloseTo(0.25, 1);
  });
});

describe("startGame", () => {
  it("piyonları Başlangıç'a alır ve desteleri tamamlayıp karıştırır", () => {
    const board = loadBoard("istanbul");
    const state = createGameState({
      board,
      cards: loadCards("istanbul", board),
      players: 3,
      rng: new Rng(5),
      jailPayProbability: 0.5,
    });
    const player = state.players[2]!;
    player.pos = 17;
    player.inJail = true;
    player.jailTurns = 2;
    state.chance.stackTop(["C11"]);
    state.chance.draw();
    player.heldChance = state.chance.removeHeld();

    startGame(state);

    expect(state.players).toHaveLength(3);
    expect(player).toEqual({ pos: 0, inJail: false, jailTurns: 0, jailStrategy: "roll", heldChance: -1, heldChest: -1 });
    expect(state.chance.size).toBe(16);
    expect(state.chest.size).toBe(16);
    expect(state.chance.order()).not.toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});
