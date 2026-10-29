import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Board } from "../../../src/board.js";
import { BOARD_SIDE } from "../layout.js";
import { createBoardMesh } from "./boardMesh.js";
import { Decks } from "./decks.js";
import { Dice } from "./dice.js";
import { createPawns, type PawnView } from "./pawns.js";

const BACKGROUND = 0x12181c;
const HALF = BOARD_SIDE / 2;
// Direction from the board towards the default camera position (a 3/4 view from the Go side).
const VIEW_DIRECTION = new THREE.Vector3(0, 0.78, 0.63).normalize();
const VIEW_TARGET = new THREE.Vector3(0, 0, 0.9);
const FOV = 38;
const BOARD_CORNERS = [
  new THREE.Vector3(-HALF, 0, -HALF),
  new THREE.Vector3(HALF, 0, -HALF),
  new THREE.Vector3(-HALF, 0, HALF),
  new THREE.Vector3(HALF, 0, HALF),
];

/** Parts of the canvas that panels cover, in CSS pixels. */
export interface Obstacles {
  /** Height of the strip at the bottom taken by the control panel. */
  bottom: number;
  /** Bottom edge of the panels in the top corners. */
  top: number;
  /** Right edge of the top-left panel and left edge of the top-right one. */
  topLeftRight: number;
  topRightLeft: number;
}

/** The 3D view: board, pawns, dice and decks. All positions are given in board coordinates. */
export class BoardScene {
  readonly dice = new Dice();
  readonly decks = new Decks();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private readonly controls: OrbitControls;
  private readonly pawns: PawnView[] = createPawns();
  private userMovedCamera = false;
  private obstacles: Obstacles = { bottom: 0, top: 0, topLeftRight: 0, topRightLeft: Infinity };
  private readonly projected = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement, board: Board) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.fog = new THREE.Fog(BACKGROUND, 34, 80);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7d7468, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e2, 1.9);
    sun.position.set(-6, 15, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    const table = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.17;
    table.receiveShadow = true;
    this.scene.add(table);

    this.scene.add(createBoardMesh(board, this.renderer), this.dice.group, this.decks.group);
    for (const pawn of this.pawns) this.scene.add(pawn.group);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(VIEW_TARGET);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 40;
    // Never let the camera drop below the table.
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
    this.controls.addEventListener("start", () => {
      this.userMovedCamera = true;
    });

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  /** Shows the first `count` pawns and hides the rest. */
  setPawnCount(count: number): void {
    this.pawns.forEach((pawn, i) => {
      pawn.group.visible = i < count;
    });
  }

  /** Puts a pawn at a board position, `lift` units above the surface. */
  setPawn(index: number, x: number, y: number, lift = 0, tilt = 0): void {
    const group = this.pawns[index]!.group;
    group.position.set(x - HALF, lift, y - HALF);
    group.rotation.z = tilt;
  }

  setHeldCards(index: number, chance: boolean, chest: boolean): void {
    const pawn = this.pawns[index]!;
    pawn.chanceCard.visible = chance;
    pawn.chestCard.visible = chest;
  }

  /** Tells the scene where the panels are, so the default view keeps the board clear of them. */
  setObstacles(obstacles: Obstacles): void {
    const current = this.obstacles;
    if (
      obstacles.bottom === current.bottom &&
      obstacles.top === current.top &&
      obstacles.topLeftRight === current.topLeftRight &&
      obstacles.topRightLeft === current.topRightLeft
    ) {
      return;
    }
    this.obstacles = obstacles;
    this.resize();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;

    const bottom = Math.min(this.obstacles.bottom, height * 0.5);
    if (this.userMovedCamera) {
      this.setInsets(width, height, 0, bottom);
      return;
    }

    // Two ways to keep the far corners out from under the top panels: stay centred and
    // back off until they are clear, or move the whole board below the panels. Use
    // whichever leaves the board larger.
    const top = Math.min(this.obstacles.top, height * 0.3);
    const centred = this.fit(width, height, 0, bottom, top);
    const lowered = this.fit(width, height, top, bottom, 0);
    if (centred <= lowered) this.fit(width, height, 0, bottom, top);
  }

  /** Shifts the picture into the area between a top and a bottom strip (in pixels). */
  private setInsets(width: number, height: number, top: number, bottom: number): void {
    this.camera.setViewOffset(width, height, 0, (bottom - top) / 2, width, height);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Places the camera on the default view direction, as close as it can get with the
   * whole board inside the canvas, clear of the `top` and `bottom` strips and with no
   * far corner under a top panel of height `panelBottom`. Returns the distance used.
   */
  private fit(width: number, height: number, top: number, bottom: number, panelBottom: number): number {
    this.setInsets(width, height, top, bottom);
    const margin = 0.05;
    const reservedTop = (2 * top) / height;
    const reservedBottom = (2 * bottom) / height;
    const { topLeftRight, topRightLeft } = this.obstacles;

    const fits = (distance: number): boolean => {
      this.camera.position.copy(VIEW_TARGET).addScaledVector(VIEW_DIRECTION, distance);
      this.camera.lookAt(VIEW_TARGET);
      this.camera.updateMatrixWorld();
      for (const corner of BOARD_CORNERS) {
        const p = this.projected.copy(corner).project(this.camera);
        if (Math.abs(p.x) > 1 - margin) return false;
        if (p.y > 1 - reservedTop - margin || p.y < -1 + reservedBottom + margin) return false;
        const x = ((p.x + 1) / 2) * width;
        const y = ((1 - p.y) / 2) * height;
        if (y < panelBottom && (x < topLeftRight || x > topRightLeft)) return false;
      }
      return true;
    };

    let near = this.controls.minDistance;
    let far = this.controls.maxDistance;
    for (let i = 0; i < 24; i++) {
      const middle = (near + far) / 2;
      if (fits(middle)) far = middle;
      else near = middle;
    }
    fits(far);
    return far;
  }
}
