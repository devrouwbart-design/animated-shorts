// Bright, eye-catching light sources (Ricks Clips study, RULES.md E1-E5). Measured on their lanterns (1080x1920):
//   core: blown-out warm white (#fefbed, luma 0.96-1.0) over the whole lantern face, saturated orange rim at its edge
//   halo: soft bloom that falls from ~0.65 just outside the core to the ambient level within ~1 core radius
//   spill: warm orange light on nearby walls, columns and rafters (night ambient luma ~0.25 blue-violet, so ~4x)
//   shafts: soft light cones under hanging lanterns at night
// Pieces:
//   lantern()   : round or square lantern = HDR emissive body (bloom picks it up) + caps/tassel + additive halo sprite
//                 + warm PointLight for the spill + optional light cone
//   addSpill(m) : lets point lights add to a material whose diffuse model ignores them (shade.ts twoTone only
//                 listens to the sun). Chains onBeforeCompile; does nothing when the scene has no point lights.
//   torchFlame(): flickering HDR flame card for torches (deterministic per frame)
// HDR needs a float frame buffer: render through <EffectComposer> (half float by default) with renderer tone mapping
// off and a ToneMappingEffect after the bloom.
import * as THREE from "three";

const radialTex = (() => {
  const cache = new Map<string, THREE.CanvasTexture>();
  return (key: string, stops: [number, string][], size = 256) => {
    let t = cache.get(key);
    if (!t) {
      const cv = document.createElement("canvas"); cv.width = cv.height = size;
      const g = cv.getContext("2d")!, gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, c] of stops) gr.addColorStop(o, c);
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
      t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t);
    }
    return t;
  };
})();

/** lantern body: hot white centre -> saturated orange rim, then multiplied into HDR (k > 1 makes the bloom see it) */
const bodyTex = () => radialTex("lanternBody", [[0, "#fffdf2"], [0.55, "#fff1c8"], [0.82, "#ffb24a"], [1, "#e0661e"]]);
const haloTex = () => radialTex("lanternHalo", [[0, "rgba(255,214,150,0.85)"], [0.25, "rgba(255,180,90,0.38)"], [0.6, "rgba(255,140,60,0.10)"], [1, "rgba(255,120,40,0)"]]);

export type LanternOpts = {
  kind?: "round" | "square";
  /** body height in metres (reference hanging lanterns ~0.5-0.7 m, wall lanterns ~0.45 m) */
  size?: number;
  /** HDR multiplier of the body (2-6; higher = stronger bloom, more blown out) */
  hot?: number;
  /** warm spill light: intensity, reach (m) */
  light?: number; reach?: number;
  /** halo sprite diameter as a multiple of the body size (reference halo ~2x core) */
  halo?: number;
  /** soft light cone under the lantern (night), length in metres; 0 = none */
  cone?: number;
  /** cap/frame colour */
  frame?: string;
};

/** a glowing lantern; origin at its hanging point (top), body below it */
export const lantern = (o: LanternOpts = {}) => {
  const { kind = "round", size = 0.6, hot = 4, light = 6, reach = 7, halo = 2.4, cone = 0, frame = "#3a2416" } = o;
  const g = new THREE.Group();
  const bodyM = new THREE.MeshBasicMaterial({ map: bodyTex(), color: new THREE.Color(hot, hot * 0.86, hot * 0.62), toneMapped: false, fog: false });
  const frameM = new THREE.MeshLambertMaterial({ color: frame });
  let body: THREE.Mesh;
  if (kind === "round") {
    body = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 24, 16), bodyM); body.scale.y = 1.2;
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.2, size * 0.24, size * 0.1, 16), frameM); c.position.y = -size * 0.55 + s * size * 0.52; g.add(c); }
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, size, size * 0.7), bodyM);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.12, size * 0.9), frameM); cap.position.y = -size * 0.0; g.add(cap);
    const bot = cap.clone(); bot.position.y = -size * 1.1; g.add(bot);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(size * 0.06, size, size * 0.06), frameM); p.position.set(x * size * 0.36, -size * 0.55, z * size * 0.36); g.add(p); }
  }
  body.position.y = -size * 0.55; g.add(body);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, size * 0.2, 4), frameM); cord.position.y = -size * 0.02; g.add(cord);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(size * 0.06, size * 0.35, 8), new THREE.MeshLambertMaterial({ color: "#c0241f" })); tassel.position.y = -size * 1.25; tassel.rotation.x = Math.PI; g.add(tassel);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1.6, 1.3, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  spr.scale.setScalar(size * halo); spr.position.y = -size * 0.55; g.add(spr);
  if (light > 0) { const pl = new THREE.PointLight("#ffb46a", light, reach, 2); pl.position.y = -size * 0.55; g.add(pl); }
  if (cone > 0) {
    const cg = new THREE.ConeGeometry(cone * 0.45, cone, 32, 1, true); cg.translate(0, -cone / 2, 0);
    const cm = new THREE.MeshBasicMaterial({ map: radialTex("coneFade", [[0, "rgba(255,200,130,0.0)"], [0.5, "rgba(255,190,120,0.10)"], [1, "rgba(255,180,110,0.0)"]]), color: new THREE.Color(1.4, 1.1, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const c = new THREE.Mesh(cg, cm); c.position.y = -size * 1.1; g.add(c);
  }
  return g;
};

/** flickering torch flame card (yaw to the camera yourself); phase from the frame number keeps renders deterministic */
/** teardrop flame: white-hot core low in the flame, yellow body, orange tongue, soft red edge (drawn, not a disc) */
const flameTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256;
    const g = cv.getContext("2d")!;
    const drop = (w: number, h: number, y0: number, col: string, blur: number) => {
      g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col; g.beginPath();
      g.moveTo(64, y0 - h); g.bezierCurveTo(64 + w * 0.35, y0 - h * 0.55, 64 + w, y0 - h * 0.25, 64 + w * 0.55, y0 - h * 0.02);
      g.bezierCurveTo(64 + w * 0.3, y0 + h * 0.08, 64 - w * 0.3, y0 + h * 0.08, 64 - w * 0.55, y0 - h * 0.02);
      g.bezierCurveTo(64 - w, y0 - h * 0.25, 64 - w * 0.35, y0 - h * 0.55, 64, y0 - h);
      g.fill(); g.restore();
    };
    drop(56, 230, 236, "rgba(220,60,10,0.55)", 8);
    drop(44, 200, 232, "rgba(255,140,30,0.9)", 5);
    drop(30, 150, 226, "rgba(255,215,90,1)", 4);
    drop(16, 80, 220, "rgba(255,255,235,1)", 3);
    t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();
export const torchFlame = (h = 0.6) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.5, h), new THREE.MeshBasicMaterial({ map: flameTex(), color: new THREE.Color(3.2, 2.6, 2.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.geometry.translate(0, h / 2, 0);
  return { mesh: m, pose: (f: number) => { const k = 1 + 0.08 * Math.sin(f * 1.7) + 0.05 * Math.sin(f * 4.3); m.scale.set(1 / Math.sqrt(k), k, 1); } };
};

/** let point lights add warm spill to a material whose diffuse model ignores them (e.g. shade.ts twoTone) */
export const addSpill = <M extends THREE.Material>(m: M, k = 1): M => {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    if (!sh.fragmentShader.includes("#include <aomap_fragment>")) return;
    sh.fragmentShader = sh.fragmentShader.replace("#include <aomap_fragment>", `#include <aomap_fragment>
  #if NUM_POINT_LIGHTS > 0
  {
    IncidentLight spillL;
    for (int si = 0; si < NUM_POINT_LIGHTS; si++) {
      getPointLightInfo(pointLights[si], -vViewPosition, spillL);
      float ndl = max(dot(normal, spillL.direction), 0.0) * 0.8 + 0.2; // wrap: lanterns light round corners a little
      reflectedLight.directDiffuse += diffuseColor.rgb * spillL.color * ndl * ${k.toFixed(3)};
    }
  }
  #endif`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() + "|" : "") + "spill1_" + k.toFixed(2);
  return m;
};
