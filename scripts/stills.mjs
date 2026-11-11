// usage: node scripts/stills.mjs <CompositionId> <outPrefix> <frame,frame,...> [scale]
// Bundles once and renders JPEG stills. GL: angle by default; set GL=swangle on machines without a GPU.
// PROPS='{"look":{"real":true}}' passes Remotion inputProps (A/B switches). CHROME_PATH picks a browser; REMOTION_TMP moves the (big) bundle temp folders to another drive.
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, prefix, frames, scale = "0.5"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME_PATH || null;
const chromiumOptions = { gl: process.env.GL || "angle" };
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps });
const onBrowserLog = (l) => { if ((l.type === "error" || l.type === "warning") && !/swiftshader|404/i.test(l.text)) console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), inputProps,
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
