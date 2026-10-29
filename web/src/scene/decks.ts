import * as THREE from "three";
import type { DeckKind } from "../../../src/types.js";
import { DECK_OFFSET, DECK_SIZE } from "../boardArt.js";
import { DECK_THEME, FONT_STACK } from "../theme.js";

const STACK_HEIGHT = 0.13;
const CARD_THICKNESS = 0.012;

function labelTexture(deck: DeckKind): THREE.CanvasTexture {
  const theme = DECK_THEME[deck];
  const width = 512;
  const height = Math.round((width * DECK_SIZE.h) / DECK_SIZE.w);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme.color;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 8;
  ctx.strokeRect(22, 22, width - 44, height - 44);
  ctx.fillStyle = theme.ink;
  ctx.font = `800 ${deck === "chance" ? 104 : 78}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(theme.label, width / 2, height / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

interface DeckView {
  top: THREE.Group;
}

/** The two card stacks in the middle of the board. Drawing a card lifts the top one briefly. */
export class Decks {
  readonly group = new THREE.Group();
  private readonly views: Record<DeckKind, DeckView>;

  constructor() {
    this.views = {
      chance: this.build("chance", DECK_OFFSET),
      communityChest: this.build("communityChest", -DECK_OFFSET),
    };
  }

  private build(deck: DeckKind, offset: number): DeckView {
    const holder = new THREE.Group();
    // Board (x, y) = centre + offset on both axes; matches the outline drawn on the surface.
    holder.position.set(offset, 0, offset);
    holder.rotation.y = Math.PI / 4;

    const stack = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_SIZE.w, STACK_HEIGHT, DECK_SIZE.h),
      new THREE.MeshStandardMaterial({ color: 0xf3f0e6, roughness: 0.8 }),
    );
    stack.position.y = STACK_HEIGHT / 2;
    stack.castShadow = true;
    stack.receiveShadow = true;

    const top = new THREE.Group();
    top.position.y = STACK_HEIGHT;
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_SIZE.w, CARD_THICKNESS, DECK_SIZE.h),
      new THREE.MeshStandardMaterial({ color: DECK_THEME[deck].color, roughness: 0.7 }),
    );
    card.position.y = CARD_THICKNESS / 2;
    card.castShadow = true;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(DECK_SIZE.w, DECK_SIZE.h),
      new THREE.MeshStandardMaterial({ map: labelTexture(deck), roughness: 0.7 }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = CARD_THICKNESS + 0.001;
    top.add(card, face);

    holder.add(stack, top);
    this.group.add(holder);
    return { top };
  }

  /** Lifts the top card of a deck; t runs 0..1 and the card is back in place at both ends. */
  lift(deck: DeckKind, t: number): void {
    const arc = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    const { top } = this.views[deck];
    top.position.y = STACK_HEIGHT + arc * 0.55;
    top.rotation.x = arc * 0.5;
  }

  rest(): void {
    this.lift("chance", 0);
    this.lift("communityChest", 0);
  }
}
