import { describe, expect, it } from "vitest";
import { Session, resolveSessionConfig } from "../src/session.js";
import { ConfigError, runSimulation } from "../src/simulate.js";
import type { SimulationResult } from "../src/types.js";

function counts(result: SimulationResult): unknown {
  const { elapsedMs: _elapsedMs, generatedAt: _generatedAt, ...meta } = result.meta;
  return { ...result, meta };
}

describe("Session ve runSimulation eşdeğerliği", () => {
  it("oyun başına tur verilince aynı seed ile aynı sonucu üretir", () => {
    const base = { players: 3, jailPayProbability: 0.35, seed: 77 };
    const session = new Session({ ...base, turnsPerGame: 40 });
    session.playTurns(5 * 40 * 3);

    expect(session.gamesStarted).toBe(5);
    expect(counts(session.snapshot())).toEqual(counts(runSimulation({ ...base, games: 5, turnsPerGame: 40 })));
  });

  it("kesintisiz oturum tek uzun oyunla aynıdır", () => {
    const base = { players: 4, jailPayProbability: 0.6, seed: 5 };
    const session = new Session(base);
    session.playTurns(250 * 4);

    expect(session.gamesStarted).toBe(1);
    expect(session.config.turnsPerGame).toBeNull();
    expect(counts(session.snapshot())).toEqual(counts(runSimulation({ ...base, games: 1, turnsPerGame: 250 })));
  });

  it("playTurns(n), n kez playNextTurn ile aynıdır", () => {
    const config = { players: 5, seed: 9, turnsPerGame: 7 };
    const a = new Session(config);
    const b = new Session(config);
    a.playTurns(333);
    for (let i = 0; i < 333; i++) b.playNextTurn();

    expect(a.state.stats).toEqual(b.state.stats);
    expect(a.state.players).toEqual(b.state.players);
    expect(a.nextPlayer).toBe(b.nextPlayer);
    expect(a.gamesStarted).toBe(b.gamesStarted);
  });
});

describe("Session akışı", () => {
  it("piyonlar Başlangıç'ta ve sıra ilk oyuncuda başlar", () => {
    const session = new Session({ players: 6, seed: 1 });
    expect(session.state.players).toHaveLength(6);
    expect(session.state.players.every((p) => p.pos === 0 && !p.inJail)).toBe(true);
    expect(session.nextPlayer).toBe(0);
    expect(session.totalTurns).toBe(0);
    expect(session.gamesStarted).toBe(1);
  });

  it("sıra oyuncular arasında döner", () => {
    const session = new Session({ players: 3, seed: 1 });
    const order: number[] = [];
    for (let i = 0; i < 7; i++) {
      order.push(session.nextPlayer);
      session.playNextTurn();
    }
    expect(order).toEqual([0, 1, 2, 0, 1, 2, 0]);
    expect(session.totalTurns).toBe(7);
  });

  it("oyun sınırında piyonlar başa döner ve desteler tamamlanır", () => {
    const session = new Session({ players: 2, seed: 3, turnsPerGame: 30 });
    session.playTurns(60);
    // The game is over, but the next one only starts with the next turn.
    expect(session.gamesStarted).toBe(1);

    const { state } = session;
    state.observer = {
      roll: () => {
        // First roll of the new game: everything has been reset by now.
        expect(state.players.every((p) => !p.inJail && p.heldChance === -1 && p.heldChest === -1)).toBe(true);
        expect(state.players[1]!.pos).toBe(0);
        expect(state.chance.size).toBe(16);
        expect(state.chest.size).toBe(16);
        state.observer = null;
      },
      land: () => {},
      card: () => {},
      jailEnter: () => {},
      jailExit: () => {},
      jailStay: () => {},
    };
    session.playNextTurn();

    expect(state.observer).toBeNull();
    expect(session.gamesStarted).toBe(2);
    expect(session.nextPlayer).toBe(1);
  });

  it("snapshot CLI şemasında güncel sayaçları verir", () => {
    const session = new Session({ players: 4, seed: 11 });
    expect(session.snapshot().meta.totalTurns).toBe(0);
    expect(session.snapshot().squares.every((s) => s.landingPct === 0)).toBe(true);

    session.playTurns(4 * 100 + 2);
    const result = session.snapshot(1234);
    expect(result.meta.totalTurns).toBe(402);
    expect(result.meta.elapsedMs).toBe(1234);
    expect(result.config).toEqual({
      edition: "istanbul",
      players: 4,
      games: 1,
      turnsPerGame: 100,
      jailPayProbability: 0.5,
      seed: 11,
      trackPerGame: false,
    });
    expect(result.squares).toHaveLength(40);
    expect(result.perGame).toBeNull();
  });
});

describe("Session yapılandırması", () => {
  it("varsayılanları doldurur", () => {
    expect(resolveSessionConfig({ seed: 4 })).toEqual({
      edition: "istanbul",
      players: 4,
      jailPayProbability: 0.5,
      seed: 4,
      turnsPerGame: null,
    });
  });

  it("seed verilmezse üretir ve raporlar", () => {
    const session = new Session();
    expect(Number.isInteger(session.config.seed)).toBe(true);
  });

  it.each([
    [{ players: 1 }, "players"],
    [{ players: 7 }, "players"],
    [{ jailPayProbability: 2 }, "jailPayProbability"],
    [{ turnsPerGame: 0 }, "turnsPerGame"],
    [{ turnsPerGame: 1.5 }, "turnsPerGame"],
    [{ seed: 0.5 }, "seed"],
  ])("%j ConfigError fırlatır", (input, field) => {
    let thrown: unknown;
    try {
      new Session(input);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).field).toBe(field);
  });
});
