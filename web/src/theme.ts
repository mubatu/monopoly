export const FONT_STACK = '"Futura", "Century Gothic", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';

export const BOARD_BG = "#cfe7d2";
export const BOARD_LINE = "#16201a";
export const BOARD_INK = "#16201a";
export const BOARD_TITLE = "#1d5c3c";
export const JAIL_CELL_COLOR = "#f7941d";
export const ACCENT_RED = "#d6262c";

const GROUP_COLORS: Record<string, string> = {
  kahverengi: "#955436",
  "açık mavi": "#aae0fa",
  pembe: "#d93a96",
  turuncu: "#f7941d",
  kırmızı: "#ed1b24",
  sarı: "#fef200",
  yeşil: "#1fb25a",
  lacivert: "#0072bb",
};

const UNKNOWN_GROUP_COLOR = "#9aa3a0";

export function groupColor(group: string | null): string {
  return (group !== null ? GROUP_COLORS[group] : undefined) ?? UNKNOWN_GROUP_COLOR;
}

export interface PawnTheme {
  name: string;
  color: string;
}

/** One entry per seat; order is fixed so a pawn keeps its colour when the count changes. */
export const PAWNS: readonly PawnTheme[] = [
  { name: "Kırmızı", color: "#d8322f" },
  { name: "Mavi", color: "#2b6fdb" },
  { name: "Yeşil", color: "#2f9e54" },
  { name: "Sarı", color: "#f2c230" },
  { name: "Mor", color: "#8a4fd0" },
  { name: "Beyaz", color: "#f1f0ea" },
];

export const DECK_THEME = {
  chance: { label: "ŞANS", color: "#f7941d", ink: "#16201a" },
  communityChest: { label: "KAMU FONU", color: "#7cc4ea", ink: "#16201a" },
} as const;

/** Turkish-aware upper-casing ("Sirkeci" → "SİRKECİ"). */
export function upper(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}
