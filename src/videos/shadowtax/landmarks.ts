// Landmarks rebuilt as real objects (shadow tax, round 3): the flagstone path from the square up the hill to the castle
// gate, the square's fountain (stone basin, column, upper bowl, arcs of water) and the windmill (tower, cap, turning
// sails). The Kenney pieces they replace were partial (the windmill model is only its sails, the fountain only a basin).
import * as THREE from "three";
import { Batch, V, lam } from "./build";
import { ctex, stoneHD } from "./paint";
import { twoTone } from "./shade";
import { CASTLE, CASTLE_AZ } from "./story";

const M4 = (x: number, y: number, z: number, yaw = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(...s));

/** ground height of the castle hill (the dome r 46 / h 4.2 and its skirt r 72 / h 1.9, see world.ts + country.ts) */
export const hillY = (x: number, z: number) => {
  const d = Math.hypot(x - CASTLE[0], z - CASTLE[2]);
  const dome = d < 46 ? -0.2 + 4.2 * Math.sqrt(1 - (d / 46) ** 2) : -1;
  const skirt = d < 72 ? -0.3 + 1.9 * Math.sqrt(1 - (d / 72) ** 2) : -1;
  return Math.max(0, dome, skirt);
};

// ---------------- the castle path ----------------
const flagTex = (snow: boolean) => ctex(snow ? "flagstoneSnow" : "flagstone", 1024, 1024, (g, r) => {
  g.fillStyle = snow ? "#e8eef6" : "#8f8577"; g.fillRect(0, 0, 1024, 1024);       // joints (snow sits in them in winter)
  for (let row = 0, y = 0; y < 1024; row++) {
    const h = 90 + r() * 70;
    for (let x = -r() * 120; x < 1024;) {
      const w = 110 + r() * 120, c = ["#cfc6b4", "#c2b8a5", "#d8d0bf", "#b9ae9a", "#c9bfab"][Math.floor(r() * 5)];
      g.fillStyle = c; g.beginPath(); g.roundRect(x + 6, y + 6, w - 12, h - 12, 14); g.fill();
      g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x + 12, y + 10, w - 30, 6);
      if (snow) { g.fillStyle = "rgba(240,246,255,0.55)"; g.beginPath(); g.ellipse(x + w * (0.3 + r() * 0.4), y + h * 0.5, w * 0.3, h * 0.25, r(), 0, 7); g.fill(); }
      x += w;
    }
    y += h;
  }
});
export type PathSwap = { m: THREE.MeshLambertMaterial; winter: THREE.Texture };
/** flagstone path from the square's south-west corner straight up the hill to the gate, following the ground,
 *  edged with low kerb stones; returns its material so winter can swap in the snow-dusted stones */
export const buildCastlePath = (b: Batch): PathSwap => {
  const m = lam("castlePath_po6", () => ({ map: flagTex(false), polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 }));
  const kerb = lam("kerbStone", () => ({ map: stoneHD("kerbHD", ["#d6cdbd", "#cbc1b0", "#ddd5c6", "#c4b9a6"], "#9c907e") }));
  const L = Math.hypot(CASTLE[0], CASTLE[2]), ux = CASTLE[0] / L, uz = CASTLE[2] / L, nx = -uz, nz = ux, W = 2.3;
  const t0 = 18, t1 = L - 14.5, step = 1.5;
  const pos: number[] = [], uv: number[] = [];
  for (let t = t0; t < t1; t += step) {
    const ta = t, tb = Math.min(t1, t + step);
    const P = (tt: number, s: number) => { const x = ux * tt + nx * W * s, z = uz * tt + nz * W * s; return [x, hillY(x, z) + 0.1, z]; };
    const a0 = P(ta, -1), a1 = P(ta, 1), b1 = P(tb, 1), b0 = P(tb, -1);
    pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    const va = ta / 4, vb = tb / 4;
    uv.push(0, va, 1.15, va, 1.15, vb, 0, va, 1.15, vb, 0, vb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  b.add(g, m);
  // one continuous low kerb on each side (top + outer face), following the ground
  for (const sd of [-1, 1]) {
    const kp: number[] = [], ku: number[] = [];
    for (let t = t0; t < t1; t += step) {
      const tb = Math.min(t1, t + step);
      const Q = (tt: number, off: number, up: number) => { const x = ux * tt + nx * off * sd, z = uz * tt + nz * off * sd; return [x, hillY(x, z) + 0.1 + up, z]; };
      const i0 = Q(t, W, 0.16), o0 = Q(t, W + 0.4, 0.16), i1 = Q(tb, W, 0.16), o1 = Q(tb, W + 0.4, 0.16), g0 = Q(t, W + 0.4, -0.12), g1 = Q(tb, W + 0.4, -0.12);
      kp.push(...i0, ...o0, ...o1, ...i0, ...o1, ...i1, ...o0, ...g0, ...g1, ...o0, ...g1, ...o1);
      const va = t / 2, vb = tb / 2;
      ku.push(0, va, 0.2, va, 0.2, vb, 0, va, 0.2, vb, 0, vb, 0, va, 0.15, va, 0.15, vb, 0, va, 0.15, vb, 0, vb);
    }
    const kg = new THREE.BufferGeometry();
    kg.setAttribute("position", new THREE.Float32BufferAttribute(kp, 3)); kg.setAttribute("uv", new THREE.Float32BufferAttribute(ku, 2));
    kg.computeVertexNormals(); b.add(kg, kerb);
  }
  return { m, winter: flagTex(true) };
};

// ---------------- the fountain ----------------
const waterTex = () => ctex("fountainWater", 512, 512, (g, r) => {
  g.fillStyle = "#43b8f5"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 6;
  for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(256, 256, 30 + i * 18 + r() * 6, r() * 6, r() * 6 + 1.6); g.stroke(); }
});
const lathe = (pts: [number, number][], seg = 40) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
/** a tiered stone fountain at (x, z): basin with a rim, column, upper bowl, finial, and arcs of water */
export const buildFountain = (b: Batch, x: number, z: number) => {
  const stone = lam("fountainStone", () => ({ map: stoneHD("fountainHD", ["#e6dfd2", "#d9d1c2", "#ece6da", "#d2c9b8"], "#a99f8f") }));
  const water = twoTone(new THREE.MeshLambertMaterial({ map: waterTex(), color: "#ffffff" }));
  const jet = twoTone(new THREE.MeshLambertMaterial({ color: "#b8ecff" }));
  // basin: thick round wall with a lip, water inside
  b.add(lathe([[2.55, 0], [3.05, 0], [3.1, 0.62], [3.25, 0.66], [3.25, 0.78], [2.55, 0.78], [2.55, 0.05]]), stone, M4(x, 0, z));
  b.add(new THREE.CircleGeometry(2.56, 40).rotateX(-Math.PI / 2), water, M4(x, 0.58, z));
  // column, upper bowl, its water, finial
  b.add(lathe([[0.55, 0.5], [0.38, 0.8], [0.3, 1.6], [0.42, 1.75], [0.01, 1.75]]), stone, M4(x, 0, z));
  b.add(lathe([[0.3, 1.7], [1.2, 1.95], [1.32, 2.15], [1.15, 2.15], [0.4, 2.0], [0.01, 2.0]]), stone, M4(x, 0, z));
  b.add(new THREE.CircleGeometry(1.14, 32).rotateX(-Math.PI / 2), water, M4(x, 2.08, z));
  b.add(lathe([[0.18, 2.0], [0.12, 2.6], [0.2, 2.75], [0.01, 2.9]], 16), stone, M4(x, 0, z));
  b.add(new THREE.SphereGeometry(0.16, 14, 10).translate(0, 2.95, 0), stone, M4(x, 0, z));
  // water: arcs from the upper bowl's rim down into the basin, and a small jet from the top
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, rr = 1.3 + 1.0 * u, y = 2.12 + 0.35 * u - 1.95 * u * u; pts.push(V(x + c * rr, y, z + s * rr)); }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.06, 6, false), jet);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4, c = Math.cos(a), s = Math.sin(a), pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10, rr = 0.85 * u, y = 2.95 + 0.6 * u - 1.4 * u * u; pts.push(V(x + c * rr, y, z + s * rr)); }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.045, 6, false), jet);
  }
};

// ---------------- the windmill ----------------
const sailTex = () => ctex("windmillSail", 128, 512, (g) => {
  g.fillStyle = "#f6f0e2"; g.fillRect(0, 0, 128, 512);
  g.strokeStyle = "#7a4f33"; g.lineWidth = 8;
  for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  for (const x of [4, 64, 124]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
});
/** a white tower mill on a little mound at (x, z), facing yaw; returns the sail group (world.ts turns it) */
export const buildWindmill = (b: Batch, parent: THREE.Object3D, x: number, z: number, yaw: number) => {
  const plaster = lam("millPlaster", () => ({ color: "#fbf3e2" })), cap = lam("roof#d9533c", () => ({ color: "#d9533c" }));
  const wood = lam("millWood", () => ({ color: "#7a4f33" })), mound = lam("millMound", () => ({ color: "#4aa83a" }));
  b.add(new THREE.SphereGeometry(1, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), mound, M4(x, -0.2, z, 0, [22, 3.2, 22]));
  b.add(new THREE.CylinderGeometry(2.7, 4.2, 14, 20).translate(0, 7 + 2.8, 0), plaster, M4(x, 0, z));
  b.add(new THREE.ConeGeometry(3.4, 4.2, 20).translate(0, 14 + 2.8 + 2.1, 0), cap, M4(x, 0, z));
  for (const [hy, a] of [[6, 0], [10, 0.9], [6, 2.4]] as const) // little windows and a door
    b.add(new THREE.BoxGeometry(0.8, 1.1, 0.2).translate(Math.sin(a) * 3.7, hy, Math.cos(a) * 3.7), lam("millWin", () => ({ color: "#3a4a8a" })), M4(x, 0, z, yaw));
  b.add(new THREE.BoxGeometry(1.4, 2.2, 0.25).translate(0, 3.9, 4.05), wood, M4(x, 0, z, yaw));
  const hub = new THREE.Group();
  hub.position.set(x + Math.sin(yaw) * 3.4, 15.4, z + Math.cos(yaw) * 3.4);
  hub.rotation.y = yaw;
  const sails = new THREE.Group();
  const sm = twoTone(new THREE.MeshLambertMaterial({ map: sailTex(), side: THREE.DoubleSide }));
  const wm = twoTone(new THREE.MeshLambertMaterial({ color: "#7a4f33" }));
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10, 0.25).translate(0, 5, 0), wm); spar.castShadow = true;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8).translate(1.25, 5.6, 0.05), sm); sail.castShadow = true;
    arm.add(spar, sail); sails.add(arm);
  }
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12).rotateX(Math.PI / 2), wm);
  sails.add(boss);
  hub.add(sails); parent.add(hub);
  void CASTLE_AZ;
  return sails;
};
