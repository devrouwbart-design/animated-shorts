// "The Lake That Went Down the Drain": timeline, story state and cameras, all timed to the Henry narration
// (shorts/lake/voice/words.json, frames = seconds x 30). Same camera grammar as the bridge short: cuts on big
// reframes, symmetric smootherstep glides of 18-40 f, every hold creeps in, 7-frame flip kicks on impacts.
export const FPS = 30;
export const TOTAL = 2100;
export type V3 = [number, number, number];

// ---------------- places (metres) ----------------
export const D0 = 1.2; // shore ground height (build.ts house() default)
export const G = D0;
export const LAKE_R = 118; // waterline radius at normal level
export const BED_Y = -12; // foot of the steep bank (lakebed rim)
export const PIT_Y = -38; // centre of the drained crater
export const RIG_DECK = 1.6; // platform deck height
export const ISLAND: V3 = [-42, 0, 46];
export const CANAL = { x: LAKE_R - 4, z: 24, w: 9 }; // canal mouth on the east shore, running east (+x)
export const MINE_Y = -160; // salt mine floor
export const SHAFT: V3 = [13, MINE_Y, -50]; // elevator shaft centre
export const ROOF: V3 = [2, MINE_Y, 5]; // where the drill comes through the mine roof (between the lamps)
export const BATH: V3 = [600, 0, 600]; // bathroom floor corner
export const TUB: V3 = [BATH[0] + 3, BATH[1] + 0.62, BATH[2] + 3]; // tub water surface centre
export const DRAIN: V3 = [TUB[0] + 0.5, TUB[1] - 0.42, TUB[2]]; // tub plug hole (on the tub floor)

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
export type Light = "day" | "golden";
export type Set = "lake" | "mine" | "bath";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: Set; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 219, light: "day", set: "lake" },        // hook: the whirlpool from above (flash-forward)
  { id: 2, a: 219, b: 316, light: "day", set: "lake" },      // "You see, Lake Peigneur ... ten feet deep"
  { id: 3, a: 316, b: 405, light: "day", set: "lake" },      // "Calm, full of fish, with a fancy garden"
  { id: 4, a: 405, b: 480, light: "day", set: "lake" },      // "a Texaco rig is drilling for oil"
  { id: 5, a: 480, b: 550, light: "day", set: "lake" },      // "the drill gets stuck"
  { id: 6, a: 550, b: 615, light: "day", set: "lake" },      // "the whole rig starts to tilt"
  { id: 7, a: 615, b: 721, light: "day", set: "lake" },      // "loud pops, jumps in a boat, gets away"
  { id: 8, a: 721, b: 784, light: "day", set: "lake" },      // "the lake starts to spin"
  { id: 9, a: 784, b: 841, light: "day", set: "lake" },      // "A whirlpool swallows the rig"
  { id: 10, a: 841, b: 924, light: "day", set: "lake" },     // "Then a tugboat. Then the barges"
  { id: 11, a: 924, b: 1001, light: "day", set: "lake" },    // the fisherman
  { id: 12, a: 1001, b: 1122, light: "day", set: "lake" },   // the canal pours in backwards as a waterfall
  { id: 13, a: 1122, b: 1170, light: "day", set: "lake" },   // "Wait. Where is all that water going?" (dive)
  { id: 14, sunAz: 165, sunEl: 40, a: 1170, b: 1275, light: "day", set: "mine" },   // the salt mine, 55 miners
  { id: 15, sunAz: 165, sunEl: 40, a: 1275, b: 1368, light: "day", set: "mine" },   // the electrician, water, alarm
  { id: 16, sunAz: 165, sunEl: 40, a: 1368, b: 1430, light: "day", set: "mine" },   // "every single miner gets out" (elevator)
  { id: 17, a: 1430, b: 1486, light: "day", set: "lake" },   // "the lake doesn't" (empty bed)
  { id: 18, sunAz: 165, sunEl: 40, a: 1486, b: 1558, light: "day", set: "mine" },   // the drill punches through the roof
  { id: 19, a: 1558, b: 1651, light: "day", set: "bath" },   // "Picture a bathtub. Pull the plug ..."
  { id: 20, a: 1651, b: 1840, light: "day", set: "bath" },   // the salt drain grows
  { id: 21, a: 1840, b: 1918, light: "golden", set: "lake" },// two days to refill
  { id: 22, a: 1918, b: 2027, light: "golden", set: "lake" },// barges pop up like corks
  { id: 23, a: 2027, b: TOTAL, light: "golden", set: "lake" },// "Just saltier."
];
/** crossfades at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 14: 8, 17: 6, 18: 6, 19: 8, 21: 8 };
export const FLASH_AT = 219;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state (pure functions of shot id + frame) ----------------
/** whirlpool strength 0..1 and the lake level (m, 0 = normal; null = drained, water hidden) */
export const vortexAt = (id: number, f: number) => {
  if (id === 1) return 1;
  if (id === 8) return 0.6 * smooth((f - 735) / 45);
  if (id === 9) return 0.6 + 0.4 * smooth((f - 784) / 40);
  if (id >= 10 && id <= 13) return 1;
  return 0;
};
export const levelAt = (id: number, f: number): number | null => {
  if (id === 1) return -1.5;
  if (id <= 9) return 0;
  if (id === 10) return lin([[841, -0.5], [924, -2]], f);
  if (id === 11) return -2.5;
  if (id === 12) return lin([[1001, -5], [1122, -7]], f);
  if (id === 13) return -7;
  if (id === 17) return null;
  if (id === 21) return lin([[1840, -9], [1918, -2.5]], f);
  if (id >= 22) return 0;
  return 0;
};
/** depth of the funnel below the level at radius r (m) */
export const funnel = (v: number, r: number) => v * (34 / (1 + (r / 7) ** 2) + 3.5 * Math.exp(-((r / 45) ** 2)));
/** angular speed of the water around the drain (rad/s) at radius r */
export const spin = (v: number, r: number) => v * (14 / (r + 6));

export type Pose = { x: number; y: number; z: number; yaw: number; tilt: number; roll: number; on: boolean };
const off: Pose = { x: 0, y: -999, z: 0, yaw: 0, tilt: 0, roll: 0, on: false };
/** a point riding the whirlpool: starts at radius r0 / angle a0 at frame f0, spirals in and goes down */
const spiral = (f: number, f0: number, r0: number, a0: number, dur: number, v: number, lvl: number): Pose => {
  const u = clamp01((f - f0) / dur), r = Math.max(0.5, r0 * (1 - u) ** 1.4);
  const a = a0 + (r0 > 0 ? 3.2 * u * u * (14 / (r + 6)) * (dur / FPS) * 0.4 : 0);
  const sink = funnel(v, r) * 0.92 + 6 * Math.max(0, u - 0.8) / 0.2;
  return { x: r * Math.cos(a), y: lvl - sink, z: r * Math.sin(a), yaw: -a, tilt: 0.5 * u, roll: 0.25 * u, on: u < 1 };
};
/** the rig: upright, tilting, sinking, gone */
export const rigPose = (id: number, f: number): Pose => {
  const base = { ...off, on: true, y: 0 };
  if (id === 1) return { ...spiral(140 + f * 0.05, 0, 9, 0.8, 300, 1, -1.5), tilt: 0.38, roll: 0.2, on: true };
  if (id <= 5) return base;
  if (id === 6) return { ...base, tilt: 0.12 * smooth((f - 575) / 40) };
  if (id === 7) return { ...base, tilt: 0.12 + 0.04 * smooth((f - 630) / 80) };
  if (id === 8) return { ...base, tilt: 0.16 + 0.06 * smooth((f - 721) / 63), y: -funnel(vortexAt(id, f), 0) * 0.2 };
  if (id === 9) {
    const u = smooth((f - 790) / 48), v = vortexAt(id, f);
    return { ...base, x: 2 * Math.sin(u * 4), z: 2 * Math.cos(u * 4) - 2, y: -funnel(v, 2) * 0.25 - 26 * u * u, tilt: 0.22 + 0.4 * u, roll: 0.3 * u, yaw: 1.4 * u, on: u < 0.999 };
  }
  return off;
};
export const TUG0: V3 = [17, 0, -7];
export const tugPose = (id: number, f: number): Pose => {
  if (id === 1) return { ...spiral(60 + f * 0.25, 0, 30, 2.4, 300, 1, -1.5), on: true };
  if (id >= 2 && id <= 9) return { ...off, on: true, x: TUG0[0], y: 0, z: TUG0[2], yaw: 0.5 };
  if (id === 10) return spiral(f, 841, Math.hypot(TUG0[0], TUG0[2]), Math.atan2(TUG0[2], TUG0[0]), 40, 1, levelAt(id, f) ?? 0);
  return off;
};
/** eleven barges moored in a line west of the rig; in shot 10 they ride the whirlpool one after another */
export const BARGE0 = (k: number): V3 => [-16 - 6.5 * (k % 6), 0, 8 + 13 * Math.floor(k / 6)];
export const bargePose = (id: number, k: number, f: number): Pose => {
  const [x0, , z0] = BARGE0(k), r0 = Math.hypot(x0, z0), a0 = Math.atan2(z0, x0);
  if (id === 1) return { ...spiral(40 + f * 0.25 + k * 9, 0, 34 + 1.5 * k, a0 + k * 0.5, 330, 1, -1.5), on: true };
  if (id >= 2 && id <= 9) return { ...off, on: true, x: x0, y: 0, z: z0, yaw: 0 };
  if (id === 10) return spiral(f, 862 + k * 5, r0, a0, 55, 1, levelAt(id, f) ?? 0);
  if (id >= 22) { // nine of the eleven pop back up like corks (two never did)
    if (k >= 9) return off;
    const at = 1958 + k * 6, u = (f - at) / FPS;
    const POP: V3[] = [[-6, 0, 10], [8, 0, 18], [-14, 0, 24], [16, 0, 4], [2, 0, 30], [-22, 0, 6], [20, 0, 26], [-4, 0, 42], [10, 0, 40]];
    const [x, , z] = POP[k];
    if (id === 22 && u < 0) return { ...off, x, z, y: -4, on: false };
    const t = id === 23 ? 3 : u;
    const y = t < 0.18 ? -3 + 3.8 * (t / 0.18) : 0.8 * Math.exp(-3 * (t - 0.18)) * Math.cos(9 * (t - 0.18));
    return { x, y, z, yaw: k * 1.3, tilt: 0.25 * Math.exp(-2 * t) * Math.sin(7 * t), roll: 0.15 * Math.exp(-2 * t) * Math.cos(6 * t), on: true };
  }
  return off;
};
/** the crew boat: moored at the platform, crew jumps in (652-664), runs away from 681 */
export const BOAT0: V3 = [5.5, 0, -8.5];
export const boatPose = (id: number, f: number): Pose => {
  if (id >= 2 && id <= 6) return { ...off, on: true, x: BOAT0[0], y: 0, z: BOAT0[2], yaw: 0.3 };
  if (id === 7 || id === 8) {
    const u = Math.max(0, (f - 681) / FPS), d = 6 * u * u + 2 * u;
    return { ...off, on: true, x: BOAT0[0] + 0.45 * d, y: 0.08 * Math.sin(f * 0.7) * Math.min(1, u), z: BOAT0[2] - d, yaw: 0.3 + 0.1 * Math.min(1, u), tilt: -0.08 * Math.min(1, u) };
  }
  return off;
};
/** the fisherman's skiff: out on the lake, then floors it to the south shore (lands at 982 on "shore") */
export const SKIFF0: V3 = [-24, 0, -60];
export const skiffPose = (id: number, f: number): Pose => {
  if (id <= 10 && id >= 2) return { ...off, on: true, x: SKIFF0[0], y: 0.05 * Math.sin(f * 0.1), z: SKIFF0[2], yaw: 0.6 };
  if (id === 11) {
    const u = clamp01((f - 930) / 52), z = -66 - 50 * easeOut(u) ** 1.2;
    const lvl = levelAt(id, f) ?? 0;
    return { ...off, on: true, x: -20 + 3 * u, y: lvl + (u >= 1 ? 0.5 : 0.1 * Math.sin(f * 0.9)), z, yaw: Math.PI, tilt: u >= 1 ? 0.1 : -0.12 };
  }
  if (id === 23) return { ...off, on: true, x: 4, y: 0.05 * Math.sin(f * 0.12), z: -24, yaw: 0.9 };
  return off;
};
/** salt-mine elevator cage height above the mine floor */
export const cageY = (id: number, f: number) => (id === 16 ? 0.0 + 16 * smooth((f - 1385) / 50) ** 1.3 : 0);
/** mine: water depth running down the tunnel toward the camera (shot 15 from "rushing") */
export const mineWater = (id: number, f: number) => (id === 15 ? smooth((f - 1300) / 60) : id === 16 ? 1 : 0);
/** mine roof: drill bit length through the roof (m) and the water column below it (0..1) */
export const roofDrill = (id: number, f: number) => (id === 18 ? lin([[1490, 0], [1500, 1.6], [1530, 2.0]], f) : 0);
export const roofWater = (id: number, f: number) => (id === 18 ? smooth((f - 1526) / 14) : 0);
/** bathtub: water level (0 full .. 1 empty), vortex 0..1, salt drain radius (m) */
export const tubState = (id: number, f: number) => {
  if (id === 19) return { level: 0.1 * smooth((f - 1600) / 50), vortex: smooth((f - 1600) / 30), hole: 0.025, salt: false, chain: smooth((f - 1586) / 10) };
  if (id === 20) {
    const g = lin([[1651, 0.03], [1715, 0.04], [1760, 0.06], [1840, 0.12]], f);
    return { level: 0.12 + 0.55 * smooth((f - 1700) / 140), vortex: 1, hole: g, salt: true, chain: 1 };
  }
  return { level: 0, vortex: 0, hole: 0.025, salt: false, chain: 0 };
};
/** golden refill waterfall + canal flow strength 0..1 */
export const fallAt = (id: number, f: number) => (id === 12 ? smooth((f - 1040) / 40) : id === 21 ? 1 : 0);

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
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// shot 1: orbiting aerial over the whirlpool, then down to the sinking rig, then over to the barges
const S1a = (f: number) => { const a = -2.3 + f * 0.0016; return dolly([70 * Math.cos(a), 58, 70 * Math.sin(a)], [0, -8, 0], pushK(f, 0, 0.0018), { fov: 44 }); };
const S1b = (f: number) => { const r = rigPose(1, f); return dolly([r.x + 20, 9, r.z - 24], [r.x, r.y + 4, r.z], pushK(f, 118, 0.002), { fov: 40, roll: -0.04 }); };
const S1c = (f: number) => dolly([-12, 16, -40], [-14, -4, 4], pushK(f, 166, 0.0025), { fov: 42, roll: 0.04 });
// shot 2: establishing, from above the garden shore looking north over the calm lake
const S2a = (f: number) => dolly([4, G + 2.6, -131.5], [0, -1.2, -70], pushK(f, 213, 0.002), { fov: 46 });
// shot 3: the garden walk on the shore, then over to the fish jumping
const S3a = (f: number) => dolly([-4.5, G + 1.7, -117.2], [-3, G + 1.2, -123.5], pushK(f, 316, 0.0025), { fov: 42 }); // from the water's edge, looking at the walk + garden
const S3b = (f: number) => dolly([2, G + 2.4, -127], [6, 0.8, -108], pushK(f, 338, 0.002), { fov: 40 });
const S3c = (f: number) => dolly([-12, G + 2.6, -128], [-4, G + 1.6, -116], pushK(f, 362, 0.002, 0.005, 30), { fov: 42 });
// shot 4: the rig and its crew
const S4a = (f: number) => dolly([18, 7.5, -24], [0, 7, 0], pushK(f, 405, 0.0022), { fov: 44 });
const S4b = (f: number) => dolly([7, RIG_DECK + 2.6, -9], [0.5, RIG_DECK + 1.4, -1.5], pushK(f, 445, 0.0025), { fov: 40 });
// shot 5: the drill pipe close-up, a worker beside it; punch-in on "stuck"
const S5a = (f: number) => dolly([2.6, RIG_DECK + 1.9, -4.4], [0.2, RIG_DECK + 1.2, 0], pushK(f, 480, 0.0025, 0.007, 30), { fov: 38 });
// shot 6: low, wide: the rig starts to tilt (dutch)
const S6a = (f: number) => dolly([15, 1.6, -19], [0, 10, 0], pushK(f, 550, 0.0025), { fov: 46, roll: -0.03 });
const S6b = (f: number) => dolly([15, 1.6, -19], [0, 10, 0], pushK(f, 550, 0.0025), { fov: 46, roll: 0.06 });
// shot 7: the crew on the deck edge and the boat below; follow the boat out
const S7a = (f: number) => dolly([12, 3.4, -18], [3, 1.6, -6], pushK(f, 615, 0.0025), { fov: 42 });
const S7b = (f: number) => { const b = boatPose(7, f); return { pos: [b.x + 9, 3.2, b.z - 10] as V3, look: [b.x, 0.8, b.z] as V3, fov: 42, roll: -0.03 }; };
// shot 8: high wide behind the escaping boat, the lake starts to spin
const S8a = (f: number) => dolly([34, 20, -70], [0, -2, 0], pushK(f, 721, 0.0025), { fov: 44 });
// shot 9: the rig goes down the funnel
const S9a = (f: number) => dolly([26, 15, -36], [0, -4, 0], pushK(f, 784, 0.003), { fov: 42, roll: 0.03 });
// shot 10: the tug, then the barges in a line
const S10a = (f: number) => dolly([30, 14, -34], [8, -4, -2], pushK(f, 841, 0.002), { fov: 42 });
const S10b = (f: number) => dolly([-44, 18, -30], [-10, -6, 6], pushK(f, 865, 0.0025), { fov: 44, roll: -0.03 });
// shot 11: tracking the fisherman's skiff to the shore
const S11a = (f: number) => { const s = skiffPose(11, f); return { pos: [s.x + 7, s.y + 2.6, s.z - 7] as V3, look: [s.x, s.y + 1.0, s.z] as V3, fov: 40, roll: 0.03 }; };
const S11b = (f: number) => dolly([-9, G + 2.4, -127], [-16.5, -1.6, -114], pushK(f, 975, 0.004), { fov: 42 });
// shot 12: the canal mouth: the water turns round and pours over the bank
const S12a = (f: number) => dolly([CANAL.x - 30, -1, CANAL.z - 26], [CANAL.x, -5, CANAL.z], pushK(f, 1001, 0.0022), { fov: 44 });
const S12b = (f: number) => dolly([CANAL.x - 18, -4.5, CANAL.z - 12], [CANAL.x + 1, -6, CANAL.z], pushK(f, 1085, 0.003, 0.006, 25), { fov: 42, roll: 0.04 });
// shot 13: straight down into the whirlpool
const S13a = (f: number) => { const u = glide((f - 1122) / 48); return { pos: [0.4, 60 - 70 * u, -6 + 5.8 * u] as V3, look: [0, -40, 0] as V3, fov: 48 + 10 * u, roll: 0.6 * u }; };
// shot 14: the salt mine, miners at work down a long white room-and-pillar gallery
const S14a = (f: number) => dolly([4, MINE_Y + 2.4, -44], [0, MINE_Y + 1.8, -14], pushK(f, 1170, 0.002), { fov: 44 });
const S14b = (f: number) => dolly([2.5, MINE_Y + 1.9, -30], [-1, MINE_Y + 1.6, -20], pushK(f, 1220, 0.0025), { fov: 40 });
// shot 15: the electrician MS, then the reverse: water rushing down the tunnel toward us
const S15a = (f: number) => dolly([3.6, MINE_Y + 1.8, -40.5], [2, MINE_Y + 1.55, -36.5], pushK(f, 1275, 0.0025), { fov: 38 });
const S15b = (f: number) => dolly([0.5, MINE_Y + 1.2, -42], [0, MINE_Y + 1.0, -10], pushK(f, 1306, 0.003), { fov: 44, roll: -0.04 });
const S15c = (f: number) => dolly([3.8, MINE_Y + 1.9, -41.5], [2, MINE_Y + 1.6, -36.5], pushK(f, 1348, 0.0025, 0.006, 20), { fov: 40, roll: 0.04 });
// shot 16: the elevator cage rises with the miners
const S16a = (f: number) => { const y = cageY(16, f); return { pos: [SHAFT[0] - 4.2, MINE_Y + 1.3, SHAFT[2] - 4.6] as V3, look: [SHAFT[0], MINE_Y + 1.5 + y * 0.9, SHAFT[2]] as V3, fov: 46 }; };
// shot 17: the empty lake bed
const S17a = (f: number) => dolly([46, 3, -96], [0, PIT_Y + 8, 0], pushK(f, 1430, 0.002), { fov: 44 });
// shot 18: looking up at the mine roof as the drill punches through
const S18a = (f: number) => dolly([ROOF[0] + 3.2, MINE_Y + 1.2, ROOF[2] - 7], [ROOF[0], MINE_Y + 7.5, ROOF[2]], pushK(f, 1486, 0.0025, 0.007, 25), { fov: 46 });
// shots 19-20: the bathtub
const S19a = (f: number) => dolly(add(TUB, [-0.25, 1.15, -2.5]), add(TUB, [0.2, 0.25, 0.25]), pushK(f, 1558, 0.0025), { fov: 44 });
const S19b = (f: number) => dolly(add(TUB, [0.9, 0.95, -1.3]), add(DRAIN, [0, 0.3, 0]), pushK(f, 1618, 0.003), { fov: 40, roll: 0.03 });
const S20a = (f: number) => dolly(add(DRAIN, [0.14, 0.9, -0.16]), add(DRAIN, [0, 0, 0]), pushK(f, 1651, 0.0025), { fov: 44 });
const S20b = (f: number) => dolly(add(DRAIN, [0.12, 1.0, -0.16]), add(DRAIN, [0, 0, 0]), pushK(f, 1754, 0.0015, 0.006, 40), { fov: 44, roll: -0.04 });
// shot 21: golden refill, the waterfall from across the lake
const S21a = (f: number) => dolly([CANAL.x - 58, 10, CANAL.z - 48], [CANAL.x, -4, CANAL.z], pushK(f, 1840, 0.0018), { fov: 44 });
// shot 22: barges popping up
const S22a = (f: number) => dolly([18, 7, -38], [2, 0, 22], pushK(f, 1918, 0.0018), { fov: 46 });
// shot 23: the fisherman tastes the lake
const S23a = (f: number) => { const s = skiffPose(23, f); return dolly([s.x + 2.6, 1.9, s.z - 3.4], [s.x, 1.2, s.z], pushK(f, 2027, 0.0025, 0.006, 30), { fov: 38 }); };

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 118, cut: true, s: S1b }, { f: 166, dur: 26, s: S1c }],
  2: [{ f: 213, s: S2a }],
  3: [{ f: 316, s: S3a }, { f: 338, dur: 26, s: S3b }, { f: 362, cut: true, s: S3c }],
  4: [{ f: 405, s: S4a }, { f: 445, cut: true, s: S4b }],
  5: [{ f: 480, s: S5a }],
  6: [{ f: 550, s: S6a }, { f: 580, dur: 30, s: S6b }],
  7: [{ f: 615, s: S7a }, { f: 676, dur: 28, s: S7b }],
  8: [{ f: 721, s: S8a }],
  9: [{ f: 784, s: S9a }],
  10: [{ f: 841, s: S10a }, { f: 865, cut: true, s: S10b }],
  11: [{ f: 924, s: S11a }, { f: 975, cut: true, s: S11b }],
  12: [{ f: 1001, s: S12a }, { f: 1085, cut: true, s: S12b }],
  13: [{ f: 1122, s: S13a }],
  14: [{ f: 1166, s: S14a }, { f: 1220, cut: true, s: S14b }],
  15: [{ f: 1275, s: S15a }, { f: 1306, cut: true, s: S15b }, { f: 1348, cut: true, s: S15c }],
  16: [{ f: 1368, s: S16a }],
  17: [{ f: 1427, s: S17a }],
  18: [{ f: 1483, s: S18a }],
  19: [{ f: 1554, s: S19a }, { f: 1618, cut: true, s: S19b }],
  20: [{ f: 1651, s: S20a }, { f: 1754, dur: 30, s: S20b }],
  21: [{ f: 1836, s: S21a }],
  22: [{ f: 1918, s: S22a }],
  23: [{ f: 2027, s: S23a }],
};


// impact kicks: the drill jams, the pops, the rig hits the funnel, the drill punches the roof, the barges pop
const KICKS: [number, number][] = [[533 / FPS, 1.2], [637 / FPS, 0.8], [645 / FPS, 0.6], [800 / FPS, 0.9], [1500 / FPS, 1.2], [1351 / FPS, 0.5], [1984 / FPS, 0.4]];
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
  { f: 0, cInf: 0 },                // hook aerial
  { f: 118, cInf: 10 },             // the sinking rig
  { f: 166, cInf: 0 },              // barges
  { f: 219, cInf: 0 },              // establishing
  { f: 316, cInf: 12 },             // garden walk (strollers sharp)
  { f: 338, cInf: 6 },              // fish
  { f: 362, cInf: 10 },             // garden
  { f: 405, cInf: 0 },              // rig wide
  { f: 445, cInf: 12 },             // crew MS
  { f: 480, cInf: 14 },             // drill CU
  { f: 550, cInf: 0 },              // tilt, boat, wides
  { f: 924, cInf: 10 },             // skiff tracking
  { f: 975, cInf: 0 },
  { f: 1170, cInf: 6 },             // mine gallery
  { f: 1220, cInf: 10 },
  { f: 1275, cInf: 13 },            // electrician MS
  { f: 1306, cInf: 6 },             // water down the tunnel
  { f: 1348, cInf: 13 },
  { f: 1368, cInf: 8 },             // elevator
  { f: 1430, cInf: 0 },             // empty bed
  { f: 1486, cInf: 6 },             // roof
  { f: 1558, cInf: 10 },            // bathtub
  { f: 1618, cInf: 12 },
  { f: 1651, cInf: 5 },             // drain from above (shallow depth: keep the blur mild)
  { f: 1840, cInf: 0 },             // golden wides
  { f: 2027, cInf: 12 },            // fisherman MS
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};
