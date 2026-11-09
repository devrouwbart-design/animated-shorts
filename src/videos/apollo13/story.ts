// "The Square Peg That Saved Apollo 13": timeline, story state and cameras, all timed to the Henry narration
// (shorts/apollo13/voice/words.json, frames = seconds x 30). Camera grammar of the bridge/lake shorts: cuts on big
// reframes, smootherstep glides of 18-40 f, every hold creeps in, 7-frame flip kicks on impacts.
export const FPS = 30;
export const TOTAL = 1875;
export type V3 = [number, number, number];

// ---------------- places (metres) ----------------
export const D0 = 0; // ground height used by build.ts helpers
/** set origins: every set lives far from the others; only the current shot's set is visible */
export const CAB: V3 = [2000, 0, 0];   // lunar-module cabin: x -1.5..1.5, floor 0, ceiling 2.6, back wall z 1.1, open toward -z
export const MCC: V3 = [4000, 0, 0];   // mission control: x -14..14, z -12..11, screens on the +z wall
export const HOT: V3 = [6000, 0, 0];   // hotel room abroad: back wall z 2, socket on it
export const SEA: V3 = [8000, 0, 0];   // Pacific splashdown
const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];
export const cab = (x: number, y: number, z: number) => at(CAB, x, y, z);
export const mcc = (x: number, y: number, z: number) => at(MCC, x, y, z);
export const hot = (x: number, y: number, z: number) => at(HOT, x, y, z);
export const sea = (x: number, y: number, z: number) => at(SEA, x, y, z);

// spacecraft (space set at the origin): stack along x, the Moon is ahead (-x), Earth behind (+x)
export const HOLE: V3 = [4.6, 0, 1.95];          // blown-out service-module bay (faces +z)
export const LMWIN: V3 = [-3.67, 0.38, 1.56];     // the lander's upper triangle window (faces +z; the lander's "up" is +x)
// cabin furniture (local cabin coords)
export const CO2: V3 = [0.62, 1.55, 1.07];       // CO2 meter on the back panel (faces -z)
export const O2: V3 = [-0.62, 1.55, 1.07];       // oxygen gauge
export const HOLDER: V3 = [-1.47, 1.05, 0.1];    // the lander's ROUND filter holder on the left wall (faces +x)
export const MAILBOX: V3 = [-0.92, 1.0, 0.0];    // where the finished box hangs, hosed to the holder
export const HATCH: V3 = [0, 2.6, 0.15];         // overhead tunnel to the command module
// mission control table (local mcc coords)
export const TABLE: V3 = [0, 0.9, 5.4];          // table top centre (2.4 x 1.2)
// hotel socket (local hotel coords)
export const SOCKET: V3 = [0.75, 0.95, 1.99];
export const RAFT: V3 = [4.3, 0.05, -2.7];       // raft beside the capsule (local sea coords)

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
/** a drop with a little bounce: 0 before t0, falls from h to 0 over dur frames, then two small hops */
export const drop = (f: number, f0: number, h: number, dur = 8) => {
  const u = (f - f0) / dur;
  if (u < 0) return h;
  if (u < 1) return h * (1 - u * u);
  const v = (f - f0 - dur) / 10;
  return v < 1 ? 0.06 * h * Math.sin(Math.PI * v) * (1 - v) : 0;
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Set = "space" | "cab" | "mcc" | "hotel" | "sea";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: Set; sunAz?: number; sunEl?: number };
const IN = { sunAz: 165, sunEl: 40 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 52, b: 130, light: "day", set: "cab", ...IN },       // hook inside: duct tape, a plastic bag and a sock (flash-forward)
  { id: 2, a: 130, b: 278, light: "day", set: "space" },           // "Apollo thirteen ... on its way to the Moon"
  { id: 3, a: 278, b: 349, light: "day", set: "space" },           // "Then, bang. An oxygen tank explodes."
  { id: 4, a: 349, b: 380, light: "day", set: "cab", ...IN },      // "Alarms everywhere."
  { id: 5, a: 380, b: 405, light: "day", set: "cab", ...IN },      // "And the radio crackles:"
  { id: 6, a: 405, b: 442, light: "day", set: "mcc", ...IN },      // "Houston, we've had a problem."
  { id: 7, a: 442, b: 482, light: "day", set: "space" },           // "The main ship is dying."
  { id: 8, a: 482, b: 545, light: "day", set: "cab", ...IN },      // "So the three astronauts squeeze into the lunar lander,"
  { id: 9, a: 545, b: 608, light: "day", set: "space" },           // "a tiny craft built for two people for two days."
  { id: 10, a: 608, b: 660, light: "day", set: "cab", ...IN },     // "They need it for three, for four days."
  { id: 11, a: 660, b: 689, light: "day", set: "cab", ...IN },     // "Oxygen? Enough."
  { id: 12, a: 689, b: 736, light: "day", set: "cab", ...IN },     // "The problem is what they breathe out."
  { id: 13, a: 736, b: 818, light: "day", set: "cab", ...IN },     // "Carbon dioxide. With every breath, the meter creeps up."
  { id: 14, a: 818, b: 930, light: "day", set: "cab", ...IN },     // spare filters: square ... holder is round
  { id: 15, a: 930, b: 963, light: "day", set: "hotel", ...IN },   // "It's like landing abroad"
  { id: 16, a: 963, b: 1011, light: "day", set: "hotel", ...IN },  // "your phone charger doesn't fit the wall socket"
  { id: 17, a: 1011, b: 1064, light: "day", set: "space" },        // "Except up here, you don't run out of battery."
  { id: 18, a: 1064, b: 1090, light: "day", set: "cab", ...IN },   // "You run out of air."
  { id: 19, a: 1090, b: 1112, light: "day", set: "mcc", ...IN },   // "Down in Houston,"
  { id: 20, a: 1112, b: 1332, light: "day", set: "mcc", ...IN },   // engineers ... pile up ... bags, cardboard, hoses, a sock, tape
  { id: 21, a: 1332, b: 1408, light: "day", set: "mcc", ...IN },   // "They invent a box that hooks the square filter to a round hose"
  { id: 22, a: 1408, b: 1450, light: "day", set: "mcc", ...IN },   // "and read the instructions up by radio,"
  { id: 23, a: 1450, b: 1477, light: "day", set: "cab", ...IN },   // "step by step."
  { id: 24, a: 1477, b: 1546, light: "day", set: "cab", ...IN },   // "An hour later, the crew has built it: the mailbox."
  { id: 25, a: 1546, b: 1605, light: "day", set: "cab", ...IN },   // "The carbon dioxide drops to almost nothing."
  { id: 26, a: 1605, b: 1635, light: "day", set: "sea" },          // "All three make it home."
  { id: 27, a: 1635, b: 1714, light: "day", set: "cab", ...IN },   // "And that famous line ...? Nobody ever said it."
  { id: 28, a: 1714, b: 1787, light: "day", set: "mcc", ...IN },   // "The real words were 'Houston, we've had a problem.'"
  { id: 29, a: 1787, b: TOTAL, light: "golden", set: "sea" },      // "Past tense. Thanks to a sock, it stayed that way."
  // opening (listed last so SHOTS[id - 1] still works): outside the spacecraft, rushing in through the lander window
  { id: 30, a: 0, b: 52, light: "day", set: "space" },             // "Three astronauts were saved from suffocating in space"
];
/** crossfades at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 1: 6, 15: 8, 19: 8, 24: 10, 26: 8, 29: 10 };
export const FLASH_AT = 130;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: shotAt(s.a - 0.5).id, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state (pure functions of shot id + frame) ----------------
/** has the oxygen tank blown? (panel off, debris, gas) */
export const blown = (id: number, f: number) => (id === 3 ? f >= 292 : id > 3 && id !== 30);
/** CO2 meter needle 0 (green, left) .. 1 (red, right) */
export const co2At = (id: number, f: number) => {
  if (id === 1) return 0.06;
  if (id < 13) return 0.18;
  if (id === 13) return lin([[736, 0.22], [764, 0.3], [790, 0.36], [810, 0.55], [818, 0.58]], f);
  if (id === 14) return 0.62;
  if (id === 18) return 0.86 + 0.02 * Math.sin(f * 0.9);
  if (id === 23) return 0.82;
  if (id === 24) return 0.8;
  if (id === 25) return lin([[1546, 0.8], [1566, 0.8], [1590, 0.03]], f) + (f > 1590 ? 0.012 * Math.sin((f - 1590) * 0.7) * Math.exp(-(f - 1590) / 8) : 0);
  return 0.04;
};
/** oxygen gauge needle (fine all along) */
export const o2At = (id: number, f: number) => (id === 11 ? lin([[660, 0.3], [676, 0.82], [684, 0.74], [689, 0.76]], f) : 0.76);
/** red alarm flashing 0/1 */
export const alarmAt = (id: number, f: number) => (id === 4 || id === 5 ? (Math.floor((f - 349) / 7) % 2 === 0 ? 1 : 0) : 0);
/** mailbox assembly 0..1 per part: canister, cardboard, bag, tape, hose (mission-control prototype / cabin build) */
export type Build = { can: number; card: number; bag: number; tape: number; hose: number };
export const FULL: Build = { can: 1, card: 1, bag: 1, tape: 1, hose: 1 };
export const protoAt = (id: number, f: number): Build | null => {
  if (id === 21) return { can: 1, card: smooth((f - 1340) / 12), bag: smooth((f - 1352) / 12), tape: smooth((f - 1366) / 14), hose: smooth((f - 1382) / 12) };
  if (id === 22) return FULL;
  return null;
};
export const cabBoxAt = (id: number, f: number): Build | null => {
  if (id === 1 || id >= 24 && id !== 26 && id !== 28 && id !== 29) return FULL;
  if (id === 23) return { can: 1, card: 1, bag: 1, tape: lin([[1450, 0.25], [1452, 0.45], [1459, 0.45], [1461, 0.7], [1463, 0.7], [1465, 1]], f), hose: 0 };
  return null;
};
/** items dropping on the table on their words (frames) */
export const ITEM_AT = { can: 1166, bag: [1213, 1218], card: [1233, 1238], hose: [1255, 1262], sock: 1281, tape: [1303, 1310, 1317] };
/** capsule height above the sea in shot 26 (splash at 1625 on "home") */
export const capY = (id: number, f: number) => (id === 26 ? Math.max(0, lin([[1605, 22], [1625, 0]], f)) : 0);
export const SPLASH = 1625;
/** hotel: plug distance from the socket face (m); bumps at 986 on "fit" */
export const plugAt = (id: number, f: number) => {
  if (id !== 16) return 0.5;
  if (f < 975) return lin([[963, 0.2], [975, 0.13]], f);
  if (f < 986) return lin([[975, 0.13], [986, 0.012]], f);
  const v = (f - 986) / 6;
  return 0.012 + 0.07 * Math.sin(Math.min(1, v) * Math.PI * 0.5) * Math.exp(-Math.max(0, f - 992) / 20);
};
/** square canister vs round holder in shot 14: the astronaut pushes it at the hole (0 far .. 1 touching) */
export const pushAt = (id: number, f: number) => (id === 14 ? lin([[892, 0], [915, 1], [919, 0.9], [924, 1], [928, 0.92]], f) : 0);

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

// --- space: the stack lies along x, so the vertical frame gets big rolls to stand it diagonally
const S2a = (f: number) => dolly([-19, 5, 15], [2.5, 0, 0], pushK(f, 130, 0.0016), { fov: 40, roll: 0.95 });
const S2b = (f: number) => dolly([11, 3.5, 10], [-5.5, 0, 0], pushK(f, 232, 0.002, 0.005, 30), { fov: 40, roll: -0.75 });
const S3a = (f: number) => dolly([1.5, 3.5, 15.5], [4.2, 0.2, 1.5], pushK(f, 278, 0.0022, 0.006, 25), { fov: 42, roll: 0.55 });
const S7a = (f: number) => dolly([15, -4, 13], [2, 0, 1], pushK(f, 442, 0.0025), { fov: 42, roll: -0.6 });
const S9a = (f: number) => dolly([-17, 6.5, 14], [-1.5, 0, 0], pushK(f, 545, 0.0025, 0.005, 30), { fov: 40, roll: 0.6 });
const S17a = (f: number) => dolly([-52, 22, 60], [0, 0, 0], pushK(f, 1011, 0.0012), { fov: 32, roll: 0.3 });
// --- opening: wide on the stack, then an accelerating rush into the lander window (roll turns the lander's +x to screen up)
const S30a = (f: number): Shot => {
  const u = clamp01(f / 50), e = u * u * u * (u * (6 * u - 15) + 10), k = Math.pow(u, 2.4);
  const p0: V3 = [-26, 9, 30], p1: V3 = [LMWIN[0], LMWIN[1], LMWIN[2] + 0.22];
  const l0: V3 = [-0.5, 0, 0], l1 = LMWIN;
  return { pos: p0.map((v, i) => v + (p1[i] - v) * k) as V3, look: l0.map((v, i) => v + (l1[i] - v) * e) as V3, fov: 40 - 6 * e, roll: 0.55 + (-Math.PI / 2 - 0.55) * e };
};
// --- cabin (the hook starts just inside the window and pulls back to the crew)
const S1a = (f: number) => { const u = glide((f - 50) / 26); return dolly(cab(-0.62, 1.38, -1.2 - 1.25 * u), cab(-0.78, 1.18, 0.0), pushK(f, 76, 0.0022), { fov: 42 }); };
const S4a = (f: number) => dolly(cab(0.05, 1.5, -2.7), cab(0.0, 1.35, 0.1), pushK(f, 349, 0.003, 0.007, 20), { fov: 42, roll: 0.05 });
const S5a = (f: number) => dolly(cab(-0.1, 1.6, -1.5), cab(-0.4, 1.5, 0.2), pushK(f, 380, 0.003), { fov: 38, roll: -0.04 });
const S8a = (f: number) => dolly(cab(0.1, 1.2, -2.6), cab(0.0, 1.65, 0.15), pushK(f, 482, 0.002), { fov: 44 });
const S10a = (f: number) => dolly(cab(0.05, 1.35, -2.75), cab(0.0, 1.4, 0.15), pushK(f, 608, 0.0025, 0.006, 20), { fov: 42 });
const S11a = (f: number) => dolly(cab(-0.5, 1.5, 0.2), [O2[0] + CAB[0], O2[1], O2[2]], pushK(f, 660, 0.003, 0.006, 20), { fov: 36 });
const S12a = (f: number) => dolly(cab(0.25, 1.55, -1.4), cab(0.35, 1.45, -0.15), pushK(f, 689, 0.0025), { fov: 38, roll: 0.03 });
const S13a = (f: number) => dolly(cab(0.5, 1.5, 0.35), [CO2[0] + CAB[0], CO2[1], CO2[2]], pushK(f, 736, 0.0025, 0.007, 30), { fov: 38 });
const S13b = (f: number) => dolly(cab(0.35, 1.5, 0.25), [CO2[0] + CAB[0], CO2[1], CO2[2]], pushK(f, 790, 0.003, 0.008, 25), { fov: 36, roll: -0.04 });
const S14a = (f: number) => dolly(cab(0.3, 1.45, -1.8), cab(0.2, 1.3, -0.3), pushK(f, 818, 0.0025, 0.007, 20), { fov: 40 });
const S14b = (f: number) => dolly(cab(HOLDER[0] + 1.2, 1.15, HOLDER[2] + 0.1), [HOLDER[0] + CAB[0], HOLDER[1] + 0.02, HOLDER[2] + 0.2], pushK(f, 892, 0.003, 0.007, 20), { fov: 42, roll: 0.04 });
const S18a = (f: number) => dolly(cab(0.1, 1.45, -1.9), cab(0.0, 1.45, 0.1), pushK(f, 1064, 0.004, 0.008, 18), { fov: 40, roll: -0.05 });
const S23a = (f: number) => dolly(cab(-0.3, 1.3, -1.25), cab(-0.75, 1.1, 0.0), pushK(f, 1450, 0.003), { fov: 40, roll: 0.03 });
const S24a = (f: number) => dolly(cab(0.15, 1.45, -2.5), cab(-0.35, 1.25, 0.1), pushK(f, 1477, 0.002), { fov: 42 });
const S24b = (f: number) => { const a = 0.45 - 0.006 * (f - 1508); return { pos: cab(-0.92 + 1.15 * Math.sin(a), 1.42, 0.0 - 1.15 * Math.cos(a)), look: cab(-0.98, 1.04, 0.05), fov: 38, roll: 0.03 }; };
const S25a = (f: number) => dolly(cab(0.45, 1.5, 0.3), [CO2[0] + CAB[0], CO2[1], CO2[2]], pushK(f, 1546, 0.003), { fov: 38 });
const S25b = (f: number) => dolly(cab(0.05, 1.45, -2.4), cab(0.0, 1.4, 0.1), pushK(f, 1589, 0.0025), { fov: 42 });
const S27a = (f: number) => dolly(cab(-0.2, 1.6, -1.3), cab(-0.4, 1.5, 0.2), pushK(f, 1635, 0.003, 0.006, 25), { fov: 38 });
// --- mission control
const S6a = (f: number) => dolly(mcc(3.2, 2.2, 6.2), mcc(0.2, 1.45, 1.2), pushK(f, 405, 0.0025, 0.007, 20), { fov: 42 });
const S19a = (f: number) => dolly(mcc(5.5, 5.2, -11.0), mcc(-0.8, 2.2, 6.0), pushK(f, 1086, 0.002), { fov: 46, roll: -0.03 });
const S20a = (f: number) => dolly(mcc(0.3, 1.75, 8.4), mcc(0.0, 1.45, 4.6), pushK(f, 1112, 0.0025), { fov: 40 });
const S20b = (f: number) => dolly(mcc(0.2, 2.9, 7.6), mcc(0.0, 0.95, 5.3), pushK(f, 1160, 0.0018), { fov: 42 });
const S21a = (f: number) => dolly(mcc(0.5, 2.0, 6.9), mcc(0.0, 1.0, 5.35), pushK(f, 1332, 0.0028, 0.006, 25), { fov: 38, roll: 0.03 });
const S22a = (f: number) => dolly(mcc(-2.3, 1.75, 5.0), mcc(-3.4, 1.55, 2.6), pushK(f, 1408, 0.0028), { fov: 38 });
const S28a = (f: number) => dolly(mcc(-2.2, 1.7, 5.2), mcc(-3.4, 1.55, 2.6), pushK(f, 1714, 0.0025, 0.005, 25), { fov: 38, roll: -0.03 });
// --- hotel
const S15a = (f: number) => dolly(hot(1.6, 1.55, -2.6), hot(0.2, 1.35, 1.0), pushK(f, 926, 0.002), { fov: 42 });
const S16a = (f: number) => dolly(hot(0.4, 1.09, 1.68), [SOCKET[0] + HOT[0] - 0.03, SOCKET[1] - 0.01, SOCKET[2] - 0.06], pushK(f, 963, 0.003, 0.008, 18), { fov: 40, roll: 0.04 });
// --- sea
const S26a = (f: number) => { const y = capY(26, f); return { pos: sea(12, 2.2, -15), look: sea(0, y + 6, 0), fov: 46, roll: -0.03 }; };
const S29a = (f: number) => dolly(sea(6.6, 1.75, -8.0), sea(4.05, 1.1, -3.0), pushK(f, 1783, 0.0022, 0.005, 30), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  30: [{ f: 0, s: S30a }],
  1: [{ f: 46, s: S1a }],
  2: [{ f: 130, s: S2a }, { f: 232, dur: 32, s: S2b }],
  3: [{ f: 278, s: S3a }],
  4: [{ f: 349, s: S4a }],
  5: [{ f: 380, s: S5a }],
  6: [{ f: 405, s: S6a }],
  7: [{ f: 442, s: S7a }],
  8: [{ f: 482, s: S8a }],
  9: [{ f: 545, s: S9a }],
  10: [{ f: 608, s: S10a }],
  11: [{ f: 660, s: S11a }],
  12: [{ f: 689, s: S12a }],
  13: [{ f: 736, s: S13a }, { f: 790, cut: true, s: S13b }],
  14: [{ f: 818, s: S14a }, { f: 888, dur: 22, s: S14b }],
  15: [{ f: 926, s: S15a }],
  16: [{ f: 963, s: S16a }],
  17: [{ f: 1011, s: S17a }],
  18: [{ f: 1064, s: S18a }],
  19: [{ f: 1086, s: S19a }],
  20: [{ f: 1112, s: S20a }, { f: 1158, dur: 30, s: S20b }],
  21: [{ f: 1332, s: S21a }],
  22: [{ f: 1408, s: S22a }],
  23: [{ f: 1450, s: S23a }],
  24: [{ f: 1472, s: S24a }, { f: 1508, dur: 26, s: S24b }],
  25: [{ f: 1546, s: S25a }, { f: 1589, cut: true, s: S25b }],
  26: [{ f: 1601, s: S26a }],
  27: [{ f: 1635, s: S27a }],
  28: [{ f: 1714, s: S28a }],
  29: [{ f: 1782, s: S29a }],
};

// impact kicks: the bang, the alarm, the square canister bumping the round hole, the plug, out of air, splashdown
const KICKS: [number, number][] = [[292 / FPS, 1.6], [325 / FPS, 0.6], [351 / FPS, 0.5], [915 / FPS, 0.7], [924 / FPS, 0.4], [986 / FPS, 0.7],
  [1077 / FPS, 0.5], [SPLASH / FPS, 1.0]];
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
  { f: 0, cInf: 0 },       // opening outside: sharp
  { f: 52, cInf: 12 },     // hook: mailbox + crew
  { f: 130, cInf: 0 },     // space wides stay sharp
  { f: 349, cInf: 11 },    // alarm
  { f: 380, cInf: 13 },    // radio CU
  { f: 405, cInf: 10 },    // mission control MS
  { f: 442, cInf: 0 },     // space
  { f: 482, cInf: 10 },    // cabin
  { f: 545, cInf: 0 },
  { f: 608, cInf: 10 },
  { f: 660, cInf: 13 },    // gauge CUs
  { f: 689, cInf: 12 },
  { f: 736, cInf: 13 },
  { f: 818, cInf: 11 },
  { f: 930, cInf: 8 },     // hotel
  { f: 963, cInf: 13 },    // socket CU
  { f: 1011, cInf: 0 },    // space
  { f: 1064, cInf: 12 },
  { f: 1090, cInf: 0 },    // mission control wide
  { f: 1112, cInf: 11 },
  { f: 1160, cInf: 8 },    // table
  { f: 1332, cInf: 12 },
  { f: 1408, cInf: 12 },   // capcom
  { f: 1450, cInf: 12 },
  { f: 1477, cInf: 10 },
  { f: 1508, cInf: 13 },   // mailbox hero
  { f: 1546, cInf: 13 },
  { f: 1589, cInf: 10 },
  { f: 1605, cInf: 0 },    // splashdown
  { f: 1635, cInf: 13 },
  { f: 1714, cInf: 12 },
  { f: 1787, cInf: 0 },    // golden raft: sharp (lens blur here softened the whole frame)
];
/** lens blur strength multiplier for the whole film: 0 = every shot fully sharp (the user asked for no blur; the
 *  per-shot table above is kept so it can be brought back at a lower strength, e.g. 0.3) */
export const DOF_SCALE = 0;
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: DOF_SCALE * (p.cInf + (d.cInf - p.cInf) * k), focus: d.focus };
};
