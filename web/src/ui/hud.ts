import type { Controller } from "../controller.js";
import { formatCount } from "../heat.js";
import { formatSpeed } from "../speed.js";
import { byId } from "./dom.js";

const REFRESH_MS = 100;
const TOAST_MS = 2600;

/** Counters in the corner, the last-turn line and the card toast. */
export class Hud {
  private readonly turns = byId("hud-turns");
  private readonly rolls = byId("hud-rolls");
  private readonly games = byId("hud-games");
  private readonly speed = byId("hud-speed");
  private readonly seed = byId("hud-seed");
  private readonly lastTurn = byId("hud-last");
  private readonly toast = byId("toast");
  private readonly toastDeck = byId("toast-deck");
  private readonly toastText = byId("toast-text");
  private lastRefresh = -Infinity;
  private toastTimer = 0;

  update(controller: Controller, now: number): void {
    if (now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    const { session } = controller;
    this.turns.textContent = formatCount(session.totalTurns);
    this.rolls.textContent = formatCount(session.state.stats.totalRolls);
    this.games.textContent = formatCount(session.gamesStarted);
    this.speed.textContent = controller.status === "running" ? formatSpeed(controller.measuredSpeed) : "—";
    this.seed.textContent = String(session.config.seed);
    // The per-turn line cannot be read at turbo speed, so it is blanked rather than left stale.
    if (controller.regime === "turbo" && controller.status === "running") this.lastTurn.textContent = "";
  }

  showTurn(text: string): void {
    this.lastTurn.textContent = text;
  }

  clearTurn(): void {
    this.lastTurn.textContent = "";
    this.hideToast();
  }

  showCard(deckLabel: string, deck: string, text: string): void {
    this.toastDeck.textContent = deckLabel;
    this.toastText.textContent = text;
    this.toast.dataset.deck = deck;
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), TOAST_MS);
  }

  private hideToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toast.hidden = true;
  }
}
