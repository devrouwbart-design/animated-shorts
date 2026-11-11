// Nature lab: our current meadow (shadow tax grass texture + its cartoon trees) vs the shared nature helpers
// (src/shared/nature.ts), same light, camera and stand-in cartoon character. Not a story short.
//   inputProps { variant: "before" | "after" } (default "after")
// Stills: PROPS='{"variant":"before"}' node scripts/stills.mjs NatureLab out/looklab/nb_ 0,40 0.5
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { twoTone, TONE } from "../shadowtax/shade";
import { LIGHTS, LOOK } from "../shadowtax/lights";
import { ctex, rep, grassHD } from "../shadowtax/paint";
import { kitClone, type Kit } from "../shadowtax/build";
import { loadKit } from "../shadowtax/world";
import { grassPatch, meadowMat, natureTree, GRASS } from "../../shared/nature";
import { mixCam, type Cam, type V3 } from "../../shared/camera";

export const NATURELAB_FRAMES = 60;
const after = () => (getInputProps() as { variant?: string }).variant !== "before";
const tone = <M extends THREE.Material>(m: M) => twoTone(m as unknown as THREE.MeshLambertMaterial) as unknown as M;

/** flat stand-in cartoon person (white head, black outline, red tunic, stick legs), 1.5 m, feet at y = 0 */
const personTex = () => ctex("labPerson", 300, 500, (g) => {
  g.lineWidth = 10; g.strokeStyle = "#111"; g.lineCap = "round";
  g.beginPath(); g.moveTo(130, 330); g.lineTo(115, 492); g.moveTo(170, 330); g.lineTo(185, 492); g.stroke();
  g.fillStyle = "#b8283c"; g.beginPath(); g.roundRect(85, 170, 130, 180, 50); g.fill(); g.stroke();
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(150, 100, 85, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#111"; g.beginPath(); g.arc(122, 100, 9, 0, 7); g.arc(178, 100, 9, 0, 7); g.fill();
});

const TREES: [number, number, number, "round" | "pine"][] = [[-4, -9, 7, "round"], [3.5, -13, 9, "pine"], [8, -18, 8, "round"], [-10, -20, 10, "round"], [0.5, -26, 8, "pine"], [14, -28, 11, "round"], [-17, -30, 9, "pine"]];
const OUR_TREES = ["tree_oak", "tree_cone", "tree_default", "tree_fat", "tree-high-round", "tree_cone", "tree_detailed"];

const buildScene = (kit: Kit, isAfter: boolean) => {
  const root = new THREE.Group();
  // ground + far hills
  const groundM = isAfter ? meadowMat(tone) : tone(new THREE.MeshLambertMaterial({ map: rep(grassHD(), 30, 30) }));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1), groundM);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  for (const [x, z, s] of [[-40, -70, 26], [10, -85, 34], [55, -75, 28]] as const) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(s, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), groundM);
    h.scale.y = 0.45; h.position.set(x, -2, z); h.receiveShadow = true; root.add(h);
  }
  // trees
  TREES.forEach(([x, z, h, kind], i) => {
    const t = isAfter ? natureTree({ height: h, kind, seed: i + 1, base: tone }) : kitClone(kit, OUR_TREES[i], h);
    if (!t) return;
    t.position.set(x, 0, z); t.rotation.y = i * 1.3; root.add(t);
  });
  // 3D blades where the lens is (after only): the character stands in them
  if (isAfter) {
    root.add(grassPatch({ center: [0, 1.5], radius: 7, density: 1700, seed: 5, base: tone }));
    // sparse, shorter, wider blades further out so the near patch has no edge
    root.add(grassPatch({ center: [0, -6], radius: 22, density: 160, height: [0.12, 0.28], width: 0.03, edge: 0.3, seed: 9, max: 120000, base: tone }));
  }
  // stand-in character (unlit flat card, faces +z)
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshBasicMaterial({ map: personTex(), transparent: true, alphaTest: 0.5 }));
  p.position.set(0.3, 0.75, 0); root.add(p);
  return root;
};

const CAM_A: Cam = { pos: [0.9, 0.95, 3.6], look: [0.1, 0.8, -1.5], fov: 40, roll: 0 };
const CAM_B: Cam = { pos: [-1.4, 2.6, 6.5], look: [1.0, 1.6, -10], fov: 40, roll: 0 };

const Inner: React.FC<{ kit: Kit; f: number }> = ({ kit, f }) => {
  const { camera } = useThree();
  const { fps } = useVideoConfig();
  const isAfter = after();
  const scene = useMemo(() => buildScene(kit, isAfter), [kit, isAfter]);
  const lights = useMemo(() => {
    const L = LIGHTS.day, K = LOOK.day;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    const g = new THREE.Group(), sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -35; sc.right = sc.top = 35; sc.near = 1; sc.far = 120;
    sun.shadow.bias = L.bias; sun.shadow.normalBias = 0.03;
    sun.position.set(30, 32, -18); sun.target.position.set(0, 0, -8); // side-back light: grass tips and tree tops catch it
    g.add(sun, sun.target, new THREE.HemisphereLight(L.sky, L.ground, L.hemiI));
    return g;
  }, []);
  GRASS.uTime.value = f / fps;
  const c = mixCam(CAM_A, CAM_B, f >= 30 ? 1 : 0);
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...c.pos); cam.lookAt(...(c.look as V3));
  return (<><primitive object={scene} dispose={null} /><primitive object={lights} dispose={null} /></>);
};

export const NatureLab: React.FC = () => {
  const f = useCurrentFrame();
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("naturelab kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  if (!kit) return null;
  return (
    <AbsoluteFill style={{ background: "#8fd0ff" }}>
      <ThreeCanvas width={1080} height={1920} shadows camera={{ fov: 40, near: 0.05, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}>
        <color attach="background" args={["#8fd0ff"]} />
        <fog attach="fog" args={["#b9e4ff", 40, 160]} />
        <Inner kit={kit} f={f} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
