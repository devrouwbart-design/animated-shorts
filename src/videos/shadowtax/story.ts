// "The King Who Taxed Shadows": timeline, story state and cameras, all timed to the Henry narration
// (shorts/shadowtax/voice/words.json, frames = seconds x 30). Camera grammar of the earlier shorts: cuts on big
// reframes, smootherstep glides of 18-40 f, every hold creeps in, 7-frame flip kicks on impacts. No lens blur.
//
// World compass: north = -z, east = +x, up = +y. The sun is placed per shot by azimuth (from north, clockwise) and
// elevation, so shadows agree from shot to shot and their lengths follow the real geometry (length = h / tan(el)).
import type { Light } from "./lights";
export type { Light };
export const FPS = 30;
export type V3 = [number, number, number];

// ---------------- places (metres) ----------------
export const D0 = 0; // ground height used by build.ts helpers
/** the market square: cobbles x -20..20, z -16..16; houses on the north and east sides, open to the south-west
 *  (toward the castle hill) so a low winter sun from the south-west reaches the whole square */
export const SQ = { x0: -20, x1: 20, z0: -16, z1: 16 };
/** the royal dais on the north side of the square (top at y 0.8), facing south */
export const DAIS: V3 = [0, 0, -12.5];
export const DAIS_TOP = 0.8;
export const KING_AT: V3 = [0, DAIS_TOP, -12.9];
/** castle on a low hill, 140 m away at azimuth 236 (south-west): the winter sunset sits right behind it */
export const CASTLE_AZ = 236;
const azXZ = (az: number, d: number): [number, number] => [Math.sin((az * Math.PI) / 180) * d, -Math.cos((az * Math.PI) / 180) * d];
const [CX, CZ] = azXZ(CASTLE_AZ, 140);
export const CASTLE: V3 = [CX, 0, CZ];
export const HILL_H = 4;
/** nursery table set (far from the town): table top at y 0.75, the toy king at its centre */
export const TAB: V3 = [3000, 0, 0];
export const TOY: V3 = [3000, 0.75, 0];
export const tab = (x: number, y: number, z: number): V3 => [TAB[0] + x, TAB[1] + y, TAB[2] + z];

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
export type Set = "town" | "table";
/** sunAz / sunEl: world compass (deg). winter: snow on the roofs and fields. */
export type ShotDef = { id: number; a: number; b: number; light: Light; set: Set; sunAz: number; sunEl: number; winter?: boolean };
const DAY = { light: "day" as const, set: "town" as const, sunAz: 150, sunEl: 42 };
const NOON = { light: "day" as const, set: "town" as const, sunAz: 180, sunEl: 63.4 };            // midsummer noon at 50 deg N
const WINTER_EVE = { light: "golden" as const, set: "town" as const, sunAz: 218, sunEl: 4.5, winter: true }; // late winter afternoon
const CLOUDY = { light: "overcast" as const, set: "town" as const, sunAz: 180, sunEl: 40 };
const SUNSET = { light: "golden" as const, set: "town" as const, sunAz: CASTLE_AZ, sunEl: 3, winter: true };  // right behind the castle
const DAWN = { light: "dawn" as const, set: "town" as const, sunAz: 122, sunEl: 6, winter: true };
const TABLE = { light: "table" as const, set: "table" as const, sunAz: 0, sunEl: 85 };
export const TOTAL = 1777;
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 60, ...DAY },           // swoop from over the castle down into the square: "A greedy king"
  { id: 2, a: 60, b: 103, ...DAY },         // "pay a tax on their shadows": a coin drops onto a villager's shadow
  { id: 3, a: 103, b: 196, ...DAY },        // "You see, his collector measured every shadow with a long rod."
  { id: 4, a: 196, b: 257, ...DAY },        // "The longer your shadow, the bigger your bill."
  { id: 5, a: 257, b: 295, ...DAY },        // "So the town got clever."
  { id: 6, a: 295, b: 352, ...NOON },       // "Everyone paid at noon in midsummer,"
  { id: 7, a: 352, b: 418, ...NOON },       // "when the sun is highest and shadows are shortest."
  { id: 8, a: 418, b: 444, ...NOON },       // "Tiny bills."
  { id: 9, a: 444, b: 488, ...NOON },       // "The king was furious."
  { id: 10, a: 488, b: 528, ...DAY },       // "So he moved tax day to a winter ..."
  { id: 11, a: 528, b: 665, ...WINTER_EVE }, // "... evening. Now the sun hung low, and every shadow stretched right across the square."
  { id: 12, a: 665, b: 767, ...TABLE },     // "Shine a torch straight down on a toy, and its shadow hides underneath."
  { id: 13, a: 767, b: 832, ...TABLE },     // "Shine it from the side, and the shadow gets long."
  { id: 14, a: 832, b: 862, ...WINTER_EVE }, // "Huge bills."
  { id: 15, a: 862, b: 929, ...CLOUDY },    // "Next, the town waited for a cloudy day."
  { id: 16, a: 929, b: 1009, ...CLOUDY },   // "Thick clouds scatter sunlight across the whole sky,"
  { id: 17, a: 1009, b: 1062, ...CLOUDY },  // "so light comes from everywhere at once."
  { id: 18, a: 1062, b: 1148, ...CLOUDY },  // "Shadows go soft and faint, with no edge to measure."
  { id: 19, a: 1148, b: 1188, ...CLOUDY },  // "The collector measured nothing."
  { id: 20, a: 1188, b: 1286, ...SUNSET },  // "Finally, the king picked a winter sunset without a single cloud."
  { id: 21, a: 1286, b: 1304, ...SUNSET },  // "Now what?"
  { id: 22, a: 1304, b: 1408, ...SUNSET },  // "The whole town squeezed into the long shadow of the king's own castle."
  { id: 23, a: 1408, b: 1520, ...SUNSET },  // "Inside a shadow, no sunlight reaches you, so you cast no shadow of your own."
  { id: 24, a: 1520, b: 1547, ...SUNSET },  // "Zero tax."
  { id: 25, a: 1547, b: 1593, ...SUNSET },  // "But the collector followed the rules."
  { id: 26, a: 1593, b: 1675, ...SUNSET },  // "He measured the biggest shadow in the kingdom, the castle's,"
  { id: 27, a: 1675, b: 1714, ...SUNSET },  // "and handed the bill to the king."
  { id: 28, a: 1714, b: TOTAL, ...DAWN },   // "The tax was gone by morning."
];
/** crossfades at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 11: 12, 12: 8, 14: 8, 15: 10, 20: 12, 28: 14 };
export const FLASH_AT = 103;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: shotAt(s.a - 0.5).id, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

/** world direction TOWARD the sun for a shot */
export const sunDirOf = (s: ShotDef): V3 => {
  const az = (s.sunAz * Math.PI) / 180, el = (s.sunEl * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
};

// ---------------- story state ----------------
/** table set: torch position relative to the toy (overhead, then swinging round to the side on "side") */
export const torchAt = (id: number, f: number): V3 => {
  if (id === 12) return [0.0, 0.4, 0.0];
  const u = smooth((f - 772) / 26), a = (u * 74 * Math.PI) / 180;      // 0 deg = straight above, 74 deg = low from the far side
  return [-0.4 * Math.sin(a), 0.4 * Math.cos(a), 0.0];
};
/** measuring rod on the ground: [x, z, yaw, length, visible] per shot (yaw: direction it points, from +x toward -z) */
export const COIN_AT = 76;
export const BILL = { tiny: 428, huge: 846, castle: 1688 };
/** clouds rolling in over shot 15 (0 = clear, 1 = full deck) */
export const cloudIn = (id: number, f: number) => (id === 15 ? smooth((f - 862) / 40) : id >= 16 && id <= 19 ? 1 : 0);
/** goose in shot 23: steps out of the castle shadow into the sun (shadow appears) and is pulled back in */
export const gooseX = (f: number) => lin([[1408, 0], [1432, 0], [1452, 4.8], [1468, 4.8], [1486, 0.6], [1520, 0.6]], f);

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
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ---- day geometry (sun az 150): shadows point DS (north-north-west); cameras look along DV, square to the shadows,
// so a shadow lies across the frame (screen left)
const rad = (d: number) => (d * Math.PI) / 180;
const sunXZ = (az: number): [number, number] => [Math.sin(rad(az)), -Math.cos(rad(az))];
const DS: [number, number] = [-sunXZ(150)[0], -sunXZ(150)[1]];
const DV: [number, number] = [-DS[1], DS[0]];
const off = (p: V3, a: number, b: number, y = p[1]): V3 => [p[0] + DS[0] * a + DV[0] * b, y, p[2] + DS[1] * a + DV[1] * b];
// places the cameras look at
export const P_FARMER: V3 = [-3.0, 0, 2.0];      // shots 2-3: the farmer whose shadow gets measured
const F_MID = off(P_FARMER, 0.95, 0);             // middle of the farmer's 1.9 m shadow
export const P_COL3 = off(P_FARMER, 1.7, -0.9);   // the collector, beside that shadow (nearer the lens)
const C4: V3 = [-0.3, 0, 2.2];
export const P_KID = off(C4, 0.7, -1.4), P_TALL = off(C4, -0.8, 1.6), P_COL4 = off(C4, 1.7, 0.7); // shot 4: kid near left, tall man far right
export const P_QUEUE: V3 = [0, 0, -6.5];          // the queue in front of the dais (it runs south from the collector)
export const P_SOFT: V3 = [2.0, 0, 1.0];          // shot 18: the villager with the soft, faint shadow
// ---- sunset geometry (sun az 236, right behind the castle): the castle's shadow crosses the square along SD;
// SN points across it toward the sunlit south-east side. The shadow's edge is ~18 m off its centre line.
export const SD: [number, number] = [-sunXZ(CASTLE_AZ)[0], -sunXZ(CASTLE_AZ)[1]];
export const SN: [number, number] = [-SD[1], SD[0]];
export const onSun = (d: number, n: number, y = 0): V3 => [SD[0] * d + SN[0] * n, y, SD[1] * d + SN[1] * n];
export const P_CROWD: V3 = onSun(0, 14.5);        // the crowd squeezed into the castle shadow, near its sunny edge
export const P_COL25: V3 = onSun(-1.5, 10.5);     // shot 25: the collector looks up at the castle
export const colWalk = (f: number): V3 => onSun(-3 - 9 * smooth((f - 1596) / 76), 0.5); // shot 26: pacing toward the castle

// 1: start high over the castle hill, rush over the roofs and land on the king on his dais
const S1a = (f: number): Shot => {
  const u = clamp01(f / 56), e = glide(u), k = Math.pow(u, 1.8);
  const p0: V3 = [CASTLE[0] + 30, 70, CASTLE[2] - 10], p1: V3 = [1.4, 2.4, -6.6];
  const l0: V3 = [-30, 0, 20], l1: V3 = [KING_AT[0], KING_AT[1] + 1.6, KING_AT[2]];
  return { pos: mixV(p0, p1, k), look: mixV(l0, l1, e), fov: 46 - 8 * e, roll: 0.25 * (1 - e) };
};
const S1b = (f: number) => dolly([1.4, 2.4, -6.6], [KING_AT[0], KING_AT[1] + 1.6, KING_AT[2]], pushK(f, 56, 0.004), { fov: 38 });
// 2: the farmer and his shadow, from the side so the shadow lies across the frame
const S2a = (f: number) => dolly(off(F_MID, -0.4, -6.4, 3.9), off(F_MID, -0.4, 0, 0.55), pushK(f, 60, 0.003, 0.007, 20), { fov: 42 });
// 3: the collector arrives and lays his rod along the shadow
const S3a = (f: number) => dolly(off(F_MID, 0.3, -8.0, 4.4), off(F_MID, 0.3, 0, 0.7), pushK(f, 103, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly(off(F_MID, 0.2, -5.6, 3.6), off(F_MID, 0.2, 0, 0.45), pushK(f, 160, 0.003, 0.006, 20), { fov: 42 });
// 4: kid with a short shadow, tall man with a long one, the collector between them
const S4a = (f: number) => dolly(off(C4, 0.3, -9.0, 4.4), off(C4, 0.3, 0, 0.6), pushK(f, 196, 0.002, 0.005, 25), { fov: 42 });
// 5: the townsfolk huddle and grin
const S5a = (f: number) => dolly([-5.6, 1.5, 7.6], [-5.6, 1.1, 3.6], pushK(f, 257, 0.004, 0.008, 18), { fov: 40, roll: 0.03 });
// 6: midsummer noon, the queue from high up: tiny shadows right under everyone's feet
const S6a = (f: number) => dolly([9, 8.5, -1.5], [0, 0.4, -6.6], pushK(f, 295, 0.002), { fov: 40, roll: -0.03 });
// 7: up at the high sun, then down to the feet ("shortest")
const S7a = (f: number) => ({ pos: [2.5, 1.0, -1.0] as V3, look: mixV([2.5 + 0.3, 30, -1.0 + 14], [0.3, 0.2, -6.4], glide((f - 372) / 26)), fov: 40 - 4 * glide((f - 372) / 26) });
const S7b = (f: number) => dolly([2.1, 1.0, -3.4], [0.0, 0.25, -6.6], pushK(f, 398, 0.004, 0.007, 18), { fov: 36 });
// 8: tiny bill for the baker
const S8a = (f: number) => dolly([1.6, 1.6, -4.0], [-0.1, 1.15, -7.4], pushK(f, 418, 0.004), { fov: 38 });
// 9: the king, furious
const S9a = (f: number) => dolly([0.3, 2.3, -9.8], [KING_AT[0], KING_AT[1] + 1.55, KING_AT[2]], pushK(f, 444, 0.003, 0.009, 18), { fov: 38 });
// 10: the king slams his decree
const S10a = (f: number) => dolly([-1.2, 2.0, -9.4], [KING_AT[0], KING_AT[1] + 1.4, KING_AT[2]], pushK(f, 488, 0.004, 0.008, 20), { fov: 40, roll: 0.03 });
// 11: winter evening: low over the cobbles toward the sun on the horizon, the long shadows reaching toward the lens,
//     then up high to see every shadow stretched right across the square
const S11a = (f: number) => dolly([9.5, 1.3, -11.5], [-6, 1.6, 6], pushK(f, 528, 0.0018), { fov: 42 });
const S11b = (f: number) => dolly([14, 16, -18], [-1.5, 0, -2], pushK(f, 596, 0.0015), { fov: 44, roll: -0.04 });
// 12-13: the nursery table: torch overhead, then to the side
const S12a = (f: number) => dolly(tab(1.0, 1.06, 0.14), tab(-0.05, 0.96, 0), pushK(f, 665, 0.0025), { fov: 40 });
const S12b = (f: number) => dolly(tab(0.62, 0.98, 0.08), tab(0, 0.8, 0), pushK(f, 720, 0.003, 0.006, 20), { fov: 40 });
const S13a = (f: number) => dolly(tab(1.0, 1.1, 0.1), tab(-0.1, 0.84, 0), pushK(f, 767, 0.002), { fov: 46 });
// 14: huge bills
const S14a = (f: number) => dolly([4.4, 1.7, -6.2], [1.0, 1.15, -9.6], pushK(f, 832, 0.004, 0.009, 16), { fov: 42 });
// 15: overcast arrives: townsfolk look up and grin
const S15a = (f: number) => dolly([-2.0, 0.8, 8.0], [-2.6, 2.6, 2.0], pushK(f, 862, 0.0025), { fov: 42 });
// 16: the cloud deck, the sun a dim glow behind it
const S16a = (f: number) => ({ pos: [0, 1.6, 12] as V3, look: mixV([-3, 60, -60], [8, 70, -40], glide((f - 929) / 80)), fov: 48, roll: 0.02 });
// 17: light arriving from everywhere onto one villager
const S17a = (f: number) => dolly([P_SOFT[0] + 0.4, 1.7, P_SOFT[2] + 5.2], [P_SOFT[0], 1.3, P_SOFT[2]], pushK(f, 1009, 0.003), { fov: 42 });
// 18: down at the feet: a soft, faint smudge; the collector kneels with the rod
const S18a = (f: number) => dolly([P_SOFT[0] + 0.8, 2.8, P_SOFT[2] + 4.8], [P_SOFT[0] - 0.9, 0.5, P_SOFT[2]], pushK(f, 1062, 0.0022, 0.005, 25), { fov: 44 });
// 19: nothing to measure
const S19a = (f: number) => dolly([P_SOFT[0] - 1.2, 1.7, P_SOFT[2] + 4.6], [P_SOFT[0] - 1.0, 1.45, P_SOFT[2] - 0.2], pushK(f, 1148, 0.0035, 0.007, 18), { fov: 42 });
// 20: the king at a clear winter sunset, the castle against the sun behind the square
const S20a = (f: number) => dolly([2.8, 1.9, -6.6], [KING_AT[0] - 0.4, KING_AT[1] + 1.5, KING_AT[2]], pushK(f, 1188, 0.002), { fov: 40 });
const S20b = (f: number) => dolly([10, 3.0, -16], [CASTLE[0], 16, CASTLE[2]], pushK(f, 1240, 0.0015), { fov: 40 });
// 21: villagers: now what?
const S21a = (f: number) => dolly([P_CROWD[0] + 1.0, 1.6, P_CROWD[2] + 5.2], [P_CROWD[0], 1.3, P_CROWD[2]], pushK(f, 1286, 0.005, 0.009, 14), { fov: 40 });
// 22: high over the town: the castle's long shadow lies across the square and the crowd squeezes into it
const S22a = (f: number) => dolly(onSun(48, 24, 30), onSun(-60, 15, 0), pushK(f, 1304, 0.0015), { fov: 44, roll: -0.03 });
const S22b = (f: number) => dolly(onSun(17, 21.5, 5.5), onSun(-4, 17.5, 0.8), pushK(f, 1360, 0.002), { fov: 44, roll: -0.02 });
// 23: inside the shadow: nobody has a shadow; the goose steps into the sun and gets one
const S23a = (f: number) => dolly(onSun(15, 19.6, 3.0), onSun(0, 17.4, 0.9), pushK(f, 1408, 0.0018), { fov: 44 });  // down the sun line toward the castle
// 24: zero tax
const S24a = (f: number) => dolly([P_CROWD[0] + 2.2, 1.7, P_CROWD[2] + 4.0], [P_CROWD[0] + 1.0, 1.3, P_CROWD[2] - 0.2], pushK(f, 1520, 0.004, 0.009, 16), { fov: 40 });
// 25: the collector, following the rules, looks up at the castle
const S25a = (f: number) => dolly([P_COL25[0] + SD[0] * 3.4, 1.45, P_COL25[2] + SD[1] * 3.4], [P_COL25[0] - SD[0] * 4, 2.3, P_COL25[2] - SD[1] * 4], pushK(f, 1547, 0.0035), { fov: 38 });
// 26: tiny collector pacing the castle's enormous shadow, seen from high above
const S26a = (f: number) => { const c = colWalk(f); return { pos: [c[0] + SD[0] * 9, 4.6, c[2] + SD[1] * 9] as V3, look: [c[0] - SD[0] * 40, 3, c[2] - SD[1] * 40] as V3, fov: 44, roll: -0.03 }; };
// 27: the bill for the king
const S27a = (f: number) => dolly([3.6, 1.9, -8.4], [KING_AT[0] + 0.7, KING_AT[1] + 1.2, KING_AT[2] + 0.6], pushK(f, 1675, 0.004, 0.01, 16), { fov: 40 });
// 28: morning: everyone dances with their long morning shadows, the king rips up the bill
const S28a = (f: number) => dolly([-9, 3.0, -3], [2, 0.8, 2.0], pushK(f, 1714, 0.0016), { fov: 44, roll: 0.03 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 56, cut: true, s: S1b }],
  2: [{ f: 60, s: S2a }],
  3: [{ f: 103, s: S3a }, { f: 156, dur: 30, s: S3b }],
  4: [{ f: 196, s: S4a }],
  5: [{ f: 257, s: S5a }],
  6: [{ f: 295, s: S6a }],
  7: [{ f: 352, s: S7a }, { f: 398, dur: 20, s: S7b }],
  8: [{ f: 418, s: S8a }],
  9: [{ f: 444, s: S9a }],
  10: [{ f: 488, s: S10a }],
  11: [{ f: 520, s: S11a }, { f: 596, dur: 40, s: S11b }],
  12: [{ f: 660, s: S12a }, { f: 716, dur: 30, s: S12b }],
  13: [{ f: 767, s: S13a }],
  14: [{ f: 828, s: S14a }],
  15: [{ f: 856, s: S15a }],
  16: [{ f: 929, s: S16a }],
  17: [{ f: 1009, s: S17a }],
  18: [{ f: 1062, s: S18a }],
  19: [{ f: 1148, s: S19a }],
  20: [{ f: 1182, s: S20a }, { f: 1236, dur: 36, s: S20b }],
  21: [{ f: 1286, s: S21a }],
  22: [{ f: 1304, s: S22a }, { f: 1356, dur: 40, s: S22b }],
  23: [{ f: 1408, s: S23a }],
  24: [{ f: 1520, s: S24a }],
  25: [{ f: 1547, s: S25a }],
  26: [{ f: 1593, s: S26a }],
  27: [{ f: 1675, s: S27a }],
  28: [{ f: 1707, s: S28a }],
};

// impact kicks: coin, tiny bill, the king's stomp, decree slam, huge bill thud, zero tax, the king's bill
const KICKS: [number, number][] = [[COIN_AT / FPS, 0.6], [462 / FPS, 1.0], [468 / FPS, 0.6], [511 / FPS, 0.8], [BILL.huge / FPS, 0.9],
  [1531 / FPS, 0.6], [1700 / FPS, 1.1]];
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
/** every shot sharp (the user's preference since Apollo 13): the lens pass stays in the chain at zero strength */
export const dofAt = (_f: number) => ({ cInf: 0, focus: undefined as undefined | ((f: number) => V3) });
