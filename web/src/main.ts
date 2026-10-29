import "./styles.css";
import { loadBoard } from "../../src/board.js";
import { ConfigError } from "../../src/session.js";
import type { SimulationConfig } from "../../src/types.js";
import { Controller, type Settings } from "./controller.js";
import { BoardScene } from "./scene/scene.js";
import { DECK_THEME } from "./theme.js";
import { Controls } from "./ui/controls.js";
import { DistributionView } from "./ui/distribution.js";
import { byId } from "./ui/dom.js";
import { Hud } from "./ui/hud.js";
import { SettingsPanel } from "./ui/settings.js";

const INITIAL: Settings = { players: 4, jailPayProbability: 0.5, seed: null, turnsPerGame: null };

const FIELD_LABELS: Partial<Record<keyof SimulationConfig, string>> = {
  players: "Piyon sayısı",
  jailPayProbability: "Kodes'te ödeme oranı",
  seed: "Seed",
  turnsPerGame: "Oyun başına tur",
};

const board = loadBoard("istanbul");
const scene = new BoardScene(byId<HTMLCanvasElement>("scene"), board);
const hud = new Hud();
let applied = INITIAL;

function sameSettings(a: Settings, b: Settings): boolean {
  return (
    a.players === b.players &&
    a.jailPayProbability === b.jailPayProbability &&
    a.seed === b.seed &&
    a.turnsPerGame === b.turnsPerGame
  );
}

/** Restarts the simulation with the given settings; an invalid value is reported next to the form. */
function restart(settings: Settings): void {
  try {
    controller.reset(settings);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const label = FIELD_LABELS[error.field] ?? error.field;
    settingsPanel.setError(error.message.replace(error.field, label));
    return;
  }
  applied = settings;
  settingsPanel.setError(null);
  settingsPanel.setPending(false);
  hud.clearTurn();
  distribution.invalidate();
}

const controls = new Controls({
  onToggle: () => controller.toggle(),
  onSpeed: (speed) => controller.setSpeed(speed),
  onShowDistribution: () => distribution.open(),
  onReset: () => restart(settingsPanel.read()),
});

const settingsPanel = new SettingsPanel(INITIAL, {
  onChange: (settings) => {
    // Before anything has been simulated a change simply takes effect; afterwards it
    // would throw the results away, so it waits for an explicit "apply and reset".
    if (!controller.hasData) restart(settings);
    else settingsPanel.setPending(!sameSettings(settings, applied));
  },
  onApply: restart,
});

const controller = new Controller(
  scene,
  {
    onStatus: (status) => {
      controls.setStatus(status);
      settingsPanel.setEnabled(status !== "running");
    },
    onTurn: (text) => hud.showTurn(text),
    onCard: (deck, text) => hud.showCard(DECK_THEME[deck].label, deck, text),
  },
  INITIAL,
);
controller.setSpeed(controls.speed);

const distribution = new DistributionView(board, () => controller.snapshot());

// Panels cover parts of the view; tell the scene where they are so the board stays clear of them.
// The strip above the control panel is where the card toast appears.
const TOAST_STRIP = 52;
const controlsPanel = byId("controls");
const hudPanel = byId("hud");
const settingsDetails = byId<HTMLDetailsElement>("settings");
// On a narrow window the open settings would sit on top of the board; start with them folded.
if (window.innerWidth < 1100) settingsDetails.open = false;

const settingsSummary = settingsDetails.querySelector("summary")!;

function reportObstacles(): void {
  const hudRect = hudPanel.getBoundingClientRect();
  const settingsRect = settingsDetails.getBoundingClientRect();
  // The settings panel is opened on demand, so only its title bar reserves space, and only
  // when the window is so narrow that it wraps below the counters.
  const wrapped = settingsRect.top >= hudRect.bottom;
  const titleBottom = settingsSummary.getBoundingClientRect().bottom + 10;
  scene.setObstacles({
    bottom: window.innerHeight - controlsPanel.getBoundingClientRect().top + TOAST_STRIP,
    top: (wrapped ? titleBottom : hudRect.bottom) + 8,
    topLeftRight: hudRect.right,
    topRightLeft: settingsRect.left,
  });
}
const panelObserver = new ResizeObserver(reportObstacles);
for (const panel of [controlsPanel, hudPanel, settingsDetails]) panelObserver.observe(panel);
window.addEventListener("resize", reportObstacles);
reportObstacles();

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && distribution.isOpen) {
    distribution.close();
    return;
  }
  if (event.code !== "Space" || event.repeat) return;
  const target = event.target;
  // Buttons already react to Space, and typing a space into a field must stay possible.
  if (target instanceof HTMLButtonElement) return;
  if (target instanceof HTMLInputElement && target.type !== "range" && target.type !== "radio") return;
  event.preventDefault();
  controller.toggle();
});

function frame(now: number): void {
  controller.frame(now);
  hud.update(controller, now);
  distribution.update(now, controller.session.totalTurns);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Handy for poking at the simulation from the browser console during development.
  Object.assign(window, { monopoly: { controller, distribution } });
}
