// The countryside around the town and the castle (shadow tax short, round 2 "more of everything"):
//   - a patchwork of farm fields (wheat, crop rows, ploughed earth, lavender, sunflowers, meadow) with sausage hedgerows
//     and wooden fences, farmhouses with haystacks, ponds with lily pads, dirt lanes, tree groves, stones and flowers
//   - more of the town: a north-west block, an east block, a church with a tall tower, cottages down the lanes
//   - the castle hill dressed: a lower skirt, a village at its foot, trees, rocks, flower beds, a ring wall, banners
//   - the square dressed: bunting along the house fronts, barrels, crates and flower pots
// Everything tall is placed only where it can NOT block the low suns the story relies on (sunClear): the winter evening
// sun (az 218, el 4.5) and the winter morning sun (az 122, el 6) must reach the whole square, and the sunset sun
// (az 236, el 3) must still light the strip beside the castle's shadow where the goose steps into the sun.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, house, prop, quad } from "./build";
import { ctex } from "./paint";
import { twoTone } from "./shade";
import { CASTLE, CASTLE_AZ, HILL_H, onSun } from "./story";

// ---------------- low-sun clearance ----------------
const rad = (d: number) => (d * Math.PI) / 180;
type SunRay = { o: [number, number]; u: [number, number]; tanEl: number };
const RAYS: SunRay[] = [];
const dirOf = (az: number): [number, number] => [Math.sin(rad(az)), -Math.cos(rad(az))];
for (let x = -20; x <= 20; x += 5) for (let z = -16; z <= 16; z += 4) {
  RAYS.push({ o: [x, z], u: dirOf(218), tanEl: Math.tan(rad(4.5)) });  // winter evening
  RAYS.push({ o: [x, z], u: dirOf(122), tanEl: Math.tan(rad(6)) });    // winter morning
}
for (let d = -10; d <= 10; d += 2.5) for (let n = 16; n <= 30; n += 2) {
  const p = onSun(d, n);
  RAYS.push({ o: [p[0], p[2]], u: dirOf(CASTLE_AZ), tanEl: Math.tan(rad(3)) }); // sunlit strip beside the castle shadow
}
/** can something of height h and radius r stand at (x, z) without shading any of the story's sunlit spots? */
export const sunClear = (x: number, z: number, h: number, r = 1) => {
  for (const { o, u, tanEl } of RAYS) {
    const vx = x - o[0], vz = z - o[1], t = vx * u[0] + vz * u[1];
    if (t <= 0) continue;
    const q = Math.abs(vx * u[1] - vz * u[0]);
    if (q < r + 2.5 && h > t * tanEl - 0.6) return false;
  }
  return true;
};

// ---------------- painted field textures (1024 px = 8 m, rows along v) ----------------
const field = (key: string, base: string, draw: (g: CanvasRenderingContext2D, r: () => number) => void) => ctex("field_" + key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024); draw(g, r);
});
const rows = (g: CanvasRenderingContext2D, n: number, w: number, col: string) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(0, (i + 0.5) * (1024 / n) - w / 2, 1024, w); };
const dots = (g: CanvasRenderingContext2D, r: () => number, n: number, cols: string[], rmin: number, rmax: number) => {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.arc(r() * 1024, r() * 1024, rmin + r() * (rmax - rmin), 0, 7); g.fill(); }
};
const FIELDS: (() => THREE.Texture)[] = [
  () => field("wheat", "#f6c443", (g, r) => { rows(g, 16, 18, "#e0a52c"); for (let i = 0; i < 2600; i++) { const x = r() * 1024, y = r() * 1024; g.strokeStyle = r() < 0.5 ? "rgba(255,235,150,0.8)" : "rgba(200,140,30,0.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 14); g.stroke(); } }),
  () => field("greens", "#4fb83a", (g, r) => { rows(g, 12, 46, "#7a5134"); for (let i = 0; i < 12; i++) for (let x = 20; x < 1024; x += 42) { const y = (i + 0.5) * (1024 / 12); g.fillStyle = r() < 0.5 ? "#5fd046" : "#3fa030"; g.beginPath(); g.ellipse(x + r() * 8, y, 19, 15, 0, 0, 7); g.fill(); } }),
  () => field("plough", "#9c6a3e", (g, r) => { rows(g, 20, 14, "#7a4f2c"); rows(g, 20, 4, "#c28a58"); dots(g, r, 400, ["rgba(90,55,30,0.5)", "rgba(230,180,120,0.5)"], 2, 6); }),
  () => field("lavender", "#9466d6", (g, r) => { rows(g, 12, 14, "#4f9a3a"); for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? "#b48aee" : "#7d4fc8"; g.beginPath(); g.arc(r() * 1024, r() * 1024, 5 + r() * 6, 0, 7); g.fill(); } }),
  () => field("sunflower", "#4fae3a", (g, r) => { for (let i = 0; i < 10; i++) for (let x = 25; x < 1024; x += 50) { const y = (i + 0.5) * (1024 / 10) + (r() - 0.5) * 8; g.fillStyle = "#ffd22e"; g.beginPath(); g.arc(x, y, 20, 0, 7); g.fill(); g.fillStyle = "#7a4a22"; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); } }),
  () => field("meadow", "#5cb846", (g, r) => { dots(g, r, 60, ["rgba(70,160,50,0.35)", "rgba(160,230,100,0.35)"], 40, 120); dots(g, r, 500, ["#ffffff", "#ffe45c", "#ff8fb0", "#ff5a5a", "#b48cff"], 4, 7); }),
];
const strawTex = () => ctex("straw", 256, 256, (g, r) => { g.fillStyle = "#f2c443"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 500; i++) { g.strokeStyle = r() < 0.5 ? "rgba(255,230,140,0.8)" : "rgba(190,130,30,0.5)"; g.lineWidth = 2; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 20, y + 10); g.stroke(); } });
const hedgeTex = () => ctex("hedgeLeaf", 256, 128, (g, r) => { g.fillStyle = "#3f9e34"; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? "rgba(110,200,80,0.6)" : "rgba(30,110,30,0.5)"; g.beginPath(); g.arc(r() * 256, r() * 128, 4 + r() * 8, 0, 7); g.fill(); } });
const buntingTex = () => ctex("bunting", 64, 64, (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64); });

/** flat ground material that always draws on top of the grass (no z-fighting at distance) */
export const flatMat = (key: string, map: THREE.Texture | null, color: string, layer: number) =>
  lam(`${key}_po${layer}`, () => ({ map, color, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -4 * layer }));
const groundQuad = (x0: number, x1: number, z0: number, z1: number, tile: number) =>
  quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(x0, 0, z0), (x1 - x0) / tile, (z1 - z0) / tile);
const M4 = (x: number, y: number, z: number, yaw = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(...s));

export type Swap = { m: THREE.MeshLambertMaterial; winter: THREE.Texture };

/** builds everything into `root`; returns the materials that turn to snow in winter */
export const buildCountry = (root: THREE.Object3D, kit: Kit, snow: () => THREE.Texture): Swap[] => {
  const b = new Batch(), swaps: Swap[] = [];
  let s = 991;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const U = (a: number, c: number) => a + (c - a) * r();
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const nearCastle = (x: number, z: number, d: number) => Math.hypot(x - CASTLE[0], z - CASTLE[2]) < d;
  const roadDist = (x: number, z: number) => { // distance to the square -> castle road
    const L = Math.hypot(CASTLE[0], CASTLE[2]), ux = CASTLE[0] / L, uz = CASTLE[2] / L, t = Math.max(0, Math.min(L, x * ux + z * uz));
    return Math.hypot(x - ux * t, z - uz * t);
  };
  const ZONES: [number, number, number, number][] = [[-26, 26, -20, 20], [-74, 70, -92, -16], [22, 60, -32, 30], [8, 28, 18, 32]];
  const inTown = (x: number, z: number, m = 0) => ZONES.some(([x0, x1, z0, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m);
  const ponds: [number, number, number][] = [[95, 70, 13], [-150, -90, 16], [60, -150, 11], [-40, 150, 12]];
  const inPond = (x: number, z: number, m = 4) => ponds.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + m);

  // ---------------- lanes ----------------
  const dirt = flatMat("lane", ctex("laneDirt", 512, 512, (g, rr) => { g.fillStyle = "#d9a96a"; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 900; i++) { g.fillStyle = rr() < 0.5 ? "rgba(150,100,55,0.3)" : "rgba(255,230,180,0.35)"; g.fillRect(rr() * 512, rr() * 512, 3 + rr() * 6, 2 + rr() * 4); } }), "#ffffff", 3);
  swaps.push({ m: dirt, winter: snow() });
  const lanes: [number, number, number, number, number][] = [[60, 16, 360, 30, 3.2], [-6, -62, -18, -360, 3.2], [-72, -6, -360, 10, 3.2], [8, 40, 40, 360, 3.0], [-30, -62, -200, -240, 2.6]];
  const laneSeg = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
    b.add(quad(V(x0 - nx, 0, z0 - nz), V(x0 + nx, 0, z0 + nz), V(x1 + nx, 0, z1 + nz), V(x1 - nx, 0, z1 - nz), 1, L / 4), dirt);
  };
  const laneHit: [number, number, number, number, number][] = [];
  for (const [x0, z0, x1, z1, w] of lanes) { laneSeg(x0, z0, x1, z1, w); laneHit.push([x0, z0, x1, z1, w]); }
  const nearLane = (x: number, z: number, m: number) => laneHit.some(([x0, z0, x1, z1, w]) => {
    const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2));
    return Math.hypot(x - x0 - dx * t, z - z0 - dz * t) < w / 2 + m;
  });

  // ---------------- patchwork fields with hedgerows and fences ----------------
  const fieldMats = FIELDS.map((f, i) => { const m = flatMat("field" + i, f(), "#ffffff", 1); swaps.push({ m, winter: snow() }); return m; });
  const hedgeM = lam("hedgeRow", () => ({ map: hedgeTex() }));
  const hedge = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!sunClear(cx, cz, 1.3, L / 2)) return;
    const g = new THREE.CapsuleGeometry(0.55, Math.max(0.1, L - 1.1), 4, 8).rotateZ(Math.PI / 2).scale(1, 1.1, 1).translate(0, 0.55, 0);
    b.add(g, hedgeM, M4(cx, 0, cz, -Math.atan2(z1 - z0, x1 - x0)));
  };
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 2), yaw = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; prop(b, kit, "fence_simple", x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * u, 1.0, yaw); }
  };
  const CW = 30, CD = 22, ang = 0.13, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = -12; i <= 12; i++) for (let j = -15; j <= 15; j++) {
    const lx = i * (CW + 3), lz = j * (CD + 3), cx = lx * ca - lz * sa, cz = lx * sa + lz * ca, d = Math.hypot(cx, cz);
    if (d < 30 || d > 380 || inTown(cx, cz, 2) || nearCastle(cx, cz, 74) || inPond(cx, cz, 16)) continue; // roads and lanes draw on top of fields
    if (r() < 0.06) continue; // a few plain grass gaps
    const w = CW * U(0.8, 1.0), dd = CD * U(0.8, 1.0), fm = pick(fieldMats);
    const g = groundQuad(-w / 2, w / 2, -dd / 2, dd / 2, 8);
    b.add(g, fm, M4(cx, 0, cz, -ang + (r() < 0.5 ? 0 : Math.PI / 2) * 0));
    const corner = (u: number, v: number): [number, number] => [cx + (u * w / 2) * ca - (v * dd / 2) * sa, cz + (u * w / 2) * sa + (v * dd / 2) * ca];
    const edges: [[number, number], [number, number]][] = [[corner(-1.05, -1.1), corner(1.05, -1.1)], [corner(1.08, -1.05), corner(1.08, 1.05)]];
    for (const [a, c] of edges) { const k = r(); if (k < 0.35) hedge(a[0], a[1], c[0], c[1]); else if (k < 0.55 && d < 220) fence(a[0], a[1], c[0], c[1]); }
  }

  // ---------------- ponds ----------------
  const water = flatMat("pond", null, "#3ab4f2", 2), sand = flatMat("pondRim", null, "#f0d79a", 1);
  for (const [px, pz, pr] of ponds) {
    b.add(new THREE.CircleGeometry(pr + 1.6, 40).rotateX(-Math.PI / 2), sand, M4(px, 0, pz));
    b.add(new THREE.CircleGeometry(pr, 40).rotateX(-Math.PI / 2), water, M4(px, 0.002, pz));
    for (let k = 0; k < 7; k++) { const a = r() * 6.28, dd = pr * U(0.3, 0.8); prop(b, kit, "lily_large", px + Math.cos(a) * dd, 0.03, pz + Math.sin(a) * dd, 0.08, r() * 6); }
    for (let k = 0; k < 6; k++) { const a = r() * 6.28; if (sunClear(px + Math.cos(a) * (pr + 3), pz + Math.sin(a) * (pr + 3), 1.4)) prop(b, kit, "plant_bushLarge", px + Math.cos(a) * (pr + 3), 0, pz + Math.sin(a) * (pr + 3), 1.4); }
  }
  swaps.push({ m: water, winter: ctex("ice", 256, 256, (g) => { g.fillStyle = "#cfe8fa"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 50, 0); g.lineTo(i * 50 + 80, 256); g.stroke(); } }) });

  // ---------------- farms: cottages, haystacks, trees ----------------
  const straw = lam("strawHD", () => ({ map: strawTex() }));
  const haystack = (x: number, z: number, k = 1) => {
    if (!sunClear(x, z, 2.6 * k, 1.3 * k)) return;
    b.add(new THREE.CylinderGeometry(1.25 * k, 1.35 * k, 1.5 * k, 16).translate(0, 0.75 * k, 0), straw, M4(x, 0, z));
    b.add(new THREE.ConeGeometry(1.4 * k, 1.2 * k, 16).translate(0, 1.5 * k + 0.6 * k, 0), straw, M4(x, 0, z));
  };
  const trees = ["tree_oak", "tree_default", "tree_fat", "tree-high-round", "tree_cone", "tree_detailed"];
  const tree = (x: number, z: number, h: number) => { if (sunClear(x, z, h, h * 0.35) && !inPond(x, z, 2) && !nearLane(x, z, 2)) prop(b, kit, pick(trees), x, 0, z, h, r() * 6); };
  let farms = 0;
  for (let k = 0; k < 140 && farms < 26; k++) {
    const a = r() * 6.28, d = U(80, 330), fx = Math.cos(a) * d, fz = Math.sin(a) * d;
    if (inTown(fx, fz) || nearCastle(fx, fz, 80) || inPond(fx, fz, 10) || roadDist(fx, fz) < 14 || !sunClear(fx, fz, 13, 9)) continue;
    farms++;
    const yaw = r() * 6.28, si = Math.floor(r() * 8);
    house(b, fx, fz, yaw, pick([6, 7]), 6, pick([5.6, 6.2]), si);
    if (r() < 0.6) house(b, fx + Math.cos(yaw) * 9, fz - Math.sin(yaw) * 9, yaw + Math.PI / 2, 8, 6, 5, (si + 3) % 8);
    for (let h2 = 0; h2 < 3; h2++) haystack(fx + U(-14, 14), fz + U(-14, 14), U(0.8, 1.2));
    for (let t = 0; t < 4; t++) tree(fx + U(-16, 16), fz + U(-16, 16), U(7, 11));
    prop(b, kit, pick(["log_stack", "crop_pumpkin", "stump_old"]), fx + U(-6, 6), 0, fz + U(-6, 6), 0.8, r() * 6);
  }
  // groves and lone trees across the land
  for (let g = 0; g < 26; g++) {
    const a = r() * 6.28, d = U(70, 420), gx = Math.cos(a) * d, gz = Math.sin(a) * d;
    if (inTown(gx, gz) || nearCastle(gx, gz, 60)) continue;
    const n = 4 + Math.floor(r() * 7);
    for (let t = 0; t < n; t++) tree(gx + U(-14, 14), gz + U(-14, 14), U(7, 13));
  }
  // stones, stumps, flowers and bushes sprinkled on the grass
  for (let k = 0; k < 260; k++) {
    const a = r() * 6.28, d = U(45, 320), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (inTown(x, z) || inPond(x, z, 2) || nearLane(x, z, 1)) continue;
    const kind = pick(["flower_redA", "flower_yellowA", "flower_purpleA", "flower_redA", "plant_bushLarge", "stone_largeA", "stone_smallB", "stump_round", "mushroom_red"]);
    const h = kind.startsWith("flower") ? 0.55 : kind.startsWith("plant") ? 1.3 : kind.startsWith("stone_large") ? 1.4 : 0.6;
    if (sunClear(x, z, h)) prop(b, kit, kind, x, 0, z, h, r() * 6);
  }

  // ---------------- more town ----------------
  const H = [7, 8.4, 9.8, 8.4, 7, 9.8];
  const row = (x0: number, x1: number, z: number, yaw: number, si0: number) => {
    let x = x0, k = si0;
    while (x < x1) { const w = pick([7, 8, 9]), h = H[k % 6]; if (sunClear(x + w / 2, z, h + 4, w / 2 + 2)) house(b, x + w / 2, z, yaw, w, 8, h, k % 8); x += w + 0.3; k++; }
  };
  const col = (z0: number, z1: number, x: number, yaw: number, si0: number) => {
    let z = z0, k = si0;
    while (z < z1) { const w = pick([7, 8, 9]), h = H[k % 6]; if (sunClear(x, z + w / 2, h + 4, w / 2 + 2)) house(b, x, z + w / 2, yaw, w, 8, h, k % 8); z += w + 0.3; k++; }
  };
  row(-70, -40, -22, 0, 1); row(-70, -44, -34, 0, 4);         // north-west block (fronts south)
  row(36, 66, -22, 0, 2); row(36, 66, -34, 0, 5);             // north-east block
  col(-30, 4, 40, -Math.PI / 2, 3); col(-30, 4, 52, Math.PI / 2, 6); // east street, both sides
  row(-60, -26, -48, Math.PI, 0); row(12, 50, -48, Math.PI, 7); // across the north lane
  col(-46, -26, -44, Math.PI / 2, 2);                          // the north-west corner
  // church: nave, tower, spire, on the north lane (far from every sun path)
  const chW = lam("chapelWall", () => ({ color: "#fbe6c2" })), chR = lam("roof#d9533c", () => ({ color: "#d9533c" }));
  b.add(boxGeo(V(-24, 0, -78), V(-12, 9, -58), 3), chW);
  b.add(quad(V(-24.4, 8.8, -58), V(-24.4, 8.8, -78), V(-18, 14, -78), V(-18, 14, -58)), chR);
  b.add(quad(V(-11.6, 8.8, -78), V(-11.6, 8.8, -58), V(-18, 14, -58), V(-18, 14, -78)), chR);
  b.add(new THREE.BufferGeometry().setFromPoints([V(-24, 9, -58), V(-12, 9, -58), V(-18, 14, -58)]).toNonIndexed(), chW);
  b.add(boxGeo(V(-21, 0, -60), V(-15, 22, -54), 3), chW);
  b.add(new THREE.ConeGeometry(4.3, 12, 4).rotateY(Math.PI / 4).translate(-18, 28, -57), chR);
  b.add(boxGeo(V(-19.2, 17, -54.05), V(-16.8, 19.4, -53.95)), lam("clockFace", () => ({ color: "#fff8e0" })));
  for (const [x, z] of [[-30, -70], [-6, -70], [-28, -86], [-8, -88]] as const) tree(x, z, 9);

  // ---------------- the castle hill ----------------
  const hillM = lam("hillSkirt", () => ({ map: ctex("hillGrass", 512, 512, (g, rr) => { g.fillStyle = "#3a9638"; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 90; i++) { g.fillStyle = rr() < 0.5 ? "rgba(120,210,80,0.4)" : "rgba(40,130,40,0.4)"; g.beginPath(); g.arc(rr() * 512, rr() * 512, 20 + rr() * 50, 0, 7); g.fill(); } for (let i = 0; i < 160; i++) { g.fillStyle = ["#ffffff", "#ffe45c", "#ff8fb0"][i % 3]; g.beginPath(); g.arc(rr() * 512, rr() * 512, 3, 0, 7); g.fill(); } }) }));
  swaps.push({ m: hillM, winter: snow() });
  b.add(new THREE.SphereGeometry(1, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillM, M4(CASTLE[0], -0.3, CASTLE[2], 0, [72, 1.9, 72]));
  // a low stone ring wall around the hilltop, with a gap for the road
  const stoneM = lam("ringStone", () => ({ map: ctex("ringStoneT", 256, 128, (g, rr) => { g.fillStyle = "#c9c2b4"; g.fillRect(0, 0, 256, 128); for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < 256; x += 48) { g.fillStyle = ["#d8d1c2", "#bdb5a5", "#cfc7b6"][Math.floor(rr() * 3)]; g.fillRect(x + 2, y + 2, 44, 28); } }) }));
  const toTown = Math.atan2(-CASTLE[2], -CASTLE[0]);
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2, da = Math.abs(((a - toTown + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 0.12) continue;
    const x = CASTLE[0] + Math.cos(a) * 50, z = CASTLE[2] + Math.sin(a) * 50, y = 1.0;
    b.add(boxGeo(V(-2.6, 0, -0.45), V(2.6, 1.3, 0.45), 1.5), stoneM, M4(x, y - 0.4, z, -a + Math.PI / 2));
  }
  // a village at the hill's foot and dressing on the slopes, away from the low-sun paths
  for (let k = 0; k < 40; k++) {
    const a = r() * 6.28, d = U(54, 90), x = CASTLE[0] + Math.cos(a) * d, z = CASTLE[2] + Math.sin(a) * d;
    if (roadDist(x, z) < 8) continue;
    if (k < 12) { if (sunClear(x, z, 11, 6)) house(b, x, z, Math.atan2(CASTLE[0] - x, CASTLE[2] - z), pick([6, 7]), 6, pick([5.6, 6.4]), Math.floor(r() * 8)); }
    else tree(x, z, U(7, 12));
  }
  for (let k = 0; k < 70; k++) {
    const a = r() * 6.28, d = U(24, 46), x = CASTLE[0] + Math.cos(a) * d, z = CASTLE[2] + Math.sin(a) * d, y = HILL_H * Math.sqrt(Math.max(0, 1 - (d / 46) ** 2));
    if (roadDist(x, z) < 4) continue;
    const kind = pick(["stone_largeA", "stone_largeC", "flower_redA", "flower_yellowA", "flower_purpleA", "plant_bushLarge", "tree_cone", "tree_oak"]);
    const h = kind.startsWith("tree") ? U(6, 9) : kind.startsWith("stone") ? U(1, 2.2) : kind.startsWith("plant") ? 1.3 : 0.55;
    if (sunClear(x, z, h + y)) prop(b, kit, kind, x, y - 0.1, z, h, r() * 6);
  }
  // lanterns up the road to the gate
  const L = Math.hypot(CASTLE[0], CASTLE[2]), ux = CASTLE[0] / L, uz = CASTLE[2] / L;
  for (let t = 30; t < 0; t += 14) for (const sd of [-1, 1]) {
    const x = ux * t - uz * 3.6 * sd, z = uz * t + ux * 3.6 * sd;
    if (sunClear(x, z, 2.9, 0.4)) prop(b, kit, "lantern", x, 0, z, 2.9);
  }

  // ---------------- the square dressed (no shadows: at a low sun they stretched into stripes) ----------------
  b.build(root);
  const wood = lam("barrelWood", () => ({ color: "#b5733f" })), hoop = lam("barrelHoop", () => ({ color: "#5a5048" })), crateM = lam("crateWood", () => ({ map: ctex("crateT", 128, 128, (g) => { g.fillStyle = "#d9a15a"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#8a5a2c"; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118); g.beginPath(); g.moveTo(5, 5); g.lineTo(123, 123); g.stroke(); }) }));
  const barrel = (x: number, z: number) => { b.add(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 14).translate(0, 0.475, 0), wood, M4(x, 0, z)); for (const y of [0.18, 0.77]) b.add(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 14).translate(0, y, 0), hoop, M4(x, 0, z)); };
  const crate = (x: number, z: number, s2 = 0.8, y = 0) => b.add(boxGeo(V(-s2 / 2, 0, -s2 / 2), V(s2 / 2, s2, s2 / 2)), crateM, M4(x, y, z, r()));
  for (const [x, z] of [[-13.5, -15.6], [-14.3, -15.2], [9.2, -15.8], [21.8, -10], [22.2, -9.2], [-8.5, -16.6]] as const) barrel(x, z);
  for (const [x, z] of [[-12.6, -16.2], [13.8, -15.4], [22, -12.3]] as const) { crate(x, z); crate(x, z, 0.6, 0.8); }
  const pots = lam("pot", () => ({ color: "#d9653c" })), bloom = [lam("bloomR", () => ({ color: "#ff3d5a" })), lam("bloomY", () => ({ color: "#ffd23f" })), lam("bloomP", () => ({ color: "#ff7ad9" }))];
  for (let x = -19; x <= 19; x += 4.5) {
    b.add(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 10).translate(0, 0.25, 0), pots, M4(x, 0, -17.55));
    b.add(new THREE.IcosahedronGeometry(0.34, 1).translate(0, 0.62, 0), lam("potLeaf", () => ({ color: "#3fae3a" })), M4(x, 0, -17.55));
    for (let k = 0; k < 4; k++) b.add(new THREE.IcosahedronGeometry(0.11, 0).translate(U(-0.22, 0.22), 0.82, U(-0.22, 0.22)), pick(bloom), M4(x, 0, -17.55));
  }
  // bunting along the house fronts: little triangle flags on a sagging line
  const flagCols = ["#ff3d5a", "#ffd23f", "#3fa0ff", "#3fcf5a", "#ff8a2a", "#c46bff"].map((c) => lam("flag" + c, () => ({ color: c, map: buntingTex(), side: THREE.DoubleSide })));
  const string = (ax: number, az: number, bx: number, bz: number, y: number) => {
    const n = Math.floor(Math.hypot(bx - ax, bz - az) / 0.7);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u, yy = y - 1.2 * 4 * u * (1 - u), yaw = -Math.atan2(bz - az, bx - ax);
      const g = new THREE.BufferGeometry().setFromPoints([V(-0.25, 0, 0), V(0.25, 0, 0), V(0, -0.5, 0)]);
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2)); g.computeVertexNormals();
      b.add(g, flagCols[i % flagCols.length], M4(x, yy, z, yaw));
    }
  };
  for (let x = -20; x < 20; x += 8) string(x, -17.4, x + 8, -17.4, 6.6);
  for (let z = -16; z < 6; z += 7.3) string(23.4, z, 23.4, z + 7.3, 6.6);
  string(-8, -17.4, 0, -10.5, 6.8); string(8, -17.4, 0, -10.5, 6.8);   // two strings down to the dais canopy

  b.build(root, false);
  return swaps;
};

/** Summer-only dressing (shown in the day, noon and overcast shots, hidden in the winter shots, where it would block
 *  the low suns the story needs): a tree avenue along the castle road, orchards, woods round the castle hill, a sheep
 *  meadow, bushes, flowers and carts. This is what the opening flies over. */
export const buildSummer = (root: THREE.Object3D, kit: Kit) => {
  const b = new Batch();
  let s = 4242;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const U = (a: number, c: number) => a + (c - a) * r();
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
  const L = Math.hypot(CASTLE[0], CASTLE[2]), ux = CASTLE[0] / L, uz = CASTLE[2] / L, nx = -uz, nz = ux;
  const at = (t: number, n: number): [number, number] => [ux * t + nx * n, uz * t + nz * n];
  const round = ["tree_oak", "tree_default", "tree_fat", "tree_detailed"];
  // tree avenue on both sides of the castle road
  for (let t = 40; t < L - 52; t += 8.5) for (const sd of [-1, 1]) { const [x, z] = at(t + U(-1, 1), sd * U(6.5, 7.5)); prop(b, kit, pick(round), x, 0, z, U(7.5, 9.5), r() * 6); }
  // bushes and flowers between the avenue trees
  for (let t = 34; t < L - 50; t += 3) for (const sd of [-1, 1]) {
    const [x, z] = at(t + U(-1, 1), sd * U(4.2, 5.4));
    prop(b, kit, r() < 0.35 ? "plant_bushLarge" : pick(["flower_redA", "flower_yellowA", "flower_purpleA"]), x, 0, z, r() < 0.35 ? U(1, 1.5) : 0.6, r() * 6);
  }
  // orchards on both sides: neat rows of round fruit trees
  const fruit = lam("fruitRed", () => ({ color: "#ff3b3b" })), apple = new THREE.IcosahedronGeometry(0.22, 0);
  for (const [t0, t1, n0, n1] of [[34, 82, 13, 40], [34, 74, -40, -13], [92, 112, 16, 36]] as const)
    for (let t = t0; t < t1; t += 7) for (let n = n0; n < n1; n += 7) {
      const [x, z] = at(t + U(-0.6, 0.6), n + U(-0.6, 0.6)), h = U(5.5, 6.8);
      prop(b, kit, "tree_oak", x, 0, z, h, r() * 6);
      for (let k = 0; k < 6; k++) { const a = r() * 6.28, rr = h * U(0.2, 0.33); b.add(apple, fruit, new THREE.Matrix4().makeTranslation(x + Math.cos(a) * rr, h * U(0.55, 0.78), z + Math.sin(a) * rr)); }
    }
  // woods all round the castle hill (the road keeps its gap)
  for (let k = 0; k < 150; k++) {
    const a = r() * 6.28, d = U(48, 110), x = CASTLE[0] + Math.cos(a) * d, z = CASTLE[2] + Math.sin(a) * d;
    const tt = (x * ux + z * uz), q = Math.abs(x * nx + z * nz);
    if (q < 9 && tt < L) continue;
    prop(b, kit, pick([...round, "tree-high-round", "tree_cone", "tree_cone"]), x, 0, z, U(8, 13), r() * 6);
  }
  for (let k = 0; k < 90; k++) { // rocks, bushes and flower clumps on the hill skirt
    const a = r() * 6.28, d = U(30, 70), x = CASTLE[0] + Math.cos(a) * d, z = CASTLE[2] + Math.sin(a) * d;
    if (Math.abs(x * nx + z * nz) < 5 && x * ux + z * uz < L) continue;
    const kind = pick(["stone_largeA", "stone_largeC", "plant_bushLarge", "flower_redA", "flower_yellowA", "flower_purpleA", "flower_redA"]);
    prop(b, kit, kind, x, Math.max(0, 1.6 * (1 - d / 72)), z, kind.startsWith("stone") ? U(1, 2.4) : kind.startsWith("plant") ? 1.4 : 0.6, r() * 6);
  }
  // copses and lone trees on the other side of the square's open corner
  for (let k = 0; k < 80; k++) {
    const [x, z] = at(U(30, 130), (r() < 0.5 ? -1 : 1) * U(42, 110));
    prop(b, kit, pick([...round, "tree-high-round", "tree_cone"]), x, 0, z, U(7, 12), r() * 6);
  }
  // a sheep meadow beside the road: woolly bodies, dark heads and legs
  const wool = lam("wool", () => ({ color: "#fbf8f1" })), face = lam("sheepFace", () => ({ color: "#2e2a30" }));
  const body = new THREE.IcosahedronGeometry(1, 1), head = new THREE.SphereGeometry(0.28, 10, 8), leg = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6);
  for (let k = 0; k < 16; k++) {
    const [x, z] = at(U(48, 76), -U(15, 34)), yaw = r() * 6.28, c = Math.cos(yaw), sn = Math.sin(yaw);
    const M = (px: number, py: number, pz: number, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(V(x + px * c + pz * sn, py, z - px * sn + pz * c), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(sx, sy, sz));
    b.add(body, wool, M(0, 0.85, 0, 0.75, 0.55, 0.55));
    b.add(head, face, M(0.78, 0.95, 0));
    for (const [lx, lz] of [[0.4, 0.25], [0.4, -0.25], [-0.4, 0.25], [-0.4, -0.25]]) b.add(leg, face, M(lx, 0.28, lz));
  }
  for (let t = 46; t < 80; t += 2) { const [x, z] = at(t, -12.5); prop(b, kit, "fence_simple", x, 0, z, 1.0, -Math.atan2(uz, ux)); }
  // carts and haystacks along the way
  for (const [t, n] of [[40, 9], [88, -10], [104, 11]] as const) { const [x, z] = at(t, n); prop(b, kit, "cart", x, 0, z, 2.2, r() * 6); }
  b.build(root);
};
