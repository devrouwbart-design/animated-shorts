// Bevelled prop geometry (Ricks Clips study, RULES.md G1-G3). Their props are never hard boxes: every block, plank
// and beam has rounded edges (~4-8 % of its smallest side) that catch a thin line of sunlight, and stone walls are
// built from separate blocks with dark recessed mortar between them and a slightly different tone per block.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** measured bevel: radius as a fraction of the smallest side (reference blocks/planks: .04-.08) */
export const BEVEL_FRAC = 0.06;

const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** box with rounded edges, centred on the origin. r defaults to BEVEL_FRAC of the smallest side. */
export const roundedBox = (w: number, h: number, d: number, r = BEVEL_FRAC * Math.min(w, h, d), seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, 0.49 * Math.min(w, h, d)));

/** rounded box spanning min..max (drop-in for a hard box between two corners) */
export const roundedBoxBetween = (min: THREE.Vector3, max: THREE.Vector3, r?: number, seg = 3) => {
  const g = roundedBox(max.x - min.x, max.y - min.y, max.z - min.z, r, seg);
  g.translate((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  return g;
};

/** write a constant vertex colour (for per-piece tone jitter with material.vertexColors) */
const tint = (g: THREE.BufferGeometry, c: THREE.Color) => {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
};

export type WallOpts = {
  /** wall size in metres (x along the wall, y up) and block depth */
  w: number; h: number; depth?: number;
  /** block size [width, height] (reference castle blocks: about 0.55 x 0.28 m against 1.5 m characters) */
  block?: [number, number];
  /** mortar gap (m) and how far blocks stand out of the mortar face */
  gap?: number; proud?: number;
  /** bevel radius (m) */
  bevel?: number;
  /** tone jitter per block: value +- (reference spread ~ +-9 %), hue shift (deg) */
  jitter?: number; hueJitter?: number;
  /** random block-length variation (0..1) and random protrusion (m) */
  lenJitter?: number; outJitter?: number;
  seed?: number;
};

/**
 * Block wall in local space: x 0..w, y 0..h, front face at z = 0 (blocks stand out toward +z).
 * Returns { blocks, mortar }: blocks carry vertex colours (use a material with vertexColors: true and a stone
 * albedo near white; multiply happens in the shader), mortar is one dark recessed plane behind them.
 */
export const blockWall = (o: WallOpts) => {
  const { w, h, depth = 0.3, block = [0.55, 0.28], gap = 0.018, proud = 0.025, bevel = 0.02, jitter = 0.09, hueJitter = 3, lenJitter = 0.25, outJitter = 0.008, seed = 7 } = o;
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const rows = Math.max(1, Math.round(h / block[1]));
  const bh = h / rows;
  const c = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    let x = j % 2 ? -block[0] * 0.5 : 0; // running bond
    while (x < w - 1e-3) {
      const len = block[0] * (1 + (r() - 0.5) * lenJitter);
      const x0 = Math.max(0, x), x1 = Math.min(w, x + len);
      if (x1 - x0 > gap * 3) {
        const bw = x1 - x0 - gap, hh = bh - gap, out = proud + (r() - 0.5) * 2 * outJitter;
        const g = roundedBox(bw, hh, depth, bevel, 2);
        g.translate((x0 + x1) / 2, j * bh + bh / 2, out - depth / 2);
        // value jitter plus a small warm/cool swing (hueJitter ~ degrees of a warm-cool shift)
        const v = 1 + (r() - 0.5) * 2 * jitter, t = ((r() - 0.5) * 2 * hueJitter) / 100;
        c.setRGB(v * (1 + t), v, v * (1 - t));
        parts.push(tint(g, c));
      }
      x += len;
    }
  }
  const blocks = mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p))!;
  parts.forEach((p) => p.dispose());
  const mortar = new THREE.PlaneGeometry(w, h);
  mortar.translate(w / 2, h / 2, -0.002);
  return { blocks, mortar, rows };
};

/** plank (bevelled, slightly irregular) along x: for carts, crates, decks */
export const plank = (len: number, wid: number, thick: number, seed = 1) => {
  const r = rng(seed);
  const g = roundedBox(len, thick, wid * (1 - r() * 0.06), Math.min(thick, wid) * 0.12, 2);
  return g;
};
