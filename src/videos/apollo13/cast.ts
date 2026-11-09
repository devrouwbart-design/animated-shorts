// Apollo 13 cast (sprite system from the bridge and lake shorts). Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, fxBurst, fxSplash, fxCreak, fxBang, fxStars, fxRing, SKINS, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { FPS, V3, clamp01, SHOTS, smooth, lin, cab, mcc, hot, sea, HOLE, HOLDER, MAILBOX, SOCKET, RAFT, SPLASH, capY, pushAt } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

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
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
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
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};


export type Stage = { places: Place[]; fx: FxPlace[] };
const who = (o: Outfit, i: number, okey: string): Who => ({ i, o, okey });
const FRONT = { side: false, mirror: false };
const L2 = LEAD;

/** a front-facing person (stand / sit / fall / stroll), blinking, optional ground blob */
const one = (out: Stage, cam: CamInfo, t: number, w: Who, x: number, y: number, z: number, fo: FrontOpts, ground = true, scale = 1) => {
  const blink = lidAt(t, w.i);
  out.places.push(person(cam, w, x, y, z, FRONT, { mode: "stand", blink, ...fo }, {}, scale));
  if (ground) blob(out, x, y, z, scale);
};
/** a walker seen side-on or front-on depending on the camera */
const walker = (out: Stage, cam: CamInfo, t: number, w: Who, x: number, y: number, z: number, dx: number, dz: number, expr: Expr, speed = 1.1) => {
  const v = viewOf(cam, x, z, dx, dz), phase = (t * speed * 0.9 + w.i * 0.37) % 1, blink = lidAt(t, w.i);
  out.places.push(person(cam, w, x, y, z, v, { mode: "stroll", phase, expr, blink }, { mode: "march", phase, expr, blink, stride: 0.6 * Math.max(0.3, v.fs) }));
  blob(out, x, y, z);
};
const exprAt = (t: number, steps: [number, Expr][]): Expr => { let e = steps[0][1]; for (const [ts, x] of steps) if (t >= ts - L2) e = x; return e; };
const fx = (out: Stage, key: string, cw: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch: cw, draw, x, y, z, w, h: w, ...extra });
const splash = (out: Stage, t: number, t0: number, x: number, wy: number, z: number, s = 1, dur = 1.0) => {
  const u = (t - t0) / dur;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 30);
  fx(out, `splash${uq}`, 800, (p) => fxSplash(p, uq), x, wy + 0.37 * 7 * s, z, 7 * s);
};
const burst = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 1.5, col = "#fff3b0") => {
  const u = (t - t0) / 0.45;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 30);
  fx(out, `burst${col}${uq}`, 500, (p) => fxBurst(p, uq, col), x, y, z, s);
};

// ---------------- the Apollo 13 cast ----------------
// our own three astronauts (white cabin coveralls, blue patch), 1970 flight controllers (white shirts, ties, crew cuts,
// pocket protectors, horn-rims), the radio man with a headset, a traveller abroad
const ASTRO: Outfit[] = [
  { jacket: "#e9ecef", pants: "#dde2e8", boots: "#bfc6cf", hat: "hair", hair: "#5a3b2a", skin: SKINS[0], patch: "#2f5fa8", zip: true },
  { jacket: "#e9ecef", pants: "#dde2e8", boots: "#bfc6cf", hat: "hair", hair: "#c9a46a", skin: SKINS[2], patch: "#2f5fa8", zip: true },
  { jacket: "#e9ecef", pants: "#dde2e8", boots: "#bfc6cf", hat: "hair", hair: "#2a201a", skin: SKINS[1], patch: "#2f5fa8", zip: true, moustache: "#2a201a" },
];
const ENG = (v: number): Outfit => ({ jacket: v % 3 === 1 ? "#dfe9f5" : "#f4f4ee", pants: ["#3b3f52", "#5a4a3a", "#4a5560", "#2f3a4a"][v % 4], boots: "#2a2420",
  hat: "crewcut", hair: ["#5a3b2a", "#2a201a", "#c9a46a", "#8a5a3c", "#3a2a22"][v % 5], skin: SKINS[v % 4], tie: ["#2c3a5a", "#7a2f2f", "#3a5a3a", "#222222"][v % 4],
  pocket: true, glasses: v % 2 === 0 });
const CAPCOM: Outfit = { ...ENG(1), headset: true, glasses: false };
const TRAVELLER: Outfit = { jacket: "#c25a7a", pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: "#d9a441", skin: SKINS[1] };

const CAB_Z = (z: number) => cab(0, 0, z)[2];
// cabin spots (world): A left, B right-front, C floating sideways over their heads (zero g)
const PA = cab(-0.42, 0.05, 0.25), PB = cab(0.42, 0.02, -0.1), PC = cab(0.85, 1.95, 0.5);
const bobY = (i: number, t: number) => 0.035 * Math.sin(t * 1.4 + i * 2.1);
const bobR = (i: number, t: number) => 0.03 * Math.sin(t * 0.9 + i * 1.7);
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

type AOpt = { scale?: number; roll?: number; ground?: boolean; headset?: boolean };
/** one astronaut card (zero-g bob + sway unless on the ground) */
const astro = (out: Stage, cam: CamInfo, t: number, i: number, p: V3, fo: FrontOpts, o: AOpt = {}) => {
  const ow = o.headset ? { ...ASTRO[i], headset: true } : ASTRO[i];
  const w = who(ow, 20 + i, `as${i}${o.headset ? "h" : ""}`), blink = lidAt(t, w.i), sc = o.scale ?? 1;
  const y = p[1] + (o.ground ? 0 : bobY(i, t));
  const pl = person(cam, w, p[0], y, p[2], FRONT, { mode: "stand", blink, ...fo }, {}, sc);
  pl.roll = (o.roll ?? 0) + (o.ground ? 0 : bobR(i, t));
  out.places.push(pl);
  if (o.ground) blob(out, p[0], p[1], p[2], sc);
};
const C_OVER = (out: Stage, cam: CamInfo, t: number, fo: FrontOpts, p: V3 = PC, sc = 0.82) => astro(out, cam, t, 2, p, fo, { roll: -1.5, scale: sc });
const engineer = (out: Stage, cam: CamInfo, t: number, v: number, p: V3, fo: FrontOpts, o: Outfit = ENG(v)) => {
  const w = who(o, 40 + v, `en${v}${o.headset ? "h" : ""}`), blink = lidAt(t, w.i);
  out.places.push(person(cam, w, p[0], p[1], p[2], FRONT, { mode: "stand", blink, ...fo }, {}));
  blob(out, p[0], p[1], p[2]);
};
/** mouth flapping while someone talks */
const talk = (f: number, a: number, b: number, rest: Expr = "neutral"): Expr => (f >= a && f < b ? (Math.floor(f / 3) % 3 === 1 ? "whistle" : f % 7 < 3 ? "smile" : "neutral") : rest);
const exF = (f: number, steps: [number, Expr][]) => exprAt(f / FPS, steps.map(([fr, e]) => [fr / FPS, e] as [number, Expr]));

// ---------------- effect drawings ----------------
/** soft gas / breath cloud on a 400 x 400 canvas; u in 0..1 (fades), col "r,g,b" */
const pCloud = (p: Pen, u: number, col: string) => {
  for (const [x, y, r] of [[200, 220, 110], [130, 250, 80], [270, 250, 85], [200, 160, 75], [150, 180, 60], [255, 175, 62]] as const)
    p.ell(x, y, r * (0.75 + 0.45 * u), r * (0.65 + 0.4 * u), `rgba(${col},${(0.8 * (1 - u) ** 1.3).toFixed(3)})`, 0);
};
/** radio waves: three arcs each side, expanding; u in 0..1 */
const pRadio = (p: Pen, u: number) => {
  for (let k = 0; k < 3; k++) {
    const v = (u + k / 3) % 1, r = 50 + 140 * v, w = 16 * (1 - v) + 4, a = 1 - v;
    for (const s of [-1, 1]) p.arc(200, 200, r, r * 1.1, s > 0 ? -40 : 140, s > 0 ? 40 : 220, w, `rgba(36,23,38,${a.toFixed(3)})`);
  }
};
/** crackle sparks for the radio */
const pCrackle = (p: Pen, u: number) => {
  for (let k = 0; k < 3; k++) {
    const a = ((k * 120 + u * 360 * 0.7) * Math.PI) / 180, x0 = 200 + 50 * Math.cos(a), y0 = 200 + 50 * Math.sin(a);
    p.stroke([[x0, y0], [x0 + 40 * Math.cos(a + 0.4), y0 + 40 * Math.sin(a + 0.4)], [x0 + 60 * Math.cos(a - 0.3), y0 + 60 * Math.sin(a - 0.3)], [x0 + 110 * Math.cos(a), y0 + 110 * Math.sin(a)]], 14, "#ffd23f");
  }
};
/** tape rip: zig-zag tear lines; u in 0..1 */
const pRip = (p: Pen, u: number) => {
  const s = 1 - u;
  for (const [y, d] of [[150, 1], [250, -1]] as const) {
    const pts: [number, number][] = []; for (let i = 0; i <= 8; i++) pts.push([60 + i * 35, y + (i % 2 ? 22 : -22) * d * s]);
    p.stroke(pts, 12 * s + 3);
  }
  p.poly([[120, 185], [300, 175], [300, 215], [120, 225]], "#a3a8ae", 8);
};
/** cartoon jet, side view, nose right */
const pPlane = (p: Pen) => {
  p.poly([[40, 110], [330, 95], [380, 110], [330, 130], [40, 125]], "#f4f6fa", 8);
  p.poly([[60, 110], [30, 40], [80, 40], [120, 105]], "#3f6fb5", 8);
  p.poly([[170, 118], [130, 175], [175, 175], [235, 118]], "#d9dde4", 8);
  for (let i = 0; i < 6; i++) p.dot(170 + i * 24, 108, 5, "#3f6fb5");
};
/** tube sock (white with red and blue stripes), toe to the right */
const pSock = (p: Pen) => {
  const pts: [number, number][] = [[120, 40], [220, 40], [220, 300], [330, 330], [350, 400], [300, 440], [140, 400], [120, 330]];
  p.poly(pts, "#f3f0e8", 10);
  p.poly([[120, 70], [220, 70], [220, 92], [120, 92]], "#c0353a", 0);
  p.poly([[120, 115], [220, 115], [220, 132], [120, 132]], "#2f5fa8", 0);
  p.poly(pts, null, 10);
};
/** cartoon fireball: jagged star (orange rim, yellow body, white core) that blooms and shrinks; u in 0..1 */
const pBoom = (p: Pen, u: number) => {
  const g = Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (1 - 0.55 * Math.max(0, u - 0.5) / 0.5), n = 14;
  const star = (r0: number, r1: number) => { const pts: [number, number][] = []; for (let i = 0; i < 2 * n; i++) { const a = (i * Math.PI) / n + 0.2, r = (i % 2 ? r0 : r1) * (0.85 + 0.15 * Math.sin(i * 2.7)); pts.push([250 + r * g * Math.cos(a), 250 + r * g * Math.sin(a)]); } return pts; };
  p.poly(star(130, 235), "#f07a2c", 10);
  p.poly(star(90, 165), "#ffd23f", 0);
  if (u < 0.6) p.ell(250, 250, 70 * g, 70 * g, "#fffbe8", 0);
};
const boom = (out: Stage, f: number, f0: number, at: V3, w: number, dur: number) => {
  const u = (f - f0) / dur;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 30);
  fx(out, `boom${uq}`, 500, (p) => pBoom(p, uq), at[0], at[1], at[2], w);
};
const cloud = (out: Stage, key: string, col: string, u: number, p: V3, w: number) => {
  const uq = q(clamp01(u), 30);
  out.fx.push({ key: `cl${key}${uq}`, cw: 400, ch: 400, draw: (pn) => pCloud(pn, uq, col), x: p[0], y: p[1], z: p[2], w, h: w, soft: true });
};
const radio = (out: Stage, f: number, p: V3, w = 0.6) => { const uq = q((f / 24) % 1, 24); fx(out, `radio${uq}`, 400, (pn) => pRadio(pn, uq), p[0], p[1], p[2], w); };
/** breath puffs leaving a mouth toward the lens, one every `every` frames */
const breaths = (out: Stage, f: number, f0: number, f1: number, from: V3, dir: V3, every = 24, col = "176,186,206", w = 0.35) => {
  for (let s = f0; s < f1; s += every) {
    const u = (f - s) / 40;
    if (u < 0 || u >= 1) continue;
    cloud(out, `br${col}`, col, u, add(from, [dir[0] * u, dir[1] * u + 0.1 * u, dir[2] * u]), w * (0.6 + 0.8 * u));
  }
};

/** everything with a face (and the 2D effects) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = t * FPS;
  LNAME = s.light;
  findSun(cam, SUN);

  // ---------------- space ----------------
  if (id === 3 || id === 7) {
    const tb = 292;
    if (id === 3) { boom(out, f, tb, [HOLE[0], HOLE[1] + 0.3, HOLE[2] + 1.0], 8, 16); boom(out, f, 325, [HOLE[0] - 0.9, HOLE[1] - 0.4, HOLE[2] + 1.4], 4.5, 12); }
    if (f >= tb) for (let k = 0; k < 14; k++) { // venting oxygen: puffs streaming out of the bay, growing and fading
      const per = 36, ph = ((f - tb) / per + k / 14) % 1, born = f - ph * per;
      if (born < tb) continue;
      const u = ph, a = k * 2.4;
      cloud(out, "gas", "232,240,255", u, [HOLE[0] + 1.2 * Math.cos(a) * u, HOLE[1] + 0.8 + 3.2 * u + 0.6 * Math.sin(a) * u, HOLE[2] + 1.0 + 5.5 * u], 2.2 + 5 * u);
    }
  }

  // ---------------- cabin ----------------
  if (id === 1) {
    astro(out, cam, t, 0, cab(-0.55, 0.05, 0.5), { expr: exF(f, [[0, "grin"], [112, "laugh"]]), look: -1 });
    astro(out, cam, t, 1, cab(-1.05, 0.03, 0.62), { expr: "smile_closed", look: 1 });
    C_OVER(out, cam, t, { expr: exF(f, [[0, "smile"], [86, "grin"]]) }, cab(0.05, 1.98, 0.75), 0.75);
  }
  if (id === 4) {
    const e = exF(f, [[349, "nervous"], [352, "shock"]]);
    astro(out, cam, t, 0, PA, { expr: e, look: 1 }); astro(out, cam, t, 1, PB, { expr: e, look: -1 }); C_OVER(out, cam, t, { expr: e });
    if (f > 352 && f < 375) fx(out, "bang", 500, (p) => fxBang(p, "#ff6a4a"), PB[0] + 0.05, PB[1] + 2.0, PB[2], 0.32);
  }
  if (id === 5) {
    astro(out, cam, t, 0, PA, { expr: talk(f, 396, 405, "stern"), look: 1 }, { headset: true });
    if (f >= 390) { const u = q(((f - 390) / 10) % 1, 10); fx(out, `crk${u}`, 400, (p) => pCrackle(p, u), PA[0] + 0.2, PA[1] + 1.38, PA[2] - 0.1, 0.32); }
  }
  if (id === 8) { // down through the overhead hatch one after another; the third gets stuck, then pops in
    const H: V3 = cab(0, 2.25, 0.15);
    ([[0, 482, PA], [1, 494, PB]] as [number, number, V3][]).forEach(([i, f0, P]) => {
      if (f < f0) return;
      const u = smooth((f - f0) / 18);
      astro(out, cam, t, i, mixV(H, P, u), { mode: u < 0.95 ? "fall" : "stand", expr: u < 0.95 ? "shock" : exF(f, [[0, "nervous"], [520, "dazed"]]) });
    });
    if (f >= 506) {
      const stuck = f < 524, u = smooth((f - 524) / 10);
      const p = stuck ? cab(0, 1.05 - 0.12 * smooth((f - 506) / 12) + 0.02 * Math.sin(f * 1.7), 0.15) : mixV(cab(0, 0.93, 0.15), PC, u);
      astro(out, cam, t, 2, p, { mode: stuck ? "fall" : "stand", expr: stuck ? "pained" : "relief" }, { roll: stuck ? 0.04 * Math.sin(f * 1.3) : -1.5 * u, scale: 1 - 0.18 * (stuck ? 0 : u) });
      if (stuck) { const uq = q(((f - 506) / 12) % 1, 12); fx(out, `creak${uq}`, 300, (p2) => fxCreak(p2, uq), cab(0.45, 0, 0)[0], 2.45, CAB_Z(0.1), 0.35); }
    }
  }
  if (id === 10) { // the third one squeezes in overhead (622 "three"); the others get pushed apart
    const k = smooth((f - 616) / 10), e: Expr = exF(f, [[608, "neutral"], [622, "nervous"]]);
    astro(out, cam, t, 0, add(PA, [-0.12 * k, 0, 0]), { expr: e, look: -1 });
    astro(out, cam, t, 1, add(PB, [0.12 * k, 0, 0]), { expr: e, look: 1 });
    if (f >= 612) C_OVER(out, cam, t, { expr: exF(f, [[612, "grin"], [640, "nervous"]]) }, mixV(cab(1.7, 2.3, 0.5), PC, k));
    if (f > 620 && f < 650) for (const sx of [-1, 1]) { const uq = q(((f - 620) / 10) % 1, 10); fx(out, `creak${uq}`, 300, (p) => fxCreak(p, uq), cab(sx * 0.95, 0, 0)[0], 1.5, CAB_Z(0), 0.3, { rot: sx * 1.2 }); }
  }
  if (id === 12) {
    astro(out, cam, t, 1, PB, { expr: exF(f, [[689, "neutral"], [712, "whistle"], [732, "neutral"]]) });
    breaths(out, f, 714, 730, cab(0.4, 1.33, -0.3), [-0.1, -0.05, -0.6], 30, "176,186,206", 0.26);
  }
  if (id === 13) breaths(out, f, 750, 812, cab(0.1, 1.4, 0.85), [0.6, 0.15, -0.1], 16, "160,170,190", 0.18);
  if (id === 14) { // holds up the square spare, then pushes it at the round holder
    const m = smooth((f - 884) / 14), p = mixV(cab(0.18, 0.02, -0.15), cab(-0.55, 0.02, 0.3), m);
    if (m < 0.5) astro(out, cam, t, 1, p, { hold: true, expr: exF(f, [[818, "neutral"], [870, "grin"], [905, "neutral"], [913, "nervous"], [916, "shock"], [926, "pained"]]), look: m > 0.5 ? -1 : 0 });
    burst(out, t, 915 / FPS, cab(HOLDER[0] + 0.2, 0, 0)[0], HOLDER[1], CAB_Z(HOLDER[2]), 0.45);
    void pushAt;
  }
  if (id === 18) {
    astro(out, cam, t, 0, PA, { expr: "dazed" }); astro(out, cam, t, 1, PB, { expr: "dazed", look: 1 }); C_OVER(out, cam, t, { expr: "dazed" });
    const u = q((f / 30) % 1, 30); fx(out, `stars${u}`, 420, (p) => fxStars(p, u), PB[0], PB[1] + 1.95, PB[2], 0.42, { h: 0.21, ch: 210 });
    breaths(out, f, 1064, 1090, cab(-0.42, 1.33, 0.05), [0.25, -0.05, -0.6], 9, "150,160,180", 0.26);
  }
  if (id === 23) {
    astro(out, cam, t, 0, cab(-0.62, 0.03, 0.42), { hold: true, expr: exF(f, [[1450, "stern"], [1465, "smile_closed"]]) });
    astro(out, cam, t, 1, cab(-0.05, 0.02, 0.45), { expr: "neutral", look: -1 });
    for (const f0 of [1450, 1459, 1463]) { const u = (f - f0) / 6; if (u >= 0 && u < 1) { const uq = q(u, 6); fx(out, `rip${uq}`, 400, (p) => pRip(p, uq), cab(MAILBOX[0] + 0.05, 0, 0)[0], MAILBOX[1] + 0.27, CAB_Z(MAILBOX[2] - 0.2), 0.3); } }
  }
  if (id === 24) {
    astro(out, cam, t, 0, cab(-0.5, 0.04, 0.5), { expr: exF(f, [[1477, "relief"], [1525, "relief_open"]]), look: -1 });
    astro(out, cam, t, 1, cab(0.2, 0.02, 0.35), { expr: "grin", look: -1 });
    C_OVER(out, cam, t, { expr: "relief_open" }, cab(0.85, 1.95, 0.6), 0.8);
  }
  if (id === 25 && f >= 1589) {
    astro(out, cam, t, 0, PA, { expr: "relief_open", wave: 0.6 }); astro(out, cam, t, 1, PB, { expr: "relief" }); C_OVER(out, cam, t, { expr: "grin" });
  }
  if (id === 27) { // "Nobody ever said it": head shake + shrug
    const shake = f >= 1694 && f < 1714 ? (Math.floor((f - 1694) / 4) % 2 ? 1 : -1) : 0;
    astro(out, cam, t, 0, PA, { expr: exF(f, [[1635, "neutral"], [1690, "smile"]]), look: shake, headTilt: 4 * shake,
      ...(f >= 1700 ? { shrug: smooth((f - 1700) / 8) } : {}) }, { headset: true });
  }

  // ---------------- mission control ----------------
  if (id === 6) {
    const e = exF(f, [[405, "neutral"], [428, "shock"]]);
    engineer(out, cam, t, 0, mcc(-0.55, 0, 1.2), { expr: e, look: 1 });
    engineer(out, cam, t, 1, mcc(0.6, 0, 1.15), { expr: exF(f, [[405, "stern"], [430, "shock"]]), look: -1 });
    engineer(out, cam, t, 2, mcc(0.05, 0.38, -2.4), { expr: e });
    engineer(out, cam, t, 3, mcc(-1.1, 0.38, -2.5), { expr: e, look: 1 });
    engineer(out, cam, t, 4, mcc(0.75, 0.76, -6.0), { expr: e });
    radio(out, f, mcc(0.1, 2.95, 1.95), 0.9);
  }
  if (id === 19) { // the whole room from the back, everyone small
    [1.2, -2.4, -6.0, -9.6].forEach((z, k) => [-6, -3.2, -0.4, 2.6, 5.4].forEach((x, j) => {
      if ((j + k) % 3 === 2) return;
      engineer(out, cam, t, 5 + k * 5 + j, mcc(x + 0.4 * Math.sin(j * 3 + k), 0.38 * k, z), { expr: "neutral", look: (j % 3) - 1 });
    }));
  }
  if (id === 20 || id === 21) {
    const pile = f >= 1160;
    engineer(out, cam, t, 0, mcc(-0.7, 0, 4.55), { expr: exF(f, [[1112, "stern"], [1283, "smile"], [1395, "grin"]]), look: 1 });
    engineer(out, cam, t, 1, mcc(0.05, 0, 4.4), { expr: exF(f, [[1112, "neutral"], [1300, "grin"], [1340, "stern"], [1395, "grin"]]), hold: pile });
    engineer(out, cam, t, 2, mcc(0.75, 0, 4.6), { expr: exF(f, [[1112, "neutral"], [1281, "laugh"], [1300, "smile"], [1395, "relief_open"]]), look: -1 });
    engineer(out, cam, t, 3, mcc(-0.3, 0, 3.65), { expr: exF(f, [[1112, "neutral"], [1305, "grin"]]) });
    engineer(out, cam, t, 4, mcc(0.45, 0, 3.55), { expr: exF(f, [[1112, "stern"], [1233, "smile"]]), look: -1 });
  }
  if (id === 22 || id === 28) {
    const tk = id === 22 ? talk(f, 1410, 1448, "neutral") : exF(f, [[1714, "neutral"], [1765, "smile"]]);
    engineer(out, cam, t, 99, mcc(-3.4, 0, 2.75), { expr: tk, hold: true, headTilt: id === 28 && f > 1745 ? 3 * Math.sin((f - 1745) * 0.5) : 0 }, CAPCOM);
    engineer(out, cam, t, 6, mcc(-4.5, 0, 1.2), { expr: "neutral", look: 1 });
    engineer(out, cam, t, 7, mcc(-2.2, 0, 1.25), { expr: id === 28 && f > 1770 ? "smile" : "stern", look: -1 });
    if (id === 22) radio(out, f, mcc(-3.15, 1.85, 2.85), 0.55);
    else radio(out, f + 12, mcc(-3.4, 2.15, 2.8), 0.5);
  }

  // ---------------- hotel ----------------
  if (id === 15) {
    const u = clamp01((f - 930) / 26), x = lin([[0, -1.7], [1, 0.25]], u), w = who(TRAVELLER, 60, "trav");
    const [px, , pz] = hot(x, 0, 0.9);
    if (u < 1) walker(out, cam, t, w, px, 0, pz, 1, 0, "smile", 1.3);
    else one(out, cam, t, w, px, 0, pz, { expr: "smile", look: 1 });
    const pu = (f - 932) / 30;
    if (pu >= 0 && pu < 1) { const [qx, qy, qz] = hot(-1.55 + 1.2 * pu, 1.9 - 0.25 * pu, 1.97); fx(out, "plane", 400, pPlane, qx, qy, qz, 0.45, { h: 0.225, ch: 200 }); }
  }
  if (id === 16) { const [bx, by, bz] = hot(SOCKET[0], SOCKET[1], SOCKET[2] - 0.05); burst(out, t, 986 / FPS, bx, by, bz, 0.12, "#ffffff"); }

  // ---------------- sea ----------------
  if (id === 26 && f >= SPLASH - 1) {
    const u = (f - SPLASH) / 30, [cx, , cz] = sea(0, 0, 0);
    splash(out, t, SPLASH / FPS, cx, 0, cz, 1.6, 1.0);
    if (u < 1) { const uq = q(clamp01(u), 30); out.fx.push({ key: `ring${uq}`, cw: 600, ch: 600, draw: (p) => fxRing(p, uq), x: cx, y: 0.04, z: cz, w: 14, h: 14, flat: true }); }
    void capY;
  }
  if (id === 29) {
    const R = (x: number, z: number): V3 => sea(RAFT[0] + x, 0.22, RAFT[2] + z);
    astro(out, cam, t, 0, R(-0.6, 0.35), { mode: "sit", expr: "relief" }, { ground: true });
    astro(out, cam, t, 2, R(0.6, 0.4), { mode: "sit", expr: "relief_open", look: -1 }, { ground: true });
    const up = smooth((f - 1812) / 8), B = R(0, -0.45);
    astro(out, cam, t, 1, B, { mode: "sit", expr: exF(f, [[1787, "smile_closed"], [1815, "grin"]]), ...(up > 0 ? { wave: up } : {}) }, { ground: true });
    if (up > 0) { // the sock, held up high
      const hx = 0.37, hy = 0.98;
      fx(out, "sock", 480, pSock, B[0] + cam.right.x * hx, B[1] + hy + 0.05 * (1 - up), B[2] + cam.right.z * hx, 0.3 * up, { rot: -0.2 });
    }
  }
  void fxBurst; void fxSplash; void bodySide; void bodyFront; void HOLE;
  return out;
};
