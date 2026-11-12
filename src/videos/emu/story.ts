// "The War We Lost to a Bird": timeline, story state and cameras, all timed to the Henry narration
// (shorts/emu/voice/words.json, frames = seconds x 30). Same camera grammar as the bridge and lake shorts: cuts on big
// reframes, symmetric smootherstep glides of 18-40 f, every hold creeps in, 7-frame flip kicks on impacts.
import type { LightName } from "./lights";
export const FPS = 30;
export const TOTAL = 2130;
export type V3 = [number, number, number];

// ---------------- places (metres, ground at y = 0) ----------------
export const G = 0;
export const D0 = 0; // house() default ground height (build.ts)
export const WHEAT_H = 0.95;                                        // wheat slab height
export const FIELD = { x0: -12, x1: 150, z0: -50, z1: 80 };         // the wheat paddock
export const ROAD_Z = -62;                                          // red dirt road running east-west
export const HOUSE: V3 = [-36, 0, 22];                              // farmhouse centre (front verandah faces -z)
export const MILL: V3 = [-50, 0, 12];                               // windmill
export const YARD: V3 = [-36, 0, 6];                                // dirt yard in front of the house (hose scene)
export const DAM = { x: 70, z: -135, r: 13 };                       // farm dam: water radius, bank ring at r + 4
export const DAM_W = -0.45;                                         // dam water level
export const NEST: V3 = [16, 0, -84];                               // hook: gun position in the open paddock
export const ROCK: V3 = [-84, 0, -112];                             // coat-of-arms knoll

/** terrain height: flat paddocks, the dam (pit + earth bank ring), the coat-of-arms knoll, low far hills */
export const hAt = (x: number, z: number) => {
  let h = 0;
  const rd = Math.hypot(x - DAM.x, z - DAM.z);
  if (rd < DAM.r + 1) h = Math.min(h, -1.7 * (1 - (rd / (DAM.r + 1)) ** 2) - 0.05);
  h += 1.7 * Math.exp(-(((rd - (DAM.r + 4)) / 3.0) ** 2));
  const rk = Math.hypot(x - ROCK[0], z - ROCK[2]);
  h += 2.2 * Math.exp(-((rk / 5.5) ** 2));
  const d = Math.hypot(x, z);
  if (d > 230) h += 9 * Math.min(1, (d - 230) / 260) * (0.6 + 0.4 * Math.sin(x * 0.011 + z * 0.007));
  return h;
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 3;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- shots ----------------
export type Light = LightName;
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 108, light: "day" },        // hook: gunner behind the Lewis gun vs one emu; CU emu on "bird"
  { id: 2, a: 108, b: 152, light: "day" },      // "And the bird won." the emu sprints past the dusty soldiers
  { id: 3, a: 152, b: 299, light: "day" },      // "You see ... farms out west, to grow wheat" aerial, then the farmer
  { id: 4, a: 299, b: 386, light: "day" },      // "Hot sun, red dirt, and miles of golden wheat"
  { id: 5, a: 386, b: 471, light: "day" },      // "twenty thousand emus walk in for dinner"
  { id: 6, a: 471, b: 555, light: "day" },      // "The farmers are soldiers, so they ask for soldiers"
  { id: 7, a: 555, b: 694, light: "day" },      // the truck, Major Meredith, two gunners, two guns, ten thousand bullets
  { id: 8, a: 694, b: 737, light: "rain" },     // "First, it rains."
  { id: 9, a: 737, b: 812, light: "day" },      // "the emus split up, and run out of range"
  { id: 10, a: 812, b: 870, light: "day" },     // "an ambush at a dam"
  { id: 11, a: 870, b: 923, light: "day" },     // "A thousand emus come to drink"
  { id: 12, a: 923, b: 1006, light: "day" },    // "He waits ... and opens fire"
  { id: 13, a: 1006, b: 1070, light: "day" },   // "Twelve emus later, the gun jams"
  { id: 14, a: 1070, b: 1165, light: "day" },   // "plan B: a machine gun on a truck"
  { id: 15, a: 1165, b: 1303, light: "day" },   // the bumpy chase
  { id: 16, a: 1303, b: 1383, light: "day" },   // "Wait. How do you miss a six-foot bird?"
  { id: 17, a: 1383, b: 1508, light: "day" },   // garden hose: a crowd standing still gets wet
  { id: 18, a: 1508, b: 1626, light: "day" },   // the emus run every which way
  { id: 19, a: 1626, b: 1732, light: "day" },   // "the invulnerability of tanks"
  { id: 20, a: 1732, b: 1858, light: "day" },   // "nine hundred and eighty-six emus"
  { id: 21, a: 1858, b: 1910, light: "day" },   // "ten bullets per bird"
  { id: 22, a: 1910, b: 1999, light: "golden" },// the army goes home; the farmers get paid
  { id: 23, a: 1999, b: TOTAL, light: "golden" },// the coat of arms; "The army doesn't."
];
/** crossfades at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 8: 6, 9: 6, 10: 8, 17: 8, 22: 8 };
export const FLASH_AT = 152;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state (pure functions of shot id + frame) ----------------
export type Pose = { x: number; y: number; z: number; yaw: number; tilt: number; roll: number; on: boolean };
export const OFF: Pose = { x: 0, y: -999, z: 0, yaw: 0, tilt: 0, roll: 0, on: false };
const P = (x: number, z: number, yaw = 0, y = 0): Pose => ({ x, y, z, yaw, tilt: 0, roll: 0, on: true });

/** truck: local +x is forward (bonnet), bed at local x < 0. Parked on the road, driving in, chasing, driving home. */
export const TRUCK_STOP: V3 = [-6, 0, ROAD_Z];
export const truckPose = (id: number, f: number): Pose => {
  if (id === 7) { const u = easeOut((f - 555) / 50); return { ...P(TRUCK_STOP[0] - 40 * (1 - u), TRUCK_STOP[2]), tilt: -0.03 * Math.sin(Math.PI * u) }; }
  if (id === 8) return P(TRUCK_STOP[0], TRUCK_STOP[2]);
  if (id === 14) { const u = Math.max(0, (f - 1150) / FPS); return { ...P(TRUCK_STOP[0] + 3 * u * u, TRUCK_STOP[2]), tilt: f > 1150 && f < 1162 ? -0.04 : 0 }; }
  if (id === 15) { // bouncing across the paddock south of the road, heading +x
    const t = (f - 1165) / FPS, x = 20 + 9 * t, n = Math.sin(t * 13) * 0.6 + Math.sin(t * 21 + 1) * 0.4;
    return { x, y: 0.18 * Math.abs(n), z: -92 + Math.sin(t * 0.8) * 1.5, yaw: 0.05 * Math.sin(t * 3), tilt: 0.07 * Math.sin(t * 17), roll: 0.06 * Math.sin(t * 11 + 2), on: true };
  }
  if (id === 22) { const t = (f - 1910) / FPS; return { ...P(TRUCK_STOP[0] + 2 + 6 * t * t * 0.4 + 4 * t, ROAD_Z), tilt: 0.01 * Math.sin(t * 20) }; }
  if (id === 23) { const t = (f - 1999) / FPS; return { ...P(-80 + 8 * t, ROAD_Z + 1.5), tilt: 0.01 * Math.sin(t * 20) }; }
  return OFF;
};
/** where the bed gun sits on the truck (local) */
export const BED_GUN: V3 = [-1.6, 1.55, 0];
/** the Lewis gun on its tripod: world position + aim yaw (0 = +x) + pitch; null = not in this shot */
export type Gun = { x: number; y: number; z: number; yaw: number; pitch: number; smoke: number };
export const DAM_GUN: V3 = [DAM.x - 6, hAt(DAM.x - 6, DAM.z - 18.2), DAM.z - 18.2];             // just behind the crest of the south bank, aiming north over the water
export const gunsAt = (id: number, f: number): Gun[] => {
  const recoil = (on: boolean) => (on ? 0.012 * (f % 2 ? 1 : -1) : 0);
  if (id === 1) return [{ x: NEST[0], y: 0, z: NEST[2], yaw: 0, pitch: 0.02, smoke: 0 }];
  if (id === 2) return [{ x: NEST[0], y: 0, z: NEST[2], yaw: 0.3, pitch: -0.15, smoke: 1 }];
  if (id === 7) return f >= 612 ? [{ x: TRUCK_STOP[0] - 4.6, y: 0, z: ROAD_Z - 4.4, yaw: 0, pitch: 0.05, smoke: 0 }, { x: TRUCK_STOP[0] - 2.2, y: 0, z: ROAD_Z - 4.6, yaw: 0.15, pitch: 0.05, smoke: 0 }] : [];
  if (id === 9) return [{ x: NEST[0], y: 0, z: NEST[2], yaw: 0.2 * Math.sin(f * 0.05), pitch: 0.02, smoke: 0 }];
  if (id >= 10 && id <= 13) {
    const firing = (id === 12 && f >= 990) || (id === 13 && f < 1051);
    return [{ x: DAM_GUN[0], y: DAM_GUN[1], z: DAM_GUN[2], yaw: Math.PI / 2 + 0.05 + recoil(firing), pitch: 0.03 + recoil(firing), smoke: id === 13 && f >= 1051 ? 1 : 0 }];
  }
  return [];
};
/** an emu herd: deterministic per-bird spots, so every shot can ask for its own flock */
export const hash = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixC = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixC(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0 (subject grows ~rate per frame; `punch` raises it for n frames with soft edges) */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// people / props the cameras frame (cast.ts reads the same constants)
export const HERO_EMU: V3 = [NEST[0] + 7.5, 0, NEST[2] + 0.4];                    // the hook's staring emu
export const FARMER: V3 = [-13.6, 0, -44];                                       // the proud veteran just outside his wheat
export const FARMERS: V3[] = [[-16, 0, -44], [-14.6, 0, -45.6], [-17.6, 0, -46.2]]; // three veterans outside the fence
export const MAJOR_TRUCK: V3 = [TRUCK_STOP[0] + 1.2, 0, ROAD_Z - 2.2];           // the major beside his truck
export const MAJOR_DAM: V3 = [DAM.x - 4.3, hAt(DAM.x - 4.3, DAM.z - 19.2), DAM.z - 19.2]; // peeking over the bank
export const TALL_EMU: V3 = [6, 0, -78];                                         // "six-foot bird": emu beside a soldier
export const HOSE: V3 = [YARD[0] + 4, 0, YARD[2] - 2];                           // farmer with the hose

// shot 1: low behind the gunner, the gun pointing at one emu; on "bird" the emu close-up
const S1a = (f: number) => dolly(add(NEST, [-3.2, 1.45, -0.45]), add(HERO_EMU, [0, 0.9, 0]), pushK(f, 0, 0.0025), { fov: 42, roll: -0.03 });
const S1b = (f: number) => dolly(add(HERO_EMU, [-2.2, 1.55, -0.5]), add(HERO_EMU, [0.05, 1.6, 0]), pushK(f, 92, 0.003, 0.007, 20), { fov: 36 });
// shot 2: MS on the soldiers; the emu runs past through frame
const S2a = (f: number) => dolly(add(NEST, [3.2, 1.4, -8.6]), add(NEST, [-0.6, 0.9, 0.4]), pushK(f, 108, 0.0025), { fov: 42, roll: 0.03 });
// shot 3: aerial over the wheatbelt, then the proud farmer
const S3a = (f: number) => { const u = (f - 152) / 100; return dolly([-90 + 30 * u, 38 - 6 * u, -110], [-18, 0, 14], pushK(f, 152, 0.0015), { fov: 46 }); };
const S3b = (f: number) => dolly(add(FARMER, [-1.6, 1.5, -4.0]), add(FARMER, [0.3, 1.3, 0]), pushK(f, 251, 0.0025), { fov: 40 });
// shot 4: low across the wheat tops toward the sun-baked house; then the wide lateral of endless wheat
const S4a = (f: number) => { const u = (f - 299) / 40; return { pos: [10 + 4 * u, WHEAT_H + 0.45, -40] as V3, look: [-30, 2.5, 18] as V3, fov: 44, roll: 0.02 }; };
const S4b = (f: number) => { const u = (f - 335) / 50; return dolly([60 - 10 * u, 9, -78], [70, 0, 10], pushK(f, 335, 0.0012), { fov: 48 }); };
// shot 5: the herd walks in over the far side of the paddock; then a close-up emu eating wheat
const S5a = (f: number) => dolly([34, 3.2, -46], [52, 0.9, 6], pushK(f, 386, 0.002), { fov: 42 });
const S5b = (f: number) => dolly([22.6, WHEAT_H + 1.0, -36.2], [24, WHEAT_H + 0.5, -33], pushK(f, 450, 0.0025, 0.006, 20), { fov: 38 });
// shot 6: the three veterans at the fence, emus eating behind them
const S6a = (f: number) => dolly(add(FARMERS[0], [1.5, 1.5, -6]), add(FARMERS[0], [0.7, 1.25, 1]), pushK(f, 471, 0.0025, 0.006, 25), { fov: 42 });
// shot 7: the truck rolls up the road; the major; the gunners with the guns; the ammo boxes
const S7a = (f: number) => dolly([TRUCK_STOP[0] + 9, 1.6, ROAD_Z - 11], [TRUCK_STOP[0] - 6, 1.4, ROAD_Z], pushK(f, 555, 0.002), { fov: 44 });
const S7b = (f: number) => dolly(add(MAJOR_TRUCK, [0.6, 1.55, -3.3]), add(MAJOR_TRUCK, [0, 1.5, 0]), pushK(f, 589, 0.0025), { fov: 40, roll: 0.03 });
const S7c = (f: number) => dolly([TRUCK_STOP[0] - 3.5, 1.4, ROAD_Z - 10], [TRUCK_STOP[0] - 3.5, 1.0, ROAD_Z - 4], pushK(f, 612, 0.0025), { fov: 42 });
const S7d = (f: number) => dolly([TRUCK_STOP[0] + 1.6, 1.5, ROAD_Z - 7.2], [TRUCK_STOP[0] - 0.4, 0.6, ROAD_Z - 4.2], pushK(f, 670, 0.003, 0.007, 20), { fov: 40, roll: -0.03 });
// shot 8: rain on the soldiers beside the truck
const S8a = (f: number) => dolly([TRUCK_STOP[0] + 1, 1.5, ROAD_Z - 9.5], [TRUCK_STOP[0] - 2, 1.3, ROAD_Z - 3], pushK(f, 694, 0.0025), { fov: 42 });
// shot 9: aerial: the herd splits into little groups running every way; then the gunner, emus out of range
const S9a = (f: number) => dolly(add(NEST, [-24, 26, -26]), add(NEST, [26, 0, 6]), pushK(f, 737, 0.0018), { fov: 46 });
const S9b = (f: number) => dolly(add(NEST, [-2.6, 1.45, 0.9]), add(NEST, [30, 1.0, 2]), pushK(f, 796, 0.004), { fov: 34 });
// shots 10-13: the dam ambush
const S10a = (f: number) => dolly([DAM.x - 26, 7, DAM.z - 40], [DAM.x, 0, DAM.z], pushK(f, 812, 0.002), { fov: 44 });
const S10b = (f: number) => dolly(add(MAJOR_DAM, [2.5, 0.8, -3.2]), add(MAJOR_DAM, [0, 0.9, 0.5]), pushK(f, 846, 0.003), { fov: 40 });
const S11a = (f: number) => dolly([DAM.x - 4, 2.9, DAM.z - 19], [DAM.x + 2, 0.2, DAM.z + 8], pushK(f, 870, 0.0022), { fov: 44 });
const S12a = (f: number) => dolly(add(MAJOR_DAM, [0.9, 0.72, -1.9]), add(MAJOR_DAM, [0, 0.95, 0]), pushK(f, 923, 0.002, 0.006, 25), { fov: 38 });
const S12b = (f: number) => dolly(add(DAM_GUN, [1.9, 1.7, -1.7]), add(DAM_GUN, [-0.8, 1.1, 8]), pushK(f, 982, 0.003), { fov: 42, roll: 0.04 });
const S13a = (f: number) => dolly([DAM.x + 14, 2.4, DAM.z - 6], [DAM.x - 2, 0.6, DAM.z + 6], pushK(f, 1006, 0.0025), { fov: 42 });
const S13b = (f: number) => dolly(add(DAM_GUN, [0.9, 1.55, 1.7]), add(DAM_GUN, [-0.55, 1.3, -0.3]), pushK(f, 1040, 0.003, 0.008, 18), { fov: 40, roll: -0.04 });
// shot 14: the truck with the gun on the back
const S14a = (f: number) => { const tp = truckPose(14, f); return dolly([tp.x + 5.5, 2.2, ROAD_Z - 8], [tp.x - 0.6, 1.5, ROAD_Z], pushK(f, 1070, 0.0025), { fov: 42 }); };
// shot 15: tracking beside the bouncing truck; emus pull away ahead
const S15a = (f: number) => { const tp = truckPose(15, f); return { pos: [tp.x + 1.5, 2.3, tp.z - 9] as V3, look: [tp.x + 4, 1.4, tp.z] as V3, fov: 44, roll: 0.02 * Math.sin(f * 0.4) }; };
const S15b = (f: number) => { const tp = truckPose(15, f); return { pos: [tp.x + 10, 1.5, tp.z - 6.5] as V3, look: [tp.x + 2, 1.5, tp.z] as V3, fov: 42, roll: -0.03 }; };
const S15c = (f: number) => { const tp = truckPose(15, f); return { pos: [tp.x - 0.4, 2.9, tp.z - 2.6] as V3, look: [tp.x - 1.6, 2.2, tp.z] as V3, fov: 40, roll: 0.05 * Math.sin(f * 0.6) }; };
// shot 16: "Wait." the emu stares into the lens; then tilt up from the soldier to the emu's head
const S16a = (f: number) => dolly(add(TALL_EMU, [0.4, 1.7, -2.6]), add(TALL_EMU, [0, 1.7, 0]), pushK(f, 1303, 0.003), { fov: 38 });
const S16b = (f: number) => { const u = glide((f - 1340) / 30); return dolly(add(TALL_EMU, [-0.4, 1.3, -4.4]), add(TALL_EMU, [-0.45, 1.0 + 0.85 * u, 0]), pushK(f, 1318, 0.002), { fov: 40 }); };
// shots 17-18: the hose in the yard
const S17a = (f: number) => dolly(add(HOSE, [-2.0, 1.7, -10.5]), add(HOSE, [-2.0, 1.0, 1.0]), pushK(f, 1383, 0.0022), { fov: 44 });
const S17b = (f: number) => dolly(add(HOSE, [-2.6, 1.5, -3.0]), add(HOSE, [-3.0, 1.25, 1.8]), pushK(f, 1470, 0.003, 0.006, 25), { fov: 40 });
const S18a = (f: number) => dolly(add(HOSE, [-4, 7.5, -10]), add(HOSE, [-5.5, 0, 3]), pushK(f, 1508, 0.0018), { fov: 48 });
// shot 19: the major, an emu strolls past behind him
const S19a = (f: number) => dolly(add(MAJOR_TRUCK, [0.5, 1.55, -3.2]), add(MAJOR_TRUCK, [0, 1.48, 0]), pushK(f, 1626, 0.002, 0.006, 25), { fov: 40 });
// shot 20: the pile of empty boxes and brass; the major counting
const S20a = (f: number) => dolly(add(TRUCK_STOP, [2.6, 2.0, -9.8]), add(TRUCK_STOP, [0.6, 0.9, -3.0]), pushK(f, 1732, 0.002, 0.005, 30), { fov: 44 });
// shot 21: ten casings in a row, an emu stalks through
export const CASINGS: V3 = [TRUCK_STOP[0] + 2.4, 0, ROAD_Z - 5.5];
const S21a = (f: number) => dolly(add(CASINGS, [0.95, 0.42, -0.75]), add(CASINGS, [0.2, 0.05, 0.05]), pushK(f, 1858, 0.003), { fov: 42 });
// shot 22: golden: the truck drives home along the road; the farmer with his reward
const S22a = (f: number) => dolly([TRUCK_STOP[0] - 3, 1.6, ROAD_Z - 9], [TRUCK_STOP[0] + 10, 1.3, ROAD_Z], pushK(f, 1910, 0.0018), { fov: 44 });
const S22b = (f: number) => dolly(add(FARMER, [-2.0, 1.5, -3.6]), add(FARMER, [0.3, 1.35, 0]), pushK(f, 1955, 0.0025), { fov: 40 });
// shot 23: the coat-of-arms knoll against the sunset; wide at "The army doesn't" with the truck far away
const S23a = (f: number) => dolly(add(ROCK, [0.3, 2.3, -12]), add(ROCK, [0, 3.0, 0]), pushK(f, 1999, 0.002), { fov: 40 });
const S23b = (f: number) => dolly(add(ROCK, [-2.5, 2.2, -16]), add(ROCK, [2.2, 2.8, 0]), pushK(f, 2079, 0.0015), { fov: 44, roll: 0.02 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 92, cut: true, s: S1b }],
  2: [{ f: 108, s: S2a }],
  3: [{ f: 148, s: S3a }, { f: 251, cut: true, s: S3b }],
  4: [{ f: 299, s: S4a }, { f: 335, cut: true, s: S4b }],
  5: [{ f: 386, s: S5a }, { f: 450, cut: true, s: S5b }],
  6: [{ f: 471, s: S6a }],
  7: [{ f: 555, s: S7a }, { f: 589, cut: true, s: S7b }, { f: 612, cut: true, s: S7c }, { f: 670, cut: true, s: S7d }],
  8: [{ f: 690, s: S8a }],
  9: [{ f: 733, s: S9a }, { f: 796, cut: true, s: S9b }],
  10: [{ f: 808, s: S10a }, { f: 846, cut: true, s: S10b }],
  11: [{ f: 870, s: S11a }],
  12: [{ f: 923, s: S12a }, { f: 982, cut: true, s: S12b }],
  13: [{ f: 1006, s: S13a }, { f: 1040, cut: true, s: S13b }],
  14: [{ f: 1070, s: S14a }],
  15: [{ f: 1165, s: S15a }, { f: 1220, cut: true, s: S15b }, { f: 1262, cut: true, s: S15c }],
  16: [{ f: 1303, s: S16a }, { f: 1318, cut: true, s: S16b }],
  17: [{ f: 1379, s: S17a }, { f: 1470, cut: true, s: S17b }],
  18: [{ f: 1508, s: S18a }],
  19: [{ f: 1626, s: S19a }],
  20: [{ f: 1732, s: S20a }],
  21: [{ f: 1858, s: S21a }],
  22: [{ f: 1906, s: S22a }, { f: 1955, cut: true, s: S22b }],
  23: [{ f: 1999, s: S23a }, { f: 2079, cut: true, s: S23b }],
};

// impact kicks: first shots, the gun jams, the truck lurches, the hose hits, the boxes land
const KICKS: [number, number][] = [[675 / FPS, 0.6], [990 / FPS, 0.8], [994 / FPS, 0.5], [998 / FPS, 0.5], [1051 / FPS, 1.0], [1152 / FPS, 0.6], [1262 / FPS, 0.8], [1420 / FPS, 0.4]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 10 },               // over the gunner's shoulder (emu sharp)
  { f: 92, cInf: 14 },              // emu CU
  { f: 108, cInf: 11 },             // soldiers MS
  { f: 148, cInf: 0 },              // aerial
  { f: 251, cInf: 12 },             // farmer MS
  { f: 299, cInf: 6 },              // across the wheat
  { f: 335, cInf: 0 },              // endless wheat
  { f: 450, cInf: 13 },             // emu eating CU
  { f: 471, cInf: 11 },             // veterans
  { f: 555, cInf: 0 },              // truck arrives
  { f: 589, cInf: 12 },             // the major
  { f: 612, cInf: 9 },              // gunners
  { f: 670, cInf: 12 },             // ammo boxes
  { f: 690, cInf: 8 },              // rain
  { f: 733, cInf: 0 },              // aerial split
  { f: 796, cInf: 10 },             // gunner, emus far
  { f: 808, cInf: 0 },              // dam wide
  { f: 846, cInf: 12 },             // major behind the bank
  { f: 870, cInf: 5 },              // emus drinking
  { f: 923, cInf: 13 },             // major waits
  { f: 982, cInf: 8 },              // open fire
  { f: 1006, cInf: 5 },
  { f: 1040, cInf: 13 },            // the jam
  { f: 1070, cInf: 8 },             // truck
  { f: 1165, cInf: 5 },             // chase
  { f: 1262, cInf: 10 },
  { f: 1303, cInf: 14 },            // emu stare
  { f: 1318, cInf: 10 },
  { f: 1379, cInf: 7 },             // hose
  { f: 1508, cInf: 0 },             // scatter from above
  { f: 1563, cInf: 5 },
  { f: 1626, cInf: 12 },            // major
  { f: 1732, cInf: 9 },             // the pile
  { f: 1858, cInf: 15 },            // casings CU
  { f: 1906, cInf: 0 },             // golden road
  { f: 1955, cInf: 12 },            // farmer
  { f: 1999, cInf: 5 },             // coat of arms
  { f: 2079, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
