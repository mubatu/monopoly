/** One-hue sequential ramp, light (near zero) to dark (most visited). */
export const HEAT_STOPS = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"] as const;

export const INK_DARK = "#0b1f33";
export const INK_LIGHT = "#ffffff";

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Position of a value on a linear scale from `min` to `max`, clamped to 0..1. */
export function heatScale(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Colour for a scale position t (0..1). */
export function heatColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (HEAT_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), HEAT_STOPS.length - 2);
  const f = scaled - i;
  const a = channels(HEAT_STOPS[i]!);
  const b = channels(HEAT_STOPS[i + 1]!);
  return toHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour with the better contrast on the given background. */
export function inkFor(background: string): string {
  const l = luminance(background);
  const withDark = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  const withLight = 1.05 / (l + 0.05);
  return withDark >= withLight ? INK_DARK : INK_LIGHT;
}

const TR = "tr-TR";

/** "%3,19" */
export function formatPct(value: number, digits = 2): string {
  return `%${value.toLocaleString(TR, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "1.234.567" */
export function formatCount(value: number): string {
  return value.toLocaleString(TR);
}
