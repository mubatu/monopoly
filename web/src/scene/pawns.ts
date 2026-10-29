import * as THREE from "three";
import { PAWN_RADIUS } from "../layout.js";
import { DECK_THEME, PAWNS } from "../theme.js";

// Half profile of a classic pawn, as (radius, height) pairs, revolved around the vertical axis.
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [PAWN_RADIUS, 0],
  [PAWN_RADIUS + 0.005, 0.025],
  [0.12, 0.05],
  [0.07, 0.09],
  [0.05, 0.2],
  [0.045, 0.26],
  [0.075, 0.285],
  [0.045, 0.31],
  [0, 0.31],
];
const HEAD_RADIUS = 0.085;
const HEAD_HEIGHT = 0.375;

export interface PawnView {
  readonly group: THREE.Group;
  /** Small cards shown next to the pawn while it holds a "get out of jail free" card. */
  readonly chanceCard: THREE.Mesh;
  readonly chestCard: THREE.Mesh;
}

function heldCard(color: string, side: number): THREE.Mesh {
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.16, 0.012),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  card.position.set(side * 0.13, 0.5, 0);
  card.rotation.z = side * -0.25;
  card.castShadow = true;
  card.visible = false;
  return card;
}

export function createPawns(): PawnView[] {
  const body = new THREE.LatheGeometry(
    PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    32,
  );
  const head = new THREE.SphereGeometry(HEAD_RADIUS, 24, 16);

  return PAWNS.map((theme) => {
    const material = new THREE.MeshStandardMaterial({ color: theme.color, roughness: 0.35, metalness: 0.05 });
    const group = new THREE.Group();

    const bodyMesh = new THREE.Mesh(body, material);
    bodyMesh.castShadow = true;
    const headMesh = new THREE.Mesh(head, material);
    headMesh.position.y = HEAD_HEIGHT;
    headMesh.castShadow = true;

    const chanceCard = heldCard(DECK_THEME.chance.color, -1);
    const chestCard = heldCard(DECK_THEME.communityChest.color, 1);
    group.add(bodyMesh, headMesh, chanceCard, chestCard);
    group.visible = false;
    return { group, chanceCard, chestCard };
  });
}
