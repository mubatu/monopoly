/**
 * Small vector icons for the board. Each draws inside a box of `size` pixels
 * centred on (cx, cy), using the current transform. `bg` is the colour behind
 * the icon, used for cut-outs such as windows.
 */
export type Glyph = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  bg: string,
) => void;

function begin(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): number {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Everything below is drawn in a -0.5..0.5 box.
  return size;
}

function cut(ctx: CanvasRenderingContext2D, bg: string): void {
  ctx.fillStyle = bg;
  ctx.strokeStyle = bg;
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export const train: Glyph = (ctx, cx, cy, size, color, bg) => {
  const s = begin(ctx, cx, cy, size, color);
  // Boiler, cab and chimney
  ctx.fillRect(-0.42 * s, -0.1 * s, 0.56 * s, 0.26 * s);
  ctx.fillRect(0.08 * s, -0.32 * s, 0.32 * s, 0.48 * s);
  ctx.fillRect(-0.34 * s, -0.28 * s, 0.1 * s, 0.2 * s);
  ctx.fillRect(-0.38 * s, -0.33 * s, 0.18 * s, 0.06 * s);
  // Cab roof and cowcatcher
  ctx.fillRect(0.04 * s, -0.37 * s, 0.4 * s, 0.07 * s);
  ctx.beginPath();
  ctx.moveTo(-0.42 * s, 0.16 * s);
  ctx.lineTo(-0.5 * s, 0.26 * s);
  ctx.lineTo(-0.42 * s, 0.26 * s);
  ctx.closePath();
  ctx.fill();
  // Wheels
  disc(ctx, -0.28 * s, 0.24 * s, 0.09 * s);
  disc(ctx, -0.06 * s, 0.24 * s, 0.09 * s);
  disc(ctx, 0.24 * s, 0.21 * s, 0.12 * s);
  // Cab window
  cut(ctx, bg);
  ctx.fillRect(0.16 * s, -0.24 * s, 0.16 * s, 0.14 * s);
  ctx.restore();
};

export const ferry: Glyph = (ctx, cx, cy, size, color, bg) => {
  const s = begin(ctx, cx, cy, size, color);
  // Hull
  ctx.beginPath();
  ctx.moveTo(-0.48 * s, 0.02 * s);
  ctx.lineTo(0.48 * s, 0.02 * s);
  ctx.lineTo(0.36 * s, 0.22 * s);
  ctx.lineTo(-0.38 * s, 0.22 * s);
  ctx.closePath();
  ctx.fill();
  // Decks and funnel
  ctx.fillRect(-0.32 * s, -0.14 * s, 0.6 * s, 0.13 * s);
  ctx.fillRect(-0.2 * s, -0.27 * s, 0.36 * s, 0.1 * s);
  ctx.fillRect(-0.06 * s, -0.42 * s, 0.11 * s, 0.14 * s);
  // Water
  ctx.lineWidth = 0.045 * s;
  ctx.beginPath();
  ctx.moveTo(-0.46 * s, 0.34 * s);
  for (let i = 0; i < 4; i++) {
    const x = -0.46 * s + i * 0.23 * s;
    ctx.quadraticCurveTo(x + 0.058 * s, 0.28 * s, x + 0.115 * s, 0.34 * s);
    ctx.quadraticCurveTo(x + 0.173 * s, 0.4 * s, x + 0.23 * s, 0.34 * s);
  }
  ctx.stroke();
  // Windows
  cut(ctx, bg);
  for (let i = 0; i < 4; i++) ctx.fillRect((-0.26 + i * 0.14) * s, -0.11 * s, 0.07 * s, 0.06 * s);
  ctx.restore();
};

export const bulb: Glyph = (ctx, cx, cy, size, color) => {
  const s = begin(ctx, cx, cy, size, color);
  disc(ctx, 0, -0.08 * s, 0.24 * s);
  ctx.beginPath();
  ctx.moveTo(-0.14 * s, 0.08 * s);
  ctx.lineTo(0.14 * s, 0.08 * s);
  ctx.lineTo(0.1 * s, 0.24 * s);
  ctx.lineTo(-0.1 * s, 0.24 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-0.09 * s, 0.27 * s, 0.18 * s, 0.05 * s);
  ctx.fillRect(-0.06 * s, 0.35 * s, 0.12 * s, 0.05 * s);
  // Rays
  ctx.lineWidth = 0.04 * s;
  for (const angle of [-150, -120, -90, -60, -30]) {
    const a = (angle * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 0.32 * s, -0.08 * s + Math.sin(a) * 0.32 * s);
    ctx.lineTo(Math.cos(a) * 0.42 * s, -0.08 * s + Math.sin(a) * 0.42 * s);
    ctx.stroke();
  }
  ctx.restore();
};

export const faucet: Glyph = (ctx, cx, cy, size, color) => {
  const s = begin(ctx, cx, cy, size, color);
  // Handle
  ctx.fillRect(-0.2 * s, -0.4 * s, 0.3 * s, 0.07 * s);
  ctx.fillRect(-0.085 * s, -0.36 * s, 0.07 * s, 0.14 * s);
  // Body and spout
  ctx.fillRect(-0.44 * s, -0.24 * s, 0.6 * s, 0.17 * s);
  ctx.beginPath();
  ctx.moveTo(0.14 * s, -0.24 * s);
  ctx.quadraticCurveTo(0.4 * s, -0.24 * s, 0.4 * s, 0.04 * s);
  ctx.lineTo(0.22 * s, 0.04 * s);
  ctx.quadraticCurveTo(0.22 * s, -0.07 * s, 0.14 * s, -0.07 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0.19 * s, 0.04 * s, 0.24 * s, 0.06 * s);
  // Drop
  ctx.beginPath();
  ctx.moveTo(0.31 * s, 0.17 * s);
  ctx.quadraticCurveTo(0.42 * s, 0.34 * s, 0.31 * s, 0.4 * s);
  ctx.quadraticCurveTo(0.2 * s, 0.34 * s, 0.31 * s, 0.17 * s);
  ctx.fill();
  ctx.restore();
};

export const chest: Glyph = (ctx, cx, cy, size, color, bg) => {
  const s = begin(ctx, cx, cy, size, color);
  // Lid
  ctx.beginPath();
  ctx.moveTo(-0.4 * s, -0.04 * s);
  ctx.lineTo(-0.4 * s, -0.14 * s);
  ctx.quadraticCurveTo(-0.4 * s, -0.34 * s, -0.2 * s, -0.34 * s);
  ctx.lineTo(0.2 * s, -0.34 * s);
  ctx.quadraticCurveTo(0.4 * s, -0.34 * s, 0.4 * s, -0.14 * s);
  ctx.lineTo(0.4 * s, -0.04 * s);
  ctx.closePath();
  ctx.fill();
  // Body
  ctx.fillRect(-0.4 * s, 0.01 * s, 0.8 * s, 0.31 * s);
  // Lock and bands
  cut(ctx, bg);
  ctx.fillRect(-0.06 * s, -0.08 * s, 0.12 * s, 0.17 * s);
  ctx.fillRect(-0.27 * s, -0.34 * s, 0.035 * s, 0.66 * s);
  ctx.fillRect(0.235 * s, -0.34 * s, 0.035 * s, 0.66 * s);
  ctx.restore();
};

export const diamond: Glyph = (ctx, cx, cy, size, color, bg) => {
  const s = begin(ctx, cx, cy, size, color);
  ctx.beginPath();
  ctx.moveTo(-0.24 * s, -0.3 * s);
  ctx.lineTo(0.24 * s, -0.3 * s);
  ctx.lineTo(0.42 * s, -0.08 * s);
  ctx.lineTo(0, 0.36 * s);
  ctx.lineTo(-0.42 * s, -0.08 * s);
  ctx.closePath();
  ctx.fill();
  cut(ctx, bg);
  ctx.lineWidth = 0.03 * s;
  ctx.beginPath();
  ctx.moveTo(-0.42 * s, -0.08 * s);
  ctx.lineTo(0.42 * s, -0.08 * s);
  ctx.moveTo(-0.12 * s, -0.3 * s);
  ctx.lineTo(-0.16 * s, -0.08 * s);
  ctx.lineTo(0, 0.36 * s);
  ctx.lineTo(0.16 * s, -0.08 * s);
  ctx.lineTo(0.12 * s, -0.3 * s);
  ctx.stroke();
  ctx.restore();
};

export const ring: Glyph = (ctx, cx, cy, size, color) => {
  const s = begin(ctx, cx, cy, size, color);
  ctx.lineWidth = 0.08 * s;
  ctx.beginPath();
  ctx.arc(0, 0.12 * s, 0.24 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.13 * s, -0.36 * s);
  ctx.lineTo(0.13 * s, -0.36 * s);
  ctx.lineTo(0.2 * s, -0.27 * s);
  ctx.lineTo(0, -0.08 * s);
  ctx.lineTo(-0.2 * s, -0.27 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const car: Glyph = (ctx, cx, cy, size, color, bg) => {
  const s = begin(ctx, cx, cy, size, color);
  // Roof
  ctx.beginPath();
  ctx.moveTo(-0.28 * s, -0.04 * s);
  ctx.lineTo(-0.16 * s, -0.26 * s);
  ctx.lineTo(0.14 * s, -0.26 * s);
  ctx.lineTo(0.3 * s, -0.04 * s);
  ctx.closePath();
  ctx.fill();
  // Body
  ctx.beginPath();
  ctx.roundRect(-0.46 * s, -0.06 * s, 0.92 * s, 0.22 * s, 0.07 * s);
  ctx.fill();
  disc(ctx, -0.25 * s, 0.17 * s, 0.11 * s);
  disc(ctx, 0.25 * s, 0.17 * s, 0.11 * s);
  cut(ctx, bg);
  disc(ctx, -0.25 * s, 0.17 * s, 0.045 * s);
  disc(ctx, 0.25 * s, 0.17 * s, 0.045 * s);
  ctx.beginPath();
  ctx.moveTo(-0.19 * s, -0.07 * s);
  ctx.lineTo(-0.12 * s, -0.21 * s);
  ctx.lineTo(-0.02 * s, -0.21 * s);
  ctx.lineTo(-0.02 * s, -0.07 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.03 * s, -0.07 * s);
  ctx.lineTo(0.03 * s, -0.21 * s);
  ctx.lineTo(0.11 * s, -0.21 * s);
  ctx.lineTo(0.21 * s, -0.07 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** A barred window: the jail. */
export const bars: Glyph = (ctx, cx, cy, size, color) => {
  const s = begin(ctx, cx, cy, size, color);
  ctx.lineWidth = 0.07 * s;
  ctx.beginPath();
  ctx.roundRect(-0.36 * s, -0.36 * s, 0.72 * s, 0.72 * s, 0.06 * s);
  ctx.stroke();
  ctx.lineWidth = 0.06 * s;
  for (const x of [-0.18, 0, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(x * s, -0.36 * s);
    ctx.lineTo(x * s, 0.36 * s);
    ctx.stroke();
  }
  ctx.restore();
};

/** A long arrow pointing left (the direction of play out of Go). */
export const arrowLeft: Glyph = (ctx, cx, cy, size, color) => {
  const s = begin(ctx, cx, cy, size, color);
  ctx.beginPath();
  ctx.moveTo(-0.5 * s, 0);
  ctx.lineTo(-0.26 * s, -0.14 * s);
  ctx.lineTo(-0.26 * s, -0.05 * s);
  ctx.lineTo(0.5 * s, -0.05 * s);
  ctx.lineTo(0.5 * s, 0.05 * s);
  ctx.lineTo(-0.26 * s, 0.05 * s);
  ctx.lineTo(-0.26 * s, 0.14 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
