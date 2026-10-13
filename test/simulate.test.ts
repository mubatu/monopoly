import { describe, expect, it } from "vitest";
import { ConfigError, resolveConfig, runSimulation } from "../src/simulate.js";
import type { SimulationResult } from "../src/types.js";

const BASE = { players: 4, games: 20, turnsPerGame: 500, jailPayProbability: 0.5, seed: 12345 } as const;
const base = runSimulation(BASE);

function withoutTimings(result: SimulationResult): unknown {
  const { elapsedMs: _elapsedMs, generatedAt: _generatedAt, ...meta } = result.meta;
  return { ...result, meta };
}

function total(result: SimulationResult, key: "landings" | "finalLandings"): number {
  return result.squares.reduce((acc, square) => acc + square[key], 0);
}

describe("sayaç tutarlılığı", () => {
  it("tur sayısı oyuncu × oyun × tur kadardır", () => {
    expect(base.meta.totalTurns).toBe(4 * 20 * 500);
    expect(base.squares).toHaveLength(40);
  });

  it("Σ finalLandings + jail.entries = totalFinalLandings", () => {
    expect(total(base, "finalLandings") + base.jail.entries).toBe(base.meta.totalFinalLandings);
  });

  it("Σ landings ≥ totalFinalLandings", () => {
    expect(total(base, "landings")).toBeGreaterThanOrEqual(base.meta.totalFinalLandings);
    expect(total(base, "landings") + base.jail.entries).toBe(base.meta.totalLandings);
  });

  it("her zar atışı ya bir final üretir ya da Kodes'te geçen bir turdur", () => {
    expect(base.meta.totalRolls).toBe(base.meta.totalFinalLandings + base.jail.turnsInJail);
    expect(base.meta.totalRolls).toBeGreaterThanOrEqual(base.meta.totalTurns - base.jail.turnsInJail);
  });

  it("Kodes giriş nedenleri toplam girişe eşittir", () => {
    const { square, chance_card, chest_card, three_doubles } = base.jail.byReason;
    expect(square + chance_card + chest_card + three_doubles).toBe(base.jail.entries);
    expect(square).toBe(base.squares[30]!.landings);
  });

  it("çekilen kart sayısı kart karelerine gelişlere eşittir", () => {
    const landingsOn = (type: string): number =>
      base.squares.filter((s) => s.type === type).reduce((acc, s) => acc + s.landings, 0);
    expect(base.cards.chanceDraws).toBe(landingsOn("chance"));
    expect(base.cards.chestDraws).toBe(landingsOn("community_chest"));
  });

  it("yüzdeler 100'e toplanır", () => {
    const landingPct = base.squares.reduce((acc, s) => acc + s.landingPct, 0) + base.jail.entryPct;
    const finalPct = base.squares.reduce((acc, s) => acc + s.finalPct, 0) + base.jail.finalPct;
    expect(landingPct).toBeCloseTo(100, 2);
    expect(finalPct).toBeCloseTo(100, 2);
  });

  it("grup toplamları üye karelerin toplamıdır", () => {
    for (const group of base.groups) {
      const members = base.squares.filter((s) => s.group === group.group);
      expect(group.squares).toEqual(members.map((s) => s.index));
      expect(group.landings).toBe(members.reduce((acc, s) => acc + s.landings, 0));
      expect(group.finalLandings).toBe(members.reduce((acc, s) => acc + s.finalLandings, 0));
    }
    expect(base.groups).toHaveLength(10);
  });
});

describe("dağılımlar", () => {
  it("zar toplamı üçgen dağılıma yakındır", () => {
    const rolls = base.meta.totalRolls;
    let counted = 0;
    for (let s = 2; s <= 12; s++) {
      const expected = (6 - Math.abs(7 - s)) / 36;
      expect(Math.abs(base.dice.sums[String(s)]! / rolls - expected)).toBeLessThan(0.01);
      counted += base.dice.sums[String(s)]!;
    }
    expect(counted).toBe(rolls);
    expect(Math.abs(base.dice.doubles / rolls - 1 / 6)).toBeLessThan(0.01);
  });

  it("Kodes (giriş) en yüksek kovadır", () => {
    const maxFinal = Math.max(...base.squares.map((s) => s.finalLandings));
    const maxLanding = Math.max(...base.squares.map((s) => s.landings));
    expect(base.jail.entries).toBeGreaterThan(maxFinal);
    expect(base.jail.entries).toBeGreaterThan(maxLanding);
  });

  it("turuncu grup pembe gruptan daha çok ziyaret edilir", () => {
    const orange = base.groups.find((g) => g.group === "turuncu")!;
    const pink = base.groups.find((g) => g.group === "pembe")!;
    expect(orange.landings).toBeGreaterThan(pink.landings);
    expect(orange.finalLandings).toBeGreaterThan(pink.finalLandings);
  });

  it("Şans karelerinde final yüzdesi geliş yüzdesinden düşüktür", () => {
    for (const index of [7, 22, 36]) {
      const square = base.squares[index]!;
      expect(square.type).toBe("chance");
      expect(square.finalPct).toBeLessThan(square.landingPct);
    }
  });

  it("Kodes'e Gir karesinde hamle bitmez", () => {
    expect(base.squares[30]!.landings).toBeGreaterThan(0);
    expect(base.squares[30]!.finalLandings).toBe(0);
  });
});

describe("Kodes'ten çıkış parametresi", () => {
  it("jailPayProbability=1 iken Kodes'te tur geçirilmez", () => {
    const result = runSimulation({ ...BASE, jailPayProbability: 1 });
    expect(result.jail.entries).toBeGreaterThan(0);
    expect(result.jail.turnsInJail).toBe(0);
    expect(result.jail.turnsInJailPctOfTurns).toBe(0);
    expect(result.meta.totalRolls).toBe(result.meta.totalFinalLandings);
  });

  it("jailPayProbability=0 iken oyuncular çift atmayı dener", () => {
    const result = runSimulation({ ...BASE, jailPayProbability: 0 });
    expect(result.jail.turnsInJail).toBeGreaterThan(base.jail.turnsInJail);
    // At most two turns are spent inside per stay; the third failed roll gets the player out.
    expect(result.jail.turnsInJail).toBeLessThanOrEqual(2 * result.jail.entries);
  });
});

describe("determinizm", () => {
  it("aynı seed ve config birebir aynı sonucu verir", () => {
    const again = runSimulation(BASE);
    expect(JSON.stringify(withoutTimings(again))).toBe(JSON.stringify(withoutTimings(base)));
  });

  it("farklı seed farklı sonuç verir", () => {
    const other = runSimulation({ ...BASE, seed: 54321 });
    expect(other.squares.map((s) => s.landings)).not.toEqual(base.squares.map((s) => s.landings));
  });

  it("seed verilmezse üretilen seed sonuçta raporlanır", () => {
    const result = runSimulation({ games: 1, turnsPerGame: 10 });
    expect(Number.isInteger(result.config.seed)).toBe(true);
    expect(result.config.seed).toBeGreaterThanOrEqual(0);
    expect(result.config.seed).toBeLessThanOrEqual(0xffffffff);
    const replay = runSimulation(result.config);
    expect(JSON.stringify(withoutTimings(replay))).toBe(JSON.stringify(withoutTimings(result)));
  });
});

describe("seçenekler", () => {
  it("onProgress her oyundan sonra çağrılır", () => {
    const calls: Array<[number, number]> = [];
    runSimulation({ ...BASE, games: 5, turnsPerGame: 10 }, { onProgress: (done, all) => calls.push([done, all]) });
    expect(calls).toEqual([
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ]);
  });

  it("trackPerGame oyun bazında final sayımlarını saklar ve toplamları tutar", () => {
    const result = runSimulation({ ...BASE, games: 6, turnsPerGame: 200, trackPerGame: true });
    expect(base.perGame).toBeNull();
    expect(result.perGame).toHaveLength(6);

    for (const game of result.perGame!) expect(game.finalLandings).toHaveLength(40);
    for (let i = 0; i < 40; i++) {
      const acrossGames = result.perGame!.reduce((acc, game) => acc + game.finalLandings[i]!, 0);
      expect(acrossGames).toBe(result.squares[i]!.finalLandings);
    }
    expect(result.perGame!.reduce((acc, game) => acc + game.jailEntries, 0)).toBe(result.jail.entries);

    // Tracking must not change the simulation itself.
    const untracked = runSimulation({ ...BASE, games: 6, turnsPerGame: 200 });
    expect(untracked.squares).toEqual(result.squares);
  });

  it("piyon sayısı 2 ve 6 ile çalışır", () => {
    expect(runSimulation({ ...BASE, players: 2, games: 2 }).meta.totalTurns).toBe(2 * 2 * 500);
    expect(runSimulation({ ...BASE, players: 6, games: 2 }).meta.totalTurns).toBe(6 * 2 * 500);
  });
});

describe("yapılandırma doğrulaması", () => {
  it("varsayılanları doldurur", () => {
    expect(resolveConfig({ seed: 7 })).toEqual({
      edition: "istanbul",
      players: 4,
      games: 100,
      turnsPerGame: 1000,
      jailPayProbability: 0.5,
      seed: 7,
      trackPerGame: false,
    });
  });

  it("negatif 32-bit seed'i işaretsiz karşılığına çevirir", () => {
    expect(resolveConfig({ seed: -1 }).seed).toBe(0xffffffff);
  });

  it.each([
    [{ players: 1 }, /players 2–6/],
    [{ players: 7 }, /players 2–6/],
    [{ players: 2.5 }, /players 2–6/],
    [{ games: 0 }, /games en az 1/],
    [{ turnsPerGame: 0 }, /turnsPerGame en az 1/],
    [{ turnsPerGame: Number.NaN }, /turnsPerGame en az 1/],
    [{ jailPayProbability: -0.1 }, /jailPayProbability 0–1/],
    [{ jailPayProbability: 1.5 }, /jailPayProbability 0–1/],
    [{ jailPayProbability: Number.NaN }, /jailPayProbability 0–1/],
    [{ seed: 1.5 }, /seed/],
    [{ seed: 2 ** 32 }, /seed/],
    [{ edition: "london" as never }, /edition/],
  ])("%j reddedilir", (input, message) => {
    expect(() => resolveConfig(input)).toThrow(message);
    expect(() => resolveConfig(input)).toThrow(ConfigError);
    expect(() => runSimulation(input)).toThrow(message);
  });
});
