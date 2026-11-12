// Emu short cast (sprite system from the bridge short). Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, fxSplash, fxPuff, SKINS, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import { emuSide, emuFront, kangaroo, shield, fxRain, fxMuzzle, fxSmoke, fxFeather, fxStream, fxDrips, fxCoins, EmuMode, EmuEye } from "./critters";
import {
  FPS, V3, clamp01, SHOTS, Pose, WHEAT_H, FIELD, NEST, HERO_EMU, FARMER, FARMERS, MAJOR_TRUCK, MAJOR_DAM, TALL_EMU, HOSE, TRUCK_STOP, ROAD_Z, DAM, DAM_GUN,
  CASINGS, ROCK, hAt, hash, truckPose, BED_GUN,
} from "./story";
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

// ---------------- the 1932 cast ----------------
// soldiers in khaki with slouch hats, Major Meredith in a peaked cap, the farmers (veterans themselves) in old slouch hats
const soldierO = (v: number): Outfit => ({ jacket: ["#9a8a5a", "#8f8254", "#a39262"][v % 3], pants: "#7d6e48", boots: "#4a3426", hat: "slouch", cap: "#a8946a",
  belt: "#6b5a3a", skin: SKINS[(v + 1) % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
const MAJOR: Outfit = { jacket: "#9c8a56", pants: "#86764a", boots: "#3a2a1e", hat: "peak", cap: "#8f7d52", belt: "#5a3a24", buttons: "#d8b85a",
  moustache: "#5a3a24", skin: SKINS[1], build: "stout" };
const farmerO = (v: number): Outfit => ({ jacket: ["#5a7fb0", "#d9cfb8", "#b5653f"][v % 3], pants: ["#6b5238", "#3b3f52", "#7a6648"][v % 3], boots: "#4a3426",
  hat: "slouch", cap: ["#7d6a52", "#5e5a50", "#8a7656"][v % 3], skin: SKINS[(v + 2) % 4], moustache: v === 2 ? "#6a4a30" : undefined });
const who = (o: Outfit, i: number, okey: string): Who => ({ i, o, okey });
const FRONT = { side: false, mirror: false };
const L2 = LEAD;
const GUNNER = (k: number) => who(soldierO(k), 10 + k, `so${k}`);
const MAJ = who(MAJOR, 20, "maj");

/** a front-facing person (stand / sit), blinking, optional ground blob */
const one = (out: Stage, cam: CamInfo, t: number, w: Who, x: number, y: number, z: number, fo: FrontOpts, ground = true, scale = 1) => {
  const blink = lidAt(t, w.i);
  out.places.push(person(cam, w, x, y, z, FRONT, { mode: "stand", blink, ...fo }, {}, scale));
  if (ground) blob(out, x, y, z, scale);
};
/** a person standing still and facing (dx, dz): side view when the camera sees them side-on */
const facing = (out: Stage, cam: CamInfo, t: number, w: Who, x: number, y: number, z: number, dx: number, dz: number, expr: Expr, ground = true) => {
  const v = viewOf(cam, x, z, dx, dz), blink = lidAt(t, w.i);
  out.places.push(person(cam, w, x, y, z, v, { mode: "stand", expr, blink }, { mode: "stand", expr, blink }));
  if (ground) blob(out, x, y, z);
};
const exprAt = (t: number, steps: [number, Expr][]): Expr => { let e = steps[0][1]; for (const [ts, x] of steps) if (t >= ts / FPS - L2) e = x; return e; };
const fx = (out: Stage, key: string, cw: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch: cw, draw, x, y, z, w, h: w, ...extra });
const puff = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 1.2, dur = 0.7) => {
  const u = (t - t0) / dur;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 20);
  fx(out, `puff${uq}`, 300, (p) => fxPuff(p, uq), x, y + 0.4 * s, z, s, { soft: true });
};
const smoke = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 0.8, dur = 1.2) => {
  const u = (t - t0) / dur;
  if (u < 0 || u >= 1) return;
  const uq = q(u, 20);
  fx(out, `smoke${uq}`, 300, (p) => fxSmoke(p, uq), x, y + 0.3 * u, z, s, { soft: true });
};

// ---------------- emus ----------------
const EMU_SC = 1.05;
/** one emu card: side view (mirrored to face its heading) or front view when it walks straight at / away from the lens */
const emu = (out: Stage, cam: CamInfo, t: number, i: number, x: number, y: number, z: number, dx: number, dz: number, mode: EmuMode,
  o: { eye?: EmuEye; front?: boolean; speed?: number; scale?: number; ground?: boolean; wet?: boolean } = {}) => {
  const sc = (o.scale ?? 1) * EMU_SC, v = viewOf(cam, x, z, dx, dz), front = o.front ?? false;
  const cyc = mode === "run" ? 2.6 : mode === "walk" ? 1.3 : mode === "peck" ? 0.9 : 0.25;
  const phase = q((t * cyc * (o.speed ?? 1) + hash(i, 4)) % 1, 12), blink = lidAt(t, 300 + i), seed = 1 + (i % 4);
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.1, z)) / sc;
  const [w, h, k] = tier(d), mirror = !front && v.mirror, light = light2D(cam, mirror), eye = o.eye ?? "open";
  const key = `E|${front ? "F" : "S"}|${mode}|${phase}|${q(blink, 4)}|${eye}|${q(light, 8)}|${seed}|${o.wet ? 1 : 0}`;
  out.places.push({ key, x, y, z, scale: sc, mirror, size: [w, h, k],
    draw: (p) => (front ? emuFront(p, { blink, eye, light, seed, phase }) : emuSide(p, { mode, phase, blink, eye, light, seed, wet: o.wet })) });
  if (o.ground !== false) blob(out, x, y, z, sc * 1.2);
};
/** a mob of n emus scattered in a rectangle, walking / eating; legs hidden when they stand in the wheat */
const inWheat = (x: number, z: number) => x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1;
const groundY = (x: number, z: number) => (inWheat(x, z) ? WHEAT_H - 0.45 : hAt(x, z));
const mob = (out: Stage, cam: CamInfo, t: number, i0: number, n: number, x0: number, x1: number, z0: number, z1: number, mode: (k: number) => EmuMode, vz = 0, vx = 0) => {
  for (let k = 0; k < n; k++) {
    const i = i0 + k, m = mode(k), move = m === "walk" || m === "run";
    const x = x0 + (x1 - x0) * hash(i, 1) + (move ? vx * t : 0), z = z0 + (z1 - z0) * hash(i, 2) + (move ? vz * t : 0);
    const hd = hash(i, 3) < 0.5 ? 1 : -1;
    const dx = move ? vx || 0.0001 * hd : hd, dz = move ? vz : 0.2 * (hash(i, 5) - 0.5);
    emu(out, cam, t, i, x, groundY(x, z), z, dx, dz, m, { ground: !inWheat(x, z) });
  }
};

/** everything with a face (and the 2D effects) in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = t * FPS;
  LNAME = s.light === "golden" ? "golden" : "day";
  findSun(cam, SUN);
  const [nx, , nz] = NEST;

  if (id === 1 || id === 2 || id === 9) { // the gun nest in the open paddock: gunner behind the gun, the loader, the major
    const sit = id === 2;
    const ex = id === 2 ? "dazed" : id === 9 ? exprAt(t, [[737, "stern"], [790, "nervous"]]) : exprAt(t, [[0, "stern"], [60, "neutral"]]);
    if (sit) {
      one(out, cam, t, GUNNER(0), nx - 1.0, 0, nz + 0.2, { mode: "sit", expr: "dazed" });
      one(out, cam, t, GUNNER(1), nx - 0.2, 0, nz + 1.2, { mode: "sit", expr: "dazed" });
      one(out, cam, t, MAJ, nx - 2.0, 0, nz + 1.0, { mode: "sit", expr: exprAt(t, [[108, "dazed"], [134, "shock"]]) });
      smoke(out, t, 108 / FPS, nx + 0.9, 1.25, nz, 0.7, 1.4);
      // the emu sprints past through the frame on "won"
      const u = (f - 118) / FPS, ex2 = nx - 6 + 9 * u;
      if (u > -0.2 && u < 1.4) emu(out, cam, t, 1, ex2, 0, nz - 2.2, 1, 0, "run", { eye: "smug", speed: 1.2 });
      for (const pf of [124, 130, 136, 142]) puff(out, t, pf / FPS, nx - 6 + 9 * ((pf - 118) / FPS) - 0.6, 0, nz - 2.0, 1.2, 0.8);
    } else {
      facing(out, cam, t, GUNNER(0), nx - 0.95, 0, nz, 1, 0, ex);
      facing(out, cam, t, GUNNER(1), nx - 0.6, 0, nz + 1.0, 1, 0.2, ex);
      facing(out, cam, t, MAJ, nx - 2.0, 0, nz + 1.3, 1, 0.1, id === 9 ? exprAt(t, [[737, "stern"], [798, "shock"]]) : "stern");
    }
    if (id === 1) emu(out, cam, t, 0, HERO_EMU[0], 0, HERO_EMU[2], -1, 0, "stand", { front: true, eye: f > 98 ? "smug" : "open" });
    if (id === 9) { // little groups running off every which way from where the herd was
      const t0 = 737 / FPS, cx = nx + 28, cz = nz + 6;
      for (let g = 0; g < 9; g++) {
        const a = g * 0.7 + 0.4, d = 4 + 10 * Math.max(0, t - t0) * (0.8 + 0.4 * hash(g, 7));
        for (let k = 0; k < 5; k++) {
          const i = 100 + g * 5 + k, ox = (hash(i, 1) - 0.5) * 3, oz = (hash(i, 2) - 0.5) * 3;
          const x = cx + Math.cos(a) * d + ox, z = cz + Math.sin(a) * d + oz;
          emu(out, cam, t, i, x, hAt(x, z), z, Math.cos(a), Math.sin(a), "run");
        }
      }
    }
  }

  if (id === 3 && f >= 245) one(out, cam, t, who(farmerO(0), 30, "fa0"), FARMER[0], 0, FARMER[2], { expr: exprAt(t, [[245, "smile"], [280, "grin"]]) });
  if (id === 4) for (let k = 0; k < 2; k++) one(out, cam, t, who(farmerO(k + 1), 31 + k, `fa${k + 1}`), 40 + k * 9, 0, -30 + k * 6, { expr: "smile" }, false);

  if (id === 5) {
    if (f < 450) mob(out, cam, t, 200, 150, 22, 90, -18, 40, (k) => (hash(k, 9) < 0.35 ? "peck" : "walk"), -1.1, 0);
    else {
      emu(out, cam, t, 2, 24, WHEAT_H - 0.45, -33, 1, 0.3, "peck", { ground: false });
      mob(out, cam, t, 400, 24, 18, 40, -26, 0, () => "peck");
    }
  }
  if (id === 6 || id === 19) mob(out, cam, t, 500, 30, -8, 24, -42, -10, (k) => (hash(k, 9) < 0.6 ? "peck" : "stand"));
  if (id === 6) {
    const ex = exprAt(t, [[471, "stern"], [520, "shock"], [534, "stern"]]);
    FARMERS.forEach(([x, , z], k) => one(out, cam, t, who(farmerO(k), 30 + k, `fa${k}`), x, 0, z, { expr: ex, ...(f >= 534 ? { wave: k === 1 ? 1 : 0.6 } : {}) }));
  }

  if (id === 7 || id === 8 || id === 14) {
    const rain = id === 8;
    const tp = truckPose(id, f);
    if (id === 7 && f >= 589) facing(out, cam, t, MAJ, MAJOR_TRUCK[0], 0, MAJOR_TRUCK[2], -1, -0.3, exprAt(t, [[589, "stern"], [640, "neutral"]]));
    if ((id === 7 && f >= 612) || rain) {
      const ex = rain ? "pained" : "stern";
      facing(out, cam, t, GUNNER(0), TRUCK_STOP[0] - 5.5, 0, ROAD_Z - 4.4, 1, 0, ex);
      facing(out, cam, t, GUNNER(1), TRUCK_STOP[0] - 3.1, 0, ROAD_Z - 4.6, 1, 0, ex);
    }
    if (rain) {
      one(out, cam, t, MAJ, MAJOR_TRUCK[0], 0, MAJOR_TRUCK[2], { expr: "nervous" });
      for (let k = 0; k < 16; k++) { // rain streak cards between the lens and the soldiers
        const x = TRUCK_STOP[0] - 6 + (k % 8) * 1.4 + hash(k, 1), z = ROAD_Z - 7 + Math.floor(k / 8) * 2.6 + hash(k, 2), y = 2.2 - ((t * 9 + hash(k, 3) * 3) % 3);
        fx(out, `rain${k % 4}`, 512, (p) => fxRain(p, k % 4), x, y, z, 2.6, { soft: true });
      }
    }
    if (id === 14) {
      const g = onPose(tp, BED_GUN[0] - 0.75, 0.85, 0), m = onPose(tp, 0.5, 0.0, -1.35);
      facing(out, cam, t, GUNNER(0), g[0], g[1], g[2], 1, 0, exprAt(t, [[1070, "stern"], [1150, "grin"]]), false);
      one(out, cam, t, MAJ, m[0], 0, m[2], { expr: exprAt(t, [[1070, "neutral"], [1100, "grin"]]), ...(f >= 1100 ? { wave: 1 } : {}) });
      if (f > 1150) puff(out, t, 1150 / FPS, tp.x - 3.2, 0, tp.z + 0.6, 1.8, 0.9);
    }
  }

  if (id === 15) { // the bumpy chase: gunner bouncing on the bed, emus pull away ahead
    const tp = truckPose(id, f), g = onPose(tp, BED_GUN[0] - 0.75, 0.85, 0);
    facing(out, cam, t, GUNNER(0), g[0], g[1], g[2], 1, 0, exprAt(t, [[1165, "stern"], [1240, "nervous"], [1280, "dazed"]]), false);
    const t0 = 1165 / FPS;
    for (let k = 0; k < 12; k++) {
      const i = 600 + k, x = 32 + 13.5 * (t - t0) + 4 * hash(i, 1) + (k % 4) * 2.2, z = -92 + (hash(i, 2) - 0.5) * 10;
      emu(out, cam, t, i, x, hAt(x, z), z, 1, 0.05 * (hash(i, 3) - 0.5), "run", { speed: 1.3, eye: k === 0 && f > 1250 ? "smug" : "open" });
    }
    for (let k = 0; k < 4; k++) puff(out, t, (Math.floor(f / 8) * 8 - k * 8) / FPS, tp.x - 3 - k * 1.8, 0, tp.z + (k % 2 ? 0.7 : -0.7), 1.3 + 0.3 * k, 1.0);
  }

  if (id === 16) {
    emu(out, cam, t, 3, TALL_EMU[0], 0, TALL_EMU[2], -1, 0, "stand", { front: true, eye: f < 1318 ? "wide" : "open", scale: 1.06 });
    one(out, cam, t, GUNNER(1), TALL_EMU[0] - 0.95, 0, TALL_EMU[2] + 0.15, { expr: exprAt(t, [[1303, "neutral"], [1352, "nervous"]]) });
  }

  if (id === 17 || id === 18) {
    const fa = who(farmerO(1), 31, "fa1"), hand: V3 = [HOSE[0] - 0.35, 1.05, HOSE[2]];
    facing(out, cam, t, fa, HOSE[0], 0, HOSE[2], -1, 0.3, id === 17 ? exprAt(t, [[1383, "smile"], [1420, "grin"]]) : exprAt(t, [[1508, "grin"], [1540, "shock"]]));
    let target: V3 | null = null;
    if (id === 17) {
      const wet = f >= 1440;
      for (let k = 0; k < 4; k++) {
        const x = HOSE[0] - 4.6 + k * 0.8, z = HOSE[2] + 1.8 + (k % 2) * 0.2;
        one(out, cam, t, GUNNER(k), x, 0, z, { expr: wet ? exprAt(t, [[1440, "shock"], [1488, "pained"]]) : "stern" });
        if (wet) fx(out, `drip${q((t * 2 + k * 0.3) % 1, 12)}`, 300, (p) => fxDrips(p, q((t * 2 + k * 0.3) % 1, 12)), x, 1.0, z - 0.1, 0.9, { h: 1.8, soft: true });
      }
      if (f >= 1420) target = [HOSE[0] - 3.4 + 1.2 * Math.sin((f - 1420) * 0.06), 1.3, HOSE[2] + 1.8];
    } else {
      const t0 = 1530 / FPS;
      for (let k = 0; k < 14; k++) {
        const i = 700 + k, a = (k / 14) * Math.PI * 2 + hash(i, 1) * 0.4, r0 = 1 + 1.6 * hash(i, 2);
        const run = t > t0 + 0.08 * hash(i, 3), d = r0 + (run ? 7 * (t - t0) : 0);
        const x = HOSE[0] - 6 + Math.cos(a) * d, z = HOSE[2] + 3 + Math.sin(a) * d;
        emu(out, cam, t, i, x, 0, z, Math.cos(a), Math.sin(a), run ? "run" : "peck", { eye: run ? "wide" : "open", speed: 1.2 });
      }
      target = f < 1530 ? [HOSE[0] - 6, 0.6, HOSE[2] + 3] : [HOSE[0] - 6 + 2.5 * Math.sin((f - 1530) * 0.09), 0.05, HOSE[2] + 3 + 2 * Math.cos((f - 1530) * 0.07)];
      if (f >= 1530) fx(out, `spl${q(((f - 1530) / 18) % 1, 20)}`, 800, (p) => fxSplash(p, q(((f - 1530) / 18) % 1, 20)), target[0], 0.6, target[2], 1.4);
    }
    if (target) { // the water arc, as a camera-facing card from the nozzle to the target
      const ax = hand[0], ay = hand[1], az = hand[2], [bx, by, bz] = target;
      const sx = (bx - ax) * cam.right.x + (bz - az) * cam.right.z, sy = by - ay, len = Math.hypot(sx, sy);
      const uq = q((t * 2) % 1, 10);
      fx(out, `stream${uq}`, 1024, (p) => fxStream(p, uq), (ax + bx) / 2, (ay + by) / 2 + 0.25, (az + bz) / 2, len * Math.sign(sx || 1),
        { ch: 256, h: len / 4, rot: Math.atan(sy / (sx || 0.001)), soft: true });
    }
  }

  if (id === 10 || id === 11 || id === 12 || id === 13) {
    const gy = hAt(DAM_GUN[0] - 0.95, DAM_GUN[2] - 0.4), my = MAJOR_DAM[1];
    const gEx = id === 13 ? exprAt(t, [[1006, "grin"], [1051, "shock"]]) : id === 12 ? exprAt(t, [[923, "stern"], [990, "grin"]]) : "stern";
    facing(out, cam, t, GUNNER(0), DAM_GUN[0] - 0.95, gy, DAM_GUN[2] - 0.4, 0.2, 1, gEx);
    facing(out, cam, t, GUNNER(1), DAM_GUN[0] - 2.1, hAt(DAM_GUN[0] - 2.1, DAM_GUN[2] - 1.4), DAM_GUN[2] - 1.4, 0.2, 1, id === 13 && f >= 1051 ? "nervous" : "stern");
    one(out, cam, t, MAJ, MAJOR_DAM[0], my, MAJOR_DAM[2], { expr: id === 12 ? exprAt(t, [[923, "stern"], [984, "shock"]]) : "stern", look: 0 });
    const firing = (id === 12 && f >= 990) || (id === 13 && f < 1051);
    if (firing && f % 3 !== 2) { // muzzle flash at the end of the shroud
      fx(out, `muz${f % 3}`, 400, (p) => fxMuzzle(p, f % 3), DAM_GUN[0] + 0.15, DAM_GUN[1] + 1.18, DAM_GUN[2] + 0.95, id === 13 && f >= 1040 ? 0.35 : 0.75, { soft: false });
    }
    if (id === 13) smoke(out, t, 1051 / FPS, DAM_GUN[0], DAM_GUN[1] + 1.35, DAM_GUN[2] - 0.05, 0.9, 1.4);
    // emus round the water: drinking, then scattering from the first shot
    const t0 = 993 / FPS, n = id === 10 ? 40 : 70;
    for (let k = 0; k < n; k++) {
      const i = 800 + k, a = 0.25 + (Math.PI - 0.5) * hash(i, 1), r = DAM.r - 0.6 + 2.5 * hash(i, 2) * (k % 3 === 0 ? 1 : 0.2);
      const scat = (id === 12 && t > t0) || id === 13, tt = id === 13 ? t - t0 : t - t0;
      const out2 = scat ? Math.max(0, tt - 0.15 * hash(i, 3)) * 9 : 0;
      const x = DAM.x + Math.cos(a) * (r + out2), z = DAM.z + Math.sin(a) * (r + out2);
      const mode: EmuMode = scat && out2 > 0 ? "run" : id === 10 ? (hash(i, 4) < 0.5 ? "walk" : "stand") : hash(i, 4) < 0.7 ? "drink" : "stand";
      const dx = scat ? Math.cos(a) : -Math.cos(a), dz = scat ? Math.sin(a) : -Math.sin(a);
      emu(out, cam, t, i, x, hAt(x, z), z, dx, dz, mode, { eye: scat ? "wide" : "open", speed: 1.2 });
      if (id === 13 && k < 6) fx(out, "feather", 200, (p) => fxFeather(p), x, hAt(x, z) + 0.5 + 1.2 * ((t - t0) % 1), z, 0.35, { rot: t * 3 + k });
    }
  }

  if (id === 19) {
    facing(out, cam, t, MAJ, MAJOR_TRUCK[0], 0, MAJOR_TRUCK[2], -1, -0.3, exprAt(t, [[1626, "stern"], [1680, "neutral"], [1714, "shock"]]));
    const x = MAJOR_TRUCK[0] - 2.6 + 1.4 * (t - 1660 / FPS);
    emu(out, cam, t, 4, x, 0, MAJOR_TRUCK[2] - 1.0, 1, 0, "walk", { eye: "smug" });
  }
  if (id === 20) {
    one(out, cam, t, MAJ, TRUCK_STOP[0] + 2.2, 0, ROAD_Z - 2.4, { expr: exprAt(t, [[1732, "stern"], [1798, "nervous"]]), headTilt: 0.08 });
    one(out, cam, t, GUNNER(0), TRUCK_STOP[0] - 0.9, 0, ROAD_Z - 4.1, { mode: "sit", expr: "dazed" });
    one(out, cam, t, GUNNER(1), TRUCK_STOP[0] - 2.2, 0, ROAD_Z - 3.6, { mode: "sit", expr: "nervous" });
  }
  if (id === 21) {
    const x = CASINGS[0] - 1.0 + 1.1 * (t - 1858 / FPS);
    emu(out, cam, t, 5, x, 0, CASINGS[2] + 0.45, 1, 0, "walk", { eye: "smug" });
  }

  if (id === 22) {
    if (f < 1955) FARMERS.forEach((_, k) => one(out, cam, t, who(farmerO(k), 30 + k, `fa${k}`), TRUCK_STOP[0] + 6 + k * 1.2, 0, ROAD_Z + 4.5 + (k % 2) * 0.4, { expr: "grin", wave: (t * 3 + k) % 1 }));
    else {
      one(out, cam, t, who(farmerO(0), 30, "fa0"), FARMER[0], 0, FARMER[2], { expr: "grin", wave: 0.5 });
      fx(out, "coins", 300, (p) => fxCoins(p), FARMER[0] + 0.5, 1.4, FARMER[2] - 0.15, 0.4);
      emu(out, cam, t, 6, FARMER[0] + 2.4, WHEAT_H - 0.45, FARMER[2] + 1.6, -1, 0, "stand", { eye: "smug", ground: false });
    }
    const tp = truckPose(id, f);
    if (tp.on) puff(out, t, (Math.floor(f / 10) * 10) / FPS, tp.x - 3, 0, tp.z, 1.6, 1.2);
  }
  if (id === 23) { // the coat-of-arms pose against the sunset: kangaroo, shield, emu
    const y = hAt(ROCK[0], ROCK[2]);
    const sx = cam.right.x, kx = ROCK[0] - 1.7 * Math.sign(sx || 1) * -1, ex = ROCK[0] + 1.7 * Math.sign(sx || 1) * -1;
    const kd = (ROCK[0] - kx) || 1;
    const blinkK = lidAt(t, 400);
    const d = cam.pos.distanceTo(tmp.set(kx, y + 1, ROCK[2])), [w, h, k] = tier(d);
    const kMirror = kd * sx < 0, light = light2D(cam, kMirror);
    out.places.push({ key: `K|${q(light, 8)}|${blinkK > 0.9 ? 1 : 0}|${w}`, x: kx, y: hAt(kx, ROCK[2]), z: ROCK[2], mirror: kMirror, size: [w, h, k], draw: (p) => kangaroo(p, light, blinkK) });
    emu(out, cam, t, 7, ex, hAt(ex, ROCK[2]), ROCK[2], ROCK[0] - ex, 0, "proud", { eye: f > 2090 ? "smug" : "open" });
    fx(out, "shield", 500, (p) => shield(p), ROCK[0], y + 1.3, ROCK[2] + 0.05, 1.6, { ch: 650, h: 2.08 });
    const tp = truckPose(id, f);
    if (tp.on) puff(out, t, 2098 / FPS, tp.x - 3, 0.4, tp.z, 2.2, 1.0);
  }
  return out;
};
