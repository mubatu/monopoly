import type { Settings } from "../controller.js";
import { byId } from "./dom.js";

export interface SettingsHandlers {
  /** A field changed; `settings` is what the form says now. */
  onChange(settings: Settings): void;
  onApply(settings: Settings): void;
}

function optionalNumber(text: string): number | null {
  const trimmed = text.trim();
  // Anything that is not a number becomes NaN, which the engine rejects with a clear message.
  return trimmed === "" ? null : Number(trimmed);
}

/** The settings panel: pawn count, jail strategy share, seed and turns per game. */
export class SettingsPanel {
  private readonly fields = byId<HTMLFieldSetElement>("settings-fields");
  private readonly players = byId("set-players");
  private readonly jailPay = byId<HTMLInputElement>("set-jail-pay");
  private readonly jailPayValue = byId("set-jail-pay-value");
  private readonly seed = byId<HTMLInputElement>("set-seed");
  private readonly turnsPerGame = byId<HTMLInputElement>("set-turns");
  private readonly apply = byId<HTMLButtonElement>("settings-apply");
  private readonly error = byId("settings-error");

  constructor(initial: Settings, handlers: SettingsHandlers) {
    for (let count = 2; count <= 6; count++) {
      const id = `set-players-${count}`;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "players";
      input.id = id;
      input.value = String(count);
      input.checked = count === initial.players;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = String(count);
      this.players.append(input, label);
    }
    this.jailPay.value = String(Math.round(initial.jailPayProbability * 100));
    this.seed.value = initial.seed === null ? "" : String(initial.seed);
    this.turnsPerGame.value = initial.turnsPerGame === null ? "" : String(initial.turnsPerGame);
    this.showJailPay();

    this.fields.addEventListener("input", () => {
      this.showJailPay();
      handlers.onChange(this.read());
    });
    this.apply.addEventListener("click", () => handlers.onApply(this.read()));
  }

  read(): Settings {
    const checked = this.players.querySelector<HTMLInputElement>("input:checked");
    return {
      players: Number(checked?.value),
      jailPayProbability: Number(this.jailPay.value) / 100,
      seed: optionalNumber(this.seed.value),
      turnsPerGame: optionalNumber(this.turnsPerGame.value),
    };
  }

  /** Settings cannot be edited while the simulation is running. */
  setEnabled(enabled: boolean): void {
    this.fields.disabled = !enabled;
  }

  /** Shows the "apply and reset" button when the form differs from the running simulation. */
  setPending(pending: boolean): void {
    this.apply.hidden = !pending;
  }

  setError(message: string | null): void {
    this.error.textContent = message ?? "";
    this.error.hidden = message === null;
  }

  private showJailPay(): void {
    this.jailPayValue.textContent = `%${this.jailPay.value}`;
  }
}
