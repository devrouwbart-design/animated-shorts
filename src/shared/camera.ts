// Camera presets measured from Ricks Clips (references/ricksclips/20261111_*.md, RULES.md C1-C7).
// Their whole short is ONE continuous camera: no hard cuts in 67 s. A new subject arrives by a quick move
// (median 0.43 s core, 0.8 s with ease tails) from the current framing to the next, ~4.8 such moves per 10 s, with
// short drifting holds between them (median 0.83 s). The move's speed curve is broad in the middle and peaks late
// (0.65 of the move), unlike our smootherstep glide which peaks sharply at 0.5 and starts/ends slower.
//
// Cam matches the per-short story.ts type: { pos, look, fov (deg), roll (radians) }.
export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov: number; roll: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** measured mean position curve of 20 reference moves (21 samples from start to end, ease tails included) */
export const REF_MOVE_CURVE = [0, 0.01, 0.03, 0.07, 0.12, 0.18, 0.24, 0.31, 0.38, 0.44, 0.5, 0.58, 0.65, 0.73, 0.81, 0.88, 0.93, 0.96, 0.98, 0.99, 1];
/** measured move length: median 24 f with tails (p10 19, p90 46) */
export const REF_MOVE_FRAMES = 24;
/** measured holds between moves: median 0.83 s, p90 2.9 s; moves per 10 s: 4.8 */
export const REF_HOLD_FRAMES = 25;

/** the measured ease (0..1 -> 0..1), monotone, C0; use it where we used smootherstep for camera glides */
export const refEase = (u: number) => {
  const x = clamp01(u) * (REF_MOVE_CURVE.length - 1), i = Math.min(REF_MOVE_CURVE.length - 2, Math.floor(x)), t = x - i;
  // cubic Hermite through the samples (Catmull-Rom tangents, clamped at the ends) so the speed has no steps
  const p = (k: number) => REF_MOVE_CURVE[Math.max(0, Math.min(REF_MOVE_CURVE.length - 1, k))];
  const last = REF_MOVE_CURVE.length - 2; // zero tangents at both ends: moves start and land without a jolt
  const m0 = i === 0 ? 0 : (p(i + 1) - p(i - 1)) / 2, m1 = i === last ? 0 : (p(i + 2) - p(i)) / 2, t2 = t * t, t3 = t2 * t;
  return clamp01((2 * t3 - 3 * t2 + 1) * p(i) + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p(i + 1) + (t3 - t2) * m1);
};
/** our older glide (smootherstep), kept for comparison */
export const smootherstep = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ pos: mixV(a.pos, b.pos, k), look: mixV(a.look, b.look, k), fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k });

/**
 * Fly from framing a to framing b (u = 0..1 through the move). arc pulls the lens back (and up a little) in the
 * middle of the move, as a fraction of the travel distance: the reference moves out-and-round rather than straight
 * through the scene (measured zoom over a move: median |24 %|, often out then in). rollDeg adds a roll bump that
 * peaks mid-move (reference roll per move: median 4.5 deg, max 21).
 */
export const flyBetween = (a: Cam, b: Cam, u: number, arc = 0.12, rollDeg = 0): Cam => {
  const k = refEase(u), c = mixCam(a, b, k), s = Math.sin(Math.PI * clamp01(u));
  if (!arc && !rollDeg) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d) || 1, travel = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
  const back = arc * travel * s;
  return { ...c, pos: [c.pos[0] - (d[0] / L) * back, c.pos[1] - (d[1] / L) * back + 0.3 * back, c.pos[2] - (d[2] / L) * back], roll: c.roll + (rollDeg * Math.PI / 180) * s };
};

/** distance factor for a push that grows the subject by pct % per frame (0.15-0.4 measured on holds) */
export const pushPct = (frames: number, pct: number) => Math.pow(1 + pct / 100, -Math.max(0, frames));
/** move the lens toward (k < 1) or away from (k > 1) its look point */
export const dollyK = (c: Cam, k: number): Cam => ({ ...c, pos: mixV(c.look, c.pos, k) });

/**
 * Hold drift: the reference never locks off. Measured on holds: zoom p50 |0.05| %/f (p90 0.44, both signs), roll
 * |0.05| deg/f median, pans p50 0.3-0.9 px/f at 720 wide. t = frames since the hold began.
 */
export const holdDrift = (c: Cam, t: number, o: { pushPct?: number; truck?: number; rollDegPerS?: number } = {}): Cam => {
  const { pushPct: pp = 0.15, truck = 0.004, rollDegPerS = 0.6 } = o;
  const k = pushPct(t, pp);
  const d: V3 = [c.look[0] - c.pos[0], 0, c.look[2] - c.pos[2]], h = Math.hypot(d[0], d[2]) || 1;
  const side: V3 = [-d[2] / h, 0, d[0] / h], s = truck * t;
  const p = mixV(c.look, c.pos, k);
  return { ...c, pos: [p[0] + side[0] * s, p[1], p[2] + side[2] * s], look: [c.look[0] + side[0] * s * 0.5, c.look[1], c.look[2] + side[2] * s * 0.5], roll: c.roll + (rollDegPerS * Math.PI / 180) * (t / 30) };
};

/** one beat of a continuous (one-take) camera: from frame f the camera flies to `cam` over `move` frames */
export type Beat = { f: number; cam: (f: number) => Cam; move?: number; arc?: number; rollDeg?: number };

/**
 * One-take camera through a list of beats (sorted by f). Before a beat's move the previous beat's camera keeps
 * running (its own drift); during the move the lens flies between the two live cameras with the measured ease.
 * Use move: 0 for the rare hard cut.
 */
export const continuous = (beats: Beat[], f: number): Cam => {
  let i = 0;
  while (i + 1 < beats.length && f >= beats[i + 1].f) i++;
  const b = beats[i], n = b.move ?? REF_MOVE_FRAMES;
  if (i === 0 || n <= 0 || f >= b.f + n) return b.cam(f);
  return flyBetween(beats[i - 1].cam(f), b.cam(f), (f - b.f) / n, b.arc ?? 0.12, b.rollDeg ?? 0);
};

/**
 * Opening move measured on the newest reference: a ~0.9 s mid shot creeping in at 0.15-0.2 %/f with a slow truck,
 * then a fast push-through (+69 % image scale in 0.37 s, speed peak mid-move) into the detail the narration names.
 * Returns a beat list for continuous(): wide framing a, detail framing b, push starting at frame fPush.
 */
export const openingBeats = (a: (f: number) => Cam, b: (f: number) => Cam, fPush = 26, pushFrames = 12): Beat[] => [
  { f: 0, cam: (f) => holdDrift(a(f), f, { pushPct: 0.18, truck: 0.003, rollDegPerS: 0.3 }) },
  { f: fPush, cam: b, move: pushFrames, arc: 0 },
];
