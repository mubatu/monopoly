/** Speeds are in turns per second, where a turn is one player's go. */
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1_000_000;
/** Up to here pawns hop square by square and the dice tumble. */
export const ANIMATED_MAX = 10;
/** Up to here pawns slide straight to where the turn ended; above it nothing is animated. */
export const QUICK_MAX = 60;
export const DEFAULT_SPEED = 2;

export const SLIDER_MAX = 100;

export type Regime = "animated" | "quick" | "turbo";

export const REGIME_LABELS: Record<Regime, string> = {
  animated: "Animasyon",
  quick: "Hızlı",
  turbo: "Turbo",
};

const RATIO = SPEED_MAX / SPEED_MIN;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Maps a slider position (0..SLIDER_MAX) to a speed on a logarithmic scale. */
export function sliderToSpeed(position: number): number {
  return SPEED_MIN * RATIO ** (clamp(position, 0, SLIDER_MAX) / SLIDER_MAX);
}

export function speedToSlider(speed: number): number {
  return (Math.log(clamp(speed, SPEED_MIN, SPEED_MAX) / SPEED_MIN) / Math.log(RATIO)) * SLIDER_MAX;
}

export function regimeFor(speed: number): Regime {
  if (speed <= ANIMATED_MAX) return "animated";
  if (speed <= QUICK_MAX) return "quick";
  return "turbo";
}

const TR = "tr-TR";

/** "0,5 tur/sn", "12 tur/sn", "3,4 bin tur/sn", "1 milyon tur/sn" */
export function formatSpeed(speed: number): string {
  let text: string;
  if (speed >= 999_500) {
    text = `${(speed / 1e6).toLocaleString(TR, { maximumFractionDigits: 1 })} milyon`;
  } else if (speed >= 9_950) {
    text = `${Math.round(speed / 1000).toLocaleString(TR)} bin`;
  } else if (speed >= 1000) {
    text = `${(speed / 1000).toLocaleString(TR, { maximumFractionDigits: 1 })} bin`;
  } else if (speed >= 10) {
    text = Math.round(speed).toLocaleString(TR);
  } else {
    text = speed.toLocaleString(TR, { maximumFractionDigits: 1 });
  }
  return `${text} tur/sn`;
}
