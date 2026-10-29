import { Session, type SessionConfig } from "../../src/session.js";
import type { DeckKind, SimulationResult, TurnObserver } from "../../src/types.js";
import { JAIL_SQUARE, placePoint, type Place } from "./layout.js";
import { describeTurn } from "./narrate.js";
import type { BoardScene } from "./scene/scene.js";
import { DEFAULT_SPEED, regimeFor, type Regime } from "./speed.js";
import { PAWNS } from "./theme.js";
import { buildQuickTimeline, buildTimeline, samplePath, type Timeline, type TurnEvent } from "./timeline.js";

export type Status = "idle" | "running" | "paused";

/** What the settings panel edits. A null seed means "pick one at random". */
export interface Settings {
  players: number;
  jailPayProbability: number;
  seed: number | null;
  turnsPerGame: number | null;
}

export interface ControllerEvents {
  onStatus(status: Status): void;
  /** One-line description of the turn that was just played (animated regimes only). */
  onTurn(text: string): void;
  onCard(deck: DeckKind, text: string): void;
}

// Longest stretch of simulation work per frame in the turbo regime, so rendering stays smooth.
const FRAME_BUDGET_MS = 8;
const BATCH_CHUNK = 1024;
const MAX_FRAME_SECONDS = 0.1;
const SPEED_WINDOW_MS = 500;

interface RunningTimeline {
  timeline: Timeline;
  player: number;
  elapsed: number;
  /** Speed the durations were computed for; lets a speed change take effect mid-animation. */
  builtForSpeed: number;
  cardsShown: number;
}

/**
 * Owns the simulation session and the main loop. The engine is always ahead of what
 * is on screen: a turn is played first, then its events are replayed as animation.
 */
export class Controller {
  session!: Session;
  status: Status = "idle";
  speed = DEFAULT_SPEED;
  /** Turns per second actually achieved, averaged over the last half second. */
  measuredSpeed = 0;

  private places: Place[] = [];
  private running: RunningTimeline | null = null;
  private readonly events: TurnEvent[] = [];
  private readonly observer: TurnObserver;
  private backlog = 0;
  private lastFrame = 0;
  private runningMs = 0;
  private windowStart = 0;
  private windowTurns = 0;

  constructor(
    private readonly scene: BoardScene,
    private readonly hooks: ControllerEvents,
    settings: Settings,
  ) {
    const events = this.events;
    this.observer = {
      roll: (player, d1, d2) => events.push({ type: "roll", player, d1, d2 }),
      land: (player, from, to, via) => events.push({ type: "land", player, from, to, via }),
      card: (player, deck, cardIndex) => events.push({ type: "card", player, deck, cardIndex }),
      jailEnter: (player, reason) => events.push({ type: "jailEnter", player, reason }),
      jailExit: (player, how) => events.push({ type: "jailExit", player, how }),
      jailStay: (player) => events.push({ type: "jailStay", player }),
    };
    this.reset(settings);
  }

  get hasData(): boolean {
    return this.session.totalTurns > 0;
  }

  get regime(): Regime {
    return regimeFor(this.speed);
  }

  /** Starts over with the given settings. Throws ConfigError (and changes nothing) if they are invalid. */
  reset(settings: Settings): void {
    const config: Partial<SessionConfig> = {
      players: settings.players,
      jailPayProbability: settings.jailPayProbability,
      turnsPerGame: settings.turnsPerGame,
    };
    if (settings.seed !== null) config.seed = settings.seed;
    this.session = new Session(config);

    this.running = null;
    this.backlog = 0;
    this.runningMs = 0;
    this.measuredSpeed = 0;
    this.windowTurns = 0;
    this.scene.setPawnCount(this.session.config.players);
    this.scene.dice.group.visible = true;
    this.scene.dice.show(1, 1, 1);
    this.scene.decks.rest();
    this.syncFromEngine();
    this.setStatus("idle");
  }

  toggle(): void {
    this.setStatus(this.status === "running" ? "paused" : "running");
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /** Current statistics in the CLI's JSON shape. */
  snapshot(): SimulationResult {
    return this.session.snapshot(Math.round(this.runningMs));
  }

  /** Advances simulation and animation by one display frame, then renders. */
  frame(now: number): void {
    const dt = Math.min((now - this.lastFrame) / 1000, MAX_FRAME_SECONDS);
    this.lastFrame = now;
    const regime = this.regime;

    if (this.running !== null) {
      if (regime === "turbo") this.finishTimeline();
      else this.advanceTimeline(dt);
    }

    if (this.status === "running") {
      this.runningMs += dt * 1000;
      if (regime === "turbo") this.runBatch(dt);
      else if (this.running === null) this.startAnimatedTurn(regime);
    }

    this.measure(now);
    this.scene.render();
  }

  private setStatus(status: Status): void {
    this.status = status;
    this.hooks.onStatus(status);
  }

  private measure(now: number): void {
    const elapsed = now - this.windowStart;
    if (elapsed < SPEED_WINDOW_MS) return;
    const turns = this.session.totalTurns;
    this.measuredSpeed = this.status === "running" ? ((turns - this.windowTurns) / elapsed) * 1000 : 0;
    this.windowStart = now;
    this.windowTurns = turns;
  }

  /** Turbo: play as many turns as the speed asks for, within the frame budget, and show where pawns are. */
  private runBatch(dt: number): void {
    this.backlog += this.speed * dt;
    let turns = Math.floor(this.backlog);
    this.backlog -= turns;

    const started = performance.now();
    while (turns > 0) {
      const chunk = Math.min(turns, BATCH_CHUNK);
      this.session.playTurns(chunk);
      turns -= chunk;
      if (performance.now() - started > FRAME_BUDGET_MS) {
        // Cannot keep up at this speed: drop the rest instead of falling ever further behind.
        this.backlog = 0;
        break;
      }
    }
    this.scene.dice.group.visible = false;
    this.syncFromEngine();
  }

  private startAnimatedTurn(regime: Regime): void {
    const session = this.session;
    const player = session.nextPlayer;
    const gamesBefore = session.gamesStarted;

    this.events.length = 0;
    session.state.observer = this.observer;
    session.playNextTurn();
    session.state.observer = null;

    if (session.gamesStarted !== gamesBefore) {
      // A new game began with this turn: everyone is back on Go before the move is shown.
      this.places = this.places.map(() => ({ square: 0, inJail: false }));
      this.placeAll();
    }

    const turnDuration = 1 / this.speed;
    const start = this.places[player]!;
    const timeline =
      regime === "animated"
        ? buildTimeline(this.events, start, turnDuration)
        : buildQuickTimeline(this.events, start, turnDuration);
    this.running = { timeline, player, elapsed: 0, builtForSpeed: this.speed, cardsShown: 0 };
    this.scene.dice.group.visible = true;

    const { board } = session;
    // Landing on the jail corner is only a visit; being locked up is reported as its own event.
    const squareName = (index: number): string => (index === JAIL_SQUARE ? "Sadece Ziyaretçi" : board.squares[index]!.name);
    this.hooks.onTurn(describeTurn(this.events, PAWNS[player]!.name, squareName));
    this.advanceTimeline(0);
  }

  private advanceTimeline(dt: number): void {
    const running = this.running!;
    running.elapsed += dt * (this.speed / running.builtForSpeed);
    const { timeline, player, elapsed } = running;

    let cards = 0;
    for (const step of timeline.steps) {
      if (elapsed < step.start) break;
      const t = step.duration > 0 ? Math.min(1, (elapsed - step.start) / step.duration) : 1;
      switch (step.kind) {
        case "dice":
          this.scene.dice.show(step.d1, step.d2, t);
          break;
        case "move": {
          const points = step.path.map((place) => placePoint(place, player));
          const sample = samplePath(points, t, step.style);
          this.scene.setPawn(player, sample.x, sample.y, sample.lift);
          break;
        }
        case "card":
          cards++;
          if (cards > running.cardsShown) {
            running.cardsShown = cards;
            const deck = step.deck === "chance" ? this.session.state.chance : this.session.state.chest;
            this.hooks.onCard(step.deck, deck.cards[step.cardIndex]!.text);
          }
          this.scene.decks.lift(step.deck, t);
          break;
        case "stay": {
          // A short shake of the head: still locked up.
          const point = placePoint({ square: JAIL_SQUARE, inJail: true }, player);
          this.scene.setPawn(player, point.x, point.y, 0, Math.sin(t * Math.PI * 4) * 0.22 * (1 - t));
          break;
        }
      }
    }

    if (elapsed >= timeline.duration) this.finishTimeline();
  }

  private finishTimeline(): void {
    this.running = null;
    this.scene.decks.rest();
    this.syncFromEngine();
  }

  /** Makes the screen match the engine: every pawn on its square (or in the cell), held cards shown. */
  private syncFromEngine(): void {
    const players = this.session.state.players;
    this.places = players.map((player) => ({ square: player.pos, inJail: player.inJail }));
    this.placeAll();
    players.forEach((player, i) => this.scene.setHeldCards(i, player.heldChance >= 0, player.heldChest >= 0));
  }

  private placeAll(): void {
    this.places.forEach((place, i) => {
      const point = placePoint(place, i);
      this.scene.setPawn(i, point.x, point.y);
    });
  }
}
