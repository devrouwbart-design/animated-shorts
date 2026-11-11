// Example frame for review (round 2): an armoured army in front of a stone fortress, fields and wooded hills behind,
// standing in grass. Their style, our own content: flat thick-outlined cartoon soldiers in a realistic 3D world.
// Realism comes from: depth of field on the background, bloom + filmic (Neutral) tone mapping, real terrain fading
// into haze, dense 3D grass near the lens, separate bevelled stone blocks with grime, glazed tiled curved roofs,
// glossy metal that catches the sun, side light that shows relief.
// Still: node scripts/stills.mjs ArmyFrame out/armyframe/x_ 0 1
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { twoTone, TONE } from "../shadowtax/shade";
import { LIGHTS } from "../shadowtax/lights";
import { ctex, cloudHD } from "../shadowtax/paint";
import { LensBlur } from "../shadowtax/lensblur";
import { blockWall, roundedBox } from "../../shared/bevel";
import { realMat, SURFACE, REAL, liftFor, type RealOpts } from "../../shared/realMaterial";
import { grassPatch, meadowMat, natureTree, GRASS } from "../../shared/nature";
import { Captions } from "../../shared/Captions";
import { lantern, torchFlame, addSpill } from "../../shared/glow";
import { rep as repTex } from "../shadowtax/paint";
import { Pen, bodyFront, type Outfit, type Expr, INK, SKINS } from "./toon";

export const ARMYFRAME_FRAMES = 30;
const SU = 0.00216;
const tone = <M extends THREE.Material>(m: M) => twoTone(m as unknown as THREE.MeshLambertMaterial) as unknown as M;
const toneStd = <M extends THREE.MeshStandardMaterial>(m: M) => twoTone(m as unknown as THREE.MeshLambertMaterial, liftFor(m.color)) as unknown as M;
const mat = (p: THREE.MeshStandardMaterialParameters, o: RealOpts) => realMat(p, o, toneStd);
const lam = (p: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(p));
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const h2 = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};
const fbm = (x: number, y: number, o = 5) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };

/** test only: inputProps { roofCam: true } looks at the gate tower roofs up close, sharp */
const ROOF_CAM = !!(getInputProps() as { roofCam?: boolean }).roofCam;
/** inputProps { time: "dusk" }: low warm sun, blue-violet shade, lanterns at full glow (default: day) */
const DUSK = (getInputProps() as { time?: string }).time === "dusk";
const FLAMES: ReturnType<typeof torchFlame>[] = [];
const CAM = ROOF_CAM
  ? { pos: new THREE.Vector3(-4, 17, -18), look: new THREE.Vector3(7, 20, -45), fov: 40 }
  : { pos: new THREE.Vector3(1.4, 3.6, 13), look: new THREE.Vector3(-0.4, 4.6, -40), fov: 42 };
const SUN_DIR = new THREE.Vector3(-0.62, 0.62, 0.48).normalize(); // high, front-left: lit wall faces with block relief
const FOCUS_AT = new THREE.Vector3(1.0, 1.6, 6.0);                // the general's face

// ---------------- army ----------------
const TUNICS = ["#9c2f2a", "#a8362e", "#8f2b27"];
const soldierOutfit = (v: number): Outfit => ({ jacket: TUNICS[v % 3], pants: "#2e3036", boots: INK, hat: "helmet", cap: v % 5 === 0 ? "#a9b1bb" : "#9ea6b0", skin: SKINS[v % 4], belt: null, armor: v % 7 === 0 ? "#9aa1a9" : "#adb4bc", trim: "#a8282a" });
const GENERAL: Outfit = { jacket: "#2f4f86", pants: "#2a2c33", boots: INK, hat: "helmet", cap: "#d6b452", skin: SKINS[1], moustache: "#2a201a", build: "stout", belt: null, armor: "#c9a64a", trim: "#2f4f86" };
const EXPRS: Expr[] = ["stern", "neutral", "grin", "stern", "laugh", "neutral", "shock", "stern"];
const LIGHT_ANGLE = -2.4;
const cardTex = (() => {
  const cache = new Map<string, THREE.CanvasTexture>();
  return (o: Outfit, expr: Expr, seed: number) => {
    const key = `${o.jacket}|${o.cap}|${o.armor}|${o.skin}|${o.build}|${expr}|${seed}`;
    let t = cache.get(key);
    if (!t) {
      const k = 0.6, cv = document.createElement("canvas"); cv.width = 600 * k; cv.height = 1000 * k;
      const g = cv.getContext("2d")!; g.setTransform(k, 0, 0, k, 0, 0);
      bodyFront(new Pen(g), o, { expr, mode: "stand", light: LIGHT_ANGLE, seed, facing: 0 });
      t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache.set(key, t);
    }
    return t;
  };
})();
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const blobTex = () => ctex("armyBlob", 128, 128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, "rgba(0,0,0,0.5)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const bannerTex = () => ctex("armyBanner2", 256, 384, (g) => {
  g.fillStyle = "#c22a26"; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#e2b64a"; g.lineWidth = 14; g.strokeRect(12, 12, 232, 360);
  g.fillStyle = "#1d1a1a"; g.beginPath(); g.arc(128, 165, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#e2b64a"; g.lineWidth = 9; g.beginPath(); g.arc(128, 165, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#e2b64a"; g.beginPath(); g.moveTo(128, 128); g.lineTo(150, 186); g.lineTo(106, 186); g.closePath(); g.fill();
  for (let i = 0; i < 7; i++) g.fillRect(22 + i * 32, 350, 16, 34);
});
const buildArmy = (root: THREE.Object3D) => {
  const r = rng(11), shafts: THREE.BufferGeometry[] = [], tips: THREE.BufferGeometry[] = [];
  const blobM = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
  const blobG = new THREE.PlaneGeometry(0.9, 0.55); blobG.rotateX(-Math.PI / 2);
  const add = (o: Outfit, expr: Expr, seed: number, x: number, z: number, s = 1, spear = true) => {
    const tex = cardTex(o, expr, seed);
    const m = new THREE.Mesh(BODY, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, color: DUSK ? new THREE.Color(0.86, 0.76, 0.78) : new THREE.Color(1.0, 0.985, 0.96) }));
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = Math.atan2(CAM.pos.x - x, CAM.pos.z - z); m.castShadow = true; root.add(m);
    const b = new THREE.Mesh(blobG, blobM); b.position.set(x, 0.03, z + 0.05); root.add(b);
    if (!spear) return;
    const tilt = (r() - 0.5) * 0.06, sx = x - 0.32 * Math.cos(m.rotation.y), sz = z + 0.32 * Math.sin(m.rotation.y), L = 2.4 * s;
    const sh = new THREE.CylinderGeometry(0.017, 0.021, L, 6); sh.translate(0, L / 2, 0); sh.rotateZ(tilt); sh.translate(sx, 0, sz); shafts.push(sh);
    const tp = new THREE.ConeGeometry(0.05, 0.28, 6); tp.translate(0, L + 0.14, 0); tp.rotateZ(tilt); tp.translate(sx, 0, sz); tips.push(tp);
  };
  add(GENERAL, "stern", 7, 1.0, 6.0, 1.06, false);
  for (let row = 0; row < 28; row++) {
    const z = 3.6 - row * 1.0, half = 1.5 + row * 0.26;
    for (let x = 2.0 - half; x <= 2.0 + half; x += 0.78) {
      const v = Math.floor(r() * 1000);
      add(soldierOutfit(v), EXPRS[v % EXPRS.length], 1 + (v % 6), x + (r() - 0.5) * 0.22, z + (r() - 0.5) * 0.28, 0.97 + r() * 0.06, r() < 0.55);
    }
  }
  for (const [x, z] of [[-0.6, 1.4], [4.2, -2.6], [0.6, -8.2]]) { // torch bearers: bright flames among the ranks
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 6), mat({ color: "#5a3a22" }, SURFACE.woodRaw)); pole.position.set(x, 1.1, z); root.add(pole);
    const fl = torchFlame(0.55); fl.mesh.position.set(x, 2.2, z); root.add(fl.mesh); FLAMES.push(fl);
    const pl = new THREE.PointLight("#ffa04a", DUSK ? 5 : 2.5, 5, 2); pl.position.set(x, 2.5, z + 0.3); root.add(pl);
  }
  const S = new THREE.Mesh(mergeGeometries(shafts.map((g) => g.toNonIndexed())), mat({ color: "#6b4a30" }, SURFACE.woodRaw)); S.castShadow = true; root.add(S);
  root.add(new THREE.Mesh(mergeGeometries(tips.map((g) => g.toNonIndexed())), mat({ color: "#cfd4db" }, { ...SURFACE.metal, roughness: 0.22 })));
  const flagM = twoTone(new THREE.MeshLambertMaterial({ map: bannerTex(), side: THREE.DoubleSide }), 0.35), poleM = mat({ color: "#3b2a1f" }, SURFACE.woodPainted);
  for (const [x, z] of [[-0.4, -5], [4.6, -9], [1.2, -15], [6.4, -19], [-2.6, -21]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 5.4, 8), poleM); pole.position.set(x, 2.7, z); pole.castShadow = true; root.add(pole);
    const fg = new THREE.PlaneGeometry(1.25, 1.9, 14, 1), pa = fg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const u = (pa.getX(i) + 0.625) / 1.25; pa.setZ(i, Math.sin(u * 5 + x) * 0.13 * u); }
    fg.computeVertexNormals();
    const flag = new THREE.Mesh(fg, flagM); flag.position.set(x + 0.66, 4.3, z); flag.rotation.y = 0.3; flag.castShadow = true; root.add(flag);
  }
};

// ---------------- fortress ----------------
/** roof surface between the roll tiles: dark pan-tile grooves with faint courses (low frequency, no shimmer) */
const tileTex = () => ctex("roofPanCN", 256, 256, (g) => {
  g.fillStyle = "#3a414b"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) {
    const x = i * 128, gr = g.createLinearGradient(x, 0, x + 128, 0);
    gr.addColorStop(0, "#262b32"); gr.addColorStop(0.5, "#4a525d"); gr.addColorStop(1, "#262b32");
    g.fillStyle = gr; g.fillRect(x, 0, 128, 256);
  }
  for (let j = 0; j < 2; j++) { g.fillStyle = "rgba(8,10,14,0.45)"; g.fillRect(0, j * 128 + 120, 256, 8); }
});
const rafterTex = () => ctex("rafterCN", 256, 256, (g) => {
  g.fillStyle = "#3a1714"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { g.fillStyle = "#6c2420"; g.fillRect(i * 32 + 6, 0, 20, 256); g.fillStyle = "#2f8a7e"; g.fillRect(i * 32 + 8, 236, 16, 18); }
});
/**
 * Chinese hip roof, built like the real thing:
 *  - concave slopes: flat at the eave, steep at the ridge (y = H (1 - t)^1.7)
 *  - the eave line rises gradually toward each corner (lift = up * e^2.5, e = 0 mid-eave .. 1 corner)
 *  - real roll tiles: a 3D rib every 0.42 m running down each slope, round tile ends along the eave
 *  - a thick slab: rafter-painted underside and a fascia board along the eave
 *  - a layered main ridge with curled end ornaments, heavy hip ridges ending in a small upturned tip
 * W x D at the eave, ridge length W - D (equal slopes), ridge height H, corner lift `up`.
 */
const curvedRoof = (W: number, D: number, H: number, up: number, tilesM: THREE.Material, ridgeM: THREE.Material, underM?: THREE.Material, fasciaM?: THREE.Material, extra?: { bronze: THREE.Material; finial?: THREE.Material }) => {
  const grp = new THREE.Group(), R = Math.max(0, W - D), NX = 96, NZ = 60, hd = D / 2, hw = W / 2;
  const tOf = (x: number, z: number) => Math.min(1, Math.max(Math.abs(z) / hd, Math.max(0, (Math.abs(x) - R / 2) / hd)));
  const yAt = (x: number, z: number) => {
    const t = tOf(x, z), front = Math.abs(z) / hd >= Math.max(0, (Math.abs(x) - R / 2) / hd);
    const e = front ? Math.abs(x) / hw : Math.abs(z) / hd; // position along the eave this point drains to
    return H * Math.pow(1 - t, 1.7) + up * Math.pow(e, 2.5) * t * t;
  };
  // surface (top) + underside slab
  const surf = (dy: number, uvK: number) => {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
      const x = -hw + (W * i) / NX, z = -hd + (D * j) / NZ, tz = Math.abs(z) / hd, tx = Math.max(0, (Math.abs(x) - R / 2) / hd), front = tz >= tx;
      pos.push(x, yAt(x, z) + dy, z); uv.push((front ? x : z) / uvK, ((front ? 1 - tz : 1 - tx) * hd) / uvK);
    }
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const top = new THREE.Mesh(surf(0, 0.84), tilesM); top.castShadow = top.receiveShadow = true; grp.add(top);
  if (underM) { const g = surf(-0.38, 1.0); g.index!.array.reverse(); g.computeVertexNormals(); const u = new THREE.Mesh(g, underM); u.receiveShadow = true; grp.add(u); }
  // fascia: a band around the eave perimeter joining top and underside
  const rim: THREE.Vector3[] = [];
  const N = 120;
  for (let k = 0; k < N; k++) { // perimeter loop
    const s = k / N, per = 2 * (W + D), d = s * per;
    let x: number, z: number;
    if (d < W) { x = -hw + d; z = hd; } else if (d < W + D) { x = hw; z = hd - (d - W); } else if (d < 2 * W + D) { x = hw - (d - W - D); z = -hd; } else { x = -hw; z = -hd + (d - 2 * W - D); }
    rim.push(new THREE.Vector3(x, yAt(x * 0.999, z * 0.999), z));
  }
  const fp: number[] = [], fi: number[] = [];
  rim.forEach((p) => fp.push(p.x, p.y + 0.02, p.z, p.x, p.y - 0.4, p.z));
  for (let k = 0; k < N; k++) { const a = 2 * k, b = 2 * ((k + 1) % N); fi.push(a, a + 1, b, b, a + 1, b + 1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
  const fascia = new THREE.Mesh(fg, fasciaM ?? ridgeM); fascia.material.side = THREE.DoubleSide; grp.add(fascia);
  // roll tiles: ribs down every slope, round tile ends on the eave
  const ribs: THREE.BufferGeometry[] = [], ends: THREE.BufferGeometry[] = [], step = 0.42, rr = 0.075;
  const rib = (pts: THREE.Vector3[]) => {
    if (pts.length < 3) return;
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length * 2), rr, 5).toNonIndexed());
    const a = pts[pts.length - 1], b = pts[pts.length - 2], dir = a.clone().sub(b).normalize();
    const disc = new THREE.CylinderGeometry(rr * 1.35, rr * 1.35, 0.06, 12); disc.rotateX(Math.PI / 2);
    disc.lookAt(dir); disc.translate(a.x, a.y, a.z); ends.push(disc.toNonIndexed());
  };
  for (const sz of [-1, 1]) for (let x = -hw + step / 2; x < hw; x += step) { // front / back slopes: ribs along z
    const z0 = Math.max(0, Math.abs(x) - R / 2) + 0.05, pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) { const z = z0 + ((hd - z0) * k) / 10; pts.push(new THREE.Vector3(x, yAt(x, sz * z * 0.999) + rr * 0.6, sz * z)); }
    rib(pts);
  }
  for (const sx of [-1, 1]) for (let z = -hd + step / 2; z < hd; z += step) { // hip ends: ribs along x
    const x0 = R / 2 + Math.abs(z) + 0.05, pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) { const x = x0 + ((hw - x0) * k) / 8; pts.push(new THREE.Vector3(sx * x, yAt(sx * x * 0.999, z) + rr * 0.6, z)); }
    rib(pts);
  }
  const ribM = new THREE.Mesh(mergeGeometries(ribs), tilesM === ridgeM ? ridgeM : ridgeM); ribM.castShadow = true; ribM.receiveShadow = true; grp.add(ribM);
  grp.add(new THREE.Mesh(mergeGeometries(ends), ridgeM));
  // main ridge: two stacked courses and a rounded cap
  const rl = Math.max(0.6, R);
  const r1 = new THREE.Mesh(roundedBox(rl + 0.6, 0.38, 0.55, 0.06), ridgeM); r1.position.y = H + 0.12; grp.add(r1);
  const r2 = new THREE.Mesh(roundedBox(rl + 0.4, 0.3, 0.42, 0.08), ridgeM); r2.position.y = H + 0.44; grp.add(r2);
  // curled end ornaments (our own simple fish-tail curl), extruded with a bevel
  const curl = new THREE.Shape();
  curl.moveTo(0, 0); curl.lineTo(0.55, 0); curl.lineTo(0.55, 0.5);
  curl.bezierCurveTo(0.6, 1.1, 0.25, 1.45, -0.25, 1.35);
  curl.bezierCurveTo(-0.05, 1.15, 0.12, 0.95, 0.05, 0.6);
  curl.lineTo(0, 0);
  const cg = new THREE.ExtrudeGeometry(curl, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 16 });
  cg.translate(-0.27, 0, -0.14);
  for (const s of [-1, 1]) { const o = new THREE.Mesh(cg, ridgeM); o.position.set(s * (rl / 2 + 0.05), H + 0.25, 0); o.scale.set(-s * 0.9, 0.9, 1); o.castShadow = true; grp.add(o); }
  // hip ridges: heavy, following the surface, ending in a small upturned tip
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 18; k++) { const s = (k / 18) * 0.97, x = sx * (R / 2 + s * hd), z = sz * (s * hd); pts.push(new THREE.Vector3(x, yAt(x * 0.999, z * 0.999) + 0.16, z)); }
    const end = pts[pts.length - 1], prev = pts[pts.length - 2], dir = end.clone().sub(prev).normalize();
    pts.push(end.clone().addScaledVector(dir, 0.35).add(new THREE.Vector3(0, 0.22, 0)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.17, 8), ridgeM); tube.castShadow = true; grp.add(tube);
    if (extra) {
      // a row of small ridge figurines walking down the hip toward the corner
      for (let k = 0; k < 4; k++) {
        const s = 0.6 + k * 0.08, x = sx * (R / 2 + s * hd), z = sz * (s * hd), y = yAt(x * 0.999, z * 0.999) + 0.36;
        const b = new THREE.Mesh(roundedBox(0.16, 0.2, 0.14, 0.04), extra.bronze); b.position.set(x, y, z); grp.add(b);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), extra.bronze); h.position.set(x, y + 0.16, z); grp.add(h);
      }
      // bronze bell hanging from the swept-up corner
      const cx = sx * hw * 0.985, cz = sz * hd * 0.985, cy = yAt(cx, cz) - 0.42;
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.26, 12), extra.bronze); bell.position.set(cx, cy - 0.2, cz); grp.add(bell);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4), extra.bronze); cord.position.set(cx, cy, cz); grp.add(cord);
    }
  }
  if (extra?.finial) { // lotus base + pearl on the middle of the main ridge
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.25, 12), extra.finial); base.position.y = H + 0.72; grp.add(base);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), extra.finial); pearl.position.y = H + 1.05; grp.add(pearl);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 10), extra.finial); tip.position.y = H + 1.42; grp.add(tip);
  }
  grp.userData.eave = (x: number, z: number) => yAt(x, z); // for hanging lanterns
  return grp;
};
const latticeTex = () => ctex("latticeCN2", 512, 512, (g) => {
  g.fillStyle = "#efe2c6"; g.fillRect(0, 0, 512, 512);
  // fret (key) pattern lattice in thin red slats, a solid lower panel and a heavy frame
  g.strokeStyle = "#7d2320"; g.lineWidth = 6; g.lineCap = "square";
  for (let y = 24; y < 330; y += 48) for (let x = 24; x < 490; x += 48) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 36, y); g.lineTo(x + 36, y + 36); g.lineTo(x + 12, y + 36); g.lineTo(x + 12, y + 12); g.lineTo(x + 24, y + 12); g.lineTo(x + 24, y + 24); g.stroke();
  }
  g.fillStyle = "#8a2722"; g.fillRect(0, 350, 512, 162);
  g.strokeStyle = "#d9b24a"; g.lineWidth = 5; g.strokeRect(30, 375, 452, 110);
  g.strokeStyle = "#5e1a17"; g.lineWidth = 26; g.strokeRect(0, 0, 512, 512); g.beginPath(); g.moveTo(0, 350); g.lineTo(512, 350); g.stroke();
});
/** painted beam band (our own pattern): teal and blue panels with gold borders and white dots on red */
const beamTex = () => ctex("beamBandCN", 512, 64, (g) => {
  g.fillStyle = "#8a2722"; g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    g.fillStyle = i % 2 ? "#2f6f8f" : "#2f8a7a"; g.fillRect(x + 10, 10, 108, 44);
    g.strokeStyle = "#e0b850"; g.lineWidth = 4; g.strokeRect(x + 10, 10, 108, 44);
    g.fillStyle = "#e0b850"; g.beginPath(); g.ellipse(x + 64, 32, 26, 13, 0, 0, 7); g.fill();
    g.fillStyle = "#1f3f5a"; g.beginPath(); g.ellipse(x + 64, 32, 15, 7, 0, 0, 7); g.fill();
    g.fillStyle = "#ffffff"; for (const dx of [22, 106]) { g.beginPath(); g.arc(x + dx, 32, 4, 0, 7); g.fill(); }
  }
  g.fillStyle = "#e0b850"; g.fillRect(0, 0, 512, 4); g.fillRect(0, 60, 512, 4);
});
const plaqueTex = () => ctex("plaqueCN", 384, 160, (g) => {
  g.fillStyle = "#1f3a6a"; g.fillRect(0, 0, 384, 160);
  g.strokeStyle = "#e0b850"; g.lineWidth = 16; g.strokeRect(8, 8, 368, 144);
  g.lineWidth = 4; g.strokeRect(26, 26, 332, 108);
  g.fillStyle = "#e0b850"; for (const x of [112, 192, 272]) { g.beginPath(); g.arc(x, 80, 26, 0, 7); g.fill(); g.fillStyle = "#1f3a6a"; g.beginPath(); g.arc(x, 80, 13, 0, 7); g.fill(); g.fillStyle = "#e0b850"; }
});
const doorTex = () => ctex("gateDoor", 256, 384, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#5a3a22" : "#62402a"; g.fillRect(i * 32, 0, 32, 384); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(i * 32, 0, 3, 384); }
  g.fillStyle = "#2a1c12"; g.fillRect(126, 0, 4, 384);
  for (let y = 30; y < 384; y += 38) for (let x = 18; x < 256; x += 28) { g.fillStyle = "#b8923e"; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = "rgba(255,240,200,0.9)"; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, 7); g.fill(); }
});
const pavilion = (W: number, D: number, H: number, bays: number, lacquer: THREE.Material, lattice: THREE.Material, beamM: THREE.Material, bracket: THREE.Material) => {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BoxGeometry(W - 1.2, H, D - 1.2), lattice); core.position.y = H / 2; core.castShadow = true; g.add(core);
  const colG = new THREE.CylinderGeometry(0.26, 0.29, H, 14);
  for (let i = 0; i <= bays; i++) for (const zs of [-1, 1]) { const c = new THREE.Mesh(colG, lacquer); c.position.set(-W / 2 + 0.4 + ((W - 0.8) * i) / bays, H / 2, zs * (D / 2 - 0.4)); c.castShadow = true; g.add(c); }
  for (const zs of [-1, 1]) for (let i = 1; i < 3; i++) { const c = new THREE.Mesh(colG, lacquer); c.position.set(zs * (W / 2 - 0.4), H / 2, -D / 2 + 0.4 + ((D - 0.8) * i) / 3); g.add(c); }
  const bandM = mat({ map: repTex(beamTex(), Math.max(1, Math.round(W / 2.6)), 1), color: "#ffffff" }, SURFACE.woodPainted);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.55, D + 0.1), [bandM, bandM, beamM, beamM, bandM, bandM]); beam.position.y = H + 0.1; g.add(beam);
  const bG = roundedBox(0.34, 0.28, 0.6, 0.04), bG2 = roundedBox(0.5, 0.22, 0.8, 0.04);
  for (let x = -W / 2 + 0.3; x <= W / 2 - 0.3; x += 0.7) for (const zs of [-1, 1]) {
    const b = new THREE.Mesh(bG, bracket); b.position.set(x, H + 0.5, zs * (D / 2 + 0.15)); g.add(b);
    const b2 = new THREE.Mesh(bG2, beamM); b2.position.set(x, H + 0.72, zs * (D / 2 + 0.3)); g.add(b2);
  }
  const rail = new THREE.Mesh(roundedBox(W + 0.6, 0.12, 0.12, 0.03), lacquer); rail.position.set(0, 1.0, D / 2 + 0.3); g.add(rail);
  const rail2 = rail.clone(); rail2.position.y = 0.55; g.add(rail2);
  for (let x = -W / 2 - 0.25; x <= W / 2 + 0.3; x += 0.9) { const p = new THREE.Mesh(roundedBox(0.12, 1.05, 0.12, 0.03), lacquer); p.position.set(x, 0.52, D / 2 + 0.3); g.add(p); }
  return g;
};
const buildFortress = (root: THREE.Object3D) => {
  const F = new THREE.Group(); F.position.set(-3, 0, -42); root.add(F);
  const stone = mat({ color: "#a39c90", vertexColors: true }, { ...SURFACE.stone, grime: 0.55, grimeH: 1.6 }), mortar = mat({ color: "#4d4842" }, { ...SURFACE.stone, wear: 0.3 });
  const stoneDark = mat({ color: "#8c867c", vertexColors: true }, { ...SURFACE.stone, grime: 0.6, grimeH: 1.2 });
  const L = 74, H = 10;
  const add = (o: THREE.Mesh) => { o.castShadow = o.receiveShadow = true; F.add(o); return o; };
  const plinth = blockWall({ w: L, h: 1.6, block: [1.7, 0.8], gap: 0.06, bevel: 0.08, proud: 0.12, jitter: 0.16, seed: 4 });
  add(new THREE.Mesh(plinth.blocks, stoneDark)); add(new THREE.Mesh(plinth.mortar, mortar));
  const wall = blockWall({ w: L, h: H - 1.6, block: [1.05, 0.52], gap: 0.05, bevel: 0.055, proud: 0.05, jitter: 0.15, seed: 3, outJitter: 0.02 });
  const wm = add(new THREE.Mesh(wall.blocks, stone)); wm.position.y = 1.6; const mm = add(new THREE.Mesh(wall.mortar, mortar)); mm.position.y = 1.6;
  const core = add(new THREE.Mesh(new THREE.BoxGeometry(L, H, 9), mat({ color: "#7d776d" }, SURFACE.stone))); core.position.set(L / 2, H / 2, -4.55);
  const capM = mat({ color: "#b4ad9f" }, SURFACE.stone);
  const string = add(new THREE.Mesh(roundedBox(L + 0.4, 0.3, 0.5, 0.06), capM)); string.position.set(L / 2, H + 0.12, 0.05);
  const low = add(new THREE.Mesh(roundedBox(L, 0.9, 0.7, 0.07), mat({ color: "#a39c90" }, SURFACE.stone))); low.position.set(L / 2, H + 0.72, -0.2); // plain stone: rounded boxes carry no vertex colours
  for (let x = 0.7; x < L; x += 2.0) { const m = add(new THREE.Mesh(roundedBox(1.2, 1.15, 0.7, 0.08), capM)); m.position.set(x, H + 1.75, -0.2); }
  const gx = 10, aw = 2.4, ah = 4.0;
  const arch = new THREE.Shape(); arch.moveTo(-aw, 0); arch.lineTo(-aw, ah); arch.absarc(0, ah, aw, Math.PI, 0, true); arch.lineTo(aw, 0); arch.lineTo(-aw, 0);
  const hole = new THREE.Mesh(new THREE.ShapeGeometry(arch, 32), new THREE.MeshBasicMaterial({ color: "#0f0d10" })); hole.position.set(gx, 0, 0.14); F.add(hole);
  const doors = new THREE.Mesh(new THREE.ShapeGeometry(arch, 32), lam({ map: doorTex() }));
  { const uvs = doors.geometry.attributes.uv, ps = doors.geometry.attributes.position; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, (ps.getX(i) + aw) / (2 * aw), ps.getY(i) / (ah + aw)); }
  doors.scale.setScalar(0.94); doors.position.set(gx, 0, 0.16); F.add(doors);
  const vM = mat({ color: "#bdb5a6" }, SURFACE.stone);
  for (let k = 0; k <= 14; k++) { const a = Math.PI - (k / 14) * Math.PI, v = add(new THREE.Mesh(roundedBox(0.62, 0.95, 0.6, 0.06), vM)); v.position.set(gx + Math.cos(a) * (aw + 0.45), ah + Math.sin(a) * (aw + 0.45), 0.2); v.rotation.z = a - Math.PI / 2; }
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const v = add(new THREE.Mesh(roundedBox(0.7, 0.75, 0.6, 0.06), vM)); v.position.set(gx + s * (aw + 0.4), 0.4 + k * 0.8, 0.2); }
  const lacquer = mat({ color: "#9a2a24" }, SURFACE.woodPainted), latM = lam({ map: latticeTex() }), beamM = mat({ color: "#7e2420" }, SURFACE.woodPainted);
  const bracket = mat({ color: "#3e7d78" }, { ...SURFACE.woodPainted, roughness: 0.5 }), tilesM = mat({ map: tileTex(), color: "#ffffff" }, { roughness: 0.32, spec: 1.3, wear: 0.4, wearScale: 1.2, grime: 0, sky: 0.45 });
  const ridgeM = mat({ color: "#4a535e" }, { roughness: 0.3, spec: 1.3, wear: 0.35, wearScale: 0.6, grime: 0, sky: 0.5 });
  const underM = twoTone(new THREE.MeshLambertMaterial({ map: rafterTex(), side: THREE.DoubleSide }), 0.2), fasciaM = mat({ color: "#7e2420" }, SURFACE.woodPainted);
  const bronze = mat({ color: "#8a6a3a" }, SURFACE.brass), goldM = mat({ color: "#d9b24a" }, SURFACE.brass);
  const HOT = DUSK ? 9 : 3.2, SPILL = DUSK ? 14 : 4;
  const T = new THREE.Group(); T.position.set(gx, H + 0.25, -3.2); F.add(T);
  const base = new THREE.Mesh(roundedBox(16, 0.5, 9, 0.08), capM); base.castShadow = true; T.add(base);
  const p1 = pavilion(13, 6.6, 3.8, 6, lacquer, latM, beamM, bracket); p1.position.y = 0.25; T.add(p1);
  const r1 = curvedRoof(16.5, 10.2, 2.0, 0.9, tilesM, ridgeM, underM, fasciaM, { bronze }); r1.position.y = 4.5; T.add(r1);
  const p2 = pavilion(9.6, 4.8, 2.8, 4, lacquer, latM, beamM, bracket); p2.position.y = 5.6; T.add(p2);
  const r2 = curvedRoof(14.0, 8.4, 3.4, 1.0, tilesM, ridgeM, underM, fasciaM, { bronze, finial: goldM }); r2.position.y = 8.9; T.add(r2);
  // name plaque on the upper storey, under the top eave
  const plq = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.12), [fasciaM, fasciaM, fasciaM, fasciaM, lam({ map: plaqueTex() }), fasciaM]); plq.position.set(0, 7.75, 2.55); T.add(plq);
  // red lanterns hanging from both eaves (front), bright enough to bloom
  const hang = (roof: THREE.Group, y0: number, xs: number[], zf: number, size: number) => {
    for (const x of xs) { const l = lantern({ kind: "round", size, hot: HOT, light: SPILL, reach: 8, halo: 2.8, cone: DUSK ? 3 : 0 }); l.position.set(x, y0 + roof.userData.eave(x, zf) - 0.55, zf); T.add(l); }
  };
  hang(r1, 4.5, [-5.4, -1.8, 1.8, 5.4], 4.3, 1.05);
  hang(r2, 8.9, [-3.6, 3.6], 3.5, 0.9);
  const bx = L - 4, bas = blockWall({ w: 8, h: H + 1, block: [1.05, 0.52], gap: 0.05, bevel: 0.055, proud: 0.05, jitter: 0.15, seed: 8 });
  const bm = add(new THREE.Mesh(bas.blocks, stone)); bm.position.set(bx - 4, 0, 5); add(new THREE.Mesh(bas.mortar, mortar)).position.set(bx - 4, 0, 5);
  const bcore = add(new THREE.Mesh(new THREE.BoxGeometry(8, H + 1, 5.2), mat({ color: "#7d776d" }, SURFACE.stone))); bcore.position.set(bx, (H + 1) / 2, 2.4);
  for (let x = -3.2; x <= 3.3; x += 2.1) { const m = add(new THREE.Mesh(roundedBox(1.2, 1.15, 0.7, 0.08), capM)); m.position.set(bx + x, H + 1.6, 4.8); }
  const p3 = pavilion(5.4, 4.0, 2.6, 3, lacquer, latM, beamM, bracket); p3.position.set(bx, H + 1, 2.2); F.add(p3);
  const r3 = curvedRoof(8.4, 6.6, 2.8, 0.8, tilesM, ridgeM, underM, fasciaM, { bronze, finial: goldM }); r3.position.set(bx, H + 1 + 3.2, 2.2); F.add(r3);
  for (const x of [-2.2, 2.2]) { const l = lantern({ kind: "round", size: 0.55, hot: HOT, light: SPILL * 0.7, reach: 6 }); l.position.set(bx + x, H + 1 + 3.2 + r3.userData.eave(x, 3.0) - 0.3, 2.2 + 3.0); F.add(l); }
  // square wall lanterns flanking the gate, torches on the parapet
  for (const s of [-1, 1]) { const l = lantern({ kind: "square", size: 0.8, hot: HOT, light: SPILL, reach: 7, halo: 2.8 }); l.position.set(gx + s * 4.4, 7.0, 0.6); F.add(l);
    const arm = new THREE.Mesh(roundedBox(0.08, 0.08, 0.5, 0.02), bronze); arm.position.set(gx + s * 4.4, 6.85, 0.3); F.add(arm); }
  for (let x = 2; x < L; x += 9) {
    if (Math.abs(x - gx) < 9) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8), bronze); pole.position.set(x, H + 1.9, -0.05); F.add(pole);
    const fl = torchFlame(0.6); fl.mesh.position.set(x, H + 2.45, 0.0); F.add(fl.mesh); FLAMES.push(fl);
    const pl = new THREE.PointLight("#ffa04a", SPILL * 0.8, 7, 2); pl.position.set(x, H + 2.7, 0.4); F.add(pl);
  }
  const walk = add(new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, 8.6), capM)); walk.position.set(L / 2, H + 0.15, -4.5);
};

// ---------------- land ----------------
const fieldsTex = () => ctex("armyFields2", 2048, 2048, (g) => {
  const r = rng(5), cols = ["#c4ad55", "#cfbb64", "#6c9e47", "#5a9142", "#84a951", "#95824f", "#b3a157", "#77a24b"];
  g.fillStyle = "#62914a"; g.fillRect(0, 0, 2048, 2048);
  for (let y = 0; y < 2048;) {
    const h = 80 + r() * 160;
    for (let x = 0; x < 2048;) {
      const w = 110 + r() * 240; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = "rgba(0,0,0,0.08)"; g.lineWidth = 3; const vert = r() < 0.5;
      for (let k = 6; k < (vert ? w : h); k += 8) { g.beginPath(); if (vert) { g.moveTo(x + k, y + 4); g.lineTo(x + k, y + h - 4); } else { g.moveTo(x + 4, y + k); g.lineTo(x + w - 4, y + k); } g.stroke(); }
      g.strokeStyle = "#3d6633"; g.lineWidth = 7; g.strokeRect(x, y, w, h);
      x += w;
    }
    y += h;
  }
});
const terrain = (x0: number, z0: number, w: number, d: number, nx: number, nz: number, hFn: (x: number, z: number) => number, m: THREE.Material) => {
  const g = new THREE.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + x0, z = p.getZ(i) + z0; p.setY(i, hFn(x, z)); }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m); mesh.position.set(x0, 0, z0); mesh.receiveShadow = true; return mesh;
};
const hillH = (x: number, z: number) => { const k = Math.max(0, (-z - 320) / 700); return Math.pow(k, 1.25) * 140 * (0.45 + 0.9 * fbm(x / 260, z / 260)) - 2; };
const mtnH = (x: number, z: number) => { const r = 1 - Math.abs(2 * fbm(x / 420 + 3, z / 420, 6) - 1); return 140 + 420 * Math.pow(r, 2.2) * Math.min(1, Math.max(0, (-z - 1300) / 300)); };
const buildLand = (root: THREE.Object3D) => {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 140), meadowMat(tone)); ground.rotation.x = -Math.PI / 2; ground.position.z = -30; ground.receiveShadow = true; root.add(ground);
  const fields = new THREE.Mesh(new THREE.PlaneGeometry(1100, 520), lam({ map: fieldsTex() })); fields.rotation.x = -Math.PI / 2; fields.position.set(-150, 0.04, -360); fields.receiveShadow = true; root.add(fields);
  root.add(terrain(-100, -900, 2600, 1300, 220, 110, hillH, meadowMat(tone)));
  const canopyG = new THREE.IcosahedronGeometry(1, 0); canopyG.scale(1, 1.15, 1);
  const cc = new Float32Array(canopyG.attributes.position.count * 3), c = new THREE.Color();
  for (let i = 0; i < canopyG.attributes.position.count; i++) { const y = canopyG.attributes.position.getY(i); c.set("#2f5a2a").lerp(new THREE.Color("#5f8f3c"), (y + 1.15) / 2.3); cc.set([c.r, c.g, c.b], i * 3); }
  canopyG.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
  const woods = new THREE.InstancedMesh(canopyG, twoTone(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), 9000);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pv = new THREE.Vector3(), r = rng(31), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let k = 0; k < 60000 && n < 9000; k++) {
    const x = -1300 + r() * 2400, z = -380 - r() * 1150;
    if (fbm(x / 160 + 7, z / 160) < 0.55) continue;
    const sz = 7 + r() * 6; pv.set(x, hillH(x, z) + sz * 0.8, z); s.set(sz, sz, sz); q.setFromAxisAngle(up, r() * 6);
    M.compose(pv, q, s); woods.setMatrixAt(n++, M);
  }
  woods.count = n; woods.receiveShadow = true; root.add(woods);
  root.add(terrain(-100, -1750, 3600, 900, 240, 60, mtnH, lam({ color: "#6f8a74" })));
  const r2 = rng(21);
  for (let i = 0; i < 70; i++) {
    const x = -30 - r2() * 260, z = -50 - r2() * 280, h = 6 + r2() * 7;
    const t = natureTree({ height: h, kind: r2() < 0.25 ? "pine" : "round", seed: i + 3, base: tone }); t.position.set(x, 0, z); t.rotation.y = r2() * 6; root.add(t);
  }
  for (const [x, z, h] of [[-18, -36, 9], [-23, -31, 7.5], [-27, -40, 10], [64, -30, 9]] as const) { const t = natureTree({ height: h, seed: Math.round(x * z), base: tone }); t.position.set(x, 0, z); root.add(t); }
  root.add(grassPatch({ center: [1.0, 6.5], radius: 9, density: 1800, seed: 5, max: 170000 }));
  root.add(grassPatch({ center: [1.5, -10], radius: 34, density: 480, height: [0.18, 0.4], width: 0.022, edge: 0.5, seed: 9, max: 260000 }));
  const sky = new THREE.SphereGeometry(3500, 32, 16), sc = new Float32Array(sky.attributes.position.count * 3);
  const top = new THREE.Color(DUSK ? "#141a3e" : "#2c74cf"), hor = new THREE.Color(DUSK ? "#d9875a" : "#cfe3f3"), mid = new THREE.Color(DUSK ? "#5e4a78" : "#7fb0e4");
  for (let i = 0; i < sky.attributes.position.count; i++) { const y = Math.max(0, sky.attributes.position.getY(i) / 3500); if (y < 0.18) c.copy(hor).lerp(mid, y / 0.18); else c.copy(mid).lerp(top, Math.min(1, (y - 0.18) / 0.5)); sc.set([c.r, c.g, c.b], i * 3); }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
  root.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  for (const [x, y, z, w, seed] of [[-700, 520, -2600, 1300, 1], [600, 680, -2800, 1500, 2], [-80, 900, -3000, 1700, 3], [1200, 430, -2400, 900, 4], [-1400, 600, -2500, 1000, 5]] as const) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: cloudHD(seed), color: DUSK ? new THREE.Color(0.55, 0.42, 0.5) : new THREE.Color(1, 1, 1), transparent: true, fog: false, depthWrite: false }));
    cl.position.set(x, y, z); cl.lookAt(CAM.pos); root.add(cl);
  }
};

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: DUSK ? 0.9 : 0.45, luminanceThreshold: DUSK ? 1.0 : 0.92, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();

const Inner: React.FC<{ f: number }> = ({ f }) => {
  const { camera, scene } = useThree();
  const { fps } = useVideoConfig();
  const world = useMemo(() => {
    const L = DUSK ? { ...LIGHTS.day, lit: [0.85, 0.55, 0.42] as [number, number, number], lift: [0.03, 0.03, 0.09] as [number, number, number], sunCol: "#ff9a5a", sunI: 1.2, sky: "#4a4a90", ground: "#2e2630", hemiI: 0.25 } : LIGHTS.day;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...((DUSK ? [0.2, 0.2, 0.36] : [0.55, 0.53, 0.55]) as [number, number, number])); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = 0.45; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0, 0, 0); TONE.uSat.value = 1.05;
    REAL.uRealSky.value.set(L.sky);
    const root = new THREE.Group();
    buildLand(root); buildFortress(root); buildArmy(root);
    const sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const target = new THREE.Vector3(4, 0, -20), sc = sun.shadow.camera;
    sc.left = sc.bottom = -48; sc.right = sc.top = 48; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    sun.position.copy(target).addScaledVector(SUN_DIR, 120); sun.target.position.copy(target);
    root.add(sun, sun.target, new THREE.HemisphereLight(L.sky, L.ground, L.hemiI));
    if (DUSK) sun.position.copy(target).addScaledVector(new THREE.Vector3(-0.7, 0.16, -0.7).normalize(), 120); // low sun behind-left
    // let every lit material take the lanterns' warm spill (the two-tone shader only listens to the sun)
    const done = new WeakSet<THREE.Material>();
    root.traverse((o) => { const m = (o as THREE.Mesh).material; for (const mm of (Array.isArray(m) ? m : m ? [m] : []) as THREE.Material[]) {
      if (done.has(mm) || (mm as THREE.MeshBasicMaterial).isMeshBasicMaterial || !("onBeforeCompile" in mm)) continue; done.add(mm); addSpill(mm); } });
    return root;
  }, []);
  scene.fog = useMemo(() => new THREE.Fog(DUSK ? "#6a5470" : "#cfe3f3", 90, 2300), []);
  for (const fl of FLAMES) { fl.pose(f); fl.mesh.lookAt(camera.position.x, fl.mesh.getWorldPosition(tmp).y, camera.position.z); }
  const fx = useMemo(() => ({ lens: new LensBlur({ maxCoC: 22, nearScale: 1.0 }), bloom: makeBloom(), tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }) }), []);
  GRASS.uTime.value = f / fps;
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(CAM.pos); cam.lookAt(CAM.look);
  if (cam.fov !== CAM.fov) { cam.fov = CAM.fov; cam.updateProjectionMatrix(); }
  cam.getWorldDirection(fwd);
  fx.lens.focus = tmp.copy(FOCUS_AT).sub(cam.position).dot(fwd);
  fx.lens.cInf = ROOF_CAM ? 0 : 7; // reference close/mid shots: background clearly soft (centre/border sharpness ratio ~6)
  return (
    <>
      <primitive object={world} dispose={null} />
      <EffectComposer multisampling={4}>
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const ArmyFrame: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#cfe3f3" }}>
      <ThreeCanvas width={1080} height={1920} shadows camera={{ fov: CAM.fov, near: 0.1, far: 8000 }}
        gl={{ antialias: false, stencil: false, toneMapping: THREE.NoToneMapping }}>
        <Inner f={f} />
      </ThreeCanvas>
      <Captions words={[{ text: "waiting.", start: 0, end: 10 }]} group={false} />
    </AbsoluteFill>
  );
};
