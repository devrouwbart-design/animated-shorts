// Nature that reads as real next to flat cartoon people (Ricks Clips study, RULES.md N1-N6).
// Measured on their near grass (4 close-ups, 540-wide scale): hue 84-107 deg, saturation ~.58, value spread .15-.35 at
// the roots to .5-.88 at the lit tips (about 3x), fine-detail energy 8-10, thousands of thin curved blades that hide the
// characters' feet. Their far nature is SIMPLE: faceted low-poly trees with soft top-lit shading (no ink), flat field
// patches, smooth green hills with darker patches. So the detail goes where the lens is.
//
//   grassPatch(): instanced 3D blades around a point, density fading out toward the edge
//   meadowMat():  ground material with large patches (light/dark green, dry, dirt) under and beyond the blades
//   natureTree(): faceted low-poly round or pine tree, top-lit / dark-underside vertex shading, natural greens
// Each material takes an optional `base` hook (a short's twoTone) like realMat(), applied first.
import * as THREE from "three";
import { NOISE_GLSL } from "./realMaterial";

type Base = <M extends THREE.Material>(m: M) => M;
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** shared wind clock: set GRASS.uTime.value = frame / fps once per frame (deterministic for renders) */
export const GRASS = { uTime: { value: 0 }, uWind: { value: 1 } };

// ---------------- grass ----------------
/** smooth 2D value noise 0..1 (CPU side, for per-blade colours) */
const h2 = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smoothNoise2 = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};
/** one blade: tapered strip with SEG segments, bent forward (+z) by `bend` x t^2; uv.y = 0 root .. 1 tip.
 *  Normals lean up (0.75) so both faces light like a lawn instead of turning black from behind. */
const bladeGeo = (seg = 4, bend = 0.35) => {
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, w = 0.5 * (1 - t) ** 0.9, z = bend * t * t, y = t;
    const n = new THREE.Vector3(0, 0.75, 0.66 - 1.2 * bend * t).normalize();
    if (i < seg) { pos.push(-w, y, z, w, y, z); nrm.push(n.x, n.y, n.z, n.x, n.y, n.z); uv.push(0, t, 1, t); }
    else { pos.push(0, y, z); nrm.push(n.x, n.y, n.z); uv.push(0.5, 1); }
  }
  for (let i = 0; i < seg - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const a = (seg - 1) * 2; idx.push(a, a + 1, a + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

/** measured near-grass palette (sRGB): root shade, mid, lit tip, dry blades */
export const GRASS_COLS = { mid: "#558f3a", light: "#8bbd4a", dark: "#2f5f27", dry: "#b3a955" };

export type GrassOpts = {
  /** patch centre (x, z) on ground height y, radius (m) */
  center: [number, number]; radius: number; y?: number;
  /** blades per m2 at the centre (reference close-ups: ground fully hidden; 1500-3000) */
  density?: number;
  /** blade height range (m) and base width (m) */
  height?: [number, number]; width?: number;
  /** share of dry yellow blades */
  dry?: number;
  /** blade colour spread (fraction toward light / dark) */
  cols?: typeof GRASS_COLS;
  /** skip points (paths, props, water) */
  avoid?: (x: number, z: number) => boolean;
  /** 0..1 darkening of shaded clumps (~0.6 m across) */
  clump?: number;
  /** where the density starts to fade, as a fraction of the radius */
  edge?: number;
  /** cap on the blade count (GPU budget) */
  max?: number;
  seed?: number;
  base?: Base;
};

export const grassMaterial = (base?: Base) => {
  let m = new THREE.MeshLambertMaterial({ color: "#ffffff", side: THREE.DoubleSide });
  if (base) m = base(m);
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, GRASS);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime; uniform float uWind; varying float vGrassT;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
  vGrassT = uv.y;
  #ifdef USE_INSTANCING
    vec2 gp = instanceMatrix[3].xz;
  #else
    vec2 gp = vec2(0.0);
  #endif
  float gw = sin(uTime * 1.6 + gp.x * 0.7 + gp.y * 0.45) + 0.4 * sin(uTime * 3.1 + gp.x * 2.3 - gp.y * 1.7);
  transformed.z += uWind * 0.08 * gw * uv.y * uv.y;
  transformed.x += uWind * 0.03 * gw * uv.y * uv.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGrassT;")
      // dark roots (self-shadow / AO inside the turf) -> bright, slightly yellow tips
      .replace("#include <color_fragment>", `#include <color_fragment>
  float gT = clamp(vGrassT, 0.0, 1.0);
  diffuseColor.rgb *= mix(0.2, 1.25, pow(gT, 0.6)); // deep root shade: reference near grass spans 2.5-4.3x in value
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.08, 0.72), gT * gT * 0.45);`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() + "|" : "") + "grass1";
  return m;
};

/** instanced 3D grass blades around a centre; returns the mesh (add it to the scene; it receives shadows) */
export const grassPatch = (o: GrassOpts) => {
  const { center: [cx, cz], radius: R, y = 0, density = 1800, height = [0.22, 0.5], width = 0.013, dry = 0.08, cols = GRASS_COLS, avoid, max = 140000, seed = 3, base, edge = 0.55, clump = 0.6 } = o;
  const r = rng(seed * 7919 + 1);
  const want = Math.min(max, Math.round(Math.PI * R * R * density * 0.72)); // ~0.72 of the full disc after the edge falloff
  const mesh = new THREE.InstancedMesh(bladeGeo(), grassMaterial(base), want);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const cMid = new THREE.Color(cols.mid), cL = new THREE.Color(cols.light), cD = new THREE.Color(cols.dark), cDry = new THREE.Color(cols.dry), c = new THREE.Color();
  let n = 0, tries = 0;
  while (n < want && tries < want * 4) {
    tries++;
    const a = r() * Math.PI * 2, d = R * Math.sqrt(r());
    const fall = 1 - THREE.MathUtils.smoothstep(d, edge * R, R);
    if (r() > fall) continue;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (avoid?.(x, z)) continue;
    const h = THREE.MathUtils.lerp(height[0], height[1], r() ** 0.8) * (0.55 + 0.45 * fall);
    e.set((r() - 0.5) * 0.9, r() * Math.PI * 2, (r() - 0.5) * 0.6); // lean forward/back, any yaw, side tilt (reference blades flop every way)
    q.setFromEuler(e); s.set(width * (0.7 + 0.6 * r()), h, h); p.set(x, y, z);
    M.compose(p, q, s); mesh.setMatrixAt(n, M);
    const k = r();
    if (r() < dry) c.copy(cDry).lerp(cMid, r() * 0.3);
    else if (k < 0.33) c.copy(cMid).lerp(cD, r() * 0.8);
    else c.copy(cMid).lerp(cL, r() * 0.9);
    // clumps: tufts shade each other, so whole patches ~0.6 m across sit darker (reference value range 2.5-4.3x)
    c.multiplyScalar(1 - clump * (1 - smoothNoise2(x / 0.6, z / 0.6)) * 0.75);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return mesh;
};

// ---------------- ground ----------------
/** meadow ground: large soft patches of light/dark green and dry grass (2-9 m), plus a darker tone where blades stand.
 *  Use the same colours as the blades so the patch edge disappears. */
export const meadowMat = (base?: Base, cols = GRASS_COLS) => {
  let m = new THREE.MeshLambertMaterial({ color: cols.mid });
  if (base) m = base(m);
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey?.bind(m);
  const v = (h: string) => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMeadowW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vMeadowW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vMeadowW;\n${NOISE_GLSL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
  vec3 mp = vec3(vMeadowW.x, 0.0, vMeadowW.z);
  float n1 = rNoise(mp / 9.0), n2 = rNoise(mp / 3.2 + 17.0), n3 = rNoise(mp / 0.9 + 5.0);
  vec3 g = mix(${v(cols.dark)}, ${v(cols.mid)}, smoothstep(0.2, 0.8, n1));
  g = mix(g, ${v(cols.light)}, smoothstep(0.6, 0.9, n1) * 0.5);
  g = mix(g, ${v(cols.dry)}, smoothstep(0.66, 0.88, n2) * 0.35);
  diffuseColor.rgb = g * (0.72 + 0.28 * n3);`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() + "|" : "") + "meadow1";
  return m;
};

// ---------------- trees ----------------
/** measured tree greens: lit canopy, mid, shaded underside, bark */
export const TREE_COLS = { lit: "#86b84a", mid: "#56903a", shade: "#33602a", bark: "#5e4632" };

export type TreeOpts = { height: number; kind?: "round" | "pine"; seed?: number; cols?: typeof TREE_COLS; base?: Base };

/** displace an icosphere into a lumpy blob and bake top-lit / dark-underside / inner-occlusion vertex colours */
const blob = (r: number, rand: () => number, cx: number, cy: number, cz: number, centre: THREE.Vector3, cols: typeof TREE_COLS, top: number, bottom: number) => {
  const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const lit = new THREE.Color(cols.lit), mid = new THREE.Color(cols.mid), sh = new THREE.Color(cols.shade), c = new THREE.Color(), v = new THREE.Vector3();
  const bump = new Map<string, number>(); // same jitter for shared corners keeps the blob closed
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let k = bump.get(key); if (k === undefined) { k = 0.82 + 0.3 * rand(); bump.set(key, k); }
    v.multiplyScalar(k); v.y *= 0.86;
    v.add(new THREE.Vector3(cx, cy, cz)); p.setXYZ(i, v.x, v.y, v.z);
  }
  for (let i = 0; i < p.count; i += 3) { // per face (faceted look), colour from height in the canopy and distance from its core
    v.set(0, 0, 0); for (let j = 0; j < 3; j++) v.add(new THREE.Vector3().fromBufferAttribute(p, i + j)); v.multiplyScalar(1 / 3);
    const hT = THREE.MathUtils.clamp((v.y - bottom) / Math.max(0.01, top - bottom), 0, 1);
    const out = THREE.MathUtils.clamp(v.distanceTo(centre) / (r * 2.2), 0, 1);
    c.copy(sh).lerp(mid, THREE.MathUtils.smoothstep(hT, 0.05, 0.55)).lerp(lit, THREE.MathUtils.smoothstep(hT, 0.55, 1) * 0.85);
    c.multiplyScalar(0.78 + 0.32 * out + (rand() - 0.5) * 0.12);
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/** low-poly tree in the reference look, base at y = 0, height in metres */
export const natureTree = (o: TreeOpts) => {
  const { height: H, kind = "round", seed = 1, cols = TREE_COLS, base } = o;
  const rand = rng(seed * 104729 + 7);
  const grp = new THREE.Group();
  let leafM: THREE.Material = new THREE.MeshLambertMaterial({ color: "#ffffff", vertexColors: true, flatShading: true });
  let barkM: THREE.Material = new THREE.MeshLambertMaterial({ color: cols.bark });
  if (base) { leafM = base(leafM); barkM = base(barkM); }
  const trunkH = kind === "pine" ? H * 0.3 : H * 0.45, trunkR = H * (kind === "pine" ? 0.035 : 0.045);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH + H * 0.1, 7), barkM);
  trunk.position.y = (trunkH + H * 0.1) / 2; grp.add(trunk);
  const parts: THREE.BufferGeometry[] = [];
  if (kind === "round") {
    const cr = H * 0.3, cy = trunkH + cr * 0.75, centre = new THREE.Vector3(0, cy, 0);
    const n = 4 + Math.floor(rand() * 3);
    parts.push(blob(cr * 0.85, rand, 0, cy, 0, centre, cols, cy + cr, cy - cr));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(), d = cr * (0.45 + 0.25 * rand());
      parts.push(blob(cr * (0.5 + 0.25 * rand()), rand, Math.cos(a) * d, cy + (rand() - 0.35) * cr * 0.7, Math.sin(a) * d, centre, cols, cy + cr, cy - cr));
    }
  } else {
    // pine: three stacked lumpy cones, wider at the bottom
    const base0 = trunkH * 0.7, top = H;
    for (let i = 0; i < 3; i++) {
      const y0 = base0 + (i / 3) * (top - base0) * 0.8, h = (top - base0) * (0.55 - i * 0.1), rr = H * (0.2 - i * 0.045);
      const g = new THREE.ConeGeometry(rr, h, 9, 2).toNonIndexed();
      g.translate(0, y0 + h / 2, 0);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let k = 0; k < p.count; k++) { p.setX(k, p.getX(k) * (0.9 + 0.2 * rand())); p.setZ(k, p.getZ(k) * (0.9 + 0.2 * rand())); }
      for (let k = 0; k < p.count; k += 3) {
        const yy = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3, local = (yy - y0) / h;
        c.set(cols.shade).lerp(new THREE.Color(cols.mid), THREE.MathUtils.smoothstep(local, 0, 0.6)).lerp(new THREE.Color(cols.lit), THREE.MathUtils.smoothstep(local, 0.6, 1) * 0.6);
        c.multiplyScalar(0.85 + (rand() - 0.5) * 0.12);
        for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (k + j) * 3);
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      parts.push(g);
    }
  }
  for (const g of parts) { const m = new THREE.Mesh(g, leafM); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
  trunk.castShadow = true; trunk.receiveShadow = true;
  return grp;
};
