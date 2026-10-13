import { describe, expect, it } from "vitest";
import boardData from "../data/board.istanbul.json" with { type: "json" };
import { buildBoard, indicesOfType, loadBoard, nearestStation, nearestUtility } from "../src/board.js";

const board = loadBoard("istanbul");

describe("İstanbul tahtası", () => {
  it("0..39 sıralı 40 kareden oluşur", () => {
    expect(board.size).toBe(40);
    expect(board.squares).toHaveLength(40);
    expect(board.squares.map((s) => s.index)).toEqual(Array.from({ length: 40 }, (_, i) => i));
  });

  it("özel kareler standart yerlerindedir", () => {
    expect(indicesOfType(board, "go")).toEqual([0]);
    expect(indicesOfType(board, "station")).toEqual([5, 15, 25, 35]);
    expect(indicesOfType(board, "utility")).toEqual([12, 28]);
    expect(indicesOfType(board, "chance")).toEqual([7, 22, 36]);
    expect(indicesOfType(board, "community_chest")).toEqual([2, 17, 33]);
    expect(indicesOfType(board, "tax")).toEqual([4, 38]);
    expect(indicesOfType(board, "jail")).toEqual([10]);
    expect(indicesOfType(board, "free_parking")).toEqual([20]);
    expect(indicesOfType(board, "go_to_jail")).toEqual([30]);
    expect(board.jailIndex).toBe(10);
  });

  it("22 mülk ve doğru büyüklükte renk grupları içerir", () => {
    expect(indicesOfType(board, "property")).toHaveLength(22);
    const sizes = Object.fromEntries(
      board.groups.map((group) => [group, board.squares.filter((s) => s.group === group).length]),
    );
    expect(sizes).toEqual({
      kahverengi: 2,
      "açık mavi": 3,
      pembe: 3,
      turuncu: 3,
      kırmızı: 3,
      sarı: 3,
      yeşil: 3,
      lacivert: 2,
      ulaşım: 4,
      "kamu kuruluşu": 2,
    });
  });

  it("kullanıcının doğruladığı kareleri içerir", () => {
    expect(board.squares[23]!.name).toBe("Erenköy");
    expect(board.squares[24]!.name).toBe("Caddebostan");
    expect(board.squares[39]!.name).toBe("Yeniköy");
  });
});

describe("en yakın kare yardımcıları", () => {
  it("Şans karelerinden en yakın ulaşım aracını bulur", () => {
    expect(nearestStation(board, 7)).toBe(15);
    expect(nearestStation(board, 22)).toBe(25);
    expect(nearestStation(board, 36)).toBe(5);
  });

  it("Şans karelerinden en yakın kamu kuruluşunu bulur", () => {
    expect(nearestUtility(board, 7)).toBe(12);
    expect(nearestUtility(board, 22)).toBe(28);
    expect(nearestUtility(board, 36)).toBe(12);
  });

  it("bir istasyonun üzerindeyken bir sonrakini verir", () => {
    expect(nearestStation(board, 5)).toBe(15);
    expect(nearestStation(board, 35)).toBe(5);
  });
});

describe("tahta doğrulaması", () => {
  const clone = (): typeof boardData => structuredClone(boardData);

  it("40 kareden farklı tahtayı reddeder", () => {
    const raw = clone();
    raw.squares.pop();
    expect(() => buildBoard(raw)).toThrow(/40 kare/);
  });

  it("sırası bozuk indeksi reddeder", () => {
    const raw = clone();
    raw.squares[5]!.index = 6;
    expect(() => buildBoard(raw)).toThrow(/index 5/);
  });

  it("bilinmeyen kare türünü reddeder", () => {
    const raw = clone();
    raw.squares[1]!.type = "hotel";
    expect(() => buildBoard(raw)).toThrow(/geçersiz type/);
  });

  it("Kodes karesi olmayan tahtayı reddeder", () => {
    const raw = clone();
    raw.squares[10]!.type = "free_parking";
    expect(() => buildBoard(raw)).toThrow(/Kodes/);
  });
});
