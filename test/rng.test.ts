import { describe, expect, it } from "vitest";
import { Rng, shuffle } from "../src/rng.js";

describe("Rng", () => {
  it("aynı tohum aynı diziyi üretir", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it("farklı tohumlar farklı diziler üretir", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 100 }, () => a.nextUint32() === b.nextUint32()).filter(Boolean);
    expect(same.length).toBeLessThan(3);
  });

  it("nextFloat [0, 1) aralığındadır", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 10000; i++) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("rollDie 1..6 arasında yaklaşık eşit dağılır", () => {
    const rng = new Rng(4);
    const counts = new Array<number>(7).fill(0);
    const rolls = 120000;
    for (let i = 0; i < rolls; i++) counts[rng.rollDie()]!++;

    expect(counts[0]).toBe(0);
    for (let face = 1; face <= 6; face++) {
      expect(counts[face]! / rolls).toBeCloseTo(1 / 6, 2);
    }
  });

  it("nextInt verilen aralığın dışına çıkmaz", () => {
    const rng = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.nextInt(16));
    expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});

describe("shuffle", () => {
  it("elemanları koruyarak yerinde karıştırır", () => {
    const items = Array.from({ length: 16 }, (_, i) => i);
    shuffle(items, new Rng(6));
    expect(items).not.toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect([...items].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("tipli dizilerle de çalışır", () => {
    const items = Uint8Array.from({ length: 16 }, (_, i) => i);
    shuffle(items, new Rng(6));
    expect([...items].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });
});
