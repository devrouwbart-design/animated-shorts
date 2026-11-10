// Shadow tax cast (sprite system from the bridge, lake and Apollo 13 shorts). Each frame every character asks for a
// drawing (a key + a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards
// shaded by cardShade(); world.ts gives each one a silhouette shadow on the ground (their own drawing laid flat, length
// from the sun's elevation), so here they only get a small contact blob (and on the overcast day a soft, faint smudge).
// Effects are unlit cards. Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines them.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxContact, fxBurst, fxBang, fxPuff, fxStars, SKINS, KID, Outfit, Expr, FrontOpts, SideOpts, INK } from "./toon";
import {
  FPS, V3, clamp01, SHOTS, smooth, lin, KING_AT, P_FARMER, P_COL3, P_KID, P_TALL, P_COL4, P_SOFT, P_CROWD, P_COL25, onSun, SN, SD,
  colWalk, gooseX, COIN_AT, BILL, torchAt, TOY,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import type { Light } from "./lights";
import { CHIMNEYS } from "./build";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number]; noShadow?: boolean; castReal?: boolean;
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
let LNAME: Light = "day";
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string; scale?: number };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};

/** contact blob under the feet; on the overcast day a wide, very soft smudge (the only shadow there is) */
const blob = (out: Stage, x: number, y: number, z: number, sc = 1) => {
  if (LNAME === "overcast") {
    out.fx.push({ key: "blob|soft|overcast", cw: 128, ch: 128, draw: (p) => fxContact(p, "#8a8ca4"), x, y: y + 0.02, z, w: 1.1 * sc, h: 0.85 * sc, flat: true });
    return;
  }
  const c = LNAME === "day" ? "#43455e" : "#4a4166";
  out.fx.push({ key: `blob|contact|${c}`, cw: 128, ch: 128, draw: (p) => fxContact(p, c), x, y: y + 0.022, z, w: 0.5 * sc, h: 0.38 * sc, flat: true });
};

const FRONT = { side: false, mirror: false };
const exprAt = (t: number, steps: [number, Expr][]): Expr => { let e = steps[0][1]; for (const [ts, x] of steps) if (t >= ts - LEAD) e = x; return e; };
const exF = (f: number, steps: [number, Expr][]) => exprAt(f / FPS, steps.map(([fr, e]) => [fr / FPS, e] as [number, Expr]));
const fx = (out: Stage, key: string, cw: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch: cw, draw, x, y, z, w, h: w, ...extra });
const burst = (out: Stage, f: number, f0: number, p: V3, s = 1.2, col = "#fff3b0") => {
  const u = (f - f0) / 13;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 30);
  fx(out, `burst${col}${uq}`, 500, (pn) => fxBurst(pn, uq, col), p[0], p[1], p[2], s);
};

// ---------------- our cast ----------------
const KING: Outfit = { jacket: "#6a3a8c", pants: "#3b2a4a", boots: "#3a2430", hat: "crown", cape: "#b3263a", moustache: "#7a4a2a", skin: SKINS[1], build: "stout", buttons: "#f2c230" };
const COLLECTOR: Outfit = { jacket: "#2f4a34", pants: "#3b3f52", boots: "#3a2a22", hat: "feathercap", skin: SKINS[2], buttons: "#c9a84a" };
const FARMER: Outfit = { jacket: "#5d7a3a", pants: "#6a4a2a", boots: "#4a3426", hat: "straw", skin: SKINS[3], moustache: "#3a2a20" };
const BAKER: Outfit = { jacket: "#d98c4a", pants: "#5a4a3a", boots: "#4a3426", hat: "chef", apron: "#fbf8f1", skin: SKINS[0], build: "stout" };
const TALL: Outfit = { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#2a2420", hat: "tophat", skin: SKINS[2] };
const KID1: Outfit = { ...KID, skin: SKINS[1] };
const KID2: Outfit = { ...KID, jacket: "#c25a7a", pants: "#3b3f52", hat: "hair", hair: "#c9763a", cap: undefined, skin: SKINS[0] };
const MAID = (v: number): Outfit => ({ jacket: ["#5a8fc2", "#8c3b4a", "#5d7a3a"][v % 3], pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: ["#d9a441", "#c25a7a", "#5a8fc2", "#7b5ac9"][v % 4], skin: SKINS[(v + 1) % 4] });
const MAN = (v: number): Outfit => ({ jacket: ["#8c3b4a", "#b5653f", "#2f5f6a", "#7b5ac9", "#5d7a3a"][v % 5], pants: ["#3b3f52", "#5a4a3a", "#4a5560"][v % 3], boots: "#4a3426",
  hat: v % 3 === 0 ? "cap" : "hair", cap: ["#3f6fb5", "#c0353a", "#5d7a3a"][v % 3], hair: ["#5a3b2a", "#2a201a", "#c9a46a", "#8a5a3c"][v % 4], skin: SKINS[v % 4], moustache: v % 4 === 1 ? "#3a2a20" : undefined });
const SCARVES = ["#c0353a", "#2f6a43", "#3f6fb5", "#d9a441", "#7b5ac9"];
let WINTER = false;
const dress = (o: Outfit, i: number): Outfit => (WINTER && !o.cape ? { ...o, scarf: SCARVES[i % 5] } : o);

/** one standing person (blinking, contact blob) */
const one = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, p: V3, fo: FrontOpts = {}, sc = 1, noShadow = false) => {
  const w: Who = { i, o: dress(o, i), okey: `w${i}${WINTER ? "s" : ""}` };
  const pl = person(cam, w, p[0], p[1], p[2], FRONT, { mode: "stand", blink: lidAt(t, i), ...fo }, {}, sc);
  pl.noShadow = noShadow;
  out.places.push(pl);
  blob(out, p[0], p[1], p[2], sc);
};
/** a walker seen side-on or front-on depending on the camera */
const walker = (out: Stage, cam: CamInfo, t: number, i: number, o: Outfit, p: V3, dx: number, dz: number, expr: Expr, speed = 1.1, sc = 1, extra: FrontOpts = {}) => {
  const v = viewOf(cam, p[0], p[2], dx, dz), phase = (t * speed * 0.9 + i * 0.37) % 1, blink = lidAt(t, i);
  const w: Who = { i, o: dress(o, i), okey: `w${i}${WINTER ? "s" : ""}` };
  out.places.push(person(cam, w, p[0], p[1], p[2], v, { mode: "stroll", phase, expr, blink, ...extra }, { mode: "march", phase, expr, blink, stride: 0.6 * Math.max(0.3, v.fs) }, sc));
  blob(out, p[0], p[1], p[2], sc);
};
const king = (out: Stage, cam: CamInfo, t: number, fo: FrontOpts, p: V3 = KING_AT) => one(out, cam, t, 1, KING, p, fo, 1.04);
const collector = (out: Stage, cam: CamInfo, t: number, p: V3, fo: FrontOpts) => one(out, cam, t, 2, COLLECTOR, p, fo, 1.02);
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** mouth flapping while someone talks */
const talk = (f: number, a: number, b: number, rest: Expr = "neutral"): Expr => (f >= a && f < b ? (Math.floor(f / 3) % 3 === 1 ? "whistle" : f % 7 < 3 ? "smile" : "neutral") : rest);

// ---------------- effect drawings ----------------
/** gold coin with a little crown, slightly tilted (400 x 400) */
const pCoin = (p: Pen) => {
  p.ell(200, 200, 150, 150, "#e8b830", 14); p.ell(200, 200, 112, 112, "#f6d45a", 8);
  p.poly([[140, 240], [140, 170], [170, 200], [200, 150], [230, 200], [260, 170], [260, 240]], "#c9961e", 8);
};
/** steam puff (fxPuff) and the anger mark (fxBang) are in toon.ts; question mark for "nothing" */
const pQuestion = (p: Pen) => {
  p.line([[140, 150], [150, 95], [200, 70], [255, 95], [262, 150], [215, 195], [205, 250]], "#fff3b0", 34);
  p.ell(205, 320, 24, 24, "#fff3b0", 10);
};
/** a light arrow (300 x 300) pointing right; the card is rotated in the world */
const pArrow = (p: Pen) => {
  p.poly([[30, 130], [190, 130], [190, 90], [280, 150], [190, 210], [190, 170], [30, 170]], "#ffe066", 10);
};
/** sunlight scattered by a cloud droplet (400 x 400): one ray comes in from the top and splits into five short rays
 *  fanning out in every downward and sideways direction; u 0..1 grows them */
const pScatter = (p: Pen, u: number) => {
  const cx = 200, cy = 150, L = 40 + 140 * u;
  p.line([[cx, 0], [cx, cy]], "#ffe066", 14);
  for (const a of [-170, -125, -90, -55, -10]) {
    const r = (-a * Math.PI) / 180, ex = cx + L * Math.cos(r), ey = cy + L * Math.sin(r);
    p.line([[cx, cy], [ex, ey]], "#ffe066", 12);
    p.poly([[ex + 22 * Math.cos(r), ey + 22 * Math.sin(r)], [ex + 16 * Math.cos(r + 1.9), ey + 16 * Math.sin(r + 1.9)], [ex + 16 * Math.cos(r - 1.9), ey + 16 * Math.sin(r - 1.9)]], "#ffe066", 6);
  }
  p.ell(cx, cy, 22, 22, "#fffbe0", 6);
};
/** the goose (in the 600 x 1000 character design space, feet at y 975): white body, orange beak and feet */
const pGoose = (p: Pen, phase: number) => {
  const step = Math.sin(phase * Math.PI * 2) * 14;
  p.stroke([[285, 900], [280 - step, 972]], 9, "#e8892c"); p.stroke([[325, 900], [330 + step, 972]], 9, "#e8892c");
  p.ell(280 - step, 972, 18, 7, "#e8892c", 6); p.ell(330 + step, 972, 18, 7, "#e8892c", 6);
  p.ell(300, 860, 105, 62, "#fbf8f1", 12);
  p.poly([[205, 850], [175, 815], [215, 830]], "#fbf8f1", 10);                       // tail
  p.line([[370, 835], [385, 760], [372, 700]], "#fbf8f1", 40);                        // neck
  p.ell(378, 690, 34, 30, "#fbf8f1", 12);                                             // head
  p.poly([[405, 682], [452, 694], [405, 705]], "#e8892c", 8);                         // beak
  p.dot(384, 682, 7, INK);
  p.ell(285, 855, 52, 26, "#e9e4d8", 0);                                              // wing
  p.arc(285, 855, 52, 26, 200, 340, 8);
};
/** torn bill halves (the morning): two halves flying apart, u 0..1 */
const pTorn = (p: Pen, u: number) => {
  const d = 60 * u, r = 0.4 * u;
  p.rot = [-r, 200, 200, -d, 0];
  p.poly([[110, 60], [200, 60], [185, 140], [205, 220], [190, 340], [110, 340]], "#f6efd9", 10);
  p.rot = [r, 200, 200, d, 0];
  p.poly([[200, 60], [290, 60], [290, 340], [190, 340], [205, 220], [185, 140]], "#f6efd9", 10);
  p.rot = null;
};
/** a hand holding a torch handle, seen from the side (400 x 400) */
const pHand = (p: Pen) => {
  p.poly([[0, 250], [140, 210], [170, 270], [20, 330]], "#3f6fb5", 10);              // sleeve
  p.ell(210, 235, 70, 58, "#ffe2c2", 10);                                             // fist
  for (const y of [205, 232, 259]) p.arc(232, y, 30, 12, 300, 420, 6);               // knuckles
};


// ---------------- life: smoke, birds, chickens, people going about their day ----------------
/** chimney smoke puff (400 x 400): soft lumps that grow and thin out, u 0..1 */
const pSmoke = (p: Pen, u: number, a0: number) => {
  for (const [x, y, rr] of [[200, 230, 90], [140, 250, 64], [262, 248, 70], [196, 168, 66]] as const)
    p.ell(x, y, rr * (0.7 + 0.5 * u), rr * (0.62 + 0.45 * u), `rgba(236,236,242,${(a0 * (1 - u) ** 1.2).toFixed(3)})`, 0);
};
/** a bird in flight (200 x 120): two wing arcs, flap 0..1 */
const pBird = (p: Pen, flap: number) => {
  const up = 40 - 70 * flap;
  p.stroke([[20, 60 + up * 0.6], [60, 60 - up * 0.2], [100, 70]], 12, "#3a3348");
  p.stroke([[100, 70], [140, 60 - up * 0.2], [180, 60 + up * 0.6]], 12, "#3a3348");
  p.dot(100, 72, 9, "#3a3348");
};
/** a chicken in the character design space (600 x 1000, feet at 975), peck 0..1 */
const pChicken = (p: Pen, peck: number) => {
  const hy = 800 + 80 * peck, hx = 372 + 22 * peck;
  p.stroke([[288, 900], [282, 972]], 8, "#e8892c"); p.stroke([[318, 900], [324, 972]], 8, "#e8892c");
  p.poly([[214, 880], [190, 830], [236, 852]], "#c0503a", 9);                         // tail
  p.ell(300, 880, 82, 58, "#fbf3e2", 11);                                              // body
  p.line([[350, 860], hx < 380 ? [360, 830] : [372, 845], [hx, hy]], "#fbf3e2", 34);    // neck
  p.ell(hx, hy, 28, 26, "#fbf3e2", 10);                                                // head
  p.poly([[hx - 8, hy - 30], [hx + 2, hy - 46], [hx + 12, hy - 30]], "#e8403a", 6);     // comb
  p.poly([[hx + 24, hy - 4], [hx + 48, hy + 4], [hx + 24, hy + 10]], "#f2b234", 6);     // beak
  p.dot(hx + 8, hy - 6, 6, INK);
  p.ell(285, 878, 40, 22, "#ece2cc", 0); p.arc(285, 878, 40, 22, 200, 340, 7);         // wing
};
const BG_PATHS: [V3, V3][] = [[[-17, 0, -15.0], [17, 0, -15.0]], [[20.6, 0, -13], [20.6, 0, 12]], [[-13, 0, 13.5], [15, 0, 13.5]], [[-19, 0, -9], [-19, 0, 9]]];
const life = (out: Stage, cam: CamInfo, t: number, id: number) => {
  const f = t * FPS, s = SHOTS[id - 1];
  if (s.set !== "town") return;
  // chimney smoke: the closest chimneys in front of the lens, thicker on cold winter days
  const fwd = new THREE.Vector3(0, 1, 0).cross(cam.right).normalize(), a0 = s.winter ? 0.85 : s.light === "overcast" ? 0.55 : 0.45;
  const near = CHIMNEYS.map((c) => ({ c, d: c.distanceTo(cam.pos), ok: c.clone().sub(cam.pos).dot(fwd) > 0 })).filter((x) => x.ok && x.d < 160).sort((a, b) => a.d - b.d).slice(0, 12);
  near.forEach(({ c }, k) => {
    for (let j = 0; j < 4; j++) {
      const u = (((f / 90 + j / 4 + k * 0.137) % 1) + 1) % 1, uq = q(u, 24);
      out.fx.push({ key: `smoke${a0}|${uq}`, cw: 400, ch: 400, draw: (pn) => pSmoke(pn, uq, a0), x: c.x + 1.8 * u, y: c.y + 0.4 + 4.5 * u, z: c.z - 1.0 * u, w: 1.1 + 2.4 * u, h: 1.1 + 2.4 * u, soft: true });
    }
  });
  // birds circling over the town (not on the overcast day)
  if (s.light !== "overcast") for (let k = 0; k < 9; k++) {
    const dir = k % 2 ? 1 : -1, a = dir * f * 0.004 + k * 0.7, rr = 34 + k * 7, cx = k < 5 ? 0 : CASTLE_X * 0.5, cz = k < 5 ? 0 : CASTLE_Z * 0.5;
    const flap = q(0.5 + 0.5 * Math.sin(f * 0.45 + k * 1.3), 6);
    fx(out, `bird${flap}`, 200, (pn) => pBird(pn, flap), cx + Math.cos(a) * rr, 22 + (k % 4) * 4 + Math.sin(f * 0.03 + k) * 1.5, cz + Math.sin(a) * rr, 1.0, { h: 0.6, ch: 120 });
  }
  if (s.winter || s.light === "golden") return;
  // chickens pecking by the stalls and the cart
  ([[9.4, -10.8], [10.7, -10.1], [-9.3, -11.2], [17.2, -3.6]] as const).forEach(([x, z], k) => {
    const peck = q(Math.max(0, Math.sin(f * 0.22 + k * 1.9)) ** 3, 4);
    out.places.push({ key: `chick${peck}`, x, y: 0, z, scale: 1, mirror: k % 2 === 1, size: [480, 800, 0.8], draw: (pn) => pChicken(pn, peck) });
    blob(out, x, 0, z, 0.5);
  });
  // townsfolk going about their day along the edges of the square (not in the shots the story crowds)
  if ([2, 3, 4, 5, 15, 16, 17, 18, 19, 28].includes(id)) BG_PATHS.forEach(([a, b], k) => {
    for (const j of [0, 1]) {
      const L = Math.hypot(b[0] - a[0], b[2] - a[2]), ph = ((t * 1.05 + k * 7 + j * L * 0.9) % (2 * L) + 2 * L) % (2 * L), back = ph > L, u = back ? 2 - ph / L : ph / L;
      const pos: V3 = [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u], dx = (b[0] - a[0]) / L * (back ? -1 : 1), dz = (b[2] - a[2]) / L * (back ? -1 : 1);
      const o = [MAN(k + 2 * j), MAID(k + j), MAN(k + 5), MAID(k + 3)][(k + j) % 4];
      walker(out, cam, t, 40 + k * 2 + j, o, pos, dx, dz, (k + j) % 3 ? "smile" : "neutral", 1.0, 1, (k + j) % 3 === 0 ? { prop: "icecream" } : {});
    }
  });
};
const CASTLE_X = -116.1, CASTLE_Z = 78.3;

/** everything with a face (and the 2D effects) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = t * FPS;
  LNAME = s.light; WINTER = !!s.winter;
  SUN.copy(cam.sun).normalize();

  // ---------------- day ----------------
  if (id === 1) {
    king(out, cam, t, { expr: exF(f, [[0, "grin"], [40, "laugh"]]), hold: true });
    collector(out, cam, t, [2.3, 0, -10.4], { prop: "ledger", expr: "stern" });
    const folk: [Outfit, V3][] = [[FARMER, [-6, 0, -2]], [BAKER, [4, 0, 2]], [MAID(0), [-2, 0, 5]], [MAN(1), [8, 0, -3]], [KID1, [-9, 0, 6]], [MAID(1), [3, 0, 8]],
      [MAN(2), [-12, 0, -6]], [TALL, [10, 0, 6]], [MAN(3), [-4, 0, 10]], [MAID(2), [14, 0, 0]]];
    folk.forEach(([o, p], k) => walker(out, cam, t, 10 + k, o, p, Math.cos(k * 2.1), Math.sin(k * 2.1), "neutral"));
  }
  if (id === 2 || id === 3) {
    one(out, cam, t, 3, FARMER, P_FARMER, { expr: id === 2 ? exF(f, [[60, "neutral"], [COIN_AT + 2, "shock"]]) : exF(f, [[103, "nervous"], [170, "dazed"]]), look: id === 3 ? 1 : 0 });
    if (id === 2) {
      const u = clamp01((f - (COIN_AT - 14)) / 14), mid = add(P_FARMER, [0.475 * -1, 0, -0.82]);
      if (f >= COIN_AT - 14) fx(out, "coin", 400, pCoin, mid[0], 0.15 + 2.6 * (1 - u * u) + (f > COIN_AT ? 0.12 * Math.abs(Math.sin((f - COIN_AT) * 0.5)) * Math.exp(-(f - COIN_AT) / 6) : 0), mid[2], 0.32);
      burst(out, f, COIN_AT, [mid[0], 0.2, mid[2]], 0.9);
    }
    if (id === 3) {
      const walkIn = clamp01((f - 106) / 22), p = mixV(add(P_COL3, [3, 0, -1]), P_COL3, smooth(walkIn));
      if (walkIn < 1) walker(out, cam, t, 2, COLLECTOR, p, -1, 0.3, "stern", 1.2, 1.02, { prop: "rod" });
      else collector(out, cam, t, P_COL3, f < 166 ? { prop: "rod", expr: "stern" } : { prop: "ledger", expr: exF(f, [[166, "stern"], [182, "grin"]]), look: -1 });
    }
  }
  if (id === 4) {
    one(out, cam, t, 5, KID1, P_KID, { expr: exF(f, [[196, "smile"], [230, "grin"]]) });
    one(out, cam, t, 9, TALL, P_TALL, { expr: exF(f, [[196, "neutral"], [242, "shock"]]), ...(f >= 238 ? { prop: ["scroll", 0.55] as ["scroll", number] } : {}) }, 1.14);
    collector(out, cam, t, P_COL4, { prop: f >= 238 ? null : "ledger", expr: talk(f, 199, 250, "stern") });
    if (f >= 222) fx(out, "slip", 300, (p) => { p.poly([[120, 100], [180, 100], [180, 180], [120, 180]], "#f6efd9", 8); p.dot(165, 165, 9, "#c8323a"); }, P_KID[0] + cam.right.x * 0.3, 0.75, P_KID[2] + cam.right.z * 0.3, 0.22);
  }
  if (id === 5) {
    const c: V3 = [-5.6, 0, 3.6];
    ([[FARMER, [-0.9, 0, 0.3]], [BAKER, [0.9, 0, 0.2]], [MAID(0), [0, 0, -0.7]], [KID2, [-0.4, 0, 0.9]], [MAN(1), [0.6, 0, -0.9]]] as [Outfit, V3][]).forEach(([o, d], k) =>
      one(out, cam, t, 3 + k * 2, o, add(c, d), { expr: exF(f, [[257, "neutral"], [268 + k * 3, "grin"]]), look: d[0] > 0 ? -1 : 1 }));
    if (f > 275) burst(out, f, 277, add(c, [0, 2.4, 0]), 1.0, "#fff3b0");
  }

  // ---------------- noon ----------------
  if (id >= 6 && id <= 9) {
    if (id !== 9) {
      collector(out, cam, t, [0.8, 0, -9.4], id === 8 ? { prop: ["scroll", 0.0], expr: exF(f, [[418, "stern"], [436, "nervous"]]) } : { prop: "ledger", expr: "stern" });
      const q2: [Outfit, number][] = [[BAKER, 4], [FARMER, 3], [MAID(0), 7], [KID1, 5], [MAN(2), 12], [MAID(1), 8], [TALL, 9], [MAN(3), 13]];
      q2.forEach(([o, i], k) => one(out, cam, t, i, o, [0.15 * Math.sin(k * 1.7), 0, -7.9 + k * 1.15], { expr: id === 8 && k === 0 ? exF(f, [[418, "smile"], [430, "laugh"]]) : k % 3 === 0 ? "smile" : "grin" }, o === TALL ? 1.14 : 1));
    }
    if (id === 9) {
      king(out, cam, t, { expr: exF(f, [[444, "stern"], [460, "shock"], [466, "stern"]]), prop: f >= 458 ? "fists" : undefined, ...(f >= 458 ? {} : { hold: true }) });
      if (f >= 462) { const u = q(((f - 462) / 14) % 1, 14); for (const sx of [-1, 1]) { const o = sx * (0.34 + 0.18 * u); fx(out, `puff${u}`, 300, (p) => fxPuff(p, u), KING_AT[0] + cam.right.x * o, KING_AT[1] + 1.85 + 0.35 * u, KING_AT[2] + cam.right.z * o, 0.42); } }
      if (f >= 462 && f < 484) fx(out, "bang", 500, (p) => fxBang(p, "#ff5a4a"), KING_AT[0] + cam.right.x * 0.5, KING_AT[1] + 2.35, KING_AT[2] + cam.right.z * 0.5, 0.42);
    }
  }
  if (id === 10) {
    king(out, cam, t, { expr: exF(f, [[488, "stern"], [508, "grin"]]), prop: ["scroll", 0.3] });
    if (f >= 509 && f < 524) fx(out, "bang2", 500, (p) => fxBang(p, "#ffd23f"), KING_AT[0] + cam.right.x * 0.7, KING_AT[1] + 1.6, KING_AT[2] + cam.right.z * 0.7, 0.4);
  }

  // ---------------- winter evening ----------------
  if (id === 11 || id === 14) {
    collector(out, cam, t, [0.8, 0, -9.4], id === 14 ? { prop: ["scroll", lin([[832, 0.1], [BILL.huge, 1]], f)], expr: "grin" } : { prop: "ledger", expr: "stern" });
    const q3: [Outfit, number, V3][] = [[FARMER, 3, [-0.2, 0, -7.8]], [BAKER, 4, [0.3, 0, -6.4]], [MAID(0), 7, [-0.4, 0, -5.0]], [KID1, 5, [0.1, 0, -3.7]], [MAN(2), 12, [-0.3, 0, -2.4]],
      [MAID(1), 8, [0.4, 0, -1.0]], [TALL, 9, [-0.1, 0, 0.5]], [MAN(3), 13, [0.3, 0, 1.9]], [KID2, 6, [-3.5, 0, 3.0]], [MAID(2), 14, [3.2, 0, 4.2]]];
    q3.forEach(([o, i, p], k) => one(out, cam, t, i, o, p, { expr: id === 14 ? (k === 0 ? exF(f, [[832, "nervous"], [BILL.huge, "shock"]]) : exF(f, [[832, "nervous"], [BILL.huge + 2 + k, "shock"]])) : exF(f, [[528, "nervous"], [600 + 5 * k, "dazed"]]) }, o === TALL ? 1.14 : 1));
  }

  // ---------------- table: hand holding the torch ----------------
  if (id === 12 || id === 13) {
    const tp = torchAt(id, f), base: V3 = [TOY[0] + tp[0], TOY[1] + tp[1], TOY[2] + tp[2]];
    const dir = new THREE.Vector3(-tp[0], 0.06 - tp[1], -tp[2]).normalize();                   // torch axis (lens end)
    const back: V3 = [base[0] - dir.x * 0.12, base[1] - dir.y * 0.12, base[2] - dir.z * 0.12];  // handle end
    const rot = Math.atan2(dir.y, dir.dot(cam.right));                                          // the fist's knuckles point along the torch
    fx(out, `hand${q(rot, 20)}`, 400, pHand, back[0] - dir.x * 0.02, back[1] - dir.y * 0.02, back[2] - dir.z * 0.02, 0.15, { rot: q(rot, 20) });
    // the toy: a cardboard cut-out of the king on a little wooden stand; it casts a REAL shadow from the torch
    out.places.push({ ...person(cam, { i: 1, o: KING, okey: "toy" }, TOY[0], TOY[1] + 0.012, TOY[2], FRONT, { mode: "stand", expr: "grin" }, {}, 0.075), noShadow: true, castReal: true });
  }

  // ---------------- overcast ----------------
  if (id === 15) {
    const c: V3 = [-2.6, 0, 2.0];
    ([[FARMER, [-1.0, 0, 0.2]], [BAKER, [0.9, 0, 0.0]], [MAID(0), [0.0, 0, -0.9]], [KID1, [-0.3, 0, 1.0]], [MAN(1), [1.4, 0, -1.2]], [KID2, [0.6, 0, 1.2]]] as [Outfit, V3][]).forEach(([o, d], k) =>
      one(out, cam, t, 3 + k * 2, o, add(c, d), { expr: exF(f, [[862, "neutral"], [900 + 2 * k, "grin"], [915, "laugh"]]), headTilt: -6, look: d[0] > 0 ? -1 : 1 }));
  }
  if (id === 16) { // light bouncing through the cloud deck
    for (let k = 0; k < 5; k++) {
      const f0 = 945 + k * 9, u = clamp01((f - f0) / 26);
      if (f < f0) continue;
      const uq = q(u, 26);
      fx(out, `scatter${uq}`, 400, (p) => pScatter(p, uq), -24 + k * 13, 96 - (k % 2) * 10, -52 - k * 4, 16);
    }
  }
  if (id === 17 || id === 18 || id === 19) {
    one(out, cam, t, 7, MAID(0), P_SOFT, { expr: id === 19 ? "grin" : id === 18 ? exF(f, [[1062, "smile"], [1120, "grin"]]) : "smile", look: id === 18 ? -1 : 0 });
    if (id === 17) { // light arriving from every direction of the sky
      const up = new THREE.Vector3(0, 1, 0), head = new THREE.Vector3(P_SOFT[0], 1.6, P_SOFT[2]);
      for (let k = 0; k < 9; k++) {
        const a = (-70 + k * 17.5) * (Math.PI / 180), f0 = 1012 + (k * 5) % 23, u = (((f - f0) / 26) % 1 + 1) % 1;
        if (f < f0) continue;
        const r = 2.6 - 1.7 * u, pos = head.clone().addScaledVector(cam.right, Math.sin(a) * r).addScaledVector(up, Math.cos(a) * r * 0.9);
        const rot = Math.atan2(-Math.cos(a), -Math.sin(a));
        fx(out, `arrow${q(rot, 20)}`, 300, pArrow, pos.x, pos.y, pos.z, 0.42, { rot: q(rot, 20) });
      }
    }
    if (id === 18 || id === 19) {
      const cp: V3 = id === 18 ? [P_SOFT[0] - 1.3, 0, P_SOFT[2] + 0.5] : [P_SOFT[0] - 1.1, 0, P_SOFT[2] + 0.2];
      collector(out, cam, t, cp, id === 18 ? { prop: "ledger", expr: exF(f, [[1062, "stern"], [1100, "nervous"], [1125, "dazed"]]), look: 1 }
        : { expr: exF(f, [[1148, "dazed"], [1166, "nervous"]]), shrug: smooth((f - 1166) / 8) });
      if (id === 19 && f >= 1170) fx(out, "question", 400, pQuestion, cp[0] + cam.right.x * 0.45, 2.25 + 0.04 * Math.sin(f * 0.3), cp[2] + cam.right.z * 0.45, 0.42);
      if (id === 19) { one(out, cam, t, 3, FARMER, [P_SOFT[0] + 1.4, 0, P_SOFT[2] - 1.6], { expr: "laugh" }); one(out, cam, t, 4, BAKER, [P_SOFT[0] - 2.8, 0, P_SOFT[2] - 1.9], { expr: "grin" }); }
    }
  }

  // ---------------- winter sunset ----------------
  if (id === 20) {
    king(out, cam, t, { expr: exF(f, [[1188, "grin"], [1250, "laugh"]]), hold: true });
    collector(out, cam, t, [2.3, 0, -10.4], { prop: "ledger", expr: "stern" });
  }
  const crowd: [Outfit, number, number, number][] = [ // outfit, index, d (along the shadow), n (across it)
    [FARMER, 3, -1.2, 0.3], [BAKER, 4, 0.6, 0.6], [MAID(0), 7, -0.2, -1.0], [KID1, 5, 1.4, -0.6], [MAN(2), 12, -2.2, -0.5], [MAID(1), 8, 2.2, 0.2],
    [TALL, 9, -0.8, -2.0], [MAN(3), 13, 0.9, -1.9], [KID2, 6, -1.8, 1.3], [MAID(2), 14, 2.0, -1.5], [MAN(1), 11, 0.1, 1.5], [MAN(4), 15, -2.8, 1.0]];
  const cp = (d: number, n: number): V3 => add(P_CROWD, onSun(d, n));
  if (id === 21) crowd.slice(0, 6).forEach(([o, i, d, n], k) => one(out, cam, t, i, o, cp(d, n), { expr: exF(f, [[1286, "neutral"], [1290 + k, "nervous"]]), look: k % 2 ? -1 : 1 }, o === TALL ? 1.14 : 1));
  if (id === 22) crowd.forEach(([o, i, d, n], k) => { // they hurry in from the sunny side
    const u = smooth((f - 1312 - 3 * k) / 46), p = mixV(cp(d - 3 + k * 0.4, n + 9 + (k % 3) * 2), cp(d, n), u);
    if (u < 1) walker(out, cam, t, i, o, p, -SN[0], -SN[1], "nervous", 1.6, o === TALL ? 1.14 : 1);
    else one(out, cam, t, i, o, p, { expr: "grin" }, o === TALL ? 1.14 : 1);
  });
  if (id === 23 || id === 24) {
    crowd.forEach(([o, i, d, n], k) => one(out, cam, t, i, o, cp(d, n), { expr: id === 24 ? exF(f, [[1520, "grin"], [1531 + k, "laugh"]]) : exF(f, [[1408, "smile"], [1452, "shock"], [1488, "grin"]]),
      ...(id === 24 && k % 3 === 0 ? { wave: smooth((f - 1533) / 6) } : {}) }, o === TALL ? 1.14 : 1));
    if (id === 23) { // the goose steps into the sun (its shadow appears) and a kid pulls it back
      const gx = gooseX(f), g = cp(3.3, 0.6 + gx), phase = (f / 9) % 1;
      out.places.push({ key: `goose${q(phase, 4)}`, x: g[0], y: 0, z: g[2], scale: 1.5, mirror: f > 1468, size: [1080, 1800, 1.8], draw: (p) => pGoose(p, q(phase, 4)) });
      blob(out, g[0], 0, g[2], 0.9);
    }
    if (id === 24) {
      collector(out, cam, t, cp(1.5, 3.2), { prop: "ledger", expr: exF(f, [[1520, "nervous"], [1531, "dazed"]]) });
      burst(out, f, 1531, add(cp(1.5, 3.2), [0, 2.6, 0]), 1.0, "#ffffff");
    }
  }
  if (id === 25) {
    collector(out, cam, t, P_COL25, { prop: "rod", expr: exF(f, [[1547, "stern"], [1573, "smile_closed"]]) });
    crowd.slice(0, 4).forEach(([o, i, d, n]) => one(out, cam, t, i, o, cp(d, n), { expr: "grin" }));
  }
  if (id === 26) {
    const c = colWalk(f);
    if (f < 1672) walker(out, cam, t, 2, COLLECTOR, c, -SD[0], -SD[1], "stern", 1.8, 1.02, { prop: "rod" });
    else collector(out, cam, t, c, { prop: "rod", expr: "stern" });
  }
  if (id === 27) {
    king(out, cam, t, { expr: exF(f, [[1675, "grin"], [1700, "shock"]]), ...(f >= 1696 ? { prop: ["scroll", 1] as ["scroll", number] } : { hold: true }) });
    if (f < 1696) collector(out, cam, t, [1.0, 0, -10.7], { prop: ["scroll", 1], expr: "smile_closed" });
    else collector(out, cam, t, [1.15, 0, -10.6], { expr: "smile_closed", wave: 0.5 });
  }

  // ---------------- morning ----------------
  if (id === 28) {
    const dance = (k: number) => 0.5 + 0.5 * Math.sin(f * 0.35 + k);
    king(out, cam, t, { expr: exF(f, [[1714, "pained"], [1742, "relief"]]), shrug: smooth((f - 1742) / 8) });
    if (f >= 1734) { const u = clamp01((f - 1734) / 20), uq = q(u, 20); fx(out, `torn${uq}`, 400, (p) => pTorn(p, uq), KING_AT[0] + cam.right.x * 0.9, KING_AT[1] + 1.4 - 0.9 * u, KING_AT[2] + cam.right.z * 0.9, 0.8); }
    crowd.slice(0, 9).forEach(([o, i], k) => {
      const p: V3 = [-6 + (k % 3) * 3.2 + Math.sin(k) * 0.6, 0, -4 + Math.floor(k / 3) * 3.0];
      one(out, cam, t, i, o, p, { expr: k % 2 ? "laugh" : "grin", wave: dance(k), headTilt: 6 * Math.sin(f * 0.3 + k) }, o === TALL ? 1.14 : 1);
    });
  }
  life(out, cam, t, id);
  void bodySide; void fxStars; void SD;
  return out;
};
