// Look lab: a small test scene that shows each shared improvement from the Ricks Clips study before/after, under the
// same day light and two-tone shading as the shadow tax short. Not a story short.
//   inputProps { variant: "before" | "after" }  (default "after")
//   before = what our shorts do now: hard boxes with a painted texture, toon two-tone Lambert, smootherstep glide.
//   after  = shared/bevel.ts block wall + bevelled planks, shared/realMaterial.ts surfaces, shared/camera.ts one-take
//            camera with the measured ease and opening move.
// Stills: PROPS='{"variant":"before"}' node scripts/stills.mjs LookLab out/looklab/b_ 20,70 0.5
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { twoTone, TONE } from "../shadowtax/shade";
import { LIGHTS, LOOK } from "../shadowtax/lights";
import { ctex, rep, stoneHD } from "../shadowtax/paint";
import { blockWall, roundedBox, plank } from "../../shared/bevel";
import { realMat, SURFACE, REAL, liftFor } from "../../shared/realMaterial";
import { continuous, openingBeats, smootherstep, mixCam, holdDrift, type Cam, type V3 } from "../../shared/camera";

export const LOOKLAB_FRAMES = 90;
const variant = () => ((getInputProps() as { variant?: string }).variant === "before" ? "before" : "after");

const lamT = (p: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(p));
const toneStd = <M extends THREE.MeshStandardMaterial>(m: M) => twoTone(m as unknown as THREE.MeshLambertMaterial, liftFor(m.color)) as unknown as M;

const crateTex = () => ctex("labCrate", 128, 128, (g) => { g.fillStyle = "#d9a15a"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#8a5a2c"; g.lineWidth = 10; g.strokeRect(5, 5, 118, 118); g.beginPath(); g.moveTo(5, 5); g.lineTo(123, 123); g.stroke(); });

/** the scene: grass ground, a 7 x 3.6 m castle wall, a 0.8 m crate, an iron bucket, a wooden bench */
const buildScene = (after: boolean) => {
  const root = new THREE.Group();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; root.add(o); return o;
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lamT({ color: "#6aab4f" }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  // ---- wall ----
  if (after) {
    const w = blockWall({ w: 7, h: 3.6, block: [0.55, 0.3], seed: 11, jitter: 0.14, gap: 0.03, bevel: 0.035, outJitter: 0.015 });
    add(w.blocks, realMat({ color: "#b8ab98", vertexColors: true }, SURFACE.stone, toneStd), -3.5, 0, -2);
    add(w.mortar, realMat({ color: "#6f655a" }, { ...SURFACE.stone, wear: 0.3 }, toneStd), -3.5, 0, -2);
    add(roundedBox(7.2, 0.25, 0.5, 0.04), realMat({ color: "#cfc3b0" }, SURFACE.stone, toneStd), 0, 3.72, -2.05); // coping
  } else {
    const t = rep(stoneHD(), 7 / 4, 3.6 / 4);
    add(new THREE.BoxGeometry(7, 3.6, 0.3), lamT({ map: t }), 0, 1.8, -2.15);
    add(new THREE.BoxGeometry(7.2, 0.25, 0.5), lamT({ color: "#cfc3b0" }), 0, 3.72, -2.05);
  }
  // ---- crate ----
  if (after) {
    const wood = realMat({ color: "#c58b4e" }, SURFACE.woodRaw, toneStd), dark = realMat({ color: "#8a5a2c" }, SURFACE.woodRaw, toneStd);
    const crate = new THREE.Group(); crate.position.set(1.1, 0, 0.2); crate.rotation.y = -0.35; root.add(crate);
    const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz, "YZX"); o.castShadow = o.receiveShadow = true; crate.add(o);
    };
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      put(plank(0.8, 0.18, 0.03, i + (s > 0 ? 9 : 1)), wood, 0, 0.11 + i * 0.193, s * 0.385, 0, 0, Math.PI / 2);            // front/back boards
      put(plank(0.74, 0.18, 0.03, i + (s > 0 ? 19 : 29)), wood, s * 0.385, 0.11 + i * 0.193, 0, Math.PI / 2, 0, Math.PI / 2); // side boards
    }
    for (const s of [-1, 1]) put(plank(1.02, 0.07, 0.035, 40 + s), dark, 0, 0.4, s * 0.405, 0, s * Math.atan2(0.62, 0.62), Math.PI / 2); // diagonal braces
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(roundedBox(0.07, 0.8, 0.07, 0.012), dark, x * 0.37, 0.4, z * 0.37);
    put(roundedBox(0.8, 0.03, 0.8, 0.01), wood, 0, 0.785, 0);
    // fittings: glossy black corner caps and a brass knob (reference box: white glints, sky-blue edges, hot spot)
    const black = realMat({ color: "#1a1a1c" }, SURFACE.glossBlack, toneStd), brass = realMat({ color: "#c8913e" }, SURFACE.brass, toneStd);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(roundedBox(0.13, 0.13, 0.13, 0.025), black, x * 0.37, 0.75, z * 0.37);
    put(new THREE.SphereGeometry(0.035, 24, 16), brass, 0.1, 0.45, 0.42);
  } else {
    const c = add(new THREE.BoxGeometry(0.8, 0.8, 0.8), lamT({ map: crateTex() }), 1.1, 0.4, 0.2); c.rotation.y = -0.35;
    const black = lamT({ color: "#1a1a1c" }), brass = lamT({ color: "#c8913e" });
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), black); b.position.set(x * 0.37, 0.335, z * 0.37); c.add(b); }
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), brass); k.position.set(0.1, 0.05, 0.42); c.add(k);
  }
  // ---- iron bucket (lathe: real curvature in both looks) ----
  const prof = [[0.16, 0], [0.2, 0.02], [0.215, 0.34], [0.23, 0.36], [0.205, 0.36], [0.19, 0.03], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(prof, 40), after ? realMat({ color: "#7a7f86", side: THREE.DoubleSide }, SURFACE.metal, toneStd) : lamT({ color: "#7a7f86", side: THREE.DoubleSide }), -0.9, 0, 0.6);
  // ---- bench ----
  const benchM = after ? realMat({ color: "#a8724a" }, SURFACE.woodPainted, toneStd) : lamT({ color: "#a8724a" });
  const top = after ? roundedBox(1.6, 0.06, 0.34, 0.02) : new THREE.BoxGeometry(1.6, 0.06, 0.34);
  add(top, benchM, -1.6, 0.45, -1.2);
  for (const s of [-1, 1]) add(after ? roundedBox(0.08, 0.42, 0.3, 0.015) : new THREE.BoxGeometry(0.08, 0.42, 0.3), benchM, -1.6 + s * 0.65, 0.21, -1.2);
  return root;
};

// ---- camera: mid shot of the crate and wall, then a fast push into the crate (frame 26), then a move to the wall ----
const A = (): Cam => ({ pos: [0.6, 1.55, 4.6], look: [0.2, 1.05, -0.4], fov: 40, roll: 0 });
const B = (): Cam => ({ pos: [1.55, 1.15, 1.75], look: [1.05, 0.55, 0.1], fov: 40, roll: 0.02 });
const Cw = (): Cam => ({ pos: [-1.2, 1.6, 1.6], look: [-1.6, 1.5, -2.0], fov: 40, roll: -0.03 });
const camAfter = (f: number) => continuous([...openingBeats(() => A(), (g) => holdDrift(B(), g - 38, { pushPct: 0.12 })), { f: 56, cam: (g) => holdDrift(Cw(), g - 56), move: 22, arc: 0.15, rollDeg: 3 }], f);
/** "before": our older grammar, a static mid shot creeping in, smootherstep glide (24 f) to the crate, cut to the wall */
const camBefore = (f: number): Cam => {
  if (f >= 56) return holdDrift(Cw(), f - 56, { truck: 0, rollDegPerS: 0 });
  const a = holdDrift(A(), f, { truck: 0, rollDegPerS: 0 });
  return f < 26 ? a : mixCam(a, B(), smootherstep((f - 26) / 24));
};

const Inner: React.FC<{ f: number; after: boolean }> = ({ f, after }) => {
  const { camera } = useThree();
  const scene = useMemo(() => buildScene(after), [after]);
  const lights = useMemo(() => {
    const L = LIGHTS.day, K = LOOK.day;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    REAL.uRealSky.value.set(L.sky);
    // after: shade keeps the surface hue (reference box: hue shifts 9 deg into shade; our blue-lavender shade shifts 18)
    if (after) TONE.uShadeCol.value.set(0.52, 0.5, 0.52);
    const g = new THREE.Group();
    const sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -8; sc.right = sc.top = 8; sc.near = 1; sc.far = 60;
    sun.shadow.bias = L.bias; sun.shadow.normalBias = 0.02;
    sun.position.set(14, 11, 4); sun.target.position.set(0, 0, 0); // side light: shows block relief (reference)
    g.add(sun, sun.target, new THREE.HemisphereLight(L.sky, L.ground, L.hemiI));
    return g;
  }, [after]);
  const c = after ? camAfter(f) : camBefore(f);
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...(c.look as V3)); cam.rotateZ(c.roll);
  if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
  return (<><primitive object={scene} dispose={null} /><primitive object={lights} dispose={null} /></>);
};

export const LookLab: React.FC = () => {
  const f = useCurrentFrame();
  const after = variant() === "after";
  return (
    <AbsoluteFill style={{ background: "#8fd0ff" }}>
      <ThreeCanvas width={1080} height={1920} shadows camera={{ fov: 40, near: 0.1, far: 200 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={["#8fd0ff"]} />
        <Inner f={f} after={after} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
