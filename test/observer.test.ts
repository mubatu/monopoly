import { describe, expect, it } from "vitest";
import { loadBoard } from "../src/board.js";
import { loadCards } from "../src/cards.js";
import { createGameState, playTurn, REASON_SQUARE, REASON_THREE_DOUBLES, sendToJail, startGame } from "../src/engine.js";
import { Rng } from "../src/rng.js";
import type { GameState, TurnObserver } from "../src/types.js";
import { scriptedGame } from "./helpers.js";

/** Records every observer call as a compact string, in order. */
function recorder(): { log: string[]; observer: TurnObserver } {
  const log: string[] = [];
  return {
    log,
    observer: {
      roll: (p, d1, d2) => log.push(`roll p${p} ${d1}+${d2}`),
      land: (p, from, to, via) => log.push(`land p${p} ${from}>${to} via${via}`),
      card: (p, deck, cardIndex) => log.push(`card p${p} ${deck} #${cardIndex}`),
      jailEnter: (p, reason) => log.push(`jailEnter p${p} r${reason}`),
      jailExit: (p, how) => log.push(`jailExit p${p} h${how}`),
      jailStay: (p) => log.push(`jailStay p${p}`),
    },
  };
}

function observed(dice: readonly number[], jailPayProbability = 0): { state: GameState; log: string[] } {
  const { state } = scriptedGame(dice, jailPayProbability);
  const { log, observer } = recorder();
  state.observer = observer;
  return { state, log };
}

describe("tur olayları", () => {
  it("düz hamle: zar ve konaklama", () => {
    const { state, log } = observed([1, 2]);
    playTurn(state, 1);
    expect(log).toEqual(["roll p1 1+2", "land p1 0>3 via0"]);
  });

  it("3 kare geri zinciri: her kart ve her konaklama sırayla bildirilir", () => {
    const { state, log } = observed([3, 4]);
    state.players[0]!.pos = 29;
    state.chance.stackTop(["C09"]);
    playTurn(state, 0);

    const c09 = state.chance.cards.findIndex((c) => c.id === "C09");
    const k04 = state.chest.cards.findIndex((c) => c.id === "K04");
    expect(log).toEqual([
      "roll p0 3+4",
      "land p0 29>36 via0",
      `card p0 chance #${c09}`,
      "land p0 36>33 via2",
      `card p0 communityChest #${k04}`,
    ]);
  });

  it("kartla ileri gitme via=1 olarak bildirilir", () => {
    const { state, log } = observed([3, 4]);
    state.chance.stackTop(["C08"]);
    playTurn(state, 0);
    expect(log.slice(-1)).toEqual(["land p0 7>39 via1"]);
  });

  it("üç çift: üçüncü atıştan sonra konaklama yok, Kodes'e giriş var", () => {
    const { state, log } = observed([1, 1, 2, 2, 3, 3]);
    playTurn(state, 0);
    expect(log).toEqual([
      "roll p0 1+1",
      "land p0 0>2 via0",
      `card p0 communityChest #${state.chest.cards.findIndex((c) => c.id === "K04")}`,
      "roll p0 2+2",
      "land p0 2>6 via0",
      "roll p0 3+3",
      `jailEnter p0 r${REASON_THREE_DOUBLES}`,
    ]);
  });

  it("Kodes'e Gir karesi: konaklama, sonra giriş", () => {
    const { state, log } = observed([2, 4]);
    state.players[0]!.pos = 24;
    playTurn(state, 0);
    expect(log).toEqual(["roll p0 2+4", "land p0 24>30 via0", `jailEnter p0 r${REASON_SQUARE}`]);
  });

  it("Kodes'te kalma, çiftle çıkma ve üçüncü atışta çıkma", () => {
    const { state, log } = observed([1, 2, 1, 3, 2, 3, 4, 4], 0);
    const player = state.players[0]!;
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);
    playTurn(state, 0);
    playTurn(state, 0);
    sendToJail(state, player, REASON_SQUARE);
    playTurn(state, 0);

    expect(log).toEqual([
      `jailEnter p0 r${REASON_SQUARE}`,
      "roll p0 1+2",
      "jailStay p0",
      "roll p0 1+3",
      "jailStay p0",
      "roll p0 2+3",
      "jailExit p0 h3",
      "land p0 10>15 via0",
      `jailEnter p0 r${REASON_SQUARE}`,
      "roll p0 4+4",
      "jailExit p0 h2",
      "land p0 10>18 via0",
    ]);
  });

  it("ödeyerek ve kartla çıkış zar atışından önce bildirilir", () => {
    const paying = observed([1, 2], 1);
    sendToJail(paying.state, paying.state.players[0]!, REASON_SQUARE);
    playTurn(paying.state, 0);
    expect(paying.log.slice(1)).toEqual(["jailExit p0 h1", "roll p0 1+2", "land p0 10>13 via0"]);

    const withCard = observed([1, 2], 0);
    const player = withCard.state.players[0]!;
    withCard.state.chance.stackTop(["C11"]);
    withCard.state.chance.draw();
    player.heldChance = withCard.state.chance.removeHeld();
    sendToJail(withCard.state, player, REASON_SQUARE);
    playTurn(withCard.state, 0);
    expect(withCard.log.slice(1)).toEqual(["jailExit p0 h0", "roll p0 1+2", "land p0 10>13 via0"]);
  });
});

describe("gözlemci ve sayaçlar", () => {
  function run(withObserver: boolean): { state: GameState; counts: Record<string, number> } {
    const board = loadBoard("istanbul");
    const state = createGameState({
      board,
      cards: loadCards("istanbul", board),
      players: 4,
      rng: new Rng(2024),
      jailPayProbability: 0.4,
    });
    const counts = { roll: 0, land: 0, card: 0, jailEnter: 0, jailExit: 0, jailStay: 0 };
    if (withObserver) {
      state.observer = {
        roll: () => void counts.roll++,
        land: () => void counts.land++,
        card: () => void counts.card++,
        jailEnter: () => void counts.jailEnter++,
        jailExit: () => void counts.jailExit++,
        jailStay: () => void counts.jailStay++,
      };
    }
    startGame(state);
    for (let turn = 0; turn < 5000; turn++) {
      for (let p = 0; p < 4; p++) playTurn(state, p);
    }
    return { state, counts };
  }

  const watched = run(true);
  const plain = run(false);

  it("olay sayıları sayaçlarla tutarlıdır", () => {
    const { stats } = watched.state;
    expect(watched.counts.roll).toBe(stats.totalRolls);
    expect(watched.counts.land).toBe(stats.landings.reduce((a, b) => a + b, 0));
    expect(watched.counts.card).toBe(stats.chanceDraws + stats.chestDraws);
    expect(watched.counts.jailEnter).toBe(stats.jailEntries);
    expect(watched.counts.jailStay).toBe(stats.turnsInJail);
    // Everyone who went in has come out, except those still inside.
    const inside = watched.state.players.filter((p) => p.inJail).length;
    expect(watched.counts.jailExit).toBe(stats.jailEntries - inside);
  });

  it("gözlemci sonucu değiştirmez", () => {
    expect(watched.state.stats).toEqual(plain.state.stats);
    expect(watched.state.players).toEqual(plain.state.players);
    expect(plain.counts.roll).toBe(0);
  });
});
