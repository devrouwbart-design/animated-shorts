// Lake short cast (sprite system from the bridge short). Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, fxBurst, fxSplash, fxPuff, fxCreak, fxFish, fxBang, KID, SKINS, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { FPS, V3, clamp01, SHOTS, G, RIG_DECK, MINE_Y, SHAFT, ROOF, TUB, BATH, rigPose, boatPose, skiffPose, cageY, bargePose, smooth, Pose } from "./story";
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

// ---------------- the lake cast ----------------

export type Stage = { places: Place[]; fx: FxPlace[] };

/** world matrix of a rig / boat pose (shared with world.ts so riders stay glued to their deck) */
const EUL = new THREE.Euler(), QQ = new THREE.Quaternion(), ONE = new THREE.Vector3(1, 1, 1), PP = new THREE.Vector3();
export const poseMatrix = (p: Pose, out = new THREE.Matrix4()) => {
  EUL.set(p.roll, p.yaw, p.tilt, "YXZ");
  return out.compose(PP.set(p.x, p.y, p.z), QQ.setFromEuler(EUL), ONE);
};
const M4 = new THREE.Matrix4(), PV = new THREE.Vector3();
const onPose = (p: Pose, lx: number, ly: number, lz: number): V3 => {
  poseMatrix(p, M4); PV.set(lx, ly, lz).applyMatrix4(M4);
  return [PV.x, PV.y, PV.z];
};

// 1980 outfits: rig crew in coveralls + hard hats, salt miners, the electrician, the fisherman, shore strollers
const worker = (v: number): Outfit => ({ jacket: ["#e8892c", "#3f6fb5", "#c0453a"][v % 3], pants: ["#a85f20", "#2f4f86", "#3b3f52"][v % 3], boots: "#4a3426",
  hat: "hardhat", cap: v % 2 ? "#f4f1ea" : "#ffd23f", skin: SKINS[(v + 1) % 4], moustache: v === 1 ? "#4a3426" : undefined });
const miner = (v: number): Outfit => ({ jacket: ["#6b7684", "#5a6b5a", "#7a6a58", "#4f5d70"][v % 4], pants: "#3b3f52", boots: "#3a2a22", hat: "hardhat",
  cap: v % 3 === 0 ? "#ffd23f" : "#f4f1ea", skin: SKINS[v % 4], moustache: v % 4 === 2 ? "#3a2a22" : undefined });
const ELECTRICIAN: Outfit = { jacket: "#2f5f6a", pants: "#2c3442", boots: "#3a2a22", hat: "hardhat", cap: "#e2453c", skin: SKINS[3], moustache: "#2a201a" };
const FISHER: Outfit = { jacket: "#5d7a3a", pants: "#3b5b9a", boots: "#4a3426", hat: "cap", cap: "#e2453c", skin: SKINS[1], moustache: "#8a6a4a", build: "stout" };
const stroller = (v: number): Outfit => v % 2
  ? { jacket: ["#c25a7a", "#5a8fc2", "#d9a441"][v % 3], pants: "#3b3f52", boots: "#5a3b2a", hat: "hair", hair: ["#5a3b2a", "#d9a441", "#2a201a"][v % 3], dress: ["#e8a0b4", "#9cc4e8", "#f2d27a"][v % 3], skin: SKINS[v % 4] }
  : { jacket: ["#3f6fb5", "#b5653f", "#5d7a3a"][v % 3], pants: "#c9b48a", boots: "#4a3426", hat: "hair", hair: ["#2a201a", "#8a5a3c", "#5a3b2a"][v % 3], skin: SKINS[(v + 2) % 4] };
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
const fishArc = (out: Stage, t: number, t0: number, x0: number, z0: number, wy: number, dir = 1) => {
  const u = (t - t0) / 0.6;
  if (u < -0.05 || u > 1.6) return;
  if (u >= 0 && u <= 1) {
    const x = x0 + dir * 2.4 * u, y = wy + 2.0 * Math.sin(Math.PI * u), rot = dir * (0.9 - 1.8 * u);
    fx(out, "fish", 512, (p) => fxFish(p), x, y, z0, 1.5, { h: 0.9, rot: dir > 0 ? rot : Math.PI - rot });
  }
  splash(out, t, t0, x0, wy, z0, 0.35, 0.7);
  splash(out, t, t0 + 0.6, x0 + dir * 2.4, wy, z0, 0.4, 0.8);
};

/** everything with a face (and the 2D effects) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = t * FPS;
  LNAME = s.light;
  findSun(cam, SUN);
  const rig = rigPose(id, f), boat = boatPose(id, f), skiff = skiffPose(id, f);
  const crewSpots: V3[] = [[2.6, RIG_DECK, -3.6], [-1.6, RIG_DECK, -4.2], [0.6, RIG_DECK, -4.8]];

  // shore strollers (shots 2-3, 21-23 far away)
  if (id === 2 || id === 3) {
    const path: [number, number, number, number][] = [[-4.8, -122.4, 1, 0], [-1.4, -122.9, -1, 0], [3.5, -122.2, -1, 0], [-11, -123.2, 1, 0]]; // first two cross the garden-walk frame
    path.forEach(([x0, z, dx], i) => {
      const x = x0 + dx * 0.9 * (t - 10.5);
      walker(out, cam, t, who(stroller(i), 40 + i, `st${i}`), x, G, z, dx, 0, i % 2 ? "smile" : "smile_closed");
    });
    one(out, cam, t, who(stroller(4), 45, "st4"), -14.5, G, -124.6, { mode: "sit", expr: "smile_closed" }, true);
  }
  if (id === 3) { fishArc(out, t, 11.45, 3.5, -114, 0, 1); fishArc(out, t, 11.85, 7, -110, 0, -1); fishArc(out, t, 12.2, 3.2, -116, 0, 1); }

  // rig crew on the deck (shots 4-7), riding the rig's tilt
  if (id >= 4 && id <= 7 && rig.on) {
    crewSpots.forEach(([lx, ly, lz], i) => {
      const w = who(worker(i), 10 + i, `wk${i}`);
      if (id === 5 && i !== 0) return;
      const [lx5, lz5] = id === 5 ? [1.1, -1.0] : [lx, lz];
      let expr: Expr = id === 4 ? (i === 1 ? "grin" : "neutral") : id === 5 ? exprAt(t, [[0, "neutral"], [17.76, "shock"]]) : id === 6 ? "nervous" : "shock";
      if (id === 7) {
        // jump into the boat: 652-664 (staggered), then ride it
        const j0 = 21.6 + i * 0.12, u = (t - j0) / 0.4;
        const seat: V3 = [-0.5 + 0.55 * i, 0.35, -0.6 + 0.5 * i];
        if (u >= 0) {
          const [sx, sy, sz] = onPose(boat, ...seat), [dx0, dy0, dz0] = onPose(rig, 2.2 + 0.9 * i, RIG_DECK, -5.4);
          if (u < 1) {
            const k = smooth(u), x = dx0 + (sx - dx0) * k, z = dz0 + (sz - dz0) * k, y = dy0 + (sy - dy0) * k + 2.2 * Math.sin(Math.PI * u);
            one(out, cam, t, w, x, y, z, { mode: "fall", expr: "shock" }, false);
          } else one(out, cam, t, w, sx, sy, sz, { mode: "sit", expr: t > 22.7 ? "nervous" : "shock" }, false);
          return;
        }
        const [x, y, z] = onPose(rig, 2.2 + 0.9 * i, RIG_DECK, -5.4);
        one(out, cam, t, w, x, y, z, { expr, look: 1 }, true);
        return;
      }
      const [x, y, z] = onPose(rig, lx5, ly, lz5);
      one(out, cam, t, w, x, y, z, { expr }, true);
    });
  }
  if (id === 8 && boat.on) [0, 1, 2].forEach((i) => {
    const [x, y, z] = onPose(boat, -0.5 + 0.55 * i, 0.35, -0.6 + 0.5 * i);
    one(out, cam, t, who(worker(i), 10 + i, `wk${i}`), x, y, z, { mode: "sit", expr: "nervous" }, false);
  });
  // effects on the rig
  if (id === 5) { burst(out, t, 17.76, 0.15, RIG_DECK + 0.9, -0.3, 1.2); if (t > 17.7 && t < 18.3) fx(out, "bang", 500, (p) => fxBang(p), 1.6, RIG_DECK + 2.75, -1.2, 0.7); }
  if (id === 6 && t > 19.1) {
    const pts: V3[] = [onPose(rig, 4.5, 3, -4.6), onPose(rig, -4.4, 6, -4.6), onPose(rig, 4.5, 9, -4.6)];
    pts.forEach(([x, y, z], i) => { const u = q((t * 1.3 + i * 0.37) % 1, 30); fx(out, `creak${u}`, 300, (p) => fxCreak(p, u), x, y, z, 1.4, { rot: i * 0.6 - 0.6 }); });
  }
  if (id === 7) {
    for (const [t0, lx, ly] of [[21.23, 4.6, 2.2], [21.5, -4.5, 5], [21.75, 4.6, 8]] as const) { const [x, y, z] = onPose(rig, lx, ly, -4.6); burst(out, t, t0, x, y, z, 2.6); }
    for (let k = 0; k < 3; k++) { const [x, , z] = onPose(boat, -0.5 + 0.55 * k, 0, -0.6 + 0.5 * k); splash(out, t, 22.0 + k * 0.12, x, 0, z, 0.4, 0.6); }
    if (t > 22.7) for (let k = 0; k < 4; k++) { const tk = 22.7 + k * 0.25, ph = ((t - tk) % 1 + 1) % 1; const [x, , z] = onPose(boat, 0, 0, 2.6 + ph * 2); splash(out, t, t - ph, x, 0, z, 0.45 + 0.1 * k, 1); }
  }
  if (id === 9) { const [x, y, z] = [rig.x, Math.max(rig.y, -10), rig.z]; splash(out, t, 26.67, x, y + 1, z, 1.6, 1.2); }

  // the fisherman (shots 2-11 in his skiff, 23 tasting the lake)
  if (skiff.on && (id === 11 || id === 23 || id === 2)) {
    const [x, y, z] = onPose(skiff, 0, 0.3, 0.3);
    const expr: Expr = id === 11 ? (t > 32.74 ? "relief_open" : "shock") : id === 23 ? exprAt(t, [[0, "neutral"], [68.2, "lick"], [69.02, "pained"]]) : "neutral";
    one(out, cam, t, who(FISHER, 30, "fisher"), x, y, z, { mode: "sit", expr }, false);
    if (id === 11 && t < 32.74) for (let k = 0; k < 3; k++) { const tk = 31 + k * 0.33, ph = ((t - tk) % 1 + 1) % 1; const [sx, , sz] = onPose(skiff, 0, 0, -1.6 - 2 * ph); splash(out, t, t - ph, sx, skiff.y, sz, 0.35, 1); }
    if (id === 11) { const u = (t - 32.74) / 0.5; if (u >= 0 && u < 1) { const uq = q(u, 30); fx(out, `puff${uq}`, 400, (p) => fxPuff(p, uq), x, y + 0.2, z - 1.5, 1.6); } }
  }

  // the salt mine
  if (id === 14) {
    const spots: [number, number, number, Expr, number][] = [[-2.2, -26, 0, "neutral", 0], [1.6, -22, 1, "grin", 0], [-0.6, -16, 2, "neutral", 1], [2.8, -12, 3, "smile_closed", 0],
      [-3.4, -9, 4, "neutral", 1], [0.8, -5, 5, "neutral", 0], [-1.6, 0, 6, "grin", 0], [3.2, 3, 7, "neutral", 0], [-3, 8, 8, "neutral", 0]];
    for (const [x, z, i, e, w] of spots) {
      if (w) walker(out, cam, t, who(miner(i), 50 + i, `mn${i}`), x + 0.8 * Math.sin(t * 0.4 + i), MINE_Y, z, 0, 1, e, 0.9);
      else one(out, cam, t, who(miner(i), 50 + i, `mn${i}`), x, MINE_Y, z, { expr: e, look: i % 3 - 1 });
    }
  }
  if (id === 15) {
    const ex = exprAt(t, [[0, "neutral"], [43.02, "shock"]]);
    one(out, cam, t, who(ELECTRICIAN, 60, "elec"), 2, MINE_Y, -36.5, { expr: ex, look: t > 43 ? -1 : 0, wave: t > 44.9 ? 1 : undefined });
    if (t > 43.02 && t < 43.5) fx(out, "bang", 500, (p) => fxBang(p), 2.25, MINE_Y + 2.95, -36.6, 0.55);
    if (t > 43.55) [0, 1].forEach((i) => {
      const z = -18 - 6 * (t - 43.55) * (1 + 0.2 * i);
      walker(out, cam, t, who(miner(i + 2), 52 + i, `mn${i + 2}`), -1.5 + 2.4 * i, MINE_Y, Math.max(-38, z), 0, -1, "shock", 1.8);
    });
  }
  if (id === 16) {
    const y = MINE_Y + cageY(id, f) + 0.12;
    const ex: Expr[] = ["relief_open", "relief", "smile", "relief_open", "grin"];
    [[-0.7, -0.5], [0.0, -0.6], [0.7, -0.45], [-0.35, 0.35], [0.4, 0.4]].forEach(([dx, dz], i) =>
      one(out, cam, t, who(miner(i), 50 + i, `mn${i}`), SHAFT[0] + dx, y, SHAFT[2] + dz, { expr: ex[i] }, false, 0.92));
  }
  if (id === 18) burst(out, t, 50.01, ROOF[0], MINE_Y + 8.2, ROOF[2], 3.5);
  if (id === 17) for (const [x, z, k] of [[38, -82, 0], [33, -78, 1], [42, -77, 2]] as const) {
    const flop = Math.sin(t * 9 + k * 2), y = bedAt(Math.hypot(x, z)) + 0.35 + 0.25 * Math.abs(flop);
    fx(out, "fish", 512, (p) => fxFish(p), x, y, z, 1.8, { h: 1.05, rot: 0.5 * flop });
  }

  // the bathroom: a kid pulls the plug
  if (id === 19) {
    const ex = exprAt(t, [[0, "grin"], [53.19, "smile"], [54.07, "shock"]]);
    one(out, cam, t, who(KID, 70, "kid"), TUB[0] + 0.45, BATH[1], TUB[2] + 0.72, { expr: ex, wave: t > 52.9 && t < 53.6 ? 1 : undefined, look: 1 });
  }
  // barges popping up
  if (id === 22) for (let k = 0; k < 9; k++) { const p = bargePose(22, k, 1958 + k * 6); splash(out, t, (1958 + k * 6) / FPS + 0.12, p.x, 0, p.z, 1.2, 1.0); }
  return out;
};

/** lake bed height (m) at radius r (the same curve world.ts builds) */
export const bedAt = (r: number) => {
  if (r >= 121) return G;
  if (r >= 110) { const u = (r - 110) / 11; return -12 + (G + 12) * (u * u * (3 - 2 * u)); }
  const u = r / 110;
  return -38 + 26 * u * u;
};
