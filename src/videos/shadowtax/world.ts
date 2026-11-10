// "The King Who Taxed Shadows" as one three.js scene with two sets (only the current shot's set is visible):
//   town:  a fairy-tale market square (cobbles, houses on the north and east sides, the royal dais with its canopy,
//          stalls, a fountain), a low hill 140 m to the south-west with the king's castle on it, fields, trees, sky,
//          clouds and the sun placed in world compass terms per shot (story.ts). Winter shots put snow on roofs and fields.
//   table: a dark nursery: a table with a wooden toy king and a torch whose beam is the scene's key light.
// Characters are camera-facing cards (cast.ts) that cast no shadow-map shadow; each gets a SILHOUETTE SHADOW instead:
// its own drawing laid flat on the ground, pointing away from the sun, length = height / tan(sun elevation), and left
// out when the character stands inside another object's shadow (a ray toward the sun hits the castle or a house).
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, Kit, setSight, house, prop, quad, matsWhere } from "./build";
import { ctex, cloudHD, cobbleHD, grassHD, stoneHD, planksHD, roofHD } from "./paint";
import { LIGHTS, LOOK, Light } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, SU, Place } from "./cast";
import { buildCountry, buildSummer, flatMat } from "./country";
import { buildCastlePath, buildFountain, buildWindmill } from "./landmarks";
import {
  FPS, SHOTS, ShotDef, camAt, sunDirOf, DAIS, DAIS_TOP, CASTLE, CASTLE_AZ, HILL_H, TAB, TOY, torchAt, cloudIn, smooth, V3,
} from "./story";

// ---------------- assets ----------------
const KIT: [string, string][] = [
  ...["lantern", "cart", "stall-red", "stall-green", "stall-bench", "banner-red", "banner-green", "windmill"].map((n) => [n, `bridge/kenney/${n}.glb`] as [string, string]),
  ...["fountain-round"].map((n) => [n, `kenney/fantasy-town-kit/${n}.glb`] as [string, string]),
  ...["fence_simple", "log_stack", "crop_pumpkin", "stump_old", "stump_round", "stone_largeA", "stone_largeC", "stone_smallB", "mushroom_red",
    "flower_redA", "flower_yellowA", "flower_purpleA", "lily_large"].map((n) => [n, `kenney/nature-kit/${n}.glb`] as [string, string]),
];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KIT.map(([n, path]) => loader.loadAsync(staticFile(path)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- painted textures ----------------
const snowTex = () => ctex("snowField", 1024, 1024, (g, r) => {
  g.fillStyle = "#eef3fa"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? "rgba(190,205,230,0.25)" : "rgba(255,255,255,0.6)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 10 + r() * 40, 5 + r() * 16, r() * 3, 0, 7); g.fill(); }
});
const snowRoofTex = () => ctex("snowRoof", 1024, 1024, (g, r) => {
  g.fillStyle = "#f1f5fb"; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = "rgba(160,176,205,0.45)"; g.lineWidth = 6;
  for (let y = 64; y < 1024; y += 128) { g.beginPath(); for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + 8 * Math.sin(x / 90 + y)); g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = "rgba(190,205,230,0.3)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 20 + r() * 50, 6 + r() * 10, 0, 0, 7); g.fill(); }
});
const dirtTex = () => ctex("dirtRoad", 512, 512, (g, r) => {
  g.fillStyle = "#b99a6e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,90,60,0.25)" : "rgba(235,215,180,0.3)"; g.fillRect(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 4); }
});
const canopyTex = () => ctex("canopy", 512, 256, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2c230" : "#b3263a"; g.fillRect(i * 64, 0, 64, 256); }
  g.fillStyle = "#b3263a"; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 64 + 32, 236, 30, 0, Math.PI); g.fill(); }
});
const flagTex = () => ctex("royalFlag", 256, 160, (g) => {
  g.fillStyle = "#b3263a"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#f2c230"; g.beginPath(); // a little crown
  g.moveTo(78, 112); g.lineTo(78, 60); g.lineTo(103, 86); g.lineTo(128, 48); g.lineTo(153, 86); g.lineTo(178, 60); g.lineTo(178, 112); g.closePath(); g.fill();
});
const wallpaperTex = () => ctex("nurseryPaper", 512, 512, (g) => {
  g.fillStyle = "#3b4a7a"; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f2d27a"; for (let y = 40; y < 512; y += 110) for (let x = (y / 110) % 2 ? 60 : 0; x < 512; x += 120) { // little stars
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? 6 : 15; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.fill();
  }
});
const rodTex = () => ctex("rodStripes", 256, 32, (g) => {
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "#c8323a" : "#f4f0e6"; g.fillRect(i * 25.6, 0, 25.6, 32); }
});
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
/** torch pool on the table: white centre (no change), dark rim (multiply) */
const poolTex = () => ctex("torchPool", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, "#f4f0ea"); gr.addColorStop(1, "#4a4660");
  g.fillStyle = "#4a4660"; g.fillRect(0, 0, 256, 256); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
});

// ---------------- helpers ----------------
const tm = (col: string) => twoTone(new THREE.MeshLambertMaterial({ color: col }));
const mesh = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, cast = true) => {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
};
/** flat ground quad on y, uv = metres / tile */
const ground = (x0: number, x1: number, z0: number, z1: number, tile: number, y = 0) =>
  quad(V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0), (x1 - x0) / tile, (z1 - z0) / tile);

// ---------------- silhouette shadows ----------------
const SHADOW_GEO = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const shadowMat = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, col: { value: new THREE.Vector3(0.3, 0.3, 0.4) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D map; uniform vec3 col; varying vec2 vUv; void main(){ if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(col, 1.0); }",
  transparent: false, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
  polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -40,
});
class ShadowCard {
  mesh: THREE.Mesh; mat: THREE.ShaderMaterial;
  constructor(parent: THREE.Object3D) {
    this.mat = shadowMat();
    this.mesh = new THREE.Mesh(SHADOW_GEO, this.mat);
    this.mesh.rotation.order = "YXZ"; this.mesh.visible = false; this.mesh.renderOrder = 0.6; this.mesh.layers.set(NOINK);
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
}

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private shadows: ShadowCard[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private cloudMaps: Record<"day" | "golden" | "grey", THREE.Texture[]>;
  private clouds: { m: THREE.Mesh; deck: boolean; base: THREE.Vector3; w: number }[] = [];
  private sets: Record<"town" | "table", THREE.Group> = { town: new THREE.Group(), table: new THREE.Group() };
  private blockers: THREE.Object3D[] = [];
  private blockCache = new Map<string, boolean>();
  private ray = new THREE.Raycaster();
  private winterOn: boolean | null = null;
  private swaps: { m: THREE.MeshLambertMaterial; summer: THREE.Texture | null; winter: THREE.Texture; col?: string }[] = [];
  private rod = new THREE.Group();
  private sails: THREE.Group | null = null;
  private summer = new THREE.Group(); // summer-only dressing: hidden in winter shots (it would block the low suns)
  private torch = new THREE.Group();
  private pool2!: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    for (const g of Object.values(this.sets)) R.add(g);
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
    this.cloudMaps = {
      day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      grey: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.overcast.cloud)),
    };
    // a ring of cumulus around the horizon (none in the south-west, where the winter sun sets) + an overhead deck for overcast
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2, d = 600 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 140 + (i % 4) * 34, base = new THREE.Vector3(Math.cos(a) * d, 55 + (i % 4) * 28, Math.sin(a) * d);
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK); m.renderOrder = -0.8;
      this.clouds.push({ m, deck: false, base, w }); this.sets.town.add(m);
    }
    for (let i = 0; i < 60; i++) {
      const a = i * 2.39996, d = 40 + 14 * Math.sqrt(i) * 22;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.grey[i % 4], color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false, fog: false }));
      const w = 260 + (i % 5) * 60, base = new THREE.Vector3(Math.cos(a) * d, 130 + (i % 4) * 22 - Math.min(90, d * 0.12), Math.sin(a) * d);
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK); m.renderOrder = -0.7;
      this.clouds.push({ m, deck: true, base, w }); this.sets.town.add(m);
    }
    setSight([]);
    this.buildTown(kit);
    this.buildCastle();
    this.buildTable();
  }

  // ======================= TOWN =======================
  private buildTown(kit: Kit) {
    const W = this.sets.town, b = new Batch();
    const grass = lam("grassHD", () => ({ map: grassHD() })), cob = flatMat("cobbleSq", cobbleHD(), "#ffffff", 5), dirt = flatMat("dirtRoad", dirtTex(), "#ffffff", 4);
    this.swaps.push({ m: dirt, summer: dirt.map, winter: snowTex() });
    this.swaps.push({ m: grass, summer: grass.map, winter: snowTex() });
    b.add(ground(-900, 900, -900, 900, 4), grass);
    b.add(ground(-23, 24, -18.5, 18, 4), cob);                              // the square
    b.add(ground(24, 60, 6, 26, 4), cob);                                    // street east
    // the road from the square's south-west corner to the castle hill
    const dir = new THREE.Vector2(CASTLE[0], CASTLE[2]).normalize(), nrm = new THREE.Vector2(-dir.y, dir.x);
    const p0 = new THREE.Vector2(-16, 12), p1 = new THREE.Vector2(CASTLE[0], CASTLE[2]).addScaledVector(dir, -30), hw = 2.6;
    const c = (p: THREE.Vector2, s: number) => V(p.x + nrm.x * hw * s, 0, p.y + nrm.y * hw * s);
    void c; void p1; void quad; // the old flat dirt road is replaced by the flagstone path (landmarks.ts)
    const lb = new Batch(), lg = new THREE.Group();
    const ps = buildCastlePath(lb); this.swaps.push({ m: ps.m, summer: ps.m.map, winter: ps.winter });
    this.sails = buildWindmill(lb, lg, 150, -170, Math.atan2(-150, 170));
    lb.build(lg); W.add(lg);
    // houses: north row (fronts on z = -18, facing south), east row (fronts on x = 24, facing west, with a street
    // gap at z 6..26 so the winter morning sun comes in), a few on the south-east corner
    let x = -36, k = 0;
    const ws = [7, 9, 8, 7, 9, 8, 7, 9, 8], hs = [7, 8.4, 9.8, 8.4, 7, 9.8, 8.4, 7, 9.8];
    while (x + ws[k % 9] <= 23.8) { const w = ws[k % 9]; house(b, x + w / 2, -22, 0, w, 8, hs[k % 9], k % 8); x += w + 0.3; k++; }
    let z = -26;
    while (z < 6) { const w = ws[k % 9]; if (z + w > 6) break; house(b, 28, z + w / 2, -Math.PI / 2, w, 8, hs[k % 9], k % 8); z += w + 0.3; k++; }
    for (const [hx, hw2] of [[14, 7], [21.5, 7]] as const) { house(b, hx, 25, Math.PI, hw2, 8, hs[k % 9], k % 8); k++; }
    // back rows behind the north side (only roofs show)
    for (let xx = -36; xx < 34; xx += 9.5) { house(b, xx, -34, 0, 9, 8, hs[k % 9] + 1.4, k % 8); k++; }
    // market dressing (kept out of the low winter sun's path from the south-west)
    prop(b, kit, "stall-red", -11, 0, -13.5, 3.2, 0.15);
    prop(b, kit, "stall-green", 11.5, 0, -13.2, 3.2, -0.15);
    prop(b, kit, "stall-bench", 14.5, 0, -11.2, 1.0, 0.4);
    prop(b, kit, "cart", 19.5, 0, -6, 2.2, 1.9);
    buildFountain(b, 13, -4.5);
    // market goods in crates in front of the stalls
    const crateM = lam("goodsCrate", () => ({ color: "#c98a4a" })), goods = [lam("gApple", () => ({ color: "#ff3b3b" })), lam("gOrange", () => ({ color: "#ff9a1f" })), lam("gCabbage", () => ({ color: "#7fd14a" })), lam("gPlum", () => ({ color: "#8a4ad0" }))];
    const ball = new THREE.IcosahedronGeometry(0.11, 1);
    for (const [gx, gz] of [[-12.2, -12.1], [-11.2, -12.0], [-10.2, -12.1], [10.3, -11.8], [11.3, -11.7], [12.3, -11.8]] as const) {
      const gi = Math.abs(Math.round(gx * 3)) % 4;
      b.add(boxGeo(V(gx - 0.42, 0, gz - 0.3), V(gx + 0.42, 0.42, gz + 0.3)), crateM);
      for (let i = 0; i < 12; i++) b.add(ball, goods[gi], new THREE.Matrix4().makeTranslation(gx - 0.3 + (i % 4) * 0.2, 0.47 + (i > 7 ? 0.1 : 0), gz - 0.15 + Math.floor(i / 4) * 0.15));
    }
    for (const [lx, lz] of [[-19, -16.5], [21.5, -16], [-6, -16.8], [6, -16.8]] as const) prop(b, kit, "lantern", lx, 0, lz, 2.9);
    prop(b, kit, "banner-red", -3.2, DAIS_TOP, -14.6, 3.2);
    prop(b, kit, "banner-red", 3.2, DAIS_TOP, -14.6, 3.2);
    // trees: north, east and south (none in the south-west sun corridors: winter evening az 218, sunset az 236, morning az 125)
    const corridor = (tx: number, tz: number) => {
      const az = ((Math.atan2(tx, -tz) * 180) / Math.PI + 360) % 360, d = Math.hypot(tx, tz);
      return (az > 196 && az < 262 && d < 420) || (az > 108 && az < 142 && d < 160);
    };
    void corridor;
    const country = new THREE.Group();
    for (const sw of buildCountry(country, kit, snowTex)) this.swaps.push({ m: sw.m, summer: sw.m.map, winter: sw.winter });
    W.add(country);
    buildSummer(this.summer, kit);
    W.add(this.summer);
    // distant low hills all round (kept under ~2 deg seen from the square, so they never hide a low sun)
    const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" }))];
    this.swaps.push({ m: hm[0], summer: null, winter: snowTex() }, { m: hm[1], summer: null, winter: snowTex() });
    ([[-300, -420, 260, 22, 140], [380, -260, 240, 20, 160], [520, 200, 200, 18, 150], [-560, -40, 180, 14, 150], [140, 560, 240, 16, 150],
      [-460, 520, 220, 12, 160]] as const).forEach(([hx, hz, sx, sy, sz], i) =>
      b.add(hill, hm[i % 2], new THREE.Matrix4().compose(V(hx, -2, hz), new THREE.Quaternion(), V(sx, sy, sz))));
    // the royal dais: wooden platform, steps, posts, striped canopy
    const wood = lam("planksHD", () => ({ map: planksHD() })), post = tm("#7a4f33"), gold = tm("#e8b830");
    const [dx, , dz] = DAIS;
    b.add(boxGeo(V(dx - 2.6, 0, dz - 2.0), V(dx + 2.6, DAIS_TOP, dz + 1.4), 1.5), wood);
    b.add(boxGeo(V(dx - 1.2, 0, dz + 1.4), V(dx + 1.2, DAIS_TOP * 0.5, dz + 2.1), 1.5), wood);
    for (const sx of [-2.4, 2.4]) for (const sz of [-1.8, 1.2]) b.add(boxGeo(V(dx + sx - 0.1, DAIS_TOP, dz + sz - 0.1), V(dx + sx + 0.1, DAIS_TOP + 3.2, dz + sz + 0.1)), post);
    const can = lam("canopy", () => ({ map: canopyTex(), side: THREE.DoubleSide }));
    b.add(quad(V(dx - 2.8, DAIS_TOP + 3.2, dz + 1.5), V(dx + 2.8, DAIS_TOP + 3.2, dz + 1.5), V(dx + 2.8, DAIS_TOP + 4.0, dz - 0.3), V(dx - 2.8, DAIS_TOP + 4.0, dz - 0.3)), can);
    b.add(quad(V(dx + 2.8, DAIS_TOP + 3.2, dz - 2.1), V(dx - 2.8, DAIS_TOP + 3.2, dz - 2.1), V(dx - 2.8, DAIS_TOP + 4.0, dz - 0.3), V(dx + 2.8, DAIS_TOP + 4.0, dz - 0.3)), can);
    b.add(new THREE.SphereGeometry(0.22, 12, 8), gold, new THREE.Matrix4().makeTranslation(dx, DAIS_TOP + 4.15, dz - 0.3));
    // throne
    b.add(boxGeo(V(dx - 0.7, DAIS_TOP, dz - 1.75), V(dx + 0.7, DAIS_TOP + 2.4, dz - 1.45)), tm("#b3263a"));
    b.add(boxGeo(V(dx - 0.75, DAIS_TOP + 2.4, dz - 1.8), V(dx + 0.75, DAIS_TOP + 2.6, dz - 1.4)), gold);
    const holder = new THREE.Group();
    b.build(holder);
    W.add(holder);
    holder.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material !== grass && m.material !== cob && m.material !== dirt && !hm.includes(m.material as THREE.MeshLambertMaterial)) this.blockers.push(m); });
    for (const m of matsWhere("roof")) this.swaps.push({ m, summer: m.map, winter: snowRoofTex() });
    // the measuring rod (laid on the ground in some shots)
    mesh(this.rod, new THREE.BoxGeometry(2.6, 0.05, 0.06).translate(1.3, 0.03, 0), lam("rodStripes", () => ({ map: rodTex() })), false);
    this.rod.visible = false; W.add(this.rod);
  }

  private buildCastle() {
    const W = this.sets.town, b = new Batch();
    const stoneM = lam("castleStone", () => ({ map: stoneHD("castleHD", ["#d6cdbd", "#cbc1b0", "#ddd5c6", "#c4b9a6"], "#9c907e") }));
    const roofM = lam("roofCastle", () => ({ map: roofHD("#4f63a8", true), side: THREE.DoubleSide }));
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    // hill: a low flattened dome
    b.add(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), grass, new THREE.Matrix4().compose(V(CASTLE[0], -0.2, CASTLE[2]), new THREE.Quaternion(), V(46, HILL_H + 0.2, 46)));
    const yaw = Math.atan2(-Math.sin((CASTLE_AZ * Math.PI) / 180), Math.cos((CASTLE_AZ * Math.PI) / 180)); // local +z faces the town
    const M = (x: number, y: number, z: number, ry = 0) => new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeTranslation(x, y, z)).multiply(new THREE.Matrix4().makeRotationY(ry))
      .premultiply(new THREE.Matrix4().makeTranslation(CASTLE[0], HILL_H - 0.3, CASTLE[2]));
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), 3), stoneM, M(0, 0, 0));
    const merlons = (x0: number, z0: number, x1: number, z1: number, y: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.6);
      for (let i = 0; i < n; i += 2) {
        const u0 = i / n, u1 = (i + 1) / n, ax = x0 + (x1 - x0) * u0, az = z0 + (z1 - z0) * u0, bx = x0 + (x1 - x0) * u1, bz = z0 + (z1 - z0) * u1;
        box(Math.min(ax, bx) - 0.45, Math.max(ax, bx) + 0.45, y, y + 1.1, Math.min(az, bz) - 0.45, Math.max(az, bz) + 0.45);
      }
    };
    // banners hanging on the curtain wall facing the town
    const ban = lam("wallBanner", () => ({ map: flagTex(), side: THREE.DoubleSide }));
    for (const bx of [-10, -6.5, 6.5, 10]) b.add(quad(V(bx - 1, 3.2, 12.56), V(bx + 1, 3.2, 12.56), V(bx + 1, 8.2, 12.56), V(bx - 1, 8.2, 12.56)), ban, M(0, 0, 0));
    // curtain walls 30 x 24, 9 m high
    box(-15, 15, 0, 9, 11, 12.5); box(-15, 15, 0, 9, -12.5, -11); box(-15.5, -14, 0, 9, -12, 12); box(14, 15.5, 0, 9, -12, 12);
    merlons(-15, 12, 15, 12, 9); merlons(-15, -12, 15, -12, 9); merlons(-15, -12, -15, 12, 9); merlons(15, -12, 15, 12, 9);
    // gatehouse
    box(-4.5, -1.8, 0, 12, 10, 14); box(1.8, 4.5, 0, 12, 10, 14); box(-1.8, 1.8, 6, 12, 10, 14);
    merlons(-4.5, 14, 4.5, 14, 12);
    b.add(quad(V(-1.8, 0, 14.02), V(1.8, 0, 14.02), V(1.8, 6, 14.02), V(-1.8, 6, 14.02)), tm("#3a2a22"), M(0, 0, 0));
    // round corner towers with blue cone roofs
    for (const [tx, tz] of [[-15, -12], [15, -12], [-15, 12], [15, 12]] as const) {
      b.add(new THREE.CylinderGeometry(3.2, 3.4, 14, 20).translate(0, 7, 0), stoneM, M(tx, 0, tz));
      b.add(new THREE.ConeGeometry(4.0, 7, 20).translate(0, 14 + 3.5, 0), roofM, M(tx, 0, tz));
    }
    // keep with a tall round tower and the royal flag
    box(-6, 6, 0, 22, -9, 1); merlons(-6, 1, 6, 1, 22); merlons(-6, -9, 6, -9, 22); merlons(-6, -9, -6, 1, 22); merlons(6, -9, 6, 1, 22);
    b.add(new THREE.CylinderGeometry(2.6, 2.8, 31, 20).translate(0, 15.5, 0), stoneM, M(4.5, 0, -7));
    b.add(new THREE.ConeGeometry(3.4, 8, 20).translate(0, 31 + 4, 0), roofM, M(4.5, 0, -7));
    b.add(boxGeo(V(-0.06, 0, -0.06), V(0.06, 5, 0.06)), tm("#5a3b2a"), M(4.5, 39, -7));
    b.add(quad(V(0.06, 3.2, 0), V(2.6, 3.2, 0), V(2.6, 4.8, 0), V(0.06, 4.8, 0)), lam("royalFlag", () => ({ map: flagTex(), side: THREE.DoubleSide })), M(4.5, 39, -7));
    // dark windows
    const win = tm("#2a2236");
    for (const [wx, wy] of [[-3, 14], [0, 17], [3, 14], [-3, 9]] as const) b.add(boxGeo(V(wx - 0.4, wy, 1.0), V(wx + 0.4, wy + 1.6, 1.08)), win, M(0, 0, 0));
    const holder = new THREE.Group();
    b.build(holder);
    W.add(holder);
    holder.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material !== grass) this.blockers.push(m); });
    for (const m of matsWhere("roofCastle")) this.swaps.push({ m, summer: m.map, winter: snowRoofTex() });
  }

  // ======================= TABLE =======================
  private buildTable() {
    const G = this.sets.table, at = (x: number, y: number, z: number) => V(TAB[0] + x, TAB[1] + y, TAB[2] + z);
    const wood = lam("planksHD", () => ({ map: planksHD() }));
    mesh(G, boxGeo(at(-0.8, 0.7, -0.5), at(0.8, 0.75, 0.6), 0.6), wood, false);                            // table top
    for (const [x, z] of [[-0.72, -0.42], [0.72, -0.42], [-0.72, 0.52], [0.72, 0.52]] as const) mesh(G, boxGeo(at(x - 0.04, 0, z - 0.04), at(x + 0.04, 0.7, z + 0.04)), tm("#7a4f33"), false);
    mesh(G, ground(TAB[0] - 4, TAB[0] + 4, -4, 4, 1.5), lam("nurseryFloor", () => ({ color: "#6a4a3a" })), false);
    mesh(G, quad(at(-4, 0, -0.9), at(4, 0, -0.9), at(4, 3, -0.9), at(-4, 3, -0.9), 8, 3), lam("nurseryPaper", () => ({ map: wallpaperTex() })), false);
    mesh(G, quad(at(-1.3, 0, 0.9), at(-1.3, 0, -0.9), at(-1.3, 3, -0.9), at(-1.3, 3, 0.9), 2, 3), lam("nurseryPaper", () => ({ map: wallpaperTex() })), false);
    // the toy's little wooden stand (the cut-out king itself is a card from cast.ts)
    mesh(G, boxGeo(V(TOY[0] - 0.035, TOY[1], TOY[2] - 0.012), V(TOY[0] + 0.035, TOY[1] + 0.012, TOY[2] + 0.012)), tm("#a8724a"));
    // the torch: red body, silver head, glowing lens (bloom); posed per frame
    const t = this.torch;
    mesh(t, new THREE.CylinderGeometry(0.018, 0.018, 0.13, 16).translate(0, 0.065, 0), tm("#c8323a"), false);
    mesh(t, new THREE.CylinderGeometry(0.03, 0.02, 0.04, 16).translate(0, -0.02, 0), twoTone(new THREE.MeshPhongMaterial({ color: "#c9ccd2", specular: "#ffffff", shininess: 60 }), 0.15), false);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 20).rotateX(Math.PI / 2).translate(0, -0.041, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.4, 3) }));
    t.add(lens); G.add(t);
    this.pool2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: poolTex(), depthWrite: false, fog: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.pool2.layers.set(NOINK); this.pool2.renderOrder = 0.4; this.pool2.visible = false; G.add(this.pool2); // off: its edges showed as a hard rectangle
  }

  /** is (x, y, z) inside the shadow of the castle / a house? (ray toward the sun) */
  private shaded(id: number, x: number, y: number, z: number, sun: THREE.Vector3) {
    const k = `${id}|${x.toFixed(1)}|${z.toFixed(1)}|${y.toFixed(1)}`;
    let hit = this.blockCache.get(k);
    if (hit === undefined) {
      this.ray.set(this.v.set(x, y + 1.0, z), sun); this.ray.far = 1500;
      hit = this.ray.intersectObjects(this.blockers, false).length > 0;
      this.blockCache.set(k, hit);
    }
    return hit;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private shadowCard(i: number) { while (this.shadows.length <= i) this.shadows.push(new ShadowCard(this.root)); return this.shadows[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  private setWinter(on: boolean) {
    if (this.winterOn === on) return;
    this.winterOn = on;
    for (const s of this.swaps) {
      if (s.col === undefined) s.col = "#" + s.m.color.getHexString();
      if (on) { s.m.map = s.winter; s.m.color.set("#ffffff"); }
      else { s.m.map = s.summer; s.m.color.set(s.col); }
      s.m.needsUpdate = true;
    }
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s: ShotDef = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    const table = s.set === "table";
    cam.fov = c.fov; cam.near = table ? 0.02 : 0.15; cam.far = 2400; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === s.set;
    this.setWinter(!!s.winter);
    this.summer.visible = !s.winter;
    if (this.sails) this.sails.rotation.z = -f * 0.02;
    // ---- sun ----
    const sunDir = V(...sunDirOf(s));
    let torchP: V3 | null = null;
    if (table) { torchP = torchAt(id, f); sunDir.set(torchP[0], torchP[1], torchP[2]).normalize(); }
    const overcast = s.light === "overcast";
    if (this.sun.castShadow === overcast) this.sun.castShadow = !overcast;
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let center = focus.clone(), Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 120);
    if (table) { center = V(...TOY); Rr = 0.9; }
    else if (s.light === "golden" && s.sunAz === CASTLE_AZ) { center = V(CASTLE[0] * 0.5 + focus.x * 0.5, 0, CASTLE[2] * 0.5 + focus.z * 0.5); Rr = 110; }
    else if (s.light === "golden" || s.light === "dawn") Rr = Math.max(Rr, 50);
    this.sun.position.copy(center).addScaledVector(sunDir, table ? 3 : 220); this.sun.target.position.copy(center);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = table ? 0.5 : 20; sc.far = table ? 6 : 480; sc.updateProjectionMatrix();
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
    this.sky.visible = !table;
    untone(L.fog, this.fog.color);
    this.fog.near = table ? 1e5 : L.fogNear * 2.2; this.fog.far = table ? 2e5 : L.fogFar * 3;
    scene.fog = this.fog;
    scene.background = table ? new THREE.Color("#0c0a16") : null;
    const showSun = !table && !overcast;
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (id === 16) { // the sun only as a dim glow somewhere behind the cloud deck
      this.sunHalo.visible = true;
      this.sunHalo.position.copy(cam.position).addScaledVector(V(0.1, 0.8, -0.6).normalize(), 900);
      this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(30)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set("#fff6e0").multiplyScalar(0.55);
    }
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(s.light === "day" ? 1.5 : 1.9)));
      (this.sunDisc.material as THREE.SpriteMaterial).color.set(s.light === "day" ? "#fff6dc" : L.sunDisc).multiplyScalar(s.light === "day" ? 5 : 6);
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(s.light === "day" ? 14 : 24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(s.light === "day" ? "#fff2cc" : L.sunDisc).multiplyScalar(s.light === "day" ? 0.7 : 1.3);
    }
    const deck = cloudIn(id, f), clear = s.light === "golden" || s.light === "dawn";
    for (const cl of this.clouds) {
      const mat = cl.m.material as THREE.MeshBasicMaterial;
      if (cl.deck) {
        cl.m.visible = deck > 0.01;
        const slide = (1 - deck) * 700;                                       // the deck rolls in from the west
        cl.m.position.set(cl.base.x - slide, cl.base.y, cl.base.z);
        mat.opacity = Math.min(1, deck * 1.4);
      } else {
        cl.m.visible = !clear && !overcast;
        cl.m.position.copy(cl.base);
        mat.map = this.cloudMaps.day[this.clouds.indexOf(cl) % 4];
      }
      cl.m.lookAt(cam.position);
    }
    // ---- set pieces ----
    if (table && torchP) {
      const tp = V(TOY[0] + torchP[0], TOY[1] + torchP[1], TOY[2] + torchP[2]);
      this.torch.position.copy(tp);
      this.torch.quaternion.setFromUnitVectors(V(0, -1, 0), V(TOY[0], TOY[1] + 0.06, TOY[2]).sub(tp).normalize());
      const el = Math.asin(Math.min(1, sunDir.y)), off = 0.06 / Math.tan(Math.max(0.15, el));
      const hx = -sunDir.x / (Math.hypot(sunDir.x, sunDir.z) || 1), hz = -sunDir.z / (Math.hypot(sunDir.x, sunDir.z) || 1);
      this.pool2.position.set(TOY[0] + hx * off * 0.5, TOY[1] + 0.002, TOY[2] + hz * off * 0.5);
      const sz = 0.55 + 0.6 * (1 - Math.min(1, sunDir.y));
      this.pool2.scale.set(sz * (1 + 0.8 * (1 - sunDir.y)), 1, sz);
      this.pool2.rotation.y = Math.atan2(hx, hz) + Math.PI / 2;
    }
    this.rod.visible = false;
    if (id === 3 && f >= 168) { this.rod.visible = true; this.rod.position.set(-3.0, 0, 2.0); this.rod.rotation.y = this.rodYaw(sunDir); }
    if (id === 18) { this.rod.visible = true; this.rod.position.set(2.0 - 0.1, 0, 1.0 + 0.25); this.rod.rotation.y = 2.4; }

    // ---- cast, silhouette shadows, effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const el = Math.asin(THREE.MathUtils.clamp(sunDir.y, 0.01, 1)), lenK = Math.min(40, 1 / Math.tan(el));
    const sx = -sunDir.x, sz2 = -sunDir.z, sl = Math.hypot(sx, sz2) || 1, yaw = Math.atan2(-sx / sl, -sz2 / sl);
    const litK = 1 - L.lambert + L.lambert * Math.sin(el);
    const shadeRatio = [0, 1, 2].map((i) => Math.min(2, (L.shade[i] + L.lift[i] / 0.45) / (L.lit[i] * litK)));
    let ai = 0, si = 0;
    const used: Actor[] = [], usedS: { sc: ShadowCard; a: Actor }[] = [];
    for (const p of stg.places as (Place & { noShadow?: boolean })[]) {
      const sc2 = p.scale ?? 1;
      const castLen = lenK * sc2 * 1000 * SU;
      const inView = this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5));
      const shadowInView = !table && !overcast && this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x + (sx / sl) * castLen * 0.5, p.y, p.z + (sz2 / sl) * castLen * 0.5), castLen * 0.5 + 2));
      if (!inView && !shadowInView) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = inView;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = !!p.castReal;
      used.push(a);
      if (!table && !overcast && !p.noShadow && !this.shaded(id, p.x, p.y, p.z, sunDir)) {
        const sh = this.shadowCard(si++);
        sh.mesh.visible = true;
        sh.mesh.position.set(p.x, p.y + 0.02, p.z);
        sh.mesh.rotation.set(-Math.PI / 2, yaw, 0);
        sh.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2 * lenK, sc2);
        sh.mat.uniforms.col.value.set(shadeRatio[0], shadeRatio[1], shadeRatio[2]);
        usedS.push({ sc: sh, a });
      }
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    for (let i = si; i < this.shadows.length; i++) this.shadows[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stg.fx) {
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
    for (const { sc, a } of usedS) sc.mat.uniforms.map.value = a.mat.map;
    for (const ef of fused) ef.bind();
    void smooth;
    return focus;
  }

  /** the rod lies along the farmer's shadow (pointing away from the sun) */
  private rodYaw(sun: THREE.Vector3) { return Math.atan2(sun.z, -sun.x); }
}
