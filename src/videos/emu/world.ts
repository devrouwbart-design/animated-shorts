// The emu short as one three.js scene: a Western Australian wheat farm in 1932.
//   red-earth paddocks with dry grass, a red dirt road, the golden wheat paddock (a raised slab with a ragged painted
//   fringe), a tin-roofed weatherboard farmhouse on stumps with a verandah, a corrugated water tank, a windmill, a farm
//   dam with an earth bank, gum trees and saltbush, the coat-of-arms knoll, the army truck and the Lewis guns.
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f). Sky, light rig, ink,
// two-tone shading and the card cast are the bridge / lake shorts', unchanged.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, prop, setSight } from "./build";
import { ctex, rng, waterNear, waterFar, cloudHD, planksHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, poseMatrix } from "./cast";
import {
  FPS, WHEAT_H, FIELD, ROAD_Z, HOUSE, MILL, YARD, DAM, DAM_W, ROCK, SHOTS, hAt, ShotDef, camAt, truckPose, gunsAt, BED_GUN, Pose, TRUCK_STOP, CASINGS,
} from "./story";

// ---------------- assets ----------------
const NATURE = ["rock_largeA", "rock_largeB", "rock_largeC", "rock_tallA", "rock_tallB", "rock_smallA", "rock_smallC", "stump_old", "log", "grass_large"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    const load = (dir: string, n: string) => loader.loadAsync(staticFile(`kenney/${dir}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const);
    kitP = Promise.all(NATURE.map((n) => load("nature-kit", n)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- painted textures ----------------
/** red outback earth with dry grass tufts and pebbles (4 m tile) */
const earthTex = () => ctex("earthHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#b8663e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 140; i++) { const x = r() * 1024, y = r() * 1024, s = 30 + r() * 90; g.fillStyle = r() < 0.5 ? "rgba(170,88,52,0.45)" : "rgba(196,124,78,0.4)"; g.beginPath(); g.ellipse(x, y, s, s * 0.6, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 260; i++) { // dry grass tufts
    const x = r() * 1024, y = r() * 1024, n = 5 + Math.floor(r() * 5);
    g.strokeStyle = r() < 0.5 ? "#c9b26a" : "#a99a58"; g.lineWidth = 3;
    for (let k = 0; k < n; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 22, y - 10 - r() * 16); g.stroke(); }
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? "#8f4a2c" : "#d9a37a"; g.beginPath(); g.arc(r() * 1024, r() * 1024, 2 + r() * 3, 0, 7); g.fill(); }
});
/** red dirt road with two dark tyre ruts (6 m wide strip, 8 m tile along) */
const roadTex = () => ctex("roadHD", 512, 512, (g, r) => {
  g.fillStyle = "#c8784a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(150,80,48,0.35)" : "rgba(222,160,112,0.35)"; g.fillRect(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 3); }
  for (const y of [150, 362]) { g.fillStyle = "rgba(120,60,36,0.45)"; g.fillRect(0, y - 22, 512, 44); g.fillStyle = "rgba(100,50,30,0.35)"; g.fillRect(0, y - 8, 512, 16); }
});
/** wheat seen from above: golden with ear dabs */
const wheatTop = () => ctex("wheatTopHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#c99434"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 102.4) { // crop rows: a darker furrow between lighter rows of ears
    g.fillStyle = "rgba(120,78,24,0.55)"; g.fillRect(0, y, 1024, 22);
    g.fillStyle = "rgba(240,200,110,0.35)"; g.fillRect(0, y + 50, 1024, 26);
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024, y = r() * 1024;
    g.fillStyle = ["#deae4a", "#b07e2a", "#e6bf62", "#9c6e22"][Math.floor(r() * 4)];
    g.beginPath(); g.ellipse(x, y, 5, 11, r() * 0.6 - 0.3, 0, 7); g.fill();
  }
});
/** wheat seen from the side: stalks, ears on a ragged top edge (alpha-tested above the stalks), dark at the root */
const wheatSide = () => ctex("wheatSideHD", 1024, 512, (g, r) => {
  g.clearRect(0, 0, 1024, 512);
  const top = 100;
  const gr = g.createLinearGradient(0, top, 0, 512); gr.addColorStop(0, "#d6a444"); gr.addColorStop(0.75, "#a87a2c"); gr.addColorStop(1, "#6a4520");
  g.fillStyle = gr; g.fillRect(0, top + 30, 1024, 512);
  for (let i = 0; i < 520; i++) {
    const x = r() * 1024, h = top + 10 + r() * 60;
    g.strokeStyle = r() < 0.5 ? "#b8862e" : "#d9a748"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 512); g.lineTo(x + (r() - 0.5) * 14, h); g.stroke();
    g.fillStyle = ["#f0c866", "#d9a748", "#f6d784"][Math.floor(r() * 3)];
    g.beginPath(); g.ellipse(x + (r() - 0.5) * 8, h - 12, 7, 20, (r() - 0.5) * 0.5, 0, 7); g.fill();
  }
});
const tinTex = () => ctex("tinHD", 256, 256, (g) => {
  for (let x = 0; x < 256; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#9aa3a8"); gr.addColorStop(0.5, "#c9d0d3"); gr.addColorStop(1, "#8b9499"); g.fillStyle = gr; g.fillRect(x, 0, 16, 256); }
  g.fillStyle = "rgba(160,90,50,0.25)"; g.fillRect(0, 200, 256, 56);
});
const boardTex = () => ctex("boardHD", 512, 512, (g, r) => {
  g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) { g.fillStyle = "#c9b896"; g.fillRect(0, y + 27, 512, 5); g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, y, 512, 4); }
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(150,120,90,0.12)"; g.fillRect(r() * 512, r() * 512, 40 + r() * 80, 3); }
});
const mudTex = () => ctex("damMudHD", 512, 512, (g, r) => {
  g.fillStyle = "#9a5e3e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,70,44,0.4)" : "rgba(176,116,80,0.35)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 6 + r() * 20, 3 + r() * 8, 0, 0, 7); g.fill(); }
  for (let y = 40; y < 512; y += 70) { g.strokeStyle = "rgba(90,50,30,0.35)"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 14, 340, y - 14, 512, y); g.stroke(); }
});
const heapTex = () => ctex("brassHeap", 512, 512, (g, r) => {
  g.fillStyle = "#b08a3a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const x = r() * 512, y = r() * 512, a = r() * 3.14;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = r() < 0.5 ? "#e8c45a" : "#c9a040"; g.fillRect(-11, -4, 22, 8); g.fillStyle = "#7a5a24"; g.fillRect(9, -4, 3, 8);
    g.restore();
  }
});
const crateTex = () => ctex("crateHD", 256, 256, (g) => {
  g.fillStyle = "#6f7448"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#4a4e2e"; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240);
  g.fillStyle = "#e7dfc4"; g.fillRect(70, 110, 116, 36);  // blank stencil plate (no lettering)
});

// ---------------- water shader (calm farm dam; the lake short's shader with no spin) ----------------
type WaterU = Record<string, THREE.IUniform>;
const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime, wDrift;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(wDrift * wTime, 0.3 * wDrift * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 6.0), texture2D(wFarTex, wp / 30.0 + 0.37), smoothstep(20.0, 70.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
const makeWater = (shared: WaterU) => {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", WATER_DECL)
      .replace("#include <map_fragment>", WATER_COL)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
  };
  m.customProgramCacheKey = () => "damWater1";
  return m;
};

// ---------------- helpers ----------------
const T4 = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const tm = (col: string) => twoTone(new THREE.MeshLambertMaterial({ color: col }));
const metal = (col: string) => twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#8a8a8a", shininess: 40 }), 0.15);
const groupMesh = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4, cast = true) => {
  const mesh = new THREE.Mesh(geo, mat);
  if (m) mesh.applyMatrix4(m);
  mesh.castShadow = cast; mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};
const setPose = (o: THREE.Object3D, p: Pose) => { o.visible = p.on; if (!p.on) return; o.matrixAutoUpdate = false; poseMatrix(p, o.matrix); o.matrixWorldNeedsUpdate = true; };
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => boxGeo(V(x0, y0, z0), V(x1, y1, z1));
const cyl = (r: number, h: number, seg = 16, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);
/** beam between two points (box of thickness th) */
const beam = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const d = b.clone().sub(a), len = d.length(), g = new THREE.BoxGeometry(th, len, th);
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
  return g;
};

/** every lens position of the film looking at its subject: trees and props there are left out */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) {
    for (let f = s.a - 8; f < s.b + 8; f += 3) {
      const c = camAt(s.id, Math.max(0, Math.min(f, s.b - 1))), o = V(...c.pos), look = V(...c.look);
      const fw = look.clone().sub(o), len = fw.length();
      fw.normalize();
      const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
      const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
      for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
        out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
    }
  }
  return out;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

/** a Lewis gun on a tripod: the group origin is on the ground; `pivot` holds the gun, aiming along +x */
const lewisGun = (tripodH: number) => {
  const g = new THREE.Group(), pivot = new THREE.Group();
  const dark = metal("#3e4236"), wood = tm("#7a5232"), drum = metal("#4a4e40");
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    groupMesh(g, beam(V(0, tripodH, 0), V(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), 0.045), dark);
  }
  pivot.position.y = tripodH + 0.06;
  const sh = cyl(0.07, 0.82, 14); sh.rotateZ(-Math.PI / 2); sh.translate(0.38, 0, 0); groupMesh(pivot, sh, dark);     // cooling shroud
  for (let i = 0; i < 5; i++) { const fin = cyl(0.078, 0.025, 14); fin.rotateZ(-Math.PI / 2); fin.translate(0.12 + i * 0.13, 0, 0); groupMesh(pivot, fin, dark); }
  const mz = cyl(0.025, 0.16, 8); mz.rotateZ(-Math.PI / 2); mz.translate(0.86, 0, 0); groupMesh(pivot, mz, dark);
  groupMesh(pivot, box(-0.28, -0.07, -0.06, 0.02, 0.07, 0.06), dark);                                                 // receiver
  const pan = cyl(0.17, 0.06, 24); pan.translate(-0.1, 0.11, 0); groupMesh(pivot, pan, drum);                       // pan magazine
  const hub = cyl(0.045, 0.08, 10); hub.translate(-0.1, 0.13, 0); groupMesh(pivot, hub, dark);
  groupMesh(pivot, box(-0.66, -0.09, -0.04, -0.27, 0.03, 0.04), wood);                                               // butt
  groupMesh(pivot, box(-0.22, -0.2, -0.03, -0.16, -0.06, 0.03), wood);                                               // grip
  g.add(pivot);
  return { g, pivot };
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: WaterU;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "rain", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fan = new THREE.Group();
  private truck = new THREE.Group(); private bedGun!: THREE.Group; private wheels: THREE.Mesh[] = [];
  private guns: { g: THREE.Group; pivot: THREE.Group }[] = [];
  private crates = new THREE.Group(); private heap = new THREE.Group(); private row = new THREE.Group(); private hose!: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light (as the bridge short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      rain: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.rain.cloud)) };
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 36, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 }, wDrift: { value: 0.15 },
    };
    setSight(sightLines());
    this.buildFarm(kit);
    this.buildTruck();
    for (let i = 0; i < 2; i++) { const gun = lewisGun(1.12); gun.g.visible = false; R.add(gun.g); this.guns.push(gun); }
    const dg = new THREE.CircleGeometry(DAM.r + 0.6, 64); dg.rotateX(-Math.PI / 2);
    const dam = new THREE.Mesh(dg, makeWater(this.WU)); dam.position.set(DAM.x, DAM_W, DAM.z); dam.receiveShadow = true; R.add(dam);
  }

  // ======================= FARM =======================
  private buildFarm(kit: Kit) {
    const R = this.root, b = new Batch(), r = rng(11);
    const earth = lam("earthHD", () => ({ map: earthTex() }));
    const mud = lam("damMudHD", () => ({ map: mudTex() }));
    const road = lam("roadHD", () => ({ map: roadTex() }));
    // terrain grid, 2.5 m cells over 600 x 600 m; dam pit triangles get mud
    const N = 240, S = 2.5, X0 = -300;
    const H: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H.push(hAt(X0 + i * S, X0 + j * S));
    const lists: Record<string, number[]> = { e: [], m: [] }, uvs: Record<string, number[]> = { e: [], m: [] };
    const P = (i: number, j: number) => [X0 + i * S, H[j * (N + 1) + i], X0 + j * S];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      for (const tri of [[[i, j], [i, j + 1], [i + 1, j]], [[i + 1, j], [i, j + 1], [i + 1, j + 1]]]) {
        const ps = tri.map(([a, c]) => P(a, c)), cx = (ps[0][0] + ps[1][0] + ps[2][0]) / 3, cz = (ps[0][2] + ps[1][2] + ps[2][2]) / 3;
        const k = Math.hypot(cx - DAM.x, cz - DAM.z) < DAM.r + 2 ? "m" : "e";
        for (const p of ps) { lists[k].push(...p); uvs[k].push(p[0] / 4, p[2] / 4); }
      }
    }
    for (const [k, mat] of [["e", earth], ["m", mud]] as const) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(lists[k], 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs[k], 2));
      g.computeVertexNormals();
      b.add(g, mat);
    }
    for (const [x0, x1, z0, z1] of [[-1200, 1200, 300, 1200], [-1200, 1200, -1200, -300], [-1200, -300, -300, 300], [300, 1200, -300, 300]]) {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4);
      b.add(g, earth, T4((x0 + x1) / 2, 9, (z0 + z1) / 2));
    }
    // road, farm track, yard (flat dirt strips just above the ground)
    const strip = (x0: number, x1: number, z0: number, z1: number, alongX: boolean) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, alongX ? uv.getX(i) * (x1 - x0) / 8 : uv.getY(i) * (z1 - z0) / 8, alongX ? uv.getY(i) : uv.getX(i));
      b.add(g, road, T4((x0 + x1) / 2, 0.03, (z0 + z1) / 2));
    };
    strip(-300, 300, ROAD_Z - 3, ROAD_Z + 3, true);
    strip(HOUSE[0] - 2, HOUSE[0] + 2, ROAD_Z + 3, YARD[2] - 6, false);
    const yd = new THREE.CircleGeometry(13, 40); yd.rotateX(-Math.PI / 2);
    const yuv = yd.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < yuv.count; i++) yuv.setXY(i, yuv.getX(i) * 3, yuv.getY(i) * 3);
    b.add(yd, road, T4(YARD[0], 0.025, YARD[2]));

    // ---- the wheat paddock: a raised slab with a painted top and a ragged alpha-tested fringe on every side ----
    const wt = wheatTop(), ws = wheatSide();
    const top = lam("wheatTop", () => ({ map: wt }));
    const side = lam("wheatSide", () => ({ map: ws, alphaTest: 0.5, side: THREE.DoubleSide }));
    const { x0, x1, z0, z1 } = FIELD, hh = WHEAT_H;
    const tg = new THREE.PlaneGeometry(x1 - x0, z1 - z0); tg.rotateX(-Math.PI / 2);
    const tuv = tg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * (x1 - x0) / 5, tuv.getY(i) * (z1 - z0) / 5);
    b.add(tg, top, T4((x0 + x1) / 2, hh, (z0 + z1) / 2));
    const fringe = 0.32, sideH = hh + fringe;
    const wall = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(len, sideH);
      const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 3, uv.getY(i));
      g.rotateY(-Math.atan2(bz - az, bx - ax)); g.translate((ax + bx) / 2, sideH / 2, (az + bz) / 2);
      b.add(g, side);
    };
    wall(x0, z0, x1, z0); wall(x1, z0, x1, z1); wall(x1, z1, x0, z1); wall(x0, z1, x0, z0);
    // a second, inset fringe row so the edge has depth from low angles
    wall(x0 + 0.6, z0 + 0.6, x1 - 0.6, z0 + 0.6); wall(x0 + 0.6, z1 - 0.6, x0 + 0.6, z0 + 0.6);
    // ---- fence: posts + three wires round the paddock ----
    const post = lam("fencePost", () => ({ color: "#8a6a4a" })), wire = lam("fenceWire", () => ({ color: "#5d5a55" }));
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.2);
      for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; b.add(box(x - 0.06, 0, z - 0.06, x + 0.06, 1.15, z + 0.06), post); }
      for (const y of [0.45, 0.75, 1.05]) b.add(beam(V(ax, y, az), V(bx, y, bz), 0.025), wire);
    };
    fence(x0 - 1.5, z0 - 1.5, x1 + 1.5, z0 - 1.5);
    fence(x0 - 1.5, z0 - 1.5, x0 - 1.5, z1 + 1.5);

    // ---- farmhouse on stumps: weatherboard walls, corrugated hip roof, front verandah, chimney ----
    const boards = lam("boards", () => ({ map: boardTex() })), tin = lam("tin", () => ({ map: tinTex(), side: THREE.DoubleSide }));
    const trim = lam("houseTrim", () => ({ color: "#3f6b5a" })), stump = lam("stumps", () => ({ color: "#6b5a4a" }));
    const glass = lam("windowGlass", () => ({ color: "#2e3b52" })), brick = lam("chimBrick", () => ({ color: "#a5523a" }));
    const [hx, , hz] = HOUSE, W = 11, D = 8, FL = 0.6, WH = 3.0;
    for (let i = 0; i <= 4; i++) for (let k = 0; k <= 3; k++) b.add(box(hx - W / 2 + i * W / 4 - 0.12, 0, hz - D / 2 + k * D / 3 - 0.12, hx - W / 2 + i * W / 4 + 0.12, FL, hz - D / 2 + k * D / 3 + 0.12), stump);
    const wg = boxGeo(V(hx - W / 2, FL, hz - D / 2), V(hx + W / 2, FL + WH, hz + D / 2), 4);
    b.add(wg, boards);
    // hip roof
    const rt = FL + WH, ov = 0.5, rh = 2.4, ax0 = hx - W / 2 - ov, ax1 = hx + W / 2 + ov, az0 = hz - D / 2 - ov, az1 = hz + D / 2 + ov;
    const ridge0 = V(hx - W / 2 + D / 2, rt + rh, hz), ridge1 = V(hx + W / 2 - D / 2, rt + rh, hz);
    const roofTri = (a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, c, d]);
      const e1 = c.clone().sub(a), along = e1.clone().normalize();
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, e1.length() / 2, 0, d.clone().sub(a).dot(along) / 2, d.clone().sub(a).sub(along.clone().multiplyScalar(d.clone().sub(a).dot(along))).length() / 2], 2));
      g.computeVertexNormals(); b.add(g, tin);
    };
    const c00 = V(ax0, rt, az0), c10 = V(ax1, rt, az0), c11 = V(ax1, rt, az1), c01 = V(ax0, rt, az1);
    roofTri(c00, c10, ridge1); roofTri(c00, ridge1, ridge0);      // front (-z)
    roofTri(c11, c01, ridge0); roofTri(c11, ridge0, ridge1);      // back
    roofTri(c10, c11, ridge1); roofTri(c01, c00, ridge0);         // hips
    // verandah across the front: deck, posts, skillion roof
    const vz0 = hz - D / 2 - 2.6;
    b.add(box(hx - W / 2, FL - 0.12, vz0, hx + W / 2, FL, hz - D / 2), lam("deck", () => ({ map: planksHD() })));
    for (let i = 0; i <= 5; i++) b.add(box(hx - W / 2 + i * W / 5 - 0.07, FL, vz0 + 0.05, hx - W / 2 + i * W / 5 + 0.07, FL + 2.5, vz0 + 0.19), trim);
    const vr = new THREE.PlaneGeometry(W + 0.6, 2.9); vr.rotateX(-Math.PI / 2 + 0.2); vr.translate(hx, FL + 2.75, vz0 + 1.25);
    const vuv = vr.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < vuv.count; i++) vuv.setXY(i, vuv.getX(i) * 6, vuv.getY(i) * 1.5);
    b.add(vr, tin);
    for (const wx of [-3.4, 3.4]) { // windows + door on the front wall
      b.add(box(hx + wx - 0.75, FL + 0.9, hz - D / 2 - 0.06, hx + wx + 0.75, FL + 2.3, hz - D / 2 + 0.02), trim);
      b.add(box(hx + wx - 0.6, FL + 1.0, hz - D / 2 - 0.09, hx + wx + 0.6, FL + 2.2, hz - D / 2 - 0.03), glass);
    }
    b.add(box(hx - 0.6, FL, hz - D / 2 - 0.06, hx + 0.6, FL + 2.2, hz - D / 2 + 0.02), trim);
    b.add(box(hx + W / 2 - 2.2, rt + 0.5, hz + 1, hx + W / 2 - 1.4, rt + rh + 0.9, hz + 1.8), brick);
    // water tank beside the house
    const tankG = new THREE.CylinderGeometry(1.6, 1.6, 2.6, 28, 1, false);
    const tuv2 = tankG.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < tuv2.count; i++) tuv2.setXY(i, tuv2.getX(i) * 6, tuv2.getY(i));
    b.add(tankG, tin, T4(hx + W / 2 + 2.4, FL + 1.3, hz + 1));
    b.add(new THREE.ConeGeometry(1.7, 0.6, 28), tin, T4(hx + W / 2 + 2.4, FL + 2.9, hz + 1));
    b.add(box(hx + W / 2 + 0.6, 0, hz - 0.8, hx + W / 2 + 4.2, FL, hz + 2.8), stump);
    // ---- windmill: tapered lattice tower, platform, fan (posed in update) and tail vane ----
    const iron = lam("millIron", () => ({ color: "#6d6f70" }));
    const [mx, , mz] = MILL, TH = 10;
    const leg = (sx: number, sz: number) => [V(mx + sx * 1.3, 0, mz + sz * 1.3), V(mx + sx * 0.22, TH, mz + sz * 0.22)];
    const legs = [leg(-1, -1), leg(1, -1), leg(1, 1), leg(-1, 1)];
    for (const [a, c] of legs) b.add(beam(a, c, 0.1), iron);
    for (let k = 1; k < 5; k++) {
      const t0 = (k - 1) / 4, t1 = k / 4;
      for (let i = 0; i < 4; i++) {
        const [a0, a1] = legs[i], [b0, b1] = legs[(i + 1) % 4];
        const pA = a0.clone().lerp(a1, t0), pB = b0.clone().lerp(b1, t1), pC = b0.clone().lerp(b1, t0), pD = a0.clone().lerp(a1, t1);
        b.add(beam(pA, pB, 0.05), iron); b.add(beam(pC, pD, 0.05), iron); b.add(beam(pD, b0.clone().lerp(b1, t1), 0.05), iron);
      }
    }
    const blade = lam("millBlade", () => ({ color: "#d9d6cf", side: THREE.DoubleSide }));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, g = new THREE.PlaneGeometry(0.34, 1.5);
      g.translate(0, 1.15, 0); g.rotateY(0.45); g.rotateZ(a);
      groupMesh(this.fan, g, blade);
    }
    groupMesh(this.fan, new THREE.TorusGeometry(1.9, 0.04, 6, 36), iron);
    groupMesh(this.fan, new THREE.TorusGeometry(0.42, 0.04, 6, 24), iron);
    this.fan.position.set(mx, TH + 0.4, mz - 0.6);
    R.add(this.fan);
    b.add(box(mx - 0.25, TH, mz - 0.4, mx + 0.25, TH + 0.6, mz + 1.0), iron);
    const vane = new THREE.PlaneGeometry(0.05, 1); vane.rotateY(Math.PI / 2); vane.scale(1, 1, 1.6);
    b.add(box(mx - 0.03, TH + 0.25, mz + 1.0, mx + 0.03, TH + 0.45, mz + 2.9), iron);
    b.add(box(mx - 0.02, TH - 0.1, mz + 2.2, mx + 0.02, TH + 1.1, mz + 3.4), blade);
    // trough under the mill
    b.add(box(mx + 1.6, 0, mz - 2.5, mx + 2.4, 0.6, mz + 1.5), tin);

    // ---- gum trees, saltbush, rocks ----
    const gum = (x: number, z: number, h: number) => prop(b, kit, "gum", x, hAt(x, z), z, h, r() * 6);
    for (const [x, z, h] of [[-52, 34, 15], [-22, 40, 13], [-58, 2, 12], [-18, 14, 11], [-44, 44, 14]] as const) gum(x, z, h);
    for (let x = -280; x < 280; x += 9 + r() * 22) { // along the road, both sides
      if (Math.abs(x - TRUCK_STOP[0]) < 14) continue;
      if (r() < 0.6) gum(x, ROAD_Z - 7 - r() * 8, 10 + r() * 7);
      if (r() < 0.4 && (x < FIELD.x0 - 6 || x > FIELD.x1 + 6)) gum(x, ROAD_Z + 7 + r() * 6, 10 + r() * 7);
    }
    for (let i = 0; i < 70; i++) { // paddock trees
      const x = -280 + r() * 560, z = -280 + r() * 560;
      if (x > FIELD.x0 - 8 && x < FIELD.x1 + 8 && z > FIELD.z0 - 8 && z < FIELD.z1 + 8) continue;
      if (Math.hypot(x - HOUSE[0], z - HOUSE[2]) < 18 || Math.hypot(x - DAM.x, z - DAM.z) < 24 || Math.abs(z - ROAD_Z) < 6) continue;
      gum(x, z, 9 + r() * 9);
    }
    for (let i = 0; i < 260; i++) {
      const x = -260 + r() * 520, z = -260 + r() * 520;
      if (x > FIELD.x0 - 2 && x < FIELD.x1 + 2 && z > FIELD.z0 - 2 && z < FIELD.z1 + 2) continue;
      if (Math.abs(z - ROAD_Z) < 4 || Math.hypot(x - YARD[0], z - YARD[2]) < 14 || Math.hypot(x - DAM.x, z - DAM.z) < 18) continue;
      prop(b, kit, "scrub", x, hAt(x, z), z, 0.6 + r() * 0.7, r() * 6);
    }
    // the coat-of-arms knoll: a ring of red sandstone round the mound top
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 0.3, rr = 3.6 + r() * 2.5, x = ROCK[0] + rr * Math.cos(a), z = ROCK[2] + rr * Math.sin(a);
      if (z < ROCK[2] - 2 && Math.abs(x - ROCK[0]) < 3) continue; // keep the lens side open
      prop(b, kit, ["rock_largeA", "rock_largeB", "rock_tallA", "rock_largeC"][i % 4], x, hAt(x, z) - 0.2, z, 1.2 + r() * 1.6, r() * 6);
    }
    for (const [x, z, n] of [[DAM.x + 18, DAM.z + 8, "log"], [DAM.x - 15, DAM.z + 12, "stump_old"]] as const)
      prop(b, kit, n, x, hAt(x, z), z, n === "log" ? 0.5 : 0.8, 1.1);
    b.build(R);

    // ---- per-shot props ----
    const crate = lam("crate", () => ({ map: crateTex() })), brass = metal("#d0a23e");
    for (let i = 0; i < 10; i++) { // ammo boxes stacked beside the truck
      const x = TRUCK_STOP[0] - 0.4 + (i % 4) * 0.62, y = Math.floor(i / 4) * 0.36, z = ROAD_Z - 4.2 + (i % 2) * 0.05;
      groupMesh(this.crates, box(x - 0.28, y, z - 0.2, x + 0.28, y + 0.34, z + 0.2), crate);
    }
    R.add(this.crates);
    const hg = new THREE.ConeGeometry(1.0, 0.45, 32, 1); hg.translate(0, 0.22, 0);
    groupMesh(this.heap, hg, lam("heap", () => ({ map: heapTex() })), T4(TRUCK_STOP[0] + 1.0, 0, ROAD_Z - 3.4));
    for (let i = 0; i < 7; i++) { // empty open boxes tipped over
      const x = TRUCK_STOP[0] - 1.4 + i * 0.7, z = ROAD_Z - 4.4 + (i % 2) * 0.5;
      const m = new THREE.Matrix4().compose(V(x, 0.17, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 0.7, i % 3 === 0 ? 1.3 : 0)), V(1, 1, 1));
      groupMesh(this.heap, box(-0.28, -0.17, -0.2, 0.28, 0.17, 0.2), crate, m);
    }
    R.add(this.heap);
    for (let i = 0; i < 10; i++) { // ten casings in a row (shot 21)
      const c = cyl(0.022, 0.11, 12); c.rotateZ(Math.PI / 2);
      groupMesh(this.row, c, brass, T4(CASINGS[0] - 0.2 + i * 0.075, 0.025, CASINGS[2] + (i % 2) * 0.01));
    }
    R.add(this.row);
    // garden hose from the tank to the yard
    const tap = V(HOUSE[0] + 5.5 + 2.4, 0.06, HOUSE[2] - 0.6);
    const curve = new THREE.CatmullRomCurve3([tap, V(HOUSE[0] + 6, 0.05, HOUSE[2] - 8), V(YARD[0] + 7, 0.05, YARD[2] + 2), V(YARD[0] + 4.2, 0.05, YARD[2] - 1.6)]);
    this.hose = groupMesh(new THREE.Group(), new THREE.TubeGeometry(curve, 60, 0.035, 8), tm("#3f8f3c"), undefined, false);
    R.add(this.hose);
  }

  // ======================= TRUCK =======================
  private buildTruck() {
    const T = this.truck, olive = tm("#5f6a3e"), dark = tm("#2b2a2a"), wood = tm("#8a6a4a"), glass = tm("#33435a"), chrome = metal("#c9c9c0");
    groupMesh(T, box(-2.9, 0.55, -0.85, 2.3, 0.75, 0.85), dark);                    // chassis
    groupMesh(T, box(1.1, 0.75, -0.62, 2.4, 1.6, 0.62), olive);                     // bonnet
    groupMesh(T, box(2.38, 0.8, -0.55, 2.48, 1.55, 0.55), dark);                    // radiator
    for (const s of [-1, 1]) { const hl = cyl(0.12, 0.12, 12); hl.rotateZ(Math.PI / 2); groupMesh(T, hl, chrome, T4(2.45, 1.55, s * 0.5)); }
    groupMesh(T, box(-0.3, 0.75, -0.9, 1.15, 2.35, 0.9), olive);                    // cab
    groupMesh(T, box(1.12, 1.55, -0.75, 1.18, 2.15, 0.75), glass);                  // windscreen
    for (const s of [-1, 1]) groupMesh(T, box(0.15, 1.6, s * 0.9 - 0.03, 0.95, 2.15, s * 0.9 + 0.03), glass); // side windows
    groupMesh(T, box(-0.4, 2.35, -0.95, 1.25, 2.45, 0.95), olive);                  // cab roof
    groupMesh(T, box(-2.95, 0.75, -1.0, -0.35, 0.85, 1.0), wood);                   // flatbed
    for (const s of [-1, 1]) groupMesh(T, box(-2.95, 0.85, s * 1.0 - 0.05, -0.35, 1.25, s * 1.0 + 0.05), wood);
    groupMesh(T, box(-2.95, 0.85, -1.0, -2.88, 1.25, 1.0), wood);
    for (const [x, s] of [[1.6, -1], [1.6, 1], [-1.9, -1], [-1.9, 1]] as const) {     // wheels + mudguards
      const tyre = cyl(0.46, 0.26, 20); tyre.rotateX(Math.PI / 2);
      const w = groupMesh(T, tyre, dark, T4(x, 0.46, s * 0.86)); this.wheels.push(w);
      const hub = cyl(0.18, 0.28, 12); hub.rotateX(Math.PI / 2); groupMesh(T, hub, olive, T4(x, 0.46, s * 0.86));
      const guard = new THREE.CylinderGeometry(0.58, 0.58, 0.34, 20, 1, true, 0, Math.PI); guard.rotateX(Math.PI / 2); guard.rotateZ(-Math.PI / 2);
      groupMesh(T, guard, olive, T4(x, 0.5, s * 0.86));
    }
    const gun = lewisGun(0.75);
    gun.g.position.set(BED_GUN[0], 0.85, BED_GUN[2]);
    this.bedGun = gun.g; T.add(gun.g);
    T.visible = false;
    this.root.add(T);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = id === 21 ? 0.05 : 0.15; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, id === 21 ? 3 : 10, 120);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
      m.scale.y = m.scale.x / (s.light === "rain" ? 1.4 : 2);
    }
    // ---- water colours ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;

    this.pose(id, f, t);

    // ---- cast + effects (the bridge short's sprite placement) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const ef = this.fx(fi++);
      ef.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      ef.use(!!p.soft);
      ef.mesh.visible = true;
      ef.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ef.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { ef.mesh.quaternion.copy(cam.quaternion); ef.mesh.rotateZ(p.rot ?? 0); }
      ef.mesh.scale.set(p.w, p.h, 1);
      fused.push(ef);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const ef of fused) ef.bind();
    return focus;
  }

  private pose(id: number, f: number, t: number) {
    this.fan.rotation.z = -t * (id === 8 ? 5 : 2.2);
    const tp = truckPose(id, f);
    setPose(this.truck, tp);
    this.bedGun.visible = id >= 14 && id <= 15;
    if (this.bedGun.visible) {
      const pv = this.bedGun.children[this.bedGun.children.length - 1];
      pv.rotation.set(0, id === 15 ? 0.15 * Math.sin(t * 9) : 0, id === 15 ? 0.25 * Math.sin(t * 7) + (f > 1285 ? 0.5 : 0) : 0.05);
    }
    const spin = id === 7 ? -Math.max(0, 1 - (f - 555) / 50) * 0.6 : id === 15 || id === 22 || id === 23 || (id === 14 && f > 1150) ? -0.5 : 0;
    for (const w of this.wheels) w.rotation.y = 0, w.rotation.z = t * spin * 12;
    const guns = gunsAt(id, f);
    this.guns.forEach((g, i) => {
      const d = guns[i];
      g.g.visible = !!d;
      if (!d) return;
      g.g.position.set(d.x, d.y, d.z);
      g.g.rotation.set(0, -d.yaw, 0);
      g.pivot.rotation.set(0, 0, d.pitch);
    });
    this.crates.visible = id === 7 || id === 8 || id === 14 || id === 19;
    this.heap.visible = id === 20;
    this.row.visible = id === 21;
    this.hose.visible = id === 17 || id === 18;
  }
}
