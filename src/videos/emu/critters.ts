// Emus and the kangaroo as flat cartoon cards, drawn with the same Pen, plum ink and painted light crescent as the
// people (toon.ts). Design canvas 600 x 1000, soles at y = 975 (1000 units = 2.16 m): an emu stands ~1.8 m = 830 units.
// Side views face screen-right (cast.ts mirrors the card for left). Modes: stand, walk, run, peck, drink, proud.
import { Pen, INK, shade } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

const FEATHER = "#7b5b3e", FEATHER_SH = "#4a3526", FEATHER_DK = "#3b2a1f";
const NECK = "#8a9bb3", NECK_SH = "#64738d";            // blue-grey throat skin (real emus have it)
const HEAD = "#4d3f36", BEAK = "#3a312b", LEG = "#7d766c", LEG_SH = "#5b554d";

export type EmuMode = "stand" | "walk" | "run" | "peck" | "drink" | "proud";
export type EmuEye = "open" | "wide" | "smug" | "shut";
export type EmuOpts = { mode?: EmuMode; phase?: number; blink?: number; eye?: EmuEye; light?: number; seed?: number; look?: number; wet?: boolean };

const quad = (a: P2, c: P2, b: P2, n = 14): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
  return out;
};
/** closed tube outline around a centre line with widths w0 -> w1 */
const tube = (pts: P2[], w0: number, w1: number): P2[] => {
  const L: P2[] = [], R: P2[] = [];
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = b[1] - a[1], ny = a[0] - b[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    L.push([q[0] + nx * w, q[1] + ny * w]); R.push([q[0] - nx * w, q[1] - ny * w]);
  });
  return [...L, ...R.reverse()];
};
/** shaggy feather body: an egg with a ragged, drooping lower fringe */
const bodyPts = (cx: number, cy: number, rx: number, ry: number, tilt: number, seed: number, shag: number): P2[] => {
  const pts: P2[] = [], n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = Math.sin(a);
    let r = 1 + 0.07 * Math.cos(a) - 0.05 * s;                 // fuller rump
    if (s > 0.15) r += shag * (i % 2 ? 0.16 : 0.02) * s * (0.7 + 0.6 * rnd(seed, i));   // ragged fringe below
    const x = rx * r * Math.cos(a), y = ry * r * s * (s > 0 ? 1.08 : 1);
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pts;
};

const emuEye = (p: Pen, x: number, y: number, r: number, eye: EmuEye, blink: number, look: number, ow: number) => {
  const shut = eye === "shut" || blink >= 0.99;
  if (shut) { p.arc(x, y + r * 0.1, r * 0.9, r * 0.5, 10, 170, ow * 0.9); return; }
  const R = eye === "wide" ? r * 1.25 : r;
  p.ell(x, y, R, R * 1.1, "#ffffff", ow * 0.75);
  p.ell(x + R * 0.25 * look, y + R * 0.05, R * 0.55, R * 0.6, "#c8682e", 0);       // orange iris
  p.dot(x + R * 0.3 * look, y + R * 0.05, R * 0.32, INK);
  if (eye === "smug" || blink > 0.3) {                                             // heavy lid
    const k = eye === "smug" ? 0.45 : Math.min(0.9, blink);
    p.clip([[x - R * 1.3, y - R * 1.3], [x + R * 1.3, y - R * 1.3], [x + R * 1.3, y - R * 1.3 + 2.4 * R * k], [x - R * 1.3, y - R * 1.3 + 2.4 * R * k]],
      () => p.ell(x, y, R + 1, R * 1.1 + 1, HEAD, 0));
    p.stroke([[x - R * 1.05, y - R * 1.1 + 2.2 * R * k], [x + R * 1.05, y - R * 1.1 + 2.2 * R * k]], ow * 0.8);
  }
};

/** emu, side view facing screen-right */
export const emuSide = (p: Pen, o: EmuOpts) => {
  const { mode = "stand", phase = 0, blink = 0, eye = "open", light = rad(-120), seed = 1, look = 1, wet = false } = o;
  const ow = 11, sole = 975, two = Math.PI * 2;
  const run = mode === "run", walk = mode === "walk", moving = run || walk;
  const ph = phase * two, bob = moving ? (run ? 16 : 8) * Math.abs(Math.sin(ph)) : 0;
  const lean = run ? rad(-12) : mode === "proud" ? rad(6) : 0;
  const cx = 250, cy = 505 - bob + (mode === "peck" || mode === "drink" ? 18 : 0) + rnd(seed, 1) * 10, rx = 168, ry = 118;
  const hip: P2 = [cx + 30, cy + 70];
  // ---- legs (far leg first, darker) ----
  const leg = (k: number, far: boolean) => {
    const pk = ph + k * Math.PI, swing = moving ? Math.sin(pk) : 0, lift = moving ? Math.max(0, -Math.cos(pk)) : 0;
    const stride = run ? 150 : walk ? 85 : 0;
    const foot: P2 = [hip[0] + 10 + swing * stride + (far ? -14 : 0) + (mode === "proud" ? (far ? -30 : 30) : 0), sole - lift * (run ? 120 : 55)];
    const knee: P2 = [hip[0] - 20 + swing * stride * 0.35, cy + 170 - lift * 30];    // bird "knee" (ankle) bends backward
    const col = far ? shade(LEG, 0.78) : LEG;
    const thigh = tube([hip, knee], 46, 30), shin = tube([knee, foot], 28, 20);
    p.poly(thigh, far ? shade(FEATHER_SH, 0.9) : FEATHER_SH, ow * 0.8);
    p.poly(shin, col, ow * 0.8);
    // three toes forward + a short back spur
    const fx = foot[0], fy = foot[1], up = lift * 40;
    for (const [dx, dy] of [[52, 6], [40, -2], [30, 10]] as P2[]) p.line([[fx, fy - 4], [fx + dx, fy - 4 + dy - up * 0.5]], far ? shade(LEG_SH, 0.8) : LEG_SH, 11);
    p.line([[fx, fy - 4], [fx - 18, fy - 6]], far ? shade(LEG_SH, 0.8) : LEG_SH, 9);
  };
  leg(1, true);
  // ---- body ----
  const B = bodyPts(cx, cy, rx, ry, lean + rad(4), seed, 1);
  p.gradFill(B, wet ? shade(FEATHER, 0.82) : FEATHER, wet ? shade(FEATHER_SH, 0.8) : FEATHER_SH, light, 0.25);
  // feather texture: short curved dark strokes, denser toward the rump
  for (let i = 0; i < 26; i++) {
    const a = rnd(seed + 3, i) * Math.PI * 2, rr = 0.25 + 0.6 * rnd(seed + 5, i), x = cx + rx * rr * Math.cos(a) * 0.95, y = cy + ry * rr * Math.sin(a) * 0.9;
    p.stroke([[x - 14, y - 6], [x, y + 8], [x + 12, y + 2]], 4, FEATHER_DK);
  }
  p.inkRing(B, ow, Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light)), 0.45);
  leg(0, false);
  // ---- neck + head ----
  const base: P2 = [cx + rx * 0.72, cy - ry * 0.45];
  let head: P2, ctrl: P2;
  if (mode === "peck") { const d = 0.5 + 0.5 * Math.sin(ph * 2); head = [cx + rx + 150, 740 + 110 * d]; ctrl = [cx + rx + 180, 400]; }
  else if (mode === "drink") { head = [cx + rx + 150, 948]; ctrl = [cx + rx + 190, 520]; }
  else if (run) { head = [cx + rx + 190, cy - 230 - bob * 0.5]; ctrl = [cx + rx + 40, cy - 120]; }
  else if (mode === "proud") { head = [cx + rx + 40, 140]; ctrl = [cx + rx + 110, 330]; }
  else { const sway = moving ? 10 * Math.sin(ph * 2) : 6 * Math.sin(seed); head = [cx + rx + 70 + sway, 170 + bob * 0.4]; ctrl = [cx + rx + 130, 360]; }
  const neckLine = quad(base, ctrl, head, 16);
  const N = tube(neckLine, 60, 32);
  p.gradFill(N, NECK, NECK_SH, light, 0.3);
  // dark feathered lower neck + a hairy crest down the back of the neck
  p.clip(N, () => { p.poly(tube(neckLine.slice(0, 7), 64, 52), FEATHER_SH, 0); for (let i = 3; i < 14; i++) p.dot(neckLine[i][0] - 10, neckLine[i][1], 7, FEATHER_DK); });
  p.poly(N, null, ow * 0.85);
  const down = mode === "peck" || mode === "drink";
  const ha = down ? rad(70) : run ? rad(-15) : 0;
  const hx = head[0], hy = head[1], hr = 42;
  const beak: P2[] = [[hx + 18, hy - 6], [hx + 74, hy + 4], [hx + 70, hy + 14], [hx + 18, hy + 16]];
  const R = (q: P2): P2 => [hx + (q[0] - hx) * Math.cos(ha) - (q[1] - hy) * Math.sin(ha), hy + (q[0] - hx) * Math.sin(ha) + (q[1] - hy) * Math.cos(ha)];
  p.poly(beak.map(R), BEAK, ow * 0.75);
  p.ell(hx, hy, hr, hr * 0.82, HEAD, ow * 0.85, 0, 360, (ha * 180) / Math.PI);
  for (let i = 0; i < 5; i++) { const [qx, qy] = R([hx - 30 + i * 9, hy - 30 - (i % 2) * 8]); p.stroke([[qx, qy + 6], [qx - 4, qy - 6]], 5, FEATHER_DK); } // tuft
  const [ex, ey] = R([hx + 6, hy - 8]);
  emuEye(p, ex, ey, 17, eye, blink, look, ow);
  if (wet) for (let i = 0; i < 4; i++) p.ell(cx - 60 + i * 50, cy + ry + 30 + (i % 2) * 20, 9, 14, "#bfe8ff", 4);
};

/** emu, front view (stares into the lens) */
export const emuFront = (p: Pen, o: EmuOpts) => {
  const { blink = 0, eye = "open", light = rad(-120), seed = 1, look = 0, phase = 0 } = o;
  const ow = 11, sole = 975, cx = 300;
  const tiltH = 0.08 * Math.sin(seed * 3 + phase * 6.28);
  // legs
  for (const s of [-1, 1]) {
    const hx = cx + s * 46, fy = sole;
    p.poly(tube([[hx, 640], [hx + s * 10, 790]], 40, 30), FEATHER_SH, ow * 0.8);
    p.poly(tube([[hx + s * 10, 790], [hx + s * 4, fy - 6]], 26, 20), LEG, ow * 0.8);
    for (const dx of [-30, 0, 30]) p.line([[hx + s * 4, fy - 8], [hx + s * 4 + dx, fy - 2]], LEG_SH, 11);
  }
  const B = bodyPts(cx, 540, 150, 128, 0, seed, 1);
  p.gradFill(B, FEATHER, FEATHER_SH, light, 0.25);
  for (let i = 0; i < 22; i++) { const x = cx - 110 + rnd(seed, i) * 220, y = 470 + rnd(seed, i + 40) * 150; p.stroke([[x - 12, y - 6], [x, y + 8], [x + 12, y - 4]], 4, FEATHER_DK); }
  p.inkRing(B, ow, Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light)), 0.45);
  // neck (gentle S)
  const neck = quad([cx, 440], [cx + 26 * Math.sin(seed), 300], [cx + 8, 205], 14);
  const N = tube(neck, 66, 40);
  p.gradFill(N, NECK, NECK_SH, light, 0.3);
  p.clip(N, () => p.poly(tube(neck.slice(0, 6), 70, 60), FEATHER_SH, 0));
  p.poly(N, null, ow * 0.85);
  // head: wide flat beak below two big googly eyes
  const hx = cx + 8, hy = 168;
  const Rt = (q: P2): P2 => [hx + (q[0] - hx) * Math.cos(tiltH) - (q[1] - hy) * Math.sin(tiltH), hy + (q[0] - hx) * Math.sin(tiltH) + (q[1] - hy) * Math.cos(tiltH)];
  p.ell(hx, hy, 58, 50, HEAD, ow * 0.85, 0, 360, (tiltH * 180) / Math.PI);
  p.poly([[hx - 34, hy + 18], [hx + 34, hy + 18], [hx + 22, hy + 46], [hx - 22, hy + 46]].map((q) => Rt(q as P2)), BEAK, ow * 0.75);
  p.stroke([Rt([hx - 28, hy + 30]), Rt([hx + 28, hy + 30])], 4);
  for (let i = 0; i < 5; i++) { const [qx, qy] = Rt([hx - 18 + i * 9, hy - 46 - (i % 2) * 8]); p.stroke([[qx, qy + 6], [qx, qy - 8]], 5, FEATHER_DK); }
  for (const s of [-1, 1]) { const [ex, ey] = Rt([hx + s * 27, hy - 8]); emuEye(p, ex, ey, 19, eye, blink, look, ow); }
};

/** kangaroo, side view facing screen-right, standing tall on its tail (coat-of-arms pose) */
export const kangaroo = (p: Pen, light = rad(-120), blink = 0) => {
  const ow = 11, sole = 975, FUR = "#b5703f", FUR_SH = "#7d4a2a", BELLY = "#e2b98a";
  const tail = tube(quad([200, 760], [110, 900], [20, 960], 12), 70, 20);
  p.gradFill(tail, FUR, FUR_SH, light, 0.3); p.poly(tail, null, ow);
  p.poly([[230, 900], [360, 960], [360, 975], [210, 975]], FUR_SH, ow);                         // long foot
  const thigh: P2[] = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; thigh.push([260 + 95 * Math.cos(a), 800 + 120 * Math.sin(a)]); }
  p.gradFill(thigh, FUR, FUR_SH, light, 0.25); p.poly(thigh, null, ow);
  const body = tube(quad([270, 760], [330, 520], [330, 330], 14), 190, 100);
  p.gradFill(body, FUR, FUR_SH, light, 0.25);
  p.clip(body, () => p.ell(355, 560, 50, 170, BELLY, 0));
  p.poly(body, null, ow);
  p.line([[360, 470], [420, 540], [440, 520]], FUR_SH, 22);                                    // little arms, held proud
  p.ell(345, 250, 70, 56, FUR, ow, 0, 360, -12);                                               // head
  p.poly([[390, 240], [455, 262], [450, 285], [385, 282]], FUR, ow);                           // snout
  p.dot(452, 268, 9, INK);
  for (const dx of [-10, 22]) p.poly([[320 + dx, 210], [300 + dx, 120], [345 + dx, 200]], FUR_SH, ow * 0.8); // ears
  if (blink > 0.9) p.arc(372, 238, 13, 7, 10, 170, 7);
  else { p.ell(372, 236, 13, 15, "#ffffff", ow * 0.7); p.dot(376, 238, 7, INK); }
  p.arc(410, 290, 18, 8, 20, 120, 5);
};

/** shield between the emu and the kangaroo (a simple cartoon shield with six blank quarters and a gold star above) */
export const shield = (p: Pen) => {
  const pts: P2[] = [[60, 120], [440, 120], [440, 430], [250, 600], [60, 430]];
  p.poly(pts, "#e9d9a8", 14);
  p.clip(pts, () => {
    const cols = ["#c0453a", "#3f6fb5", "#d9a441", "#5d7a3a", "#7b5ac9", "#2f5f6a"];
    for (let i = 0; i < 6; i++) { const x = 60 + (i % 3) * 127, y = 120 + Math.floor(i / 3) * 200; p.poly([[x + 12, y + 12], [x + 115, y + 12], [x + 115, y + 188], [x + 12, y + 188]], cols[i], 8); }
  });
  p.poly(pts, null, 16);
  const st: P2[] = []; for (let i = 0; i < 14; i++) { const a = rad(-90 + i * (360 / 14)), r = i % 2 ? 26 : 62; st.push([250 + r * Math.cos(a), 52 + r * Math.sin(a)]); }
  p.poly(st, "#f2c94c", 10);
};

// ---------------- effects for this short ----------------
/** rain streaks on a 512 x 512 card (soft) */
export const fxRain = (p: Pen, seed: number) => {
  for (let i = 0; i < 60; i++) { const x = rnd(seed, i) * 520, y = rnd(seed, i + 99) * 520; p.stroke([[x, y], [x - 10, y + 70]], 3, "rgba(225,235,245,0.75)"); }
};
/** muzzle flash (star with a hot core), 400 x 400 */
export const fxMuzzle = (p: Pen, k: number) => {
  const pts: P2[] = [];
  for (let i = 0; i < 16; i++) { const a = rad(i * 22.5 + k * 11), r = (i % 2 ? 70 : 180) * (0.75 + 0.25 * rnd(k, i)); pts.push([200 + r * Math.cos(a), 200 + r * Math.sin(a)]); }
  p.poly(pts, "#ffd23f", 10);
  p.ell(200, 200, 60, 60, "#fff6d0", 0);
};
/** grey jam smoke puff, 300 x 300, t 0..1 */
export const fxSmoke = (p: Pen, t: number) => {
  for (let i = 0; i < 5; i++) {
    const a = rad(200 + i * 40), d = 30 + 60 * t, r = (40 + 14 * (i % 2)) * (0.6 + 0.6 * t);
    p.ell(150 + d * Math.cos(a) * 0.6, 170 - 60 * t + d * Math.sin(a) * 0.5, r, r * 0.85, `rgba(120,118,126,${(0.9 * (1 - t)).toFixed(2)})`, 0);
  }
};
/** loose feather, 200 x 200 */
export const fxFeather = (p: Pen) => {
  p.poly([[40, 160], [80, 60], [150, 30], [130, 110], [60, 170]], FEATHER, 7);
  p.stroke([[40, 165], [140, 40]], 5, FEATHER_DK);
};
/** water stream from the hose: a fat arc of blue from (0, 0.5) to (1, 0.5) on a 1024 x 256 card, flecks along it */
export const fxStream = (p: Pen, t: number) => {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([20 + 980 * u, 150 - 90 * Math.sin(Math.PI * u * 0.9)]); }
  p.line(pts, "#bfe8ff", 26);
  p.stroke(pts.map(([x, y]) => [x, y - 5] as P2), 7, "#ffffff");
  for (let i = 0; i < 12; i++) { const u = (i / 12 + t * 0.7) % 1, [x, y] = pts[Math.round(u * 20)]; p.ell(x + 10, y - 26 + 50 * rnd(i, 3), 7, 9, "#bfe8ff", 4); }
};
/** drips falling off a soaked soldier, 300 x 600 */
export const fxDrips = (p: Pen, t: number) => {
  for (let i = 0; i < 7; i++) { const x = 40 + rnd(i, 1) * 220, y = ((rnd(i, 2) + t * 1.5) % 1) * 560 + 20; p.ell(x, y, 9, 13, "#bfe8ff", 4); }
};
/** small sack of coins (the bounty), 300 x 300 */
export const fxCoins = (p: Pen) => {
  p.poly([[90, 120], [210, 120], [250, 250], [50, 250]], "#c9a46a", 10);
  p.stroke([[100, 120], [200, 120]], 12, "#7a5a3a");
  for (const [x, y] of [[90, 270], [150, 280], [210, 270]] as P2[]) p.ell(x, y, 34, 14, "#f2c94c", 7);
};
