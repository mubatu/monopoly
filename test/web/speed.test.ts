import { describe, expect, it } from "vitest";
import {
  ANIMATED_MAX,
  DEFAULT_SPEED,
  formatSpeed,
  QUICK_MAX,
  regimeFor,
  SLIDER_MAX,
  sliderToSpeed,
  SPEED_MAX,
  SPEED_MIN,
  speedToSlider,
} from "../../web/src/speed.js";

describe("hız kaydırıcısı", () => {
  it("uçlar en düşük ve en yüksek hıza denk gelir", () => {
    expect(sliderToSpeed(0)).toBeCloseTo(SPEED_MIN, 10);
    expect(sliderToSpeed(SLIDER_MAX)).toBeCloseTo(SPEED_MAX, 4);
    expect(SPEED_MIN).toBe(0.5);
    expect(SPEED_MAX).toBe(1_000_000);
  });

  it("aralık dışındaki değerleri sınıra çeker", () => {
    expect(sliderToSpeed(-5)).toBeCloseTo(SPEED_MIN, 10);
    expect(sliderToSpeed(SLIDER_MAX + 5)).toBeCloseTo(SPEED_MAX, 4);
    expect(speedToSlider(0)).toBe(0);
    expect(speedToSlider(1e9)).toBeCloseTo(SLIDER_MAX, 10);
  });

  it("monoton artar ve logaritmiktir", () => {
    let previous = 0;
    for (let s = 0; s <= SLIDER_MAX; s++) {
      const speed = sliderToSpeed(s);
      expect(speed).toBeGreaterThan(previous);
      previous = speed;
    }
    // Equal slider steps multiply the speed by the same factor.
    expect(sliderToSpeed(40) / sliderToSpeed(30)).toBeCloseTo(sliderToSpeed(90) / sliderToSpeed(80), 8);
  });

  it("ters eşleme tutarlıdır", () => {
    for (const s of [0, 1, 17.5, 50, 99, 100]) expect(speedToSlider(sliderToSpeed(s))).toBeCloseTo(s, 8);
    expect(sliderToSpeed(speedToSlider(DEFAULT_SPEED))).toBeCloseTo(2, 10);
  });

  it("rejim eşikleri", () => {
    expect(regimeFor(SPEED_MIN)).toBe("animated");
    expect(regimeFor(ANIMATED_MAX)).toBe("animated");
    expect(regimeFor(ANIMATED_MAX + 0.01)).toBe("quick");
    expect(regimeFor(QUICK_MAX)).toBe("quick");
    expect(regimeFor(QUICK_MAX + 0.01)).toBe("turbo");
    expect(regimeFor(SPEED_MAX)).toBe("turbo");
  });

  it("hızı Türkçe biçimler", () => {
    expect(formatSpeed(0.5)).toBe("0,5 tur/sn");
    expect(formatSpeed(2)).toBe("2 tur/sn");
    expect(formatSpeed(12.4)).toBe("12 tur/sn");
    expect(formatSpeed(3400)).toBe("3,4 bin tur/sn");
    expect(formatSpeed(12_300)).toBe("12 bin tur/sn");
    expect(formatSpeed(1_000_000)).toBe("1 milyon tur/sn");
  });
});
