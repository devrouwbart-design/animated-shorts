// The Apollo 13 short as one three.js scene with five sets (only the current shot's set is visible):
//   space: the Apollo stack (service module, command module, docked lunar module), stars, Earth and the Moon (placed per
//          shot in screen terms), the blown-off bay panel and debris
//   cab:   the cramped lunar-module cabin: instrument panel, triangular windows, CO2 meter + oxygen gauge, the ROUND
//          filter holder, the overhead hatch, the duct-taped "mailbox" and the floating hook items
//   mcc:   1970 mission control: tiered console rows, big wall screens, a loudspeaker, the junk table
//   hotel: a hotel room abroad: wallpaper, window, desk, the round-pin wall socket and a flat-blade plug
//   sea:   the Pacific: capsule under three striped parachutes, the yellow raft
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f). Light rig, ink, two-tone
// shading and the card cast come from the bridge/lake shorts.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, setSight } from "./build";
import { ctex, rng, cloudHD, waterNear, waterFar } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, CAB, MCC, HOT, SEA, HOLE, CO2, O2, HOLDER, MAILBOX, HATCH, TABLE, SOCKET, RAFT, SHOTS, ShotDef, Build, FULL, camAt, blown, co2At, o2At,
  alarmAt, protoAt, cabBoxAt, ITEM_AT, capY, SPLASH, plugAt, pushAt, drop, lin, smooth, clamp01, V3,
} from "./story";

export const loadKit = () => Promise.resolve({} as Kit);

// ---------------- painted textures ----------------
const starTex = () => ctex("a13stars", 4096, 2048, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 2048); gr.addColorStop(0, "#0b1038"); gr.addColorStop(0.5, "#141c52"); gr.addColorStop(1, "#0b1038");
  g.fillStyle = gr; g.fillRect(0, 0, 4096, 2048);
  for (let i = 0; i < 60; i++) { // a faint lilac milky band
    const x = r() * 4096, y = 1024 + 380 * Math.sin(x / 650) + (r() - 0.5) * 260;
    g.fillStyle = `rgba(150,130,220,${0.03 + r() * 0.04})`; g.beginPath(); g.ellipse(x, y, 160 + r() * 260, 60 + r() * 110, r(), 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * 4096, y = r() * 2048, s = r() ** 3 * 2.6 + 0.7;
    g.fillStyle = ["#ffffff", "#dfe8ff", "#fff3d0", "#ffd9e8"][Math.floor(r() * 4)]; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "#ffffff"; g.lineCap = "round";
  for (let i = 0; i < 70; i++) { // cartoon twinkles
    const x = r() * 4096, y = r() * 2048, s = 6 + r() * 9; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
  }
});
const earthTex = () => ctex("a13earth", 1024, 512, (g, r) => {
  g.fillStyle = "#2f7fd0"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 14; i++) { // continents: lumpy green/tan blobs
    const cx = r() * 1024, cy = 110 + r() * 300, n = 9, rr = 40 + r() * 70;
    g.fillStyle = r() < 0.7 ? "#5daa4a" : "#c9a86a"; g.beginPath();
    for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2, d = rr * (0.6 + 0.6 * r()); g.lineTo(cx + d * Math.cos(a) * 1.4, cy + d * Math.sin(a)); }
    g.closePath(); g.fill();
  }
  g.fillStyle = "#f4f8ff"; g.fillRect(0, 0, 1024, 34); g.fillRect(0, 478, 1024, 34);
  g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineCap = "round";
  for (let i = 0; i < 40; i++) { // cloud swirls
    const x = r() * 1024, y = 40 + r() * 430, w = 30 + r() * 90; g.lineWidth = 8 + r() * 12;
    g.beginPath(); g.ellipse(x, y, w, w * 0.3, r() * 0.4, r() * 3, r() * 3 + 2.5); g.stroke();
  }
});
const moonTex = () => ctex("a13moon", 1024, 512, (g, r) => {
  g.fillStyle = "#c2beb5"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 9; i++) { g.fillStyle = "rgba(120,116,112,0.55)"; g.beginPath(); g.ellipse(r() * 1024, 120 + r() * 280, 60 + r() * 90, 40 + r() * 60, r(), 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = r() * 512, s = 6 + r() ** 2 * 34;
    g.fillStyle = "rgba(95,92,90,0.5)"; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(235,232,225,0.7)"; g.lineWidth = Math.max(2, s * 0.18); g.beginPath(); g.arc(x - s * 0.1, y - s * 0.1, s, 2.4, 5.6); g.stroke();
  }
});
const foilTex = () => ctex("a13foil", 512, 512, (g, r) => {
  g.fillStyle = "#d9a43a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const x = r() * 512, y = r() * 512, s = 14 + r() * 40;
    g.fillStyle = r() < 0.5 ? "rgba(255,226,130,0.55)" : "rgba(150,96,24,0.45)";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * (r() - 0.5)); g.lineTo(x + s * (r() - 0.3), y + s); g.closePath(); g.fill();
  }
  g.strokeStyle = "rgba(60,36,10,0.6)"; g.lineWidth = 4; for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke(); }
});
const hullTex = (key: string, base: string, nx: number, ny: number, extra?: (g: CanvasRenderingContext2D, r: () => number) => void) => ctex(key, 1024, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(80,90,110,0.08)"; g.fillRect(r() * 1024, r() * 512, 40 + r() * 140, 20 + r() * 60); }
  g.strokeStyle = "rgba(40,44,56,0.55)"; g.lineWidth = 3;
  for (let i = 1; i < nx; i++) { g.beginPath(); g.moveTo((i * 1024) / nx, 0); g.lineTo((i * 1024) / nx, 512); g.stroke(); }
  for (let i = 1; i < ny; i++) { g.beginPath(); g.moveTo(0, (i * 512) / ny); g.lineTo(1024, (i * 512) / ny); g.stroke(); }
  extra?.(g, r);
});
const smTex = () => hullTex("a13sm", "#e3e6ea", 6, 3, (g) => {
  g.fillStyle = "#f6f7f9"; for (const x of [120, 520]) { g.fillRect(x, 60, 150, 390); g.strokeStyle = "rgba(60,70,90,0.35)"; g.lineWidth = 2; for (let y = 70; y < 450; y += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 150, y); g.stroke(); } }
});
const cmTex = () => hullTex("a13cm", "#cdd2d8", 12, 2, (g) => {
  g.fillStyle = "#26304a"; for (const x of [430, 520]) g.fillRect(x, 300, 46, 46);
});
const lmTex = () => hullTex("a13lm", "#a9aeb5", 5, 3, (g) => { g.fillStyle = "#6e737c"; g.fillRect(380, 120, 260, 120); });
const panelTex = () => ctex("a13panel", 1024, 1024, (g, r) => {
  g.fillStyle = "#77808b"; g.fillRect(0, 0, 1024, 1024);
  for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) { // panel blocks
    const x0 = bx * 256 + 10, y0 = by * 256 + 10;
    g.fillStyle = (bx + by) % 2 ? "#6a737e" : "#7f8994"; g.fillRect(x0, y0, 236, 236);
    g.strokeStyle = "#2a2e36"; g.lineWidth = 5; g.strokeRect(x0, y0, 236, 236);
    const kind = Math.floor(r() * 3);
    if (kind === 0) for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) { // switch rows
      const x = x0 + 30 + i * 44, y = y0 + 34 + j * 52;
      g.fillStyle = "#1f232a"; g.fillRect(x - 10, y - 8, 20, 16);
      g.fillStyle = "#e6e8ea"; g.fillRect(x - 3, y - (r() < 0.5 ? 20 : -4), 6, 16);
    }
    else if (kind === 1) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { // small dials
      const x = x0 + 64 + i * 110, y = y0 + 64 + j * 110;
      g.fillStyle = "#f2efe6"; g.beginPath(); g.arc(x, y, 38, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#1f232a"; g.lineWidth = 6; g.stroke();
      const a = -2.2 + r() * 2.8; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 * Math.cos(a), y + 30 * Math.sin(a)); g.stroke();
    }
    else for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { // indicator lamps
      const x = x0 + 40 + i * 52, y = y0 + 50 + j * 64;
      g.fillStyle = ["#ffcf4a", "#7be07b", "#f2f2f2", "#ff9b5a"][Math.floor(r() * 4)]; g.fillRect(x - 16, y - 12, 32, 24);
      g.strokeStyle = "#1f232a"; g.lineWidth = 4; g.strokeRect(x - 16, y - 12, 32, 24);
    }
  }
});
const quiltTex = () => ctex("a13quilt", 512, 512, (g, r) => {
  g.fillStyle = "#a7b0ad"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(70,80,80,0.45)"; g.lineWidth = 4;
  for (let k = 0; k <= 512; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
  for (let i = 0; i < 10; i++) { g.fillStyle = "rgba(240,238,230,0.5)"; g.fillRect(r() * 480, r() * 480, 50, 14); } // velcro patches
});
const dialTex = (key: string, zones: [number, number, string][]) => ctex(key, 512, 512, (g) => {
  g.fillStyle = "#f6f3ea"; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  for (const [u0, u1, c] of zones) { g.strokeStyle = c; g.lineWidth = 70; g.beginPath(); g.arc(256, 256, 170, a0 + (a1 - a0) * u0, a0 + (a1 - a0) * u1); g.stroke(); }
  g.strokeStyle = "#1f232a"; g.lineWidth = 9;
  for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10; g.beginPath(); g.moveTo(256 + 205 * Math.cos(a), 256 + 205 * Math.sin(a)); g.lineTo(256 + 240 * Math.cos(a), 256 + 240 * Math.sin(a)); g.stroke(); }
  g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 246, 0, Math.PI * 2); g.stroke();
});
const crtTex = () => ctex("a13crt", 512, 384, (g, r) => {
  g.fillStyle = "#06321e"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#5dff9a"; g.lineWidth = 5; g.beginPath();
  for (let x = 20; x < 492; x += 8) g.lineTo(x, 250 - 70 * Math.sin(x / 50) - 30 * Math.sin(x / 13)); g.stroke();
  g.fillStyle = "#5dff9a"; for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) if (r() < 0.8) g.fillRect(24 + i * 52, 26 + j * 22, 18 + r() * 22, 8);
});
const bigScreenTex = () => ctex("a13big", 2048, 1024, (g, r) => {
  g.fillStyle = "#0c2b4d"; g.fillRect(0, 0, 2048, 1024);
  g.strokeStyle = "rgba(120,180,255,0.18)"; g.lineWidth = 3;
  for (let x = 0; x < 2048; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (let y = 0; y < 1024; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
  g.fillStyle = "#4a8fd8"; g.beginPath(); g.arc(420, 520, 130, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#6fc06a"; g.beginPath(); g.ellipse(390, 480, 60, 40, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cfcfc8"; g.beginPath(); g.arc(1680, 470, 80, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#ffffff"; g.lineWidth = 9; g.setLineDash([26, 16]); g.beginPath(); // the free-return figure eight
  for (let i = 0; i <= 200; i++) { const t = (i / 200) * Math.PI * 2; g.lineTo(1050 + 760 * Math.sin(t), 500 + 210 * Math.sin(2 * t)); }
  g.stroke(); g.setLineDash([]);
  g.fillStyle = "#ffd84a"; g.beginPath(); g.arc(1050 + 760 * Math.sin(0.7), 500 + 210 * Math.sin(1.4), 18, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) { g.fillStyle = "#7fd1ff"; g.fillRect(100 + i * 470, 900, 120 + r() * 140, 22); }
});
const carpetTex = () => ctex("a13carpet", 512, 512, (g, r) => {
  g.fillStyle = "#5c6878"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(r() * 512, r() * 512, 3, 3); }
});
const wallpaperTex = () => ctex("a13paper", 512, 512, (g) => {
  g.fillStyle = "#ead3ae"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "#dcc095"; g.fillRect(x, 0, 22, 512); }
  g.fillStyle = "rgba(170,120,80,0.35)";
  for (let y = 32; y < 512; y += 96) for (let x = 43; x < 512; x += 64) { g.beginPath(); g.ellipse(x, y, 8, 14, 0, 0, Math.PI * 2); g.fill(); }
});
const skyWinTex = () => ctex("a13skywin", 256, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#5a9be0"); gr.addColorStop(1, "#cfe4f6"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#ffffff"; for (const [x, y, s] of [[60, 70, 30], [90, 60, 36], [125, 72, 26], [190, 150, 22], [215, 142, 28]]) { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#9db3c8"; g.fillRect(0, 210, 256, 46); // far runway / town strip
});
const starWinTex = () => ctex("a13starwin", 256, 256, (g, r) => {
  g.fillStyle = "#0e1546"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(r() * 256, r() * 256, 0.8 + r() * 1.8, 0, Math.PI * 2); g.fill(); }
});
/** the lander window from outside: warm cabin light, panel lamps, and two of the crew peeking out (one per pane).
 *  Canvas x = u (along the lander's y), canvas y = 1 - v (v along the lander's +x, which is screen up in the opening). */
const windowTex = () => ctex("a13window", 1024, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#fff1cf"); gr.addColorStop(1, "#f0b86a"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = ["#ffcf4a", "#7be07b", "#ff9b5a", "#ffffff"][Math.floor(r() * 4)]; g.fillRect(r() * 1024, 380 + r() * 120, 18, 12); }
  g.fillStyle = "rgba(120,80,40,0.25)"; g.fillRect(0, 360, 1024, 152);
  const face = (cx: number, cy: number, hair: string, skin: string, grin: boolean) => {
    g.lineWidth = 12; g.strokeStyle = "#241726";
    g.fillStyle = "#e9ecef"; g.beginPath(); g.ellipse(cx, cy + 150, 95, 70, 0, 0, Math.PI * 2); g.fill(); g.stroke(); // shoulders
    g.fillStyle = skin; g.beginPath(); g.ellipse(cx, cy, 78, 84, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = hair; g.beginPath(); g.ellipse(cx, cy - 34, 80, 54, 0, Math.PI, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#241726"; for (const dx of [-26, 26]) { g.beginPath(); g.ellipse(cx + dx, cy + 6, 9, 13, 0, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = 9; g.beginPath(); if (grin) g.arc(cx, cy + 30, 26, 0.15 * Math.PI, 0.85 * Math.PI); else { g.moveTo(cx - 18, cy + 40); g.lineTo(cx + 18, cy + 38); } g.stroke();
    g.fillStyle = "#ffffff"; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx + 40, cy - 40, 14, 30, -0.6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; // glass glint
  };
  face(745, 300, "#5a3b2a", "#ffe2c2", true);
  face(279, 300, "#c9a46a", "#ecd0b6", false);
  g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(560, 0); g.lineTo(700, 0); g.lineTo(560, 512); g.lineTo(420, 512); g.fill(); // glass sheen
});
const stripeTex = () => ctex("a13chute", 512, 256, (g) => {
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#f4f1ea" : "#ee7a2c"; g.fillRect(i * 32, 0, 32, 256); }
});
const ribTex = (key: string, base: string) => ctex(key, 64, 256, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 64, 256);
  g.fillStyle = "rgba(30,36,46,0.4)"; for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 64, 5);
});
const sockTex = () => ctex("a13sock", 256, 256, (g) => {
  g.fillStyle = "#f3f0e8"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#c0353a"; g.fillRect(0, 10, 256, 18); g.fillStyle = "#2f5fa8"; g.fillRect(0, 40, 256, 14);
});
const canTex = () => ctex("a13can", 256, 256, (g) => {
  g.fillStyle = "#c9ced5"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#3a3e46"; for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) g.fillRect(34 + i * 33, 34 + j * 33, 20, 20); // grille
  g.strokeStyle = "#2a2e36"; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240);
});

// ---------------- water (flat sea; the lake short's shader without the whirlpool) ----------------
type WaterU = Record<string, THREE.IUniform>;
const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.4 * wTime, 0.15 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.8);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;
const makeWater = (shared: WaterU) => {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
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
  m.customProgramCacheKey = () => "a13sea";
  return m;
};

// ---------------- helpers ----------------
const tm = (col: string) => twoTone(new THREE.MeshLambertMaterial({ color: col }));
const tm2 = (col: string) => twoTone(new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
const metal = (col: string) => twoTone(new THREE.MeshPhongMaterial({ color: col, specular: "#9a9a9a", shininess: 50 }), 0.15);
const mapped = (key: string, tex: () => THREE.Texture, col = "#ffffff") => lam(key, () => ({ map: tex(), color: col }));
const unlit = (tex: THREE.Texture, k = 1) => new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(k, k, k) });
const mesh = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, cast = false) => {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m;
};
/** y-axis cylinder turned to lie along +x (top radius at +x) */
const alongX = (g: THREE.BufferGeometry) => g.rotateZ(-Math.PI / 2);
const tube = (pts: V3[], r: number, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), seg, r, 10, false);
const ring = (r0: number, r1: number, h: number, n = 40) => new THREE.LatheGeometry([new THREE.Vector2(r0, -h / 2), new THREE.Vector2(r1, -h / 2), new THREE.Vector2(r1, h / 2), new THREE.Vector2(r0, h / 2), new THREE.Vector2(r0, -h / 2)], n);
const setXY = (o: THREE.Object3D, p: V3) => o.position.set(p[0], p[1], p[2]);

/** the improvised "mailbox": a square canister in a cardboard box, a plastic bag taped on top, grey duct tape bands, a
 *  suit hose out of the side. Parts appear by Build (cardboard slides in, bag swells, tape strips one by one). The open
 *  square end (-z) shows the canister grille. */
const canMat = () => mapped("a13canTex", canTex);
const canister = () => {
  const g = new THREE.Group();
  mesh(g, boxGeo(V(-0.14, -0.14, -0.15), V(0.14, 0.14, 0.15), 0, true), metal("#c3c9d0"));
  for (const z of [-0.152, 0.152]) mesh(g, boxGeo(V(-0.12, -0.12, z - 0.003), V(0.12, 0.12, z + 0.003)), canMat());
  mesh(g, boxGeo(V(-0.145, -0.03, -0.12), V(0.145, 0.03, 0.12)), tm("#4a505a"));
  return g;
};
class Mailbox {
  g = new THREE.Group(); can: THREE.Group; card: THREE.Mesh[] = []; bag: THREE.Mesh; tape: THREE.Mesh[] = []; hose: THREE.Mesh;
  constructor(hoseEnd: V3 = [-0.55, 0.05, 0.1]) {
    this.can = canister(); this.g.add(this.can);
    const cb = tm("#c9a26b");
    const panels: [THREE.Vector3, THREE.Vector3][] = [[V(-0.2, -0.17, -0.16), V(-0.18, 0.17, 0.2)], [V(0.18, -0.17, -0.16), V(0.2, 0.17, 0.2)],
      [V(-0.2, 0.15, -0.16), V(0.2, 0.17, 0.2)], [V(-0.2, -0.17, 0.18), V(0.2, 0.17, 0.2)], [V(-0.2, -0.17, -0.16), V(0.2, -0.15, 0.2)]];
    for (const [a, b] of panels) this.card.push(mesh(this.g, boxGeo(a, b, 0, true), cb));
    const bagM = new THREE.MeshLambertMaterial({ color: "#eaf2f7", transparent: true, opacity: 0.62, depthWrite: false });
    this.bag = mesh(this.g, new THREE.SphereGeometry(1, 24, 14).scale(0.21, 0.09, 0.17).translate(0, 0.2, 0.03), bagM);
    this.bag.renderOrder = 2;
    const tp = tm("#8d939a"), S: [THREE.Vector3, THREE.Vector3, number][] = [
      [V(-0.212, -0.085, -0.165), V(0.212, -0.05, 0.212), 0], [V(-0.212, 0.07, -0.165), V(0.212, 0.105, 0.212), 0],   // bands
      [V(-0.022, 0.14, -0.165), V(0.022, 0.27, 0.212), 0],                                                           // over the bag
      [V(0.2, -0.03, -0.17), V(0.215, 0.03, 0.21), 0.7], [V(0.2, -0.03, -0.17), V(0.215, 0.03, 0.21), -0.7],      // X on the side
    ];
    for (const [a, b, r] of S) { const m = mesh(this.g, boxGeo(a, b), tp); if (r) { m.geometry.translate(-0.2075, 0, -0.02); m.rotation.x = r; m.position.set(0.2075, 0, 0.02); } this.tape.push(m); }
    const hm = mapped("a13hose", () => ribTex("a13hoseT", "#8e9cab"));
    this.hose = mesh(this.g, tube([[-0.19, 0.0, 0.05], [-0.3, 0.04, 0.08], [hoseEnd[0] + 0.1, hoseEnd[1] + 0.02, hoseEnd[2]], hoseEnd], 0.035), hm);
  }
  set(b: Build | null) {
    this.g.visible = !!b;
    if (!b) return;
    this.can.visible = b.can > 0;
    const off = [V(-1, 0, 0), V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), V(0, -1, 0)];
    this.card.forEach((m, i) => { m.visible = b.card > 0.01; m.position.copy(off[i]).multiplyScalar((1 - b.card) * 0.3); });
    this.bag.visible = b.bag > 0.01; this.bag.scale.setScalar(0.4 + 0.6 * b.bag);
    this.tape.forEach((m, i) => { m.visible = b.tape * this.tape.length > i + 0.01; });
    this.hose.visible = b.hose > 0.5;
  }
}

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

/** Earth / Moon per space shot, in screen terms of the shot camera at frame f0: [sx, sy (-1..1), distance, radius, f0] */
type Body = [number, number, number, number, number];
const BODIES: Record<number, { earth?: Body; moon?: Body }> = {
  30: { earth: [0.3, -0.5, 650, 46, 0], moon: [-0.35, 0.62, 780, 30, 0] },
  2: { earth: [0.1, 0.5, 650, 42, 160], moon: [-0.15, 0.55, 760, 36, 270] },
  3: { earth: [-0.2, -0.62, 800, 30, 300] },
  7: { earth: [0.25, -0.55, 700, 48, 450] },
  9: { moon: [0.25, 0.58, 700, 40, 565] },
  17: { earth: [0.3, -0.6, 900, 34, 1030] },
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial; private stars: THREE.Mesh;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: WaterU;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private bodyCache = new Map<string, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private sets: Record<"space" | "cab" | "mcc" | "hotel" | "sea", THREE.Group> = { space: new THREE.Group(), cab: new THREE.Group(), mcc: new THREE.Group(), hotel: new THREE.Group(), sea: new THREE.Group() };
  // space
  private earth!: THREE.Mesh; private moon!: THREE.Mesh; private panel!: THREE.Mesh; private debris: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  // cabin
  private co2Needle!: THREE.Object3D; private o2Needle!: THREE.Object3D; private alarms: THREE.MeshBasicMaterial[] = [];
  private cabBox!: Mailbox; private canister!: THREE.Group; private floaters: Record<string, THREE.Object3D> = {};
  // mission control
  private proto!: Mailbox; private items: Record<string, THREE.Object3D[]> = {};
  // hotel
  private plug = new THREE.Group();
  // sea
  private capsule = new THREE.Group(); private chutes = new THREE.Group(); private raft = new THREE.Group();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root;
    for (const g of Object.values(this.sets)) R.add(g);
    // ---- sky (sea only) + stars (space) + light ----
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
    const st = starTex(); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
    this.stars = new THREE.Mesh(new THREE.SphereGeometry(1150, 64, 32), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, depthWrite: false, fog: false, color: new THREE.Color(0.95, 0.95, 1.0) }));
    this.stars.renderOrder = -1; this.stars.frustumCulled = false; this.stars.layers.set(NOINK);
    R.add(this.stars);
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
      m.position.set(SEA[0] + Math.cos(a) * d, 60 + (i % 4) * 30, SEA[2] + Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); this.sets.sea.add(m);
    }
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    setSight([]);
    this.buildSpace();
    this.buildCab();
    this.buildMcc();
    this.buildHotel();
    this.buildSea();
  }

  // ======================= SPACE =======================
  private buildSpace() {
    const S = this.sets.space, b = new Batch();
    const sm = mapped("a13smT", smTex), cm = mapped("a13cmT", cmTex), lm = mapped("a13lmT", lmTex), foil = mapped("a13foilT", foilTex);
    const dark = tm("#3b3d44"), bay = tm("#4a3c34"), white = tm("#eef0f2");
    // service module: open in the bay-4 sector (faces +z), the panel is its own mesh
    b.add(alongX(new THREE.CylinderGeometry(1.95, 1.95, 7.2, 60, 1, true, Math.PI / 6, (Math.PI * 5) / 3)).translate(5.0, 0, 0), sm);
    b.add(alongX(new THREE.CylinderGeometry(1.75, 1.75, 7.0, 40, 1, false)).translate(5.0, 0, 0), bay);
    for (const x of [1.4, 8.6]) b.add(new THREE.CircleGeometry(1.95, 60).rotateY(x < 5 ? -Math.PI / 2 : Math.PI / 2).translate(x, 0, 0), white);
    for (const [x, y] of [[3.9, 0.55], [5.4, -0.5]]) b.add(new THREE.SphereGeometry(0.62, 20, 14).translate(x, y, 1.1), tm("#d8d2c4")); // oxygen tanks in the bay
    b.add(alongX(new THREE.CylinderGeometry(1.25, 0.55, 2.4, 32, 1, true)).translate(9.8, 0, 0), dark); // engine bell
    b.add(alongX(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 24)).translate(8.75, 0, 0), dark);
    for (let k = 0; k < 4; k++) { // RCS quads
      const a = Math.PI / 4 + (k * Math.PI) / 2, y = 2.05 * Math.sin(a), z = 2.05 * Math.cos(a);
      b.add(boxGeo(V(2.3, y - 0.25, z - 0.25), V(2.9, y + 0.25, z + 0.25)), tm("#d9dcdf"));
      for (const dx of [-0.4, 0.4]) b.add(alongX(new THREE.CylinderGeometry(0.07, 0.04, 0.3, 10)).translate(2.6 + dx, y * 1.06, z * 1.06), dark);
    }
    b.add(boxGeo(V(8.0, -3.6, -0.08), V(8.16, -1.9, 0.08)), white); // high-gain antenna boom + dishes
    for (const [dy, dz] of [[-0.45, -0.45], [-0.45, 0.45], [0.45, -0.45], [0.45, 0.45]]) b.add(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, 0.9).rotateX(Math.PI).translate(8.08, -3.8 + dy * 0.6, dz), white);
    // command module cone, heat shield, docking tunnel
    b.add(new THREE.CylinderGeometry(0.42, 1.95, 3.4, 48).rotateZ(Math.PI / 2).translate(-0.3, 0, 0), cm);
    b.add(alongX(new THREE.CylinderGeometry(1.99, 1.99, 0.22, 48)).translate(1.32, 0, 0), tm("#6a5444"));
    b.add(alongX(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 24)).translate(-2.3, 0, 0), tm("#9aa0a8"));
    // lunar module: ascent stage (angular grey cabin with triangle windows facing +z), gold descent stage, legs
    b.add(boxGeo(V(-5.0, -1.25, -1.35), V(-2.7, 1.25, 1.35), 0, true), lm);
    b.add(boxGeo(V(-4.6, -1.5, -1.0), V(-3.0, 1.5, 1.0), 0, true), lm);
    b.add(boxGeo(V(-4.4, -0.9, 1.35), V(-3.1, 0.9, 1.55), 0, true), tm("#8e939b"));
    for (const s of [-1, 1]) b.add(alongX(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 20)).translate(-3.9, s * 1.55, -0.6), tm("#b8bcc2"));
    b.add(new THREE.CylinderGeometry(2.15, 2.15, 1.9, 8).rotateZ(Math.PI / 2).rotateX(Math.PI / 8).translate(-5.95, 0, 0), foil);
    b.add(alongX(new THREE.CylinderGeometry(0.35, 0.75, 0.7, 20, 1, true)).translate(-7.25, 0, 0), tm2("#3b3d44"));
    for (let k = 0; k < 4; k++) { // folded legs: strut from the stage corner forward to a footpad
      const a = Math.PI / 4 + (k * Math.PI) / 2, cy = Math.sin(a), cz = Math.cos(a);
      const p0 = V(-6.4, 2.0 * cy, 2.0 * cz), p1 = V(-4.4, 2.75 * cy, 2.75 * cz);
      const d = p1.clone().sub(p0), geo = new THREE.CylinderGeometry(0.09, 0.09, d.length(), 8);
      geo.applyMatrix4(new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
      b.add(geo, tm("#c9a24a"));
      b.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16).rotateZ(Math.PI / 2).translate(-4.35, 2.8 * cy, 2.8 * cz), foil);
    }
    b.build(S, true);
    // the two triangle windows: warm lit cabin behind the glass with the crew peeking out (unlit + a little HDR so it
    // glows); one picture spans both panes: u runs along y (screen across once the lander is stood up), v along x (up)
    const wt = windowTex(); wt.colorSpace = THREE.SRGBColorSpace; wt.anisotropy = 8;
    const wm = new THREE.MeshBasicMaterial({ map: wt, color: new THREE.Color(1.25, 1.2, 1.1), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const pts = [V(-3.3, s * 0.15, 1.56), V(-4.2, s * 0.15, 1.56), V(-3.5, s * 0.85, 1.56)];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      g.setAttribute("uv", new THREE.Float32BufferAttribute(pts.flatMap((p) => [(p.y + 0.85) / 1.7, (p.x + 4.2) / 0.9]), 2));
      const m = mesh(S, g, wm); m.layers.set(NOINK);
    }
    for (const s of [-1, 1]) for (const [a, c] of [[V(-3.3, s * 0.15, 1.565), V(-4.2, s * 0.15, 1.565)], [V(-4.2, s * 0.15, 1.565), V(-3.5, s * 0.85, 1.565)], [V(-3.5, s * 0.85, 1.565), V(-3.3, s * 0.15, 1.565)]] as const) {
      const d = c.clone().sub(a), g2 = new THREE.CylinderGeometry(0.035, 0.035, d.length(), 8);
      g2.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
      mesh(S, g2, tm("#2e3238"));
    }
    // the bay-4 panel (blows off)
    this.panel = mesh(S, alongX(new THREE.CylinderGeometry(1.97, 1.97, 7.0, 16, 1, true, -Math.PI / 6, Math.PI / 3)), sm, true);
    (this.panel.material as THREE.Material).side = THREE.DoubleSide;
    this.panel.position.set(5.0, 0, 0);
    const r = rng(13);
    for (let i = 0; i < 22; i++) {
      const s = 0.12 + r() * 0.35, m = mesh(S, i % 3 ? boxGeo(V(-s, -s * 0.15, -s * 0.6), V(s, s * 0.15, s * 0.6)) : new THREE.TetrahedronGeometry(s), i % 2 ? foil : sm, true);
      this.debris.push({ m, v: V((r() - 0.5) * 2.4, (r() - 0.4) * 2.2, 1.6 + r() * 3.2), w: V(r() * 4, r() * 4, r() * 4) });
    }
    const et = earthTex(), mt = moonTex();
    for (const t of [et, mt]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
    this.earth = mesh(S, new THREE.SphereGeometry(1, 64, 32), twoTone(new THREE.MeshLambertMaterial({ map: et, fog: false })));
    this.moon = mesh(S, new THREE.SphereGeometry(1, 64, 32), twoTone(new THREE.MeshLambertMaterial({ map: mt, fog: false })));
    this.earth.rotation.set(0.3, 2.2, 0.2); this.moon.rotation.set(0.1, 1.0, 0);
  }

  // ======================= CABIN =======================
  private buildCab() {
    const C = this.sets.cab, b = new Batch();
    C.position.set(...CAB);
    const quilt = mapped("a13quiltT", quiltTex), panel = mapped("a13panelT", panelTex), floor = tm("#6c7178"), dark = tm("#2e3238");
    b.add(boxGeo(V(-1.5, -0.1, -1.4), V(1.5, 0, 1.1)), floor);
    b.add(boxGeo(V(-1.5, 0, 1.1), V(1.5, 2.7, 1.2)), quilt);
    b.add(boxGeo(V(-1.25, 0.95, 1.06), V(1.25, 2.15, 1.1), 0), panel);                 // main instrument panel
    b.add(boxGeo(V(-1.3, 0.75, 0.85), V(1.3, 0.95, 1.1)), tm("#5e666f"));             // sloped shelf
    for (const s of [-1, 1]) b.add(boxGeo(V(s > 0 ? 1.5 : -1.6, 0, -1.4), V(s > 0 ? 1.6 : -1.5, 2.7, 1.2), 1.2), quilt);
    for (const [x0, x1, z0, z1] of [[-1.5, 1.5, -1.4, -0.3], [-1.5, 1.5, 0.6, 1.2], [-1.5, -0.45, -0.3, 0.6], [0.45, 1.5, -0.3, 0.6]])
      b.add(boxGeo(V(x0, 2.6, z0), V(x1, 2.75, z1), 1.2, true), quilt);                // ceiling round the hatch
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 24, 1, true).translate(HATCH[0], HATCH[1] + 0.6, HATCH[2]), new THREE.MeshLambertMaterial({ color: "#2c3038", side: THREE.BackSide }));
    b.add(ring(0.42, 0.5, 0.08).translate(HATCH[0], HATCH[1] - 0.02, HATCH[2]), metal("#a5abb3"));
    // triangle windows high on the back wall, with stars
    const sw = new THREE.MeshBasicMaterial({ map: starWinTex(), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const a = V(s * 1.25, 2.25, 1.055), c = V(s * 0.55, 2.25, 1.055), d = V(s * 1.25, 1.7, 1.055);
      const geo = new THREE.BufferGeometry().setFromPoints([a, c, d]); geo.setIndex(s > 0 ? [0, 1, 2] : [0, 2, 1]);
      geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0], 2)); geo.computeVertexNormals();
      b.add(geo, sw);
      for (const [p, q] of [[a, c], [c, d], [d, a]]) { const dd = q.clone().sub(p), g2 = new THREE.CylinderGeometry(0.025, 0.025, dd.length(), 6); g2.applyMatrix4(new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dd.normalize()), V(1, 1, 1))); b.add(g2, dark); }
    }
    // stowage and clutter
    b.add(boxGeo(V(1.05, 0.0, 0.35), V(1.5, 0.55, 1.05), 0, true), tm("#e6e2d6"));
    b.add(boxGeo(V(-1.5, 1.75, 0.55), V(-1.15, 2.2, 1.05), 0, true), tm("#e6e2d6"));
    b.add(boxGeo(V(1.2, 1.3, -0.9), V(1.5, 1.55, -0.2), 0, true), tm("#cfc9b8"));
    b.add(tube([[1.48, 1.9, -1.2], [1.3, 1.7, -0.8], [1.45, 1.4, -0.4], [1.3, 1.1, 0.2], [1.46, 0.8, 0.6]], 0.03), mapped("a13hose", () => ribTex("a13hoseT", "#8e9cab")));
    b.build(C, false);
    // gauges: bezel + unlit face + needle (pivot at the centre), faces -z
    const gauge = (p: V3, key: string, zones: [number, number, string][]) => {
      const g = new THREE.Group(); g.position.set(p[0], p[1], p[2] - 0.02);
      mesh(g, ring(0.13, 0.165, 0.05).rotateX(Math.PI / 2), metal("#2f333a"));
      mesh(g, new THREE.CircleGeometry(0.135, 48).rotateY(Math.PI).translate(0, 0, 0.005), unlit(dialTex(key, zones), 0.95));
      const pivot = new THREE.Group(); pivot.position.set(0, 0, -0.012); g.add(pivot);
      mesh(pivot, boxGeo(V(-0.006, -0.01, -0.006), V(0.006, 0.115, 0.006)), tm("#c0353a"));
      mesh(g, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16).rotateX(Math.PI / 2).translate(0, 0, -0.015), tm("#1f232a"));
      C.add(g); return pivot;
    };
    this.co2Needle = gauge(CO2, "a13dialCO2", [[0, 0.45, "#5cc05c"], [0.45, 0.7, "#f2c230"], [0.7, 1, "#e0443a"]]);
    this.o2Needle = gauge(O2, "a13dialO2", [[0, 1, "#5cc05c"]]);
    // master alarm lamps
    for (const x of [-0.18, 0.18]) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.05, 0.05) });
      const l = mesh(C, boxGeo(V(x - 0.08, 2.2, 1.03), V(x + 0.08, 2.3, 1.06)), m); l.layers.set(NOINK); this.alarms.push(m);
    }
    // the ROUND filter holder on the left wall (faces +x)
    const h = new THREE.Group(); h.position.set(...HOLDER);
    mesh(h, ring(0.085, 0.12, 0.06).rotateZ(Math.PI / 2), metal("#9aa1aa"));
    mesh(h, new THREE.CircleGeometry(0.085, 32).rotateY(Math.PI / 2).translate(-0.01, 0, 0), new THREE.MeshBasicMaterial({ color: "#121318" }));
    mesh(h, boxGeo(V(-0.04, -0.26, -0.26), V(-0.02, 0.26, 0.26)), tm("#d3d8de"));
    C.add(h);
    // the finished mailbox (hosed to the holder) and the spare square canister in shot 14
    this.cabBox = new Mailbox([HOLDER[0] - MAILBOX[0] + 0.06, HOLDER[1] - MAILBOX[1], HOLDER[2] - MAILBOX[2]]);
    this.cabBox.g.position.set(...MAILBOX); C.add(this.cabBox.g);
    this.canister = canister(); C.add(this.canister);
    // hook floaters: tape roll, plastic bag, sock
    this.floaters.tape = this.tapeRoll(); this.floaters.bag = this.bag(); this.floaters.sock = this.sock();
    for (const o of Object.values(this.floaters)) C.add(o);
  }
  private tapeRoll() { const g = new THREE.Group(); mesh(g, ring(0.045, 0.075, 0.05), metal("#a3a8ae")); mesh(g, ring(0.038, 0.045, 0.05), tm("#c9a26b")); return g; }
  private bag() {
    const g = new THREE.Group();
    const m = mesh(g, new THREE.SphereGeometry(0.15, 20, 12).scale(1.2, 0.35, 1), new THREE.MeshLambertMaterial({ color: "#e4eef4", transparent: true, opacity: 0.6, depthWrite: false }));
    m.renderOrder = 2; mesh(g, ring(0.03, 0.045, 0.02).translate(0.17, 0, 0), tm("#d8dde2")); return g;
  }
  private sock() {
    const g = new THREE.Group(), mat = mapped("a13sockT", sockTex);
    mesh(g, tube([[0, 0.17, 0], [0, 0.02, 0], [0.02, -0.04, 0], [0.12, -0.06, 0]], 0.04, 24), mat);
    mesh(g, new THREE.SphereGeometry(0.04, 12, 8).scale(1, 0.85, 1).translate(0.12, -0.06, 0), mat);
    return g;
  }
  private hoseCoil() { return (() => { const g = new THREE.Group(); const pts: V3[] = []; for (let i = 0; i <= 30; i++) { const a = i * 0.5; pts.push([0.16 * Math.cos(a), 0.02 * i * 0.08, 0.16 * Math.sin(a)]); } mesh(g, tube(pts, 0.03, 80), mapped("a13hose", () => ribTex("a13hoseT", "#8e9cab"))); return g; })(); }

  // ======================= MISSION CONTROL =======================
  private buildMcc() {
    const M = this.sets.mcc, b = new Batch();
    M.position.set(...MCC);
    const carpet = mapped("a13carpetT", carpetTex), wall = tm("#4a5363"), cons = tm("#8f9c92"), consD = tm("#6b776f"), crt = unlit(crtTex(), 1.25);
    b.add(boxGeo(V(-14, -0.1, -12), V(14, 0, 11.5), 4), carpet);
    b.add(boxGeo(V(-14, 0, 11.5), V(14, 9, 11.8)), wall);
    b.add(boxGeo(V(-14, 0, -12.3), V(14, 9, -12)), wall);
    for (const s of [-1, 1]) b.add(boxGeo(V(s > 0 ? 14 : -14.3, 0, -12), V(s > 0 ? 14.3 : -14, 9, 11.5)), wall);
    b.add(boxGeo(V(-14, 8.6, -12), V(14, 9, 11.5), 0, true), tm("#d6d6cf"));
    for (let z = -10; z < 11; z += 4) b.add(boxGeo(V(-12, 8.55, z - 0.3), V(12, 8.6, z + 0.3)), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.5) }));
    // big screens on the +z wall
    b.add(new THREE.PlaneGeometry(10, 4.6).rotateY(Math.PI).translate(0, 4.9, 11.45), unlit(bigScreenTex(), 1.15));
    for (const s of [-1, 1]) b.add(new THREE.PlaneGeometry(4.6, 3).rotateY(Math.PI).translate(s * 8.4, 5.0, 11.45), unlit(crtTex(), 1.1));
    // tiered console rows (consoles face -z toward the seated controllers; the backs face the screens' side)
    [2.0, -1.6, -5.2, -8.8].forEach((zc, k) => {
      const yb = 0.38 * k;
      if (k) b.add(boxGeo(V(-12, 0, zc - 2.2), V(12, yb, zc + 1.4)), carpet);
      for (let x = -9; x < 9; x += 1.5) {
        b.add(boxGeo(V(x + 0.02, yb, zc - 0.4), V(x + 1.48, yb + 0.66, zc + 0.4), 0, true), cons);
        b.add(boxGeo(V(x + 0.02, yb + 0.66, zc - 0.05), V(x + 1.48, yb + 0.98, zc + 0.42), 0, true), consD);
        b.add(new THREE.PlaneGeometry(0.56, 0.28).rotateY(Math.PI).rotateX(-0.25).translate(x + 0.75, yb + 0.83, zc - 0.07), crt);
        b.add(boxGeo(V(x + 0.1, yb + 0.97, zc + 0.0), V(x + 1.4, yb + 0.995, zc + 0.36)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.5, 0.95) })); // glow strip
        for (let i = 0; i < 3; i++) b.add(boxGeo(V(x + 0.2 + i * 0.45, yb + 0.2, zc + 0.4), V(x + 0.5 + i * 0.45, yb + 0.5, zc + 0.42)), tm("#76827a")); // back vents
      }
    });
    // loudspeaker over the front row
    b.add(boxGeo(V(-0.25, 2.75, 1.45), V(0.45, 3.2, 1.75), 0, true), tm("#2f343c"));
    b.add(new THREE.CylinderGeometry(0.015, 0.015, 5.5, 6).translate(0.1, 5.9, 1.6), tm("#2f343c"));
    // the junk table + chairs, coffee cups
    const [tx, ty, tz] = TABLE, top = tm("#9aa0a6");
    b.add(boxGeo(V(tx - 1.2, ty - 0.05, tz - 0.6), V(tx + 1.2, ty, tz + 0.6), 0, true), top);
    for (const [dx, dz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) b.add(boxGeo(V(tx + dx - 0.04, 0, tz + dz - 0.04), V(tx + dx + 0.04, ty - 0.05, tz + dz + 0.04)), tm("#4a4f57"));
    for (const [dx, dz] of [[-0.95, 0.35], [1.0, -0.4]]) b.add(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 14).translate(tx + dx, ty + 0.05, tz + dz), tm("#f2efe6"));
    b.add(boxGeo(V(tx + 0.7, ty, tz + 0.1), V(tx + 1.0, ty + 0.01, tz + 0.5)), tm("#f6f3ea")); // papers
    b.build(M, false);
    // items that drop onto the table + the prototype
    this.items.can = [canister()];
    this.items.bag = [this.bag(), this.bag()];
    this.items.card = [0, 1].map(() => { const g = new THREE.Group(); mesh(g, boxGeo(V(-0.2, 0, -0.15), V(0.2, 0.012, 0.15), 0, true), tm("#c9a26b")); return g; });
    this.items.hose = [this.hoseCoil(), this.hoseCoil()];
    this.items.sock = [this.sock()];
    this.items.tape = [this.tapeRoll(), this.tapeRoll(), this.tapeRoll()];
    for (const l of Object.values(this.items)) for (const o of l) M.add(o);
    this.proto = new Mailbox([-0.5, -0.15, 0.25]); M.add(this.proto.g);
    // CAPCOM's clipboard
    const clip = new THREE.Group(); mesh(clip, boxGeo(V(-0.11, -0.15, -0.006), V(0.11, 0.15, 0.006), 0, true), tm("#8a5a34")); mesh(clip, boxGeo(V(-0.095, -0.13, -0.01), V(0.095, 0.12, -0.006)), tm("#f6f3ea"));
    clip.position.set(-3.38, 1.12, 2.93); clip.rotation.x = -0.5; this.items.clip = [clip]; M.add(clip);
  }

  // ======================= HOTEL =======================
  private buildHotel() {
    const H = this.sets.hotel, b = new Batch();
    H.position.set(...HOT);
    const paper = mapped("a13paperT", wallpaperTex), wood = tm("#a8724a"), white = tm("#f4f1ea");
    b.add(boxGeo(V(-4, -0.1, -4), V(4, 0, 2.1), 1.5), tm("#8a5a3c"));
    b.add(boxGeo(V(-4, 0, 2.0), V(4, 3, 2.1), 1.2), paper);
    b.add(boxGeo(V(-2.3, 0, -4), V(-2.2, 3, 2.0), 1.2), paper);
    b.add(boxGeo(V(-4, 0, 1.98), V(4, 0.12, 2.0)), white); // skirting
    // window with sky, frame, curtains
    b.add(new THREE.PlaneGeometry(1.3, 1.2).rotateY(Math.PI).translate(-0.95, 1.7, 1.985), unlit(skyWinTex(), 1.05));
    for (const [x0, y0, x1, y1] of [[-1.65, 1.06, -0.25, 1.12], [-1.65, 2.28, -0.25, 2.34], [-1.65, 1.06, -1.59, 2.34], [-0.31, 1.06, -0.25, 2.34], [-0.98, 1.06, -0.92, 2.34]])
      b.add(boxGeo(V(x0, y0, 1.95), V(x1, y1, 1.99)), white);
    for (const x of [-1.95, -0.05]) b.add(boxGeo(V(x - 0.2, 0.9, 1.88), V(x + 0.2, 2.55, 1.96), 0, true), tm("#b8453c"));
    // desk + lamp + phone
    b.add(boxGeo(V(0.25, 0.7, 1.4), V(1.9, 0.76, 1.97), 0, true), wood);
    for (const [x, z] of [[0.3, 1.45], [1.85, 1.45], [0.3, 1.92], [1.85, 1.92]]) b.add(boxGeo(V(x - 0.03, 0, z - 0.03), V(x + 0.03, 0.7, z + 0.03)), tm("#6a4430"));
    b.add(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 16).translate(1.6, 0.78, 1.75), tm("#d9b44a"));
    b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8).translate(1.6, 0.98, 1.75), tm("#d9b44a"));
    b.add(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 20, 1, true).translate(1.6, 1.22, 1.75), tm("#f2e3c0"));
    b.add(boxGeo(V(0.38, 0.76, 1.55), V(0.46, 0.77, 1.7)), tm("#1f232a"));
    // the suitcase by the door
    b.add(boxGeo(V(-1.6, 0.05, 0.6), V(-1.1, 0.75, 0.85), 0, true), tm("#3f6fb5"));
    b.add(boxGeo(V(-1.42, 0.75, 0.7), V(-1.28, 0.82, 0.75)), tm("#1f232a"));
    for (const x of [-1.55, -1.15]) b.add(new THREE.SphereGeometry(0.04, 10, 8).translate(x, 0.04, 0.72), tm("#1f232a"));
    // the round-pin wall socket
    const [sx, sy, sz] = SOCKET;
    b.add(boxGeo(V(sx - 0.07, sy - 0.07, sz - 0.012), V(sx + 0.07, sy + 0.07, sz + 0.005), 0, true), white);
    b.add(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 32).rotateX(Math.PI / 2).translate(sx, sy, sz - 0.008), tm("#e2ded3"));
    for (const dx of [-0.0095, 0.0095]) b.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12).rotateX(Math.PI / 2).translate(sx + dx, sy, sz - 0.0145), new THREE.MeshBasicMaterial({ color: "#14151a" }));
    b.build(H, false);
    // the flat-blade plug + its cable back to the phone (moves with the plug)
    const p = this.plug;
    mesh(p, boxGeo(V(-0.016, -0.019, -0.03), V(0.016, 0.019, 0), 0, true), tm("#f2efe6"));
    for (const dx of [-0.0075, 0.0075]) mesh(p, boxGeo(V(dx - 0.0016, -0.0045, 0), V(dx + 0.0016, 0.0045, 0.02)), metal("#d8c070"));
    mesh(p, tube([[0, 0, -0.03], [0, -0.01, -0.09], [-0.05, -0.12, -0.18], [-0.25, -0.19, -0.3]], 0.0045, 30), tm("#f2efe6"));
    H.add(p);
  }

  // ======================= SEA =======================
  private buildSea() {
    const W = this.sets.sea;
    const water = new THREE.Mesh(new THREE.CircleGeometry(700, 96).rotateX(-Math.PI / 2), makeWater(this.WU));
    water.position.set(...SEA); water.receiveShadow = true; W.add(water);
    // capsule: cone apex up, heat shield, recovery loop
    const c = this.capsule;
    mesh(c, new THREE.CylinderGeometry(0.42, 1.95, 3.4, 48), mapped("a13cmT", cmTex), true).position.y = 1.7 - 0.6;
    mesh(c, new THREE.CylinderGeometry(1.99, 1.9, 0.3, 48).translate(0, -0.6, 0), tm("#6a5444"), true);
    mesh(c, new THREE.TorusGeometry(0.25, 0.04, 8, 20).translate(0, 2.95, 0), tm("#c9ccd2"));
    W.add(c);
    // three main parachutes, orange and white gores, lines to the capsule apex
    const chuteM = lam("a13chuteT", () => ({ map: stripeTex(), side: THREE.DoubleSide }));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4, g = new THREE.Group();
      g.position.set(3.4 * Math.cos(a), 0, 3.4 * Math.sin(a)); g.rotation.set(0.25 * Math.sin(a), 0, -0.25 * Math.cos(a));
      mesh(g, new THREE.SphereGeometry(4.0, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), chuteM, true);
      this.chutes.add(g);
      for (let i = 0; i < 8; i++) {
        const b = (i / 8) * Math.PI * 2, rim = V(3.4 * Math.cos(a) + 3.75 * Math.cos(b), 1.0, 3.4 * Math.sin(a) + 3.75 * Math.sin(b)), apex = V(0, -13.5, 0);
        const d = rim.clone().sub(apex), geo = new THREE.CylinderGeometry(0.02, 0.02, d.length(), 4);
        geo.applyMatrix4(new THREE.Matrix4().compose(rim.clone().add(apex).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1)));
        mesh(this.chutes, geo, tm("#f4f1ea"));
      }
    }
    W.add(this.chutes);
    // yellow raft beside the capsule
    const r = this.raft;
    mesh(r, new THREE.TorusGeometry(1.15, 0.24, 12, 40).rotateX(Math.PI / 2), tm("#f2c230"), true);
    mesh(r, new THREE.CircleGeometry(1.1, 32).rotateX(-Math.PI / 2).translate(0, 0.06, 0), tm("#e8892c"));
    r.position.set(SEA[0] + RAFT[0], RAFT[1], SEA[2] + RAFT[2]); W.add(r);
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
    const az = THREE.MathUtils.degToRad(s.sunAz ?? (s.set === "space" ? 110 : L.az)), el = THREE.MathUtils.degToRad(s.sunEl ?? (s.set === "space" ? 30 : L.el));
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  /** a body placed in screen terms of the shot camera at frame f0 */
  private bodyAt(id: number, key: string, b: Body) {
    const k = `${id}|${key}`;
    let v = this.bodyCache.get(k);
    if (v) return v;
    const c = camAt(id, b[4]), cam = new THREE.PerspectiveCamera(c.fov, 1080 / 1920, 0.1, 2000);
    cam.position.set(...c.pos); cam.lookAt(...c.look); cam.rotateZ(c.roll); cam.updateMatrixWorld();
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0), up = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 1), fw = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 2).negate();
    const tv = Math.tan((c.fov * Math.PI) / 360), th = tv * (1080 / 1920);
    v = cam.position.clone().addScaledVector(fw, b[2]).addScaledVector(right, b[0] * b[2] * th).addScaledVector(up, b[1] * b[2] * tv);
    this.bodyCache.set(k, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    const indoor = s.set === "cab" || s.set === "hotel" || s.set === "mcc";
    cam.fov = c.fov; cam.near = indoor ? 0.03 : 0.2; cam.far = 1600; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    for (const [k, g] of Object.entries(this.sets)) g.visible = k === s.set;
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, indoor ? 3 : 12, 120);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    const al = alarmAt(id, f);
    const lit: V3 = al ? [L.lit[0] * 1.15, L.lit[1] * 0.42, L.lit[2] * 0.4] : s.set === "space" ? [1.7, 1.62, 1.5] : [...L.lit];
    TONE.uLitCol.value.set(...lit);
    if (s.set === "space") { TONE.uShadeCol.value.set(0.17, 0.18, 0.3); TONE.uShadeLift.value.set(0.02, 0.03, 0.08); }
    else { TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift); }
    if (al) TONE.uShadeCol.value.set(0.3, 0.12, 0.16);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); if (al) CHAR.uCharTint.value.set(1.15, 0.55, 0.52);
    CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, stars, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position); this.stars.position.copy(cam.position);
    this.sky.visible = s.set === "sea"; this.stars.visible = s.set === "space";
    untone(L.fog, this.fog.color);
    this.fog.near = s.set === "sea" ? L.fogNear * 2 : 1e5; this.fog.far = s.set === "sea" ? L.fogFar * 2.2 : 2e5;
    scene.fog = this.fog;
    scene.background = s.set === "space" ? new THREE.Color("#0b1038") : s.set === "sea" ? null : new THREE.Color(0.05, 0.05, 0.06);
    const showSun = s.light === "golden" && s.set === "sea";
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
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;

    if (s.set === "space") this.poseSpace(id, f, t);
    if (s.set === "cab") this.poseCab(id, f, t);
    if (s.set === "mcc") this.poseMcc(id, f, t);
    if (s.set === "hotel") this.plug.position.set(SOCKET[0], SOCKET[1], SOCKET[2] - 0.004 - plugAt(id, f));
    if (s.set === "sea") this.poseSea(id, f, t);

    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const stg = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of stg.places) {
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
    for (const ef of fused) ef.bind();
    return focus;
  }

  private poseSpace(id: number, f: number, t: number) {
    const bl = blown(id, f), dt = Math.max(0, (f - 292) / FPS);
    // the panel: in place, then tumbling away toward +z
    this.panel.visible = !bl || dt < 30;
    this.panel.position.set(5.0 + 0.2 * dt, 0.35 * dt, 2.1 * dt); this.panel.rotation.set(0.5 * dt, 0.25 * dt, 0.15 * dt);
    if (!bl) { this.panel.position.set(5.0, 0, 0); this.panel.rotation.set(0, 0, 0); }
    for (const d of this.debris) {
      d.m.visible = bl;
      if (!bl) continue;
      d.m.position.set(HOLE[0] + d.v.x * dt, HOLE[1] + d.v.y * dt, HOLE[2] + 0.2 + d.v.z * dt);
      d.m.rotation.set(d.w.x * dt, d.w.y * dt, d.w.z * dt);
    }
    const B = BODIES[id] ?? {};
    this.earth.visible = !!B.earth; this.moon.visible = !!B.moon;
    if (B.earth) { this.earth.position.copy(this.bodyAt(id, "earth", B.earth)); this.earth.scale.setScalar(B.earth[3]); }
    if (B.moon) { this.moon.position.copy(this.bodyAt(id, "moon", B.moon)); this.moon.scale.setScalar(B.moon[3]); }
    void t;
  }

  private poseCab(id: number, f: number, t: number) {
    // the dial arc runs 0.8 pi .. 2.2 pi (canvas angle, clockwise on screen); seen from -z the needle needs theta + pi/2
    const ang = (u: number) => Math.PI * (0.8 + 1.4 * u) + Math.PI / 2;
    this.co2Needle.rotation.z = ang(co2At(id, f));
    this.o2Needle.rotation.z = ang(o2At(id, f));
    const al = alarmAt(id, f);
    for (const m of this.alarms) m.color.setRGB(al ? 4.5 : 0.35, al ? 0.3 : 0.05, al ? 0.2 : 0.05);
    this.cabBox.set(cabBoxAt(id, f));
    // spare square canister: held up (818-888), turned square-on (868-878), pushed at the round holder (892-930)
    const cv = id === 14;
    this.canister.visible = cv;
    if (cv) {
      const turn = smooth((f - 866) / 12), u = pushAt(id, f), m = smooth((f - 884) / 14);
      const zo = lin([[884, 0.45], [905, 0.4], [913, 0.38], [915, 0.2], [919, 0.28], [924, 0.2], [930, 0.24]], f);
      const held: V3 = [0.3, 1.02 + 0.015 * Math.sin(t * 2), -0.55], wall: V3 = [HOLDER[0] + 0.19 + 0.02 * u, HOLDER[1], HOLDER[2] + zo];
      const p = held.map((v, i) => v + (wall[i] - v) * m) as V3;
      setXY(this.canister, p);
      this.canister.rotation.set(0.35 * (1 - turn) * (1 - m), -0.7 * (1 - turn) + (Math.PI / 2) * m, 0.15 * (1 - turn) * (1 - m));
    }
    // hook floaters drifting past the lens on their words (tape 68, bag 88, sock 115)
    const fl = (o: THREE.Object3D, f0: number, a: V3, b: V3, spin: number) => {
      const u = (f - f0) / 26;
      o.visible = id === 1 && u > -0.05 && u < 2.2;
      if (!o.visible) return;
      const k = 1 - (1 - clamp01(u)) ** 2 + 0.18 * Math.max(0, u - 1);
      setXY(o, a.map((v, i) => v + (b[i] - v) * k) as V3);
      o.rotation.set(spin * t, spin * 0.7 * t + 1, 0.4);
    };
    fl(this.floaters.tape, 58, [-1.4, 1.7, -1.0], [-0.62, 1.42, -1.45], 1.6);
    fl(this.floaters.bag, 80, [0.6, 1.9, -0.9], [-0.15, 1.6, -1.25], 0.8);
    fl(this.floaters.sock, 104, [-1.2, 0.9, -1.0], [-0.45, 1.12, -1.55], 1.2);
  }

  private poseMcc(id: number, f: number, _t: number) {
    const [tx, ty, tz] = TABLE, show = id >= 20 && id <= 21;
    // resting spots on the table (local mcc coords); in shot 21 they slide toward the prototype as it is built
    const spot = (k: string, i: number): V3 => {
      const S: Record<string, V3[]> = {
        can: [[tx, ty + 0.13, tz]], bag: [[tx - 0.75, ty + 0.05, tz + 0.15], [tx - 0.5, ty + 0.05, tz - 0.25]],
        card: [[tx + 0.6, ty, tz + 0.2], [tx + 0.62, ty + 0.013, tz + 0.18]], hose: [[tx - 0.3, ty, tz + 0.35], [tx + 0.35, ty, tz - 0.3]],
        sock: [[tx + 0.3, ty + 0.06, tz + 0.35]], tape: [[tx + 0.85, ty + 0.025, tz - 0.25], [tx + 0.95, ty + 0.025, tz - 0.1], [tx + 0.9, ty + 0.075, tz - 0.18]], clip: [[0, 0, 0]],
      };
      return S[k][i];
    };
    for (const [k, list] of Object.entries(this.items)) list.forEach((o, i) => {
      if (k === "clip") { o.visible = id === 22 || id === 28; return; }
      const f0 = k === "can" ? ITEM_AT.can : k === "sock" ? ITEM_AT.sock : (ITEM_AT as unknown as Record<string, number[]>)[k][i];
      const used = id === 21 && (k === "can" || (k === "card") || (k === "bag" && i === 0) || (k === "hose" && i === 0));
      o.visible = show && f >= f0 - 9 && !used;
      if (!o.visible) return;
      const p = spot(k, i), h = drop(f, f0 - 8, 1.1, 8);
      setXY(o, [p[0], p[1] + h, p[2]]);
      o.rotation.set(0, i * 1.3 + (k === "sock" ? 0.6 : 0), k === "sock" ? Math.PI / 2 : 0);
      if (k === "bag") o.rotation.set(0, i * 0.8, 0);
    });
    const pb = protoAt(id, f);
    this.proto.set(pb);
    this.proto.g.position.set(tx, ty + 0.17, tz);
    this.proto.g.rotation.y = 0.5;
  }

  private poseSea(id: number, f: number, t: number) {
    const y = capY(id, f), bob = 0.08 * Math.sin(t * 1.4);
    this.capsule.position.set(SEA[0], (y > 0 ? y : bob) + 0.6, SEA[2]);
    this.capsule.rotation.set(y > 0 ? 0.04 * Math.sin(t * 2) : 0.05 * Math.sin(t * 1.1), 0.4, y > 0 ? 0.03 : 0.04 * Math.cos(t * 0.9));
    const after = Math.max(0, (f - SPLASH) / FPS);
    this.chutes.visible = id === 26;
    this.chutes.position.set(SEA[0] + 2.5 * after, y + 0.6 + 16.6 - 9 * after * after, SEA[2] + 1.5 * after);
    this.chutes.scale.set(1 + 0.3 * after, Math.max(0.15, 1 - 1.2 * after), 1 + 0.3 * after);
    this.raft.visible = id === 29;
    this.raft.position.y = 0.05 + 0.06 * Math.sin(t * 1.3 + 1);
    this.raft.rotation.set(0.03 * Math.sin(t), 0, 0.03 * Math.cos(t * 1.2));
  }
}
void lin; void FULL;
