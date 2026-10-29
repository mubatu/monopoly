import type { TurnEvent } from "./timeline.js";

const EXIT_TEXT = ["kartla çıktı", "ödeyip çıktı", "çiftle çıktı", "3. atışta çıktı"] as const;

/** One-line summary of a turn, e.g. "Mavi: 4+3 → Şans → Kadıköy Vapur İskelesi". */
export function describeTurn(
  events: readonly TurnEvent[],
  playerName: string,
  squareName: (index: number) => string,
): string {
  const parts: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case "roll":
        parts.push(`${event.d1}+${event.d2}${event.d1 === event.d2 ? " (çift)" : ""}`);
        break;
      case "land":
        parts.push(squareName(event.to));
        break;
      case "jailEnter":
        parts.push("Kodes");
        break;
      case "jailExit":
        parts.push(EXIT_TEXT[event.how]);
        break;
      case "jailStay":
        parts.push("Kodes'te kaldı");
        break;
      case "card":
        break;
    }
  }
  return `${playerName}: ${parts.join(" → ")}`;
}
