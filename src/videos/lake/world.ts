// The lake short as one three.js scene with three sets:
//   lake: terrain bowl (shore, steep bank, bed, island, canal), the whirlpool water, garden shore, trees, houses, the
//         drilling rig, tug, eleven barges, the crew boat and the fisherman's skiff, the canal waterfall
//   mine: a white room-and-pillar salt gallery 160 m below the lake, elevator shaft + cage, alarm lamp, roof drill
//   bath: a small bathroom with a tub, plug chain, rubber duck and the growing salt drain
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f). Sky, light rig, ink,
// two-tone shading and the card cast are the bridge short's, unchanged.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, prop, house, setSight } from "./build";
import { ctex, rng, grassHD, cobbleHD, beam, waterNear, waterFar, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pen } from "./toon";
import { Pool, Actor, Fx, stage, poseMatrix, bedAt } from "./cast";
import {
  FPS, G, LAKE_R, CANAL, MINE_Y, SHAFT, ROOF, BATH, TUB, DRAIN, RIG_DECK, SHOTS, ShotDef, camAt, vortexAt, levelAt, funnel, rigPose, tugPose,
  bargePose, boatPose, skiffPose, cageY, mineWater, roofDrill, roofWater, tubState, fallAt, Pose,
} from "./story";

// ---------------- assets ----------------
const NATURE = ["flower_redA", "flower_yellowA", "flower_purpleA", "flower_redB", "flower_yellowB", "grass_large", "lily_large", "lily_small", "rock_largeA",
  "rock_largeB", "stump_round", "log", "fence_simple", "path_stone"];
const TOWN = ["lantern", "fountain-round", "stall-bench", "fence", "rock-large", "cart"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    const load = (dir: string, n: string) => loader.loadAsync(staticFile(`kenney/${dir}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const);
    kitP = Promise.all([...NATURE.map((n) => load("nature-kit", n)), ...TOWN.map((n) => load("fantasy-town-kit", n))])
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- painted textures (lake only) ----------------
const mudTex = () => ctex("mudHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#8a6e4f"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const x = r() * 1024, y = r() * 1024, rx = 20 + r() * 70, ry = rx * (0.4 + r() * 0.4);
    g.fillStyle = r() < 0.5 ? "rgba(70,52,36,0.22)" : "rgba(170,140,100,0.18)";
    g.beginPath(); g.ellipse(x, y, rx, ry, r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(50,36,24,0.35)"; g.lineWidth = 3; // drying cracks
  for (let i = 0; i < 70; i++) { let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); } g.stroke(); }
});
const sandTex = () => ctex("bankHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#c9a874"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,90,60,0.18)" : "rgba(240,220,170,0.25)"; g.fillRect(r() * 1024, r() * 1024, 3 + r() * 9, 2 + r() * 5); }
  for (let y = 0; y < 1024; y += 64 + r() * 40) { g.fillStyle = "rgba(110,80,52,0.16)"; g.fillRect(0, y, 1024, 6 + r() * 10); } // strata
});
const saltTex = () => ctex("saltHD2", 1024, 1024, (g, r) => {
  g.fillStyle = "#f3e9d6"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9; i++) { // a few wavy, uneven strata in warm greys and pale ochre
    const y0 = r() * 1024, th = 10 + r() * 40, col = r() < 0.5 ? `rgba(176,150,120,${0.18 + r() * 0.15})` : `rgba(140,132,128,${0.15 + r() * 0.15})`;
    g.fillStyle = col; g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y0 + 18 * Math.sin(x / 140 + i) + 8 * Math.sin(x / 47 + 2 * i));
    for (let x = 1024; x >= 0; x -= 32) g.lineTo(x, y0 + th + 14 * Math.sin(x / 120 + i * 1.7));
    g.closePath(); g.fill();
  }
  for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,250,240,0.35)" : "rgba(150,130,110,0.12)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 10 + r() * 40, 6 + r() * 20, r() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.5)" : "rgba(160,155,150,0.25)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 6, 2 + r() * 6); }
  g.strokeStyle = "rgba(150,128,105,0.22)"; g.lineWidth = 3; // scallop marks of the mining machine, uneven
  for (let x = 0; x < 1024; x += 70 + r() * 60) { g.beginPath(); for (let y = 0; y <= 1024; y += 16) g.lineTo(x + 20 * Math.sin(y / 90 + x), y); g.stroke(); }
});
const tileTex = (key: string, a: string, b: string, n: number) => ctex(key, 512, 512, (g) => {
  const s = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = "rgba(90,90,100,0.6)"; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke(); }
});
const fallTex = () => {
  const t = ctex("waterfall", 256, 512, (g, r) => {
    g.fillStyle = "#9fd6ea"; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 70; i++) { const x = r() * 256, w = 3 + r() * 10; g.fillStyle = r() < 0.6 ? "rgba(255,255,255,0.8)" : "rgba(40,120,170,0.45)"; g.fillRect(x, r() * 512, w, 60 + r() * 200); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const rigTex = () => ctex("rigBands", 64, 512, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2efe8" : "#d8452f"; g.fillRect(0, i * 64, 64, 64); } });
const hullTex = (key: string, top: string, mid: string, bot: string) => ctex(key, 256, 128, (g) => {
  g.fillStyle = top; g.fillRect(0, 0, 256, 40); g.fillStyle = mid; g.fillRect(0, 40, 256, 60); g.fillStyle = bot; g.fillRect(0, 100, 256, 28);
  g.fillStyle = "rgba(0,0,0,0.12)"; for (let x = 8; x < 256; x += 32) g.fillRect(x, 44, 3, 52);
});

// ---------------- water shader (whirlpool) ----------------
type WaterU = Record<string, THREE.IUniform>;
const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime, wSpin, wScale, wLevel, wDark, wDrift;
uniform vec2 wC;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wq = vWP.xz - wC;
  float wr = length(wq) / wScale;
  float wa = -wSpin * wTime * 14.0 / (wr + 6.0);          // inner water turns faster: the marks shear into a spiral
  vec2 wp = vec2(cos(wa) * wq.x - sin(wa) * wq.y, sin(wa) * wq.x + cos(wa) * wq.y) + vec2(wDrift * wTime, 0.0);
  vec4 mk = mix(texture2D(wNearTex, wp / (8.0 * wScale)), texture2D(wFarTex, wp / (40.0 * wScale) + 0.37), smoothstep(25.0, 90.0, wd / wScale));
  float sw = wSpin * smoothstep(0.0, 1.0, 1.0 - wr / 60.0);
  wc = mix(wc, wTrough, mk.g * (0.6 + 0.3 * sw));
  wc = mix(wc, wCrest, mk.r * (0.7 + 0.6 * sw));
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  float wDown = clamp((wLevel - vWP.y) / (8.0 * wScale), 0.0, 1.0);  // down the funnel: darker, foamier rim
  wc = mix(wc, wTrough * 0.55, wDark * wDown);
  wc = mix(wc, wCrest, wDark * 0.35 * smoothstep(0.02, 0.2, wDown) * (1.0 - smoothstep(0.3, 0.6, wDown)) * mk.r);
  diffuseColor.rgb = wc;`;
const makeWater = (shared: WaterU, own: WaterU, key: string) => {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, own);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", WATER_DECL)
      .replace("#include <map_fragment>", WATER_COL)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
  };
  m.customProgramCacheKey = () => "lakeWater1" + key;
  return m;
};
const ownU = (scale: number, cx: number, cz: number, dark: number, drift: number): WaterU => ({
  wSpin: { value: 0 }, wScale: { value: scale }, wLevel: { value: 0 }, wDark: { value: dark }, wC: { value: new THREE.Vector2(cx, cz) }, wDrift: { value: drift },
});

/** polar water disc around (cx, cz): rings x segments, heights rebuilt from (level, vortex) */
class Swirl {
  mesh: THREE.Mesh; private geo: THREE.BufferGeometry; private rad: number[]; private key = "";
  constructor(parent: THREE.Object3D, mat: THREE.Material, private cx: number, private cz: number, R: number, rings: number, segs: number, private depth: (v: number, r: number) => number) {
    this.rad = Array.from({ length: rings + 1 }, (_, i) => (i === 0 ? 0.02 * R : R * (i / rings) ** 1.7));
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2, r = this.rad[i];
      pos.push(cx + r * Math.cos(a), 0, cz + r * Math.sin(a)); uv.push(j / segs, i / rings);
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + 1, c = a + segs + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  set(level: number, v: number) {
    const k = `${level.toFixed(3)}|${v.toFixed(3)}`;
    if (k === this.key) return;
    this.key = k;
    const p = this.geo.attributes.position as THREE.BufferAttribute, segs1 = p.count / this.rad.length;
    for (let i = 0; i < this.rad.length; i++) {
      const y = level - this.depth(v, this.rad[i]);
      for (let j = 0; j < segs1; j++) p.setY(i * segs1 + j, y);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/** rectangular tub water: heights from a funnel around the drain whose throat widens with the salt hole */
class TubWater {
  mesh: THREE.Mesh; private geo: THREE.BufferGeometry; private key = "";
  constructor(parent: THREE.Object3D, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, nx: number, nz: number) {
    this.geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); this.geo.rotateX(-Math.PI / 2); this.geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    this.mesh = new THREE.Mesh(this.geo, mat); this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  set(level: number, v: number, rc: number) {
    const k = `${level.toFixed(4)}|${v.toFixed(3)}|${rc.toFixed(4)}`;
    if (k === this.key) return;
    this.key = k;
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i) - DRAIN[0], p.getZ(i) - DRAIN[2]);
      p.setY(i, Math.max(DRAIN[1] - 0.01, level - (v * 0.35) / (1 + (r / rc) ** 2)));
    }
    p.needsUpdate = true; this.geo.computeVertexNormals();
  }
}

// ---------------- helpers ----------------
/** where the canal bed meets the falling bank (the waterfall lip) */
const LIP_X = 114.3;
const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
const T4 = (x: number, y: number, z: number, ry = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(s, s, s));
/** boat hull: pointed bow at +z, flat transom at -z, length L, beam W, depth D (top at y = 0, keel at -D) */
const hullGeo = (L: number, W: number, D: number) => {
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, -L / 2); sh.lineTo(W / 2, -L / 2); sh.lineTo(W / 2, L * 0.18); sh.quadraticCurveTo(W / 2, L * 0.42, 0, L / 2);
  sh.quadraticCurveTo(-W / 2, L * 0.42, -W / 2, L * 0.18); sh.lineTo(-W / 2, -L / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2); // extrude along -y: deck at y = 0, keel at y = -D
  return g;
};
const tm = (col: string) => twoTone(new THREE.MeshLambertMaterial({ color: col }));
const metal = (col: string) => twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#9a9a9a", shininess: 50 }), 0.15);
const groupMesh = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4, cast = true) => {
  const mesh = new THREE.Mesh(geo, mat);
  if (m) mesh.applyMatrix4(m);
  mesh.castShadow = cast; mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
};
const setPose = (o: THREE.Object3D, p: Pose) => { o.visible = p.on; if (!p.on) return; o.matrixAutoUpdate = false; poseMatrix(p, o.matrix); o.matrixWorldNeedsUpdate = true; };

/** height of the lake terrain at (x, z): bowl + bank + island + the canal cut */
const hAt = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  let h = bedAt(r);
  const dz = Math.abs(z - CANAL.z);
  if (x > CANAL.x - 2 && dz < CANAL.w / 2 + 2) {
    const bank = dz < CANAL.w / 2 ? -3 : -3 + (G + 3) * ((dz - CANAL.w / 2) / 2);
    h = Math.min(h, Math.max(bank, -3));
  }
  return h;
};

/** every lens position of the film looking at its subject: props and houses there are left out */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) {
    if (s.set !== "lake") continue;
    for (let f = s.a - 8; f < s.b + 8; f += 3) {
      const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
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
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private sets: Record<"lake" | "mine" | "bath", THREE.Group> = { lake: new THREE.Group(), mine: new THREE.Group(), bath: new THREE.Group() };
  private lake!: Swirl; private lakeU!: WaterU; private puddle!: THREE.Mesh; private canalWater!: THREE.Mesh;
  private fall!: THREE.Mesh; private fallMap!: THREE.Texture; private fallFoam!: THREE.Mesh;
  private rig = new THREE.Group(); private pipe!: THREE.Mesh; private tug = new THREE.Group(); private barges: THREE.Group[] = [];
  private boat = new THREE.Group(); private skiff = new THREE.Group();
  private cage = new THREE.Group(); private alarm!: THREE.Mesh; private alarmMat!: THREE.MeshBasicMaterial;
  private mineSheet!: THREE.Mesh; private bit = new THREE.Group(); private column!: THREE.Mesh; private columnMap!: THREE.Texture; private pool2!: THREE.Mesh;
  private tubWater!: TubWater; private tubU!: WaterU; private plug = new THREE.Group(); private chain: THREE.Mesh[] = []; private duck = new THREE.Group();
  private saltRing = new THREE.Group(); private hole!: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    for (const g of Object.values(this.sets)) R.add(g);
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
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); this.sets.lake.add(m);
    }

    // ---- water uniforms shared by every water surface ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };

    setSight(sightLines());
    this.buildLake(kit);
    this.buildMine();
    this.buildBath();
    // water surfaces (after the sets, they need the uniforms)
    this.lakeU = ownU(1, 0, 0, 1, 0);
    this.lake = new Swirl(this.sets.lake, makeWater(this.WU, this.lakeU, "lake"), 0, 0, LAKE_R + 6, 70, 160, funnel);
    const pud = new THREE.CircleGeometry(16, 48); pud.rotateX(-Math.PI / 2);
    this.puddle = new THREE.Mesh(pud, makeWater(this.WU, ownU(1, 0, 0, 0, 0.1), "pud"));
    this.puddle.position.set(0, -37.3, 0); this.puddle.receiveShadow = true; this.sets.lake.add(this.puddle);
    const cg = new THREE.PlaneGeometry(420, CANAL.w + 0.4); cg.rotateX(-Math.PI / 2);
    this.canalWater = new THREE.Mesh(cg, makeWater(this.WU, ownU(0.6, 0, 0, 0, -1.2), "canal"));
    this.canalWater.position.set(LIP_X + 210, -0.2, CANAL.z); this.canalWater.receiveShadow = true; this.sets.lake.add(this.canalWater);
    // the canal waterfall: a curved sheet over the lip, scrolling streaks
    this.fallMap = fallTex();
    const fg = new THREE.PlaneGeometry(CANAL.w, 1, 1, 16);
    const fp = fg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) { const u = 0.5 - fp.getY(i); fp.setXYZ(i, fp.getX(i), -u * 14, -3.2 * u * u - 0.6 * u); } // x across, falls 14 m, curls out toward -x (lake)
    fg.rotateY(Math.PI / 2); fg.computeVertexNormals();
    this.fall = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: this.fallMap, color: new THREE.Color(1.05, 1.05, 1.05), side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    this.fall.position.set(LIP_X, -0.2, CANAL.z); this.fall.layers.set(NOINK); this.sets.lake.add(this.fall);
    const foamG = new THREE.CircleGeometry(1, 32); foamG.rotateX(-Math.PI / 2);
    this.fallFoam = new THREE.Mesh(foamG, new THREE.MeshBasicMaterial({ color: "#f4fbff", transparent: true, opacity: 0.85, depthWrite: false }));
    this.fallFoam.layers.set(NOINK); this.sets.lake.add(this.fallFoam);
    this.tubU = ownU(0.02, DRAIN[0], DRAIN[2], 1, 0);
    this.tubWater = new TubWater(this.sets.bath, makeWater(this.WU, this.tubU, "tub"), TUB[0] - 0.85, TUB[0] + 0.85, TUB[2] - 0.34, TUB[2] + 0.34, 80, 32);
    this.alarmMat = this.alarm.material as THREE.MeshBasicMaterial;
  }

  // ======================= LAKE =======================
  private buildLake(kit: Kit) {
    const L = this.sets.lake, b = new Batch(), r = rng(7);
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    const bank = lam("bankHD", () => ({ map: sandTex() }));
    const mud = lam("mudHD", () => ({ map: mudTex() }));
    const cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    // terrain grid, 2.5 m cells over 520 x 520 m; triangles sorted to grass / bank / mud by height
    const N = 208, S = 2.5, X0 = -260;
    const H: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H.push(hAt(X0 + i * S, X0 + j * S));
    const lists: Record<string, number[]> = { g: [], b: [], m: [] }, uvs: Record<string, number[]> = { g: [], b: [], m: [] };
    const P = (i: number, j: number) => [X0 + i * S, H[j * (N + 1) + i], X0 + j * S];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      for (const tri of [[[i, j], [i, j + 1], [i + 1, j]], [[i + 1, j], [i, j + 1], [i + 1, j + 1]]]) {
        const ps = tri.map(([a, c]) => P(a, c)), y = (ps[0][1] + ps[1][1] + ps[2][1]) / 3;
        const k = y > G - 0.25 ? "g" : y > -12.4 ? "b" : "m";
        for (const p of ps) { lists[k].push(...p); uvs[k].push(p[0] / 4, p[2] / 4); }
      }
    }
    for (const [k, mat] of [["g", grass], ["b", bank], ["m", mud]] as const) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(lists[k], 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs[k], 2));
      g.computeVertexNormals();
      b.add(g, mat);
    }
    // flat grass beyond the grid
    for (const [x0, x1, z0, z1] of [[-900, 900, 260, 900], [-900, 900, -900, -260], [-900, -260, -260, 260], [260, 900, -260, 260]]) {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 4, uv.getY(i) * (z1 - z0) / 4);
      b.add(g, grass, T4((x0 + x1) / 2, G, (z0 + z1) / 2));
    }
    // garden promenade along the south shore: a cobbled walk, flower beds, hedges, a fountain, benches, lanterns
    b.add(boxGeo(V(-40, G - 0.05, -124.2), V(40, G + 0.03, -121.6), 2), cobble);
    b.add(boxGeo(V(-16.5, G - 0.05, -134), V(-14.5, G + 0.03, -124.2), 2), cobble);
    const flowers = ["flower_redA", "flower_yellowA", "flower_purpleA", "flower_redB", "flower_yellowB"];
    for (let x = -38; x < 38; x += 1.1) for (const z of [-125.2, -126.1]) if (Math.abs(x + 15.5) > 1.6) prop(b, kit, flowers[Math.floor(r() * 5)], x + r() * 0.4, G, z + r() * 0.3, 0.45 + r() * 0.2, r() * 6);
    for (let x = -38; x < 38; x += 3.2) if (Math.abs(x + 15.5) > 2.5) prop(b, kit, "hedge", x, G, -127.3, 1.0, 0);
    prop(b, kit, "fountain-round", 26, G, -133, 1.6);
    for (const x of [-26, -14.5, -2, 10, 22]) prop(b, kit, "lantern", x, G, -124.4, 2.6);
    for (const x of [-20, 4, 16]) prop(b, kit, "stall-bench", x, G, -124.9, 0.9, Math.PI);
    for (let i = 0; i < 26; i++) { const x = -44 + i * 3.6 + r(), z = -136 - r() * 10; prop(b, kit, ["tree_oak", "tree_fat", "tree_default", "plant_bushLarge"][i % 4], x, G, z, 5 + r() * 4); }
    // shore trees all round, houses here and there behind them (a few houses by the garden)
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, rr = 126 + r() * 60, x = rr * Math.cos(a), z = rr * Math.sin(a);
      if (x > CANAL.x - 4 && Math.abs(z - CANAL.z) < CANAL.w) continue;
      prop(b, kit, ["tree_oak", "tree_fat", "tree_default", "tree_cone", "tree-high-round", "plant_bushLarge"][i % 6], x, G, z, 6 + r() * 6);
    }
    for (let i = 0; i < 18; i++) {
      const a = -2.4 + i * 0.27 + r() * 0.1, rr = 168 + r() * 30;
      house(b, rr * Math.cos(a), rr * Math.sin(a), -a - Math.PI / 2, [7, 9][i % 2], 8, [7, 8.4][i % 2], i % 8, G);
    }
    for (const [x, z, w] of [[-30, -150, 9], [-18, -152, 7], [14, -150, 9], [27, -151, 7]] as const) house(b, x, z, 0, w, 8, 7.6, Math.floor(r() * 8), G);
    // canal: timber-lined banks out to the east
    const wood = lam("wood", () => ({ map: beam() }));
    for (const s of [-1, 1]) b.add(boxGeo(V(CANAL.x - 2, -3, CANAL.z + s * (CANAL.w / 2) - 0.3), V(400, G + 0.3, CANAL.z + s * (CANAL.w / 2) + 0.3), 2), wood);
    // rocks on the bed (seen when it drains)
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, rr = 20 + r() * 85; prop(b, kit, i % 2 ? "rock_largeA" : "rock_largeB", rr * Math.cos(a), bedAt(rr) - 0.3, rr * Math.sin(a), 1 + r() * 2, r() * 6); }
    b.build(L);

    // ---- the rig: jack-up platform, banded derrick, drill pipe, cabin ----
    const steel = metal("#8d939c"), deck = tm("#6e737c"), red = tm("#d8452f"), white = tm("#f2efe8"), dark = tm("#3a3e46");
    const band = lam("rigBands", () => ({ map: rigTex() }));
    const g = this.rig;
    groupMesh(g, boxGeo(V(-6, RIG_DECK - 0.7, -6), V(6, RIG_DECK, 6), 0, true), deck);
    for (const [x, z] of [[-5.3, -5.3], [5.3, -5.3], [-5.3, 5.3], [5.3, 5.3]]) {
      groupMesh(g, new THREE.CylinderGeometry(0.45, 0.45, 14, 10).translate(0, -4, 0), band, T4(x, RIG_DECK, z));
    }
    const top = 24, legs: [number, number][] = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
    for (const [x, z] of legs) groupMesh(g, beamBetween(V(x, RIG_DECK, z), V(x * 0.25, RIG_DECK + top, z * 0.25), 0.32), red);
    for (let k = 0; k < 6; k++) {
      const y0 = RIG_DECK + (k * top) / 6, y1 = RIG_DECK + ((k + 1) * top) / 6, s0 = 1 - 0.75 * (k / 6), s1 = 1 - 0.75 * ((k + 1) / 6);
      for (let e = 0; e < 4; e++) {
        const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4];
        groupMesh(g, beamBetween(V(ax * s0, y0, az * s0), V(bx * s1, y1, bz * s1), 0.14), k % 2 ? white : red);
        groupMesh(g, beamBetween(V(ax * s1, y1, az * s1), V(bx * s1, y1, bz * s1), 0.14), white);
      }
    }
    groupMesh(g, boxGeo(V(-1.2, RIG_DECK + top, -1.2), V(1.2, RIG_DECK + top + 1.4, 1.2), 0, true), dark);
    groupMesh(g, boxGeo(V(-2.2, RIG_DECK, -2.2), V(2.2, RIG_DECK + 0.5, 2.2)), dark); // drill floor
    this.pipe = groupMesh(g, new THREE.CylinderGeometry(0.18, 0.18, top + 8, 10).translate(0, (top - 8) / 2, 0), band, T4(0, RIG_DECK, 0));
    groupMesh(g, boxGeo(V(2.6, RIG_DECK, 2.4), V(5.6, RIG_DECK + 2.8, 5.6), 0, true), white); // crew cabin
    groupMesh(g, boxGeo(V(2.55, RIG_DECK + 1.4, 2.35), V(5.65, RIG_DECK + 2.0, 5.65)), tm("#5a8fc2"));
    groupMesh(g, boxGeo(V(-5.6, RIG_DECK, 2.8), V(-2.8, RIG_DECK + 1.6, 5.6), 0, true), tm("#e8892c")); // pump house
    for (const [ax, az, bx, bz] of [[-6, -6, 6, -6], [6, -6, 6, 6], [6, 6, -6, 6], [-6, 6, -6, -6]]) {
      groupMesh(g, beamBetween(V(ax, RIG_DECK + 1.05, az), V(bx, RIG_DECK + 1.05, bz), 0.07), tm("#ffd23f"));
      for (let k = 0; k <= 8; k++) { const x = ax + ((bx - ax) * k) / 8, z = az + ((bz - az) * k) / 8; groupMesh(g, beamBetween(V(x, RIG_DECK, z), V(x, RIG_DECK + 1.05, z), 0.06), tm("#ffd23f")); }
    }
    L.add(g);
    // ---- tug ----
    const t = this.tug;
    groupMesh(t, hullGeo(8, 3, 1.4), lam("tugHull", () => ({ map: hullTex("tugHull", "#f2efe8", "#c0453a", "#2a2a33") })), T4(0, 0.6, 0));
    groupMesh(t, boxGeo(V(-1.1, 0.6, -2.6), V(1.1, 2.4, 0.6), 0, true), white);
    groupMesh(t, boxGeo(V(-1.15, 1.7, -2.65), V(1.15, 2.1, 0.65)), tm("#5a8fc2"));
    groupMesh(t, new THREE.CylinderGeometry(0.35, 0.4, 1.6, 12).translate(0, 3.2, -1.4), dark);
    groupMesh(t, new THREE.CylinderGeometry(0.37, 0.37, 0.35, 12).translate(0, 3.6, -1.4), red);
    groupMesh(t, new THREE.TorusGeometry(1.5, 0.22, 8, 24).rotateX(Math.PI / 2).scale(1, 1, 2.4).translate(0, 0.45, 0), dark); // fender
    L.add(t);
    // ---- eleven barges (pipes and boxes on deck) ----
    const rust = lam("bargeHull", () => ({ map: hullTex("bargeHull", "#6b4632", "#8a5a3c", "#3a2a22") }));
    for (let k = 0; k < 11; k++) {
      const bg = new THREE.Group();
      groupMesh(bg, boxGeo(V(-2.1, -0.9, -5), V(2.1, 0.5, 5), 0, true), rust);
      if (k % 2) for (let p = 0; p < 6; p++) groupMesh(bg, new THREE.CylinderGeometry(0.3, 0.3, 8.2, 10).rotateX(Math.PI / 2).translate(-1.3 + (p % 3) * 1.3, 0.8 + Math.floor(p / 3) * 0.55, 0), steel);
      else for (let p = 0; p < 3; p++) groupMesh(bg, boxGeo(V(-1.5, 0.5, -4 + p * 2.8), V(1.5, 1.9, -1.6 + p * 2.8), 0, true), tm(["#3f6fb5", "#5d7a3a", "#b5653f"][(k + p) % 3]));
      this.barges.push(bg); L.add(bg);
    }
    // ---- crew boat + skiff ----
    groupMesh(this.boat, hullGeo(5, 2, 0.9), lam("boatHull", () => ({ map: hullTex("boatHull", "#f2efe8", "#f2efe8", "#3f6fb5") })), T4(0, 0.45, 0));
    groupMesh(this.boat, boxGeo(V(-0.25, 0.2, -2.9), V(0.25, 1.1, -2.3), 0, true), dark); // outboard
    groupMesh(this.boat, boxGeo(V(-0.9, 0.1, -0.9), V(0.9, 0.35, 1.0)), tm("#c9b48a"));
    L.add(this.boat);
    groupMesh(this.skiff, hullGeo(3.6, 1.4, 0.6), lam("skiffHull", () => ({ map: hullTex("skiffHull", "#8a5a3c", "#5d8a6a", "#3a2a22") })), T4(0, 0.3, 0));
    groupMesh(this.skiff, boxGeo(V(-0.2, 0.1, -2.0), V(0.2, 0.8, -1.6), 0, true), dark);
    groupMesh(this.skiff, new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6).rotateX(-0.8).translate(-0.45, 1.0, -1.6), tm("#5a3b2a")); // fishing rod, stowed at the stern
    L.add(this.skiff);
  }

  // ======================= MINE =======================
  private buildMine() {
    const M = this.sets.mine, b = new Batch(), Y = MINE_Y, Hh = 9;
    const salt = lam("saltHD", () => ({ map: saltTex() }));
    const floor = lam("saltHD2", () => ({ map: saltTex() }));
    b.add(boxGeo(V(-10, Y - 0.5, -64), V(10, Y, 44), 4), floor);
    b.add(boxGeo(V(-11, Y, -64), V(-10, Y + Hh, 44), 4), salt);
    b.add(boxGeo(V(10, Y, -64), V(11, Y + Hh, -56), 4), salt);
    b.add(boxGeo(V(10, Y, -44), V(11, Y + Hh, 44), 4), salt);
    b.add(boxGeo(V(10, Y + Hh - 1.5, -56), V(11, Y + Hh, -44), 4), salt); // lintel
    b.add(boxGeo(V(-11, Y + Hh, -64), V(11, Y + Hh + 1, 44), 4, true), salt);
    b.add(boxGeo(V(-11, Y, 44), V(11, Y + Hh, 45), 4), salt);
    b.add(boxGeo(V(-11, Y, -65), V(11, Y + Hh, -64), 4), salt);
    for (const s of [-1, 1]) for (let z = -48; z <= 36; z += 14) b.add(boxGeo(V(s * 6 - 1.8, Y, z - 2), V(s * 6 + 1.8, Y + Hh, z + 2), 4), salt);
    // side room for the elevator shaft (opening in the east wall)
    b.add(boxGeo(V(10, Y - 0.5, -56), V(18, Y, -44), 4), floor);
    b.add(boxGeo(V(18, Y, -56), V(19, Y + 40, -44), 4), salt);
    for (const z of [-57, -44]) b.add(boxGeo(V(10, Y, z), V(19, Y + 40, z + 1), 4), salt);
    // ceiling lamps (HDR emissive for the bloom)
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.8) });
    for (let z = -60; z <= 40; z += 10) b.add(boxGeo(V(-0.4, Y + Hh - 0.25, z - 0.8), V(0.4, Y + Hh, z + 0.8)), lampM);
    // conveyor + cables along the west wall, a parked mining machine
    const dark = tm("#3a3e46"), yel = tm("#e2b23c");
    b.add(boxGeo(V(-9.6, Y, -60), V(-8.2, Y + 0.9, 40)), dark);
    b.add(boxGeo(V(-9.5, Y + 0.9, -60), V(-8.3, Y + 1.0, 40)), tm("#2a2a30"));
    b.add(boxGeo(V(4.8, Y, 14), V(8.8, Y + 2.2, 22), 0, true), yel);
    b.add(boxGeo(V(5.4, Y + 2.2, 15), V(8.2, Y + 3.2, 18), 0, true), yel);
    b.add(new THREE.CylinderGeometry(1.1, 1.1, 3.6, 16).rotateZ(Math.PI / 2).translate(6.8, Y + 1.2, 23.2), dark);
    b.build(M, false);
    // elevator: rails + cage (moves)
    const steel = metal("#8d939c");
    for (const [x, z] of [[SHAFT[0] - 1.5, SHAFT[2] - 1.5], [SHAFT[0] + 1.5, SHAFT[2] - 1.5], [SHAFT[0] - 1.5, SHAFT[2] + 1.5], [SHAFT[0] + 1.5, SHAFT[2] + 1.5]])
      groupMesh(M, boxGeo(V(x - 0.1, Y, z - 0.1), V(x + 0.1, Y + 40, z + 0.1)), steel, undefined, false);
    const c = this.cage;
    groupMesh(c, boxGeo(V(-1.35, 0, -1.35), V(1.35, 0.12, 1.35), 0, true), tm("#5a5f68"), undefined, false);
    groupMesh(c, boxGeo(V(-1.35, 2.6, -1.35), V(1.35, 2.72, 1.35), 0, true), tm("#5a5f68"), undefined, false);
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) groupMesh(c, boxGeo(V(x - 0.06, 0, z - 0.06), V(x + 0.06, 2.7, z + 0.06)), tm("#e2b23c"), undefined, false);
    for (const y of [1.0, 1.1]) for (const [ax, az, bx, bz] of [[-1.3, 1.3, 1.3, 1.3], [1.3, -1.3, 1.3, 1.3], [-1.3, -1.3, -1.3, 1.3]])
      groupMesh(c, beamBetween(V(ax, y, az), V(bx, y, bz), 0.05), tm("#e2b23c"), undefined, false);
    c.position.set(SHAFT[0], Y, SHAFT[2]); M.add(c);
    // alarm lamp by the electrician
    this.alarm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.05, 0.05) }));
    this.alarm.position.set(5.2, Y + 4.4, -36.6); M.add(this.alarm);
    groupMesh(M, boxGeo(V(5.0, Y + 3.9, -36.8), V(5.4, Y + 4.15, -36.4)), tm("#3a3e46"), undefined, false);
    // floodwater down the gallery (front advances toward the lens)
    const sheetG = new THREE.PlaneGeometry(19.6, 1); sheetG.rotateX(-Math.PI / 2); sheetG.translate(0, 0, 0.5); // z 0..1, scaled per frame
    this.mineSheet = new THREE.Mesh(sheetG, makeWater(this.WU, ownU(0.25, 0, 0, 0, 0), "mine"));
    this.mineSheet.receiveShadow = true; M.add(this.mineSheet);
    // the drill bit through the roof + the water column
    const band = lam("rigBands", () => ({ map: rigTex() }));
    groupMesh(this.bit, new THREE.CylinderGeometry(0.3, 0.3, 2.4, 12).translate(0, 1.2, 0), band, undefined, false);
    groupMesh(this.bit, new THREE.ConeGeometry(0.42, 0.7, 12).rotateX(Math.PI).translate(0, -0.35, 0), metal("#c9ccd2"), undefined, false);
    M.add(this.bit);
    this.columnMap = fallTex().clone(); this.columnMap.needsUpdate = true; this.columnMap.wrapS = this.columnMap.wrapT = THREE.RepeatWrapping;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 1, 20, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ map: this.columnMap, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
    this.column.layers.set(NOINK); M.add(this.column);
    const pg = new THREE.CircleGeometry(1, 40); pg.rotateX(-Math.PI / 2);
    this.pool2 = new THREE.Mesh(pg, makeWater(this.WU, ownU(0.25, 0, 0, 0, 0), "mpool")); this.pool2.receiveShadow = true; M.add(this.pool2);
  }

  // ======================= BATH =======================
  private buildBath() {
    const B = this.sets.bath, b = new Batch(), [X, Y, Z] = BATH;
    const floorT = lam("bathFloor", () => ({ map: tileTex("bathFloor", "#f4f1ea", "#7fa8c9", 8) }));
    const wallT = lam("bathWall", () => ({ map: tileTex("bathWall", "#d9eef0", "#c4e3e8", 10) }));
    const paint = tm("#f2d27a");
    b.add(boxGeo(V(X - 3, Y - 0.1, Z - 3), V(X + 7, Y, Z + 7), 2.5), floorT);
    b.add(boxGeo(V(X - 3, Y, Z + 4), V(X + 7, Y + 1.4, Z + 4.1), 2.5), wallT);
    b.add(boxGeo(V(X - 3, Y + 1.4, Z + 4), V(X + 7, Y + 3.2, Z + 4.1)), paint);
    b.add(boxGeo(V(X + 4.4, Y, Z - 3), V(X + 4.5, Y + 1.4, Z + 4), 2.5), wallT);
    b.add(boxGeo(V(X + 4.4, Y + 1.4, Z - 3), V(X + 4.5, Y + 3.2, Z + 4)), paint);
    // tub: outer shell + basin walls, porcelain
    const por = twoTone(new THREE.MeshPhongMaterial({ color: "#fbfaf6", specular: "#ffffff", shininess: 80 }), 0.2);
    const [tx, , tz] = TUB, tb = Y + 0.12, tt = Y + 0.72;
    b.add(boxGeo(V(tx - 0.95, tb, tz - 0.42), V(tx + 0.95, tb + 0.08, tz + 0.42)), por);
    for (const [x0, x1, z0, z1] of [[tx - 0.95, tx + 0.95, tz - 0.42, tz - 0.34], [tx - 0.95, tx + 0.95, tz + 0.34, tz + 0.42], [tx - 0.95, tx - 0.85, tz - 0.42, tz + 0.42], [tx + 0.85, tx + 0.95, tz - 0.42, tz + 0.42]])
      b.add(boxGeo(V(x0, tb, z0), V(x1, tt, z1)), por);
    for (const [x, z] of [[tx - 0.8, tz - 0.3], [tx + 0.8, tz - 0.3], [tx - 0.8, tz + 0.3], [tx + 0.8, tz + 0.3]]) b.add(new THREE.SphereGeometry(0.07, 10, 8).translate(x, Y + 0.06, z), metal("#d9b44a"));
    const chrome = metal("#c9ccd2");
    b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10).translate(tx + 0.9, tt + 0.25, tz), chrome);
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10).rotateZ(Math.PI / 2).translate(tx + 0.78, tt + 0.48, tz), chrome);
    b.add(boxGeo(V(X - 0.4, Y, Z + 2.2), V(X + 0.6, Y + 0.01, Z + 2.9)), tm("#c25a7a")); // bath mat
    b.build(B, false);
    // plug + chain, duck, salt ring, the dark hole
    groupMesh(this.plug, new THREE.CylinderGeometry(0.05, 0.045, 0.04, 16), tm("#2a2a30"), undefined, false);
    B.add(this.plug);
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), chrome); m.layers.set(NOINK); this.chain.push(m); B.add(m); }
    const yellow = tm("#ffd23f"), orange = tm("#f08a2c");
    groupMesh(this.duck, new THREE.SphereGeometry(0.09, 16, 12).scale(1.2, 0.8, 1), yellow, undefined, false);
    groupMesh(this.duck, new THREE.SphereGeometry(0.06, 16, 12).translate(0.07, 0.09, 0), yellow, undefined, false);
    groupMesh(this.duck, new THREE.ConeGeometry(0.025, 0.06, 8).rotateZ(-Math.PI / 2).translate(0.15, 0.085, 0), orange, undefined, false);
    B.add(this.duck);
    const saltM = tm("#f4f1ea"), saltR = rng(5);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, g = new THREE.DodecahedronGeometry(0.03 + saltR() * 0.02, 0);
      const m = groupMesh(this.saltRing, g, saltM, undefined, false);
      m.position.set(Math.cos(a), 0.015, Math.sin(a)); m.rotation.set(saltR() * 3, saltR() * 3, 0); m.userData.a = a;
    }
    B.add(this.saltRing);
    const hg = new THREE.CircleGeometry(1, 32); hg.rotateX(-Math.PI / 2);
    this.hole = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: "#0d0b10" })); this.hole.layers.set(NOINK); B.add(this.hole);
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
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? (s.set === "lake" ? L.el : 70));
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
    cam.fov = c.fov; cam.near = s.set === "bath" ? 0.03 : 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === s.set;
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, s.set === "bath" ? 3 : 12, 120);
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
    this.sky.visible = s.set === "lake";
    untone(L.fog, this.fog.color);
    this.fog.near = s.set === "lake" ? L.fogNear : 60; this.fog.far = s.set === "lake" ? L.fogFar : 400;
    scene.fog = this.fog; scene.background = s.set === "lake" ? null : new THREE.Color(0.05, 0.05, 0.06);
    const showSun = s.light === "golden" && s.set === "lake";
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
    }
    // ---- water colours ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;

    if (s.set === "lake") this.poseLake(id, f, t);
    if (s.set === "mine") this.poseMine(id, f, t);
    if (s.set === "bath") this.poseBath(id, f, t);

    // ---- cast + effects (the bridge short's sprite placement) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    if (s.set === "lake" && fallAt(id, f) > 0.05) {
      const lvl = levelAt(id, f) ?? -9;
      for (let k = 0; k < 3; k++) {
        const u = ((t * 1.2 + k / 3) % 1), uq = Math.round(u * 30) / 30;
        st.fx.push({ key: `spray${uq}`, cw: 400, ch: 400, draw: (p) => pPuff(p, uq), x: LIP_X - 3.8, y: lvl + 1.5 + u * 2, z: CANAL.z - 3 + k * 3, w: 4 + 3 * u, h: 4 + 3 * u, soft: true });
      }
    }
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

  private poseLake(id: number, f: number, t: number) {
    const lvl = levelAt(id, f), v = vortexAt(id, f);
    this.lake.mesh.visible = lvl !== null;
    if (lvl !== null) this.lake.set(lvl, v);
    this.lakeU.wSpin.value = v; this.lakeU.wLevel.value = lvl ?? 0;
    this.puddle.visible = lvl === null;
    setPose(this.rig, rigPose(id, f));
    this.pipe.rotation.y = id >= 4 && id <= 5 && f < 533 ? t * 6 : 0;
    setPose(this.tug, tugPose(id, f));
    this.barges.forEach((bg, k) => setPose(bg, bargePose(id, k, f)));
    setPose(this.boat, boatPose(id, f));
    setPose(this.skiff, skiffPose(id, f));
    // canal + waterfall
    const fa = fallAt(id, f), wl = lvl ?? -9;
    this.canalWater.position.y = id >= 12 && id !== 22 && id !== 23 ? -0.6 : -0.2;
    this.fall.visible = fa > 0.02;
    if (this.fall.visible) {
      const drop = Math.max(1, -0.2 - wl);
      this.fall.scale.set(1, drop / 14, 1);
      (this.fall.material as THREE.MeshBasicMaterial).opacity = 0.95 * fa;
      this.fallMap.offset.y = (t * 1.6) % 1;
    }
    this.fallFoam.visible = this.fall.visible;
    if (this.fallFoam.visible) { this.fallFoam.position.set(LIP_X - 3.8, wl + 0.05, CANAL.z); this.fallFoam.scale.set(4 * fa, 1, CANAL.w * 0.7 * fa); }
  }

  private poseMine(id: number, f: number, t: number) {
    this.cage.position.y = MINE_Y + cageY(id, f);
    const flash = id === 15 && f >= 1345 ? (Math.floor((f - 1345) / 6) % 2 === 0 ? 1 : 0) : id === 16 ? (Math.floor(f / 6) % 2) : 0;
    this.alarmMat.color.setRGB(flash ? 4.0 : 0.4, flash ? 0.25 : 0.05, flash ? 0.15 : 0.05);
    const mw = mineWater(id, f);
    this.mineSheet.visible = mw > 0.01;
    if (this.mineSheet.visible) { const len = 104 * mw; this.mineSheet.scale.set(1, 1, len); this.mineSheet.position.set(0, MINE_Y + 0.02 + 0.25 * mw, 44 - len); }
    const d = roofDrill(id, f), wcol = roofWater(id, f);
    this.bit.visible = d > 0.01;
    this.bit.position.set(ROOF[0], MINE_Y + 9 + 0.7 - d, ROOF[2]); this.bit.rotation.y = t * 8;
    this.column.visible = wcol > 0.01;
    if (this.column.visible) { this.column.position.set(ROOF[0], MINE_Y + 9, ROOF[2]); this.column.scale.set(wcol, 9 * Math.min(1, wcol * 1.5), wcol); this.columnMap.offset.y = (t * 2) % 1; }
    this.pool2.visible = id === 18 && f > 1532;
    if (this.pool2.visible) { const r = 1.5 + (f - 1532) * 0.25; this.pool2.position.set(ROOF[0], MINE_Y + 0.03, ROOF[2]); this.pool2.scale.set(r, 1, r); }
  }

  private poseBath(id: number, f: number, t: number) {
    const st = tubState(id, f), top = TUB[1];
    const lvl = top - st.level * 0.45;
    this.tubWater.set(lvl, st.vortex * (0.35 + 0.65 * Math.min(1, st.hole / 0.06)), 0.03 + 0.8 * st.hole);
    const tm2 = this.tubWater.mesh.material as THREE.MeshLambertMaterial; tm2.transparent = true; tm2.opacity = st.salt ? 0.72 : 0.9;
    this.tubU.wSpin.value = st.vortex * 1.5; this.tubU.wLevel.value = lvl;
    // plug: in the drain until the chain is pulled, then it dangles above the water at the rim
    const pulled = st.chain, rim = new THREE.Vector3(TUB[0] + 0.85, TUB[1] + 0.12, TUB[2] - 0.2);
    const pIn = new THREE.Vector3(DRAIN[0], DRAIN[1] + 0.02, DRAIN[2]), pOut = new THREE.Vector3(TUB[0] + 0.6, TUB[1] + 0.05, TUB[2] - 0.32);
    const pp = pIn.clone().lerp(pOut, pulled);
    this.plug.position.copy(pp); this.plug.visible = !st.salt;
    this.chain.forEach((m, i) => { const u = i / (this.chain.length - 1); m.position.copy(rim.clone().lerp(pp, u)).add(V(0, -0.12 * Math.sin(Math.PI * u) * (1 - pulled), 0)); m.visible = !st.salt; });
    // duck: bobbing; circling the drain once the water turns
    const a = t * (0.6 + 2.5 * st.vortex), rr = id === 20 ? 0.62 : 0.45 - 0.1 * st.vortex;
    this.duck.position.set(DRAIN[0] - 0.25 + rr * Math.cos(a) * 0.9, lvl + 0.04 + 0.01 * Math.sin(t * 3), DRAIN[2] + rr * Math.sin(a) * 0.32);
    this.duck.rotation.y = -a - Math.PI / 2;
    // the salt drain: a ring of crystals around a hole that grows
    const hr = st.hole;
    this.hole.position.set(DRAIN[0], DRAIN[1] + 0.004, DRAIN[2]); this.hole.scale.set(hr, 1, hr);
    this.saltRing.visible = st.salt;
    this.saltRing.position.set(DRAIN[0], DRAIN[1], DRAIN[2]);
    this.saltRing.children.forEach((m, i) => {
      const ang = m.userData.a as number, rr2 = hr + 0.03 + 0.01 * Math.sin(i * 2.3);
      m.position.set(rr2 * Math.cos(ang), 0.01, rr2 * Math.sin(ang));
      const sh = Math.max(0.35, 1 - (hr - 0.03) * 3.5);
      m.scale.setScalar(sh);
    });
  }
}

/** soft white spray puff for the waterfall foot */
const pPuff = (p: Pen, u: number) => {
  for (const [x, y, r] of [[200, 230, 110], [130, 260, 80], [270, 260, 85], [200, 170, 70]] as const)
    p.ell(x, y - 60 * u, r * (0.7 + 0.5 * u), r * (0.6 + 0.4 * u), `rgba(255,255,255,${(0.75 * (1 - u)).toFixed(2)})`, 0);
};
