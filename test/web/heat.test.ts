import { describe, expect, it } from "vitest";
import { formatCount, formatPct, HEAT_STOPS, heatColor, heatScale, INK_DARK, INK_LIGHT, inkFor } from "../../web/src/heat.js";

describe("ısı ölçeği", () => {
  it("en düşük ve en yüksek değer uç renkleri verir", () => {
    expect(heatColor(heatScale(1.9, 1.9, 3.2))).toBe(HEAT_STOPS[0]);
    expect(heatColor(heatScale(3.2, 1.9, 3.2))).toBe(HEAT_STOPS.at(-1));
    expect(heatColor(-1)).toBe(HEAT_STOPS[0]);
    expect(heatColor(2)).toBe(HEAT_STOPS.at(-1));
  });

  it("ara duraklara tam oturur ve aralarını doğrusal doldurur", () => {
    expect(heatColor(0.5)).toBe(HEAT_STOPS[3]);
    expect(heatColor(1 / 12)).toBe("#b6d4f8");
  });

  it("ölçek doğrusaldır ve veri yokken sıfırdır", () => {
    expect(heatScale(1, 0, 4)).toBe(0.25);
    expect(heatScale(3, 2, 4)).toBe(0.5);
    expect(heatScale(5, 0, 4)).toBe(1);
    expect(heatScale(1, 2, 4)).toBe(0);
    expect(heatScale(0, 0, 0)).toBe(0);
  });

  it("açıktan koyuya gider", () => {
    const brightness = (hex: string): number => {
      const v = Number.parseInt(hex.slice(1), 16);
      return ((v >> 16) & 0xff) + ((v >> 8) & 0xff) + (v & 0xff);
    };
    let previous = Infinity;
    for (let i = 0; i <= 20; i++) {
      const value = brightness(heatColor(i / 20));
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });

  it("yazı rengi zemine göre seçilir", () => {
    expect(inkFor(HEAT_STOPS[0])).toBe(INK_DARK);
    expect(inkFor(HEAT_STOPS.at(-1)!)).toBe(INK_LIGHT);
  });
});

describe("biçimleme", () => {
  it("yüzdeyi tr-TR biçiminde yazar", () => {
    expect(formatPct(3.1934)).toBe("%3,19");
    expect(formatPct(0)).toBe("%0,00");
    expect(formatPct(11.357, 1)).toBe("%11,4");
  });

  it("sayıları binlik ayraçla yazar", () => {
    expect(formatCount(1234567)).toBe("1.234.567");
  });
});
