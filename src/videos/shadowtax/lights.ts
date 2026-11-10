// Light presets per time of day (shadow tax short). Unlike the earlier shorts the sun here is placed in WORLD
// compass terms per shot (story.ts ShotDef sunAz / sunEl: azimuth from north, clockwise; north = -z, east = +x),
// because the story is about where the sun is: shadows must agree from shot to shot. az/el below are defaults only. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export type Light = "day" | "golden" | "overcast" | "table" | "dawn";
export const LIGHTS: Record<Light, LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 0.68, 0.24], shade: [0.15, 0.15, 0.3], lift: [0.04, 0.06, 0.17], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.78, 0.56], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.85, 0.80, 0.95],
    blob: [0.75, 0.74, 0.9], actorShadow: false,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffab5e", sunI: 5.5, sky: "#d8b0b8", ground: "#8a6a60", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
  // thick overcast: no direct sun (world.ts turns the shadow map off), lit and shade nearly equal = soft, flat light
  overcast: {
    az: 180, el: 50,
    lit: [1.02, 1.03, 1.08], shade: [0.84, 0.86, 0.95], lift: [0.02, 0.02, 0.04], lambert: 0.15, sideK: 0.78, term: 0.6,
    charTint: [0.96, 0.97, 1.0], charShade: 1.0, charGrad: 0.02, bodyGrad: 0.06, sideTint: [0.95, 0.95, 0.98],
    blob: [0.7, 0.7, 0.74], actorShadow: false,
    top: "#8d96a6", hor: "#c9ced6", skyCurve: [0.0, 0.5, 0.6], fog: "#c3c8d0", fogNear: 20, fogFar: 260, sunDisc: "#000000",
    sunCol: "#e8ecf2", sunI: 1.2, sky: "#d0d6e0", ground: "#9a9086", hemiI: 0.9,
    bias: -0.00025, normalBias: 0.015,
  },
  // a dark nursery lit by one torch: warm key, deep blue-violet shade
  table: {
    az: 0, el: 80,
    lit: [1.75, 1.5, 1.05], shade: [0.16, 0.14, 0.24], lift: [0.03, 0.03, 0.07], lambert: 0.3, sideK: 0.84, term: 0.45,
    charTint: [1.0, 0.92, 0.82], charShade: 0.6, charGrad: 0.1, bodyGrad: 0.2, sideTint: [0.85, 0.82, 0.95],
    blob: [0.4, 0.4, 0.5], actorShadow: false,
    top: "#1a1530", hor: "#2a2240", skyCurve: [0.0, 0.5, 0.6], fog: "#1a1530", fogNear: 50, fogFar: 300, sunDisc: "#000000",
    sunCol: "#ffe2b0", sunI: 3.0, sky: "#2a2440", ground: "#1a1420", hemiI: 0.2,
    bias: -0.0004, normalBias: 0.004,
  },
  // winter sunrise: low sun, rosier and a little less orange than the evening
  dawn: {
    az: 125, el: 6,
    lit: [1.55, 0.86, 0.5], shade: [0.17, 0.17, 0.32], lift: [0.05, 0.06, 0.16], lambert: 0.35, sideK: 0.82, term: 0.07,
    charTint: [1.0, 0.84, 0.7], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.88, 0.84, 0.96],
    blob: [0.75, 0.74, 0.9], actorShadow: false,
    top: "#6f8fc8", hor: "#ffc9a0", skyCurve: [0.05, 0.6, 1.0], fog: "#f2c2a6", fogNear: 50, fogFar: 380, sunDisc: "#ffe0b8",
    sunCol: "#ffc08a", sunI: 5.0, sky: "#d8c0c8", ground: "#8a7068", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<Light, WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0, 0, 0],
    sat: 1.08,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.1,
  },
  overcast: {
    sky: { c: ["#c9ced6", "#bcc2cc", "#a9b0bc", "#9aa2b0", "#8d96a6"], e: [0, 3, 8, 16, 40] },
    water: { near: "#5a8a96", mid: "#4f7a8e", far: "#6a8096", crest: "#a9c2c8", trough: "#3a5a6e", glint: "#d8e0e4", shade: [0.8, 0.82, 0.9] },
    cloud: { lit: "#d9dde4", mid: "#bfc5cf", shade: "#9aa1ae" },
    bounce: [0, 0, 0],
    sat: 0.9,
  },
  table: {
    sky: { c: ["#2a2240", "#241d3a", "#1e1834", "#1a1530", "#16122a"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0.03, 0.02, 0.0],
    sat: 1.05,
  },
  dawn: {
    sky: { c: ["#ffc9a0", "#f6b9a4", "#d8b4c0", "#9fb0d4", "#6f8fc8"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffe0c4", mid: "#f2b4a8", shade: "#a99ac8" },
    bounce: [0.04, 0.02, 0.0],
    sat: 1.08,
  },
};
