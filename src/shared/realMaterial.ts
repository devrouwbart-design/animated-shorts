// Realistic surface layer for world props (Ricks Clips study, references/ricksclips/RULES.md M1-M5).
// Their props read as "real" next to flat cartoon people because every surface has: a roughness-driven specular
// highlight from the sun, a faint sky reflection at grazing angles, large-scale tone/roughness wear (no two blocks or
// planks the same) and darkening where things meet the ground. Our world shader (shade.ts twoTone) has none of it.
//
// realMat() returns a MeshStandardMaterial with that layer added in onBeforeCompile. It CHAINS onto a shader hook that
// is already on the material, so a short keeps its own diffuse model: `realMat(params, opts, twoTone)` runs the
// short's twoTone first (palette, shade colour, sun terminator) and then adds specular + wear + grime on top.
// Without a chain it is a plain standard material with the same additions.
import * as THREE from "three";

export type RealOpts = {
  /** GGX roughness 0..1 (measured looks: wet/lacquer .2-.3, painted wood/metal .35-.5, stone/raw wood .7-.85, cloth .9) */
  roughness?: number;
  /** 0 = dielectric (F0 .04), 1 = metal (tinted highlight, diffuse drops) */
  metal?: number;
  /** multiplier on the sun's specular highlight (1 = physical) */
  spec?: number;
  /** 0..1: large-scale albedo (+-17 % at 1) and roughness (+-.15) variation in world space */
  wear?: number;
  /** size of one wear cell in metres (blocks / planks: about the size of one piece) */
  wearScale?: number;
  /** 0..1: darkening toward groundY (contact grime / ambient occlusion at the base, -45 % at 1) */
  grime?: number;
  /** world height where grime is strongest, and how far up it fades (m) */
  groundY?: number;
  grimeH?: number;
  /** sky reflection strength at grazing angles (0 = off) */
  sky?: number;
};

/** shared uniforms: the world sets the sky colour per light (e.g. to its horizon colour) once per frame */
export const REAL = {
  uRealSky: { value: new THREE.Color("#bcd3ee") },
};

export const REAL_DEFAULTS: Required<RealOpts> = { roughness: 0.6, metal: 0, spec: 1, wear: 0.5, wearScale: 0.6, grime: 0.35, groundY: 0, grimeH: 0.45, sky: 0.25 };

/** surface presets measured from the reference props (roughness from highlight size, wear from tone spread) */
export const SURFACE = {
  stone: { roughness: 0.82, spec: 0.6, wear: 0.8, wearScale: 0.45, grime: 0.45, sky: 0.08 },
  woodRaw: { roughness: 0.72, spec: 0.7, wear: 0.6, wearScale: 0.35, grime: 0.4, sky: 0.12 },
  woodPainted: { roughness: 0.45, spec: 1.0, wear: 0.35, wearScale: 0.5, grime: 0.3, sky: 0.25 },
  metal: { roughness: 0.35, metal: 1, spec: 1.2, wear: 0.4, wearScale: 0.25, grime: 0.25, sky: 0.6 },
  cloth: { roughness: 0.92, spec: 0.3, wear: 0.3, wearScale: 0.3, grime: 0.2, sky: 0 },
  wet: { roughness: 0.22, spec: 1.4, wear: 0.3, wearScale: 0.8, grime: 0.2, sky: 0.7 },
} satisfies Record<string, RealOpts>;

const NOISE = /* glsl */ `
float rHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rHash(i), rHash(i + vec3(1,0,0)), f.x), mix(rHash(i + vec3(0,1,0)), rHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rHash(i + vec3(0,0,1)), rHash(i + vec3(1,0,1)), f.x), mix(rHash(i + vec3(0,1,1)), rHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

type Hook = (sh: THREE.WebGLProgramParametersWithUniforms, r: THREE.WebGLRenderer) => void;

/** add the realistic layer to an existing MeshStandardMaterial (keeps and chains any onBeforeCompile already set) */
export function realify<T extends THREE.MeshStandardMaterial>(m: T, opts: RealOpts = {}): T {
  const o = { ...REAL_DEFAULTS, ...opts };
  m.roughness = o.roughness;
  m.metalness = o.metal;
  const prev = m.onBeforeCompile as Hook | undefined;
  const prevKey = m.customProgramCacheKey?.bind(m);
  const f = (x: number) => x.toFixed(3);
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uRealSky = REAL.uRealSky;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRealW;")
      .replace("#include <project_vertex>", `#include <project_vertex>
  { vec4 rw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    rw = instanceMatrix * rw;
  #endif
    vRealW = (modelMatrix * rw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRealW;\nuniform vec3 uRealSky;\n${NOISE}`)
      // wear: two octaves, the big one about one piece wide, so neighbouring blocks / planks differ in tone
      .replace("#include <color_fragment>", `#include <color_fragment>
  float rWa = rNoise(vRealW / ${f(o.wearScale)}), rWb = rNoise(vRealW / ${f(o.wearScale * 0.23)});
  diffuseColor.rgb *= 1.0 + ${f(o.wear)} * ((rWa - 0.5) * 0.28 + (rWb - 0.5) * 0.06);
  float rGrime = 1.0 - ${f(o.grime)} * 0.45 * (1.0 - smoothstep(0.0, ${f(o.grimeH)}, vRealW.y - ${f(o.groundY)}));
  diffuseColor.rgb *= rGrime;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + ${f(o.wear)} * (rWb - 0.5) * 0.3 + (1.0 - rGrime) * 0.4, 0.05, 1.0);`)
      // metals lose their diffuse (the specular colour was already taken from the albedo above)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
  diffuseColor.rgb *= 1.0 - 0.85 * metalnessFactor;`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
  reflectedLight.directSpecular *= ${f(o.spec)};
  {
    vec3 rUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float rFres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition) * -1.0), 0.0, 1.0), 5.0);
    float rGloss = (1.0 - roughnessFactor) * (1.0 - roughnessFactor);
    vec3 rF0 = mix(vec3(0.04), diffuseColor.rgb / max(1.0 - 0.85 * metalnessFactor, 0.15), metalnessFactor);
    reflectedLight.indirectSpecular += uRealSky * (rF0 + (1.0 - rF0) * rFres) * rGloss * (0.6 + 0.4 * dot(normal, rUp)) * ${f(o.sky)} * rGrime;
  }`);
  };
  const key = `real1_${f(o.roughness)}_${f(o.metal)}_${f(o.spec)}_${f(o.wear)}_${f(o.wearScale)}_${f(o.grime)}_${f(o.groundY)}_${f(o.grimeH)}_${f(o.sky)}`;
  m.customProgramCacheKey = () => (prevKey ? prevKey() + "|" : "") + key;
  return m;
}

/**
 * New realistic material. `base` is an optional diffuse model hook of the short (e.g. shade.ts twoTone), applied
 * first so the world keeps its palette: realMat({ color, map }, SURFACE.stone, twoTone).
 */
export function realMat(params: THREE.MeshStandardMaterialParameters, opts: RealOpts = {}, base?: <M extends THREE.MeshStandardMaterial>(m: M) => M): THREE.MeshStandardMaterial {
  let m = new THREE.MeshStandardMaterial(params);
  if (base) m = base(m);
  return realify(m, opts);
}
