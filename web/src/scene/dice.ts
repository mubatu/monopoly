import * as THREE from "three";

const SIZE = 0.46;
const REST_Z = 2.3;
const REST_X = 0.42;

// Which face shows which value: [+X, -X, +Y, -Y, +Z, -Z]. Opposite faces add up to 7.
const FACE_VALUES = [2, 5, 1, 6, 3, 4];

const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function faceTexture(value: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d9d5c8";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#fbfaf5";
  ctx.beginPath();
  ctx.roundRect(5, 5, size - 10, size - 10, 20);
  ctx.fill();
  ctx.fillStyle = "#1b1f22";
  for (const [x, y] of PIPS[value]!) {
    ctx.beginPath();
    ctx.arc(size / 2 + x * 32, size / 2 + y * 32, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Rotation that brings the face with the given value to the top. */
function upRotation(value: number): THREE.Quaternion {
  const euler = new THREE.Euler();
  switch (value) {
    case 2:
      euler.z = Math.PI / 2;
      break;
    case 5:
      euler.z = -Math.PI / 2;
      break;
    case 6:
      euler.x = Math.PI;
      break;
    case 3:
      euler.x = -Math.PI / 2;
      break;
    case 4:
      euler.x = Math.PI / 2;
      break;
    default:
      break;
  }
  return new THREE.Quaternion().setFromEuler(euler);
}

const SPIN_AXES = [new THREE.Vector3(1, 0.35, 0.6).normalize(), new THREE.Vector3(-0.5, 0.3, 1).normalize()];
const UP = new THREE.Vector3(0, 1, 0);

/** Two dice resting in the middle of the board. No physics: a tumble that ends on the rolled faces. */
export class Dice {
  readonly group = new THREE.Group();
  private readonly dice: THREE.Mesh[] = [];
  private readonly targets = [upRotation(1), upRotation(1)];
  private readonly yaw = [
    new THREE.Quaternion().setFromAxisAngle(UP, 0.3),
    new THREE.Quaternion().setFromAxisAngle(UP, -0.2),
  ];
  private readonly spin = new THREE.Quaternion();

  constructor() {
    const geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const materials = FACE_VALUES.map(
      (value) => new THREE.MeshStandardMaterial({ map: faceTexture(value), roughness: 0.4 }),
    );
    for (let i = 0; i < 2; i++) {
      const die = new THREE.Mesh(geometry, materials);
      die.castShadow = true;
      this.dice.push(die);
      this.group.add(die);
    }
    this.show(1, 1, 1);
  }

  /** Shows a roll at animation progress t (0 = just thrown, 1 = at rest). */
  show(d1: number, d2: number, t: number): void {
    this.targets[0] = upRotation(d1);
    this.targets[1] = upRotation(d2);
    const progress = Math.min(1, Math.max(0, t));
    const remaining = (1 - progress) ** 2;

    this.dice.forEach((die, i) => {
      this.spin.setFromAxisAngle(SPIN_AXES[i]!, remaining * Math.PI * 5);
      die.quaternion.copy(this.yaw[i]!).multiply(this.spin).multiply(this.targets[i]!);
      const side = i === 0 ? -1 : 1;
      die.position.set(side * REST_X - side * remaining * 0.5, SIZE / 2 + 0.9 * 4 * progress * (1 - progress), REST_Z + remaining * 0.8);
    });
  }
}
