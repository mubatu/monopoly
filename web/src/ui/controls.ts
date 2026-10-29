import type { Status } from "../controller.js";
import {
  DEFAULT_SPEED,
  formatSpeed,
  REGIME_LABELS,
  regimeFor,
  SLIDER_MAX,
  sliderToSpeed,
  speedToSlider,
} from "../speed.js";
import { byId } from "./dom.js";

const TOGGLE_LABELS: Record<Status, string> = {
  idle: "Başlat",
  running: "Durdur",
  paused: "Devam Et",
};

// The range input works in whole steps; ten per slider unit keeps dragging smooth.
const STEPS_PER_UNIT = 10;

export interface ControlsHandlers {
  onToggle(): void;
  onSpeed(speed: number): void;
  onShowDistribution(): void;
  onReset(): void;
}

/** The bottom panel: start/stop, speed slider, distribution and reset buttons. */
export class Controls {
  private readonly toggle = byId<HTMLButtonElement>("toggle");
  private readonly slider = byId<HTMLInputElement>("speed");
  private readonly speedValue = byId("speed-value");
  private readonly speedRegime = byId("speed-regime");

  constructor(handlers: ControlsHandlers) {
    this.slider.min = "0";
    this.slider.max = String(SLIDER_MAX * STEPS_PER_UNIT);
    this.slider.step = "1";
    this.slider.value = String(Math.round(speedToSlider(DEFAULT_SPEED) * STEPS_PER_UNIT));

    this.toggle.addEventListener("click", () => handlers.onToggle());
    this.slider.addEventListener("input", () => {
      const speed = this.speed;
      this.showSpeed(speed);
      handlers.onSpeed(speed);
    });
    byId("show-dist").addEventListener("click", () => handlers.onShowDistribution());
    byId("reset").addEventListener("click", () => handlers.onReset());
    this.showSpeed(this.speed);
  }

  get speed(): number {
    return sliderToSpeed(Number(this.slider.value) / STEPS_PER_UNIT);
  }

  setStatus(status: Status): void {
    this.toggle.textContent = TOGGLE_LABELS[status];
    this.toggle.dataset.status = status;
  }

  private showSpeed(speed: number): void {
    this.speedValue.textContent = formatSpeed(speed);
    const regime = regimeFor(speed);
    this.speedRegime.textContent = REGIME_LABELS[regime];
    this.speedRegime.dataset.regime = regime;
  }
}
