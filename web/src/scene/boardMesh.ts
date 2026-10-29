import * as THREE from "three";
import type { Board } from "../../../src/board.js";
import { drawBoard } from "../boardArt.js";
import { BOARD_SIDE } from "../layout.js";

const THICKNESS = 0.16;
const RIM = 0.14;

/** The board: a dark slab with the drawn surface on top. Its top face is at y = 0. */
export function createBoardMesh(board: Board, renderer: THREE.WebGLRenderer): THREE.Group {
  const group = new THREE.Group();

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_SIDE + 2 * RIM, THICKNESS, BOARD_SIDE + 2 * RIM),
    new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.7 }),
  );
  slab.position.y = -THICKNESS / 2 - 0.002;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const size = Math.min(4096, renderer.capabilities.maxTextureSize);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  drawBoard(canvas.getContext("2d")!, size, board);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Keeps the square names readable at the grazing angles the board is usually seen from.
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // A plane rotated to face up maps canvas (x, y) to world (x, z): no mirroring.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_SIDE, BOARD_SIDE),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.receiveShadow = true;
  group.add(surface);

  return group;
}
