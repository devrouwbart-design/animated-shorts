# Frame-by-frame study of a reference short (every frame at 30 fps), written to measure what makes it look real and
# feel alive, in numbers our renders can be compared against:
#   cuts and shot lengths | camera motion per frame (zoom %/f, pan px/f, roll deg/f) and how moves ease in/out |
#   colour (luma, contrast, saturation, colourfulness, warm/cool, palette per shot) | detail (edge density, fine-texture
#   energy, sharpness centre vs edges = depth of field) | audio loudness.
# Writes report.md (tables + plain-language summary), frames.csv, shots.json, 2 s contact sheets and per-shot key frames
# into <outdir>. The output is PRIVATE STUDY MATERIAL: keep <outdir> outside git (out/ is ignored) and never publish frames.
#
# Usage: python scripts/analyze_reference.py <video.mp4> <outdir> [--width 540]
# Needs: ffmpeg/ffprobe on PATH, numpy, opencv-python(-headless), pillow.
import argparse, csv, json, os, subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("out"); ap.add_argument("--width", type=int, default=540)
A = ap.parse_args()
os.makedirs(os.path.join(A.out, "sheets"), exist_ok=True); os.makedirs(os.path.join(A.out, "keys"), exist_ok=True)
run = lambda *a: subprocess.run(a, capture_output=True, text=True)
FPS = 30

pr = json.loads(run("ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", A.video).stdout)
vs = next(s for s in pr["streams"] if s["codec_type"] == "video")
W0, H0 = int(vs["width"]), int(vs["height"])
W = A.width; H = int(round(H0 * W / W0 / 2) * 2)
dur = float(pr["format"]["duration"])

# ---------------- decode every frame at 30 fps ----------------
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", A.video, "-vf", f"fps={FPS},scale={W}:{H}:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
frames = []
while True:
    b = p.stdout.read(W * H * 3)
    if len(b) < W * H * 3: break
    frames.append(np.frombuffer(b, np.uint8).reshape(H, W, 3))
p.wait()
N = len(frames)
print(f"{N} frames at {W}x{H} (source {W0}x{H0}, {dur:.2f} s)")

# ---------------- per-frame colour / detail ----------------
def colourfulness(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    rg, yb = r - g, 0.5 * (r + g) - b
    return float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean()))

def sharp(gray):
    return float(cv2.Laplacian(gray, cv2.CV_32F).var())

rows = []
orb = cv2.ORB_create(1200)
prev_g = prev_kp = prev_des = prev_h = None
for i, f in enumerate(frames):
    g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV)
    L = g.astype(np.float32) / 255
    sat = hsv[..., 1].astype(np.float32) / 255
    hue = hsv[..., 0].astype(np.float32) * 2  # degrees
    lit = sat > 0.15
    warm = float(np.mean(((hue < 70) | (hue > 330))[lit])) if lit.any() else 0.0
    edges = cv2.Canny(g, 60, 150)
    # fine texture: energy of the image minus a 5 px blur (painted detail, grain, small props)
    fine = float(np.mean(np.abs(g.astype(np.float32) - cv2.GaussianBlur(g, (0, 0), 2.5).astype(np.float32))))
    c = g[H // 4: 3 * H // 4, W // 4: 3 * W // 4]
    border = np.concatenate([g[: H // 6].ravel(), g[-H // 6:].ravel()])
    sc, sb = sharp(c), sharp(border.reshape(-1, W))
    hist = cv2.calcHist([hsv], [0, 1], None, [30, 16], [0, 180, 0, 256]); cv2.normalize(hist, hist)
    # ---- camera motion from the previous frame: similarity transform from matched features ----
    zoom = tx = ty = rot = np.nan; inl = 0
    kp, des = orb.detectAndCompute(g, None)
    diff = float(np.mean(np.abs(g.astype(np.int16) - prev_g.astype(np.int16)))) if prev_g is not None else 0.0
    histcorr = float(cv2.compareHist(prev_h, hist, cv2.HISTCMP_CORREL)) if prev_h is not None else 1.0
    if prev_des is not None and des is not None and len(des) > 20 and len(prev_des) > 20:
        m = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(prev_des, des)
        if len(m) > 25:
            a = np.float32([prev_kp[x.queryIdx].pt for x in m]); b2 = np.float32([kp[x.trainIdx].pt for x in m])
            M, mask = cv2.estimateAffinePartial2D(a, b2, method=cv2.RANSAC, ransacReprojThreshold=2.0)
            if M is not None:
                inl = int(mask.sum())
                s = float(np.hypot(M[0, 0], M[1, 0]))
                # translation of the frame centre (so a pure zoom about the centre reads as 0 pan)
                cx, cy = W / 2, H / 2
                nx, ny = M[0, 0] * cx + M[0, 1] * cy + M[0, 2], M[1, 0] * cx + M[1, 1] * cy + M[1, 2]
                zoom, tx, ty, rot = (s - 1) * 100, (nx - cx) * 720 / W, (ny - cy) * 720 / W, float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
    rows.append(dict(f=i, t=round(i / FPS, 3), luma=float(L.mean()), p2=float(np.percentile(L, 2)), p98=float(np.percentile(L, 98)), lstd=float(L.std()),
                     sat=float(sat.mean()), colorful=colourfulness(f), warm=warm, edge=float((edges > 0).mean()), fine=fine,
                     sharp_c=sc, sharp_b=sb, diff=diff, histcorr=histcorr, zoom=zoom, tx=tx, ty=ty, rot=rot, inliers=inl))
    prev_g, prev_kp, prev_des, prev_h = g, kp, des, hist

# ---------------- cuts ----------------
d = np.array([r["diff"] for r in rows]); hc = np.array([r["histcorr"] for r in rows]); inl = np.array([r["inliers"] for r in rows])
med = np.median(d[1:]) if N > 1 else 0
cut = [0]
for i in range(1, N):
    hard = (d[i] > max(18, 4 * med) and hc[i] < 0.75) or (hc[i] < 0.45) or (inl[i] < 12 and d[i] > max(12, 3 * med))
    if hard and i - cut[-1] >= 4: cut.append(i)
for i in cut[1:]:  # motion measured across a cut is meaningless
    for k in ("zoom", "tx", "ty", "rot"): rows[i][k] = float("nan")
flashes = [i for i in range(1, N - 1) if rows[i]["luma"] - (rows[i - 1]["luma"] + rows[i + 1]["luma"]) / 2 > 0.18]
shots = []
for k, a in enumerate(cut):
    b = cut[k + 1] if k + 1 < len(cut) else N
    S = rows[a + 1:b] if b - a > 1 else rows[a:b]
    zs = np.array([r["zoom"] for r in S], float); txs = np.array([r["tx"] for r in S], float); tys = np.array([r["ty"] for r in S], float); rs = np.array([r["rot"] for r in S], float)
    ok = ~np.isnan(zs)
    speed = np.hypot(np.nan_to_num(txs), np.nan_to_num(tys))
    still = float(np.mean((np.abs(np.nan_to_num(zs)) < 0.05) & (speed < 0.5))) if len(S) else 1
    tz = float(np.nansum(zs)) if ok.any() else 0.0
    kind = "hold" if still > 0.8 else ("push-in" if tz > 3 else "pull-out" if tz < -3 else "pan/track" if np.nanmax(speed) > 2 else "creep")
    # ease profile: where the peak speed sits inside the move (0 = starts fast / ease-out burst, 0.5 = symmetric)
    mv = np.abs(np.nan_to_num(zs)) * 8 + speed
    pk = float(np.argmax(mv) / max(1, len(mv) - 1)) if len(mv) else 0
    sub = rows[a:b]
    shots.append(dict(id=k + 1, a=a, b=b, frames=b - a, sec=round((b - a) / FPS, 2), kind=kind, still_frac=round(still, 2),
                      zoom_total_pct=round(tz, 1), zoom_mean_pct_per_f=round(float(np.nanmean(zs)) if ok.any() else 0, 3),
                      pan_max_px_per_f_720=round(float(np.nanmax(speed)) if len(speed) else 0, 1), roll_total_deg=round(float(np.nansum(rs)), 2),
                      peak_at=round(pk, 2), luma=round(float(np.mean([r["luma"] for r in sub])), 3), sat=round(float(np.mean([r["sat"] for r in sub])), 3),
                      colorful=round(float(np.mean([r["colorful"] for r in sub])), 1), warm=round(float(np.mean([r["warm"] for r in sub])), 2),
                      edge=round(float(np.mean([r["edge"] for r in sub])), 4), fine=round(float(np.mean([r["fine"] for r in sub])), 2),
                      dof_ratio=round(float(np.mean([r["sharp_c"] / max(1e-3, r["sharp_b"]) for r in sub])), 2)))

# ---------------- palettes + key frames + sheets ----------------
def palette(img, k=6):
    px = img.reshape(-1, 3).astype(np.float32)[:: 37]
    _, lab, cen = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    cnt = np.bincount(lab.ravel(), minlength=k)
    o = np.argsort(-cnt)
    return [("#%02x%02x%02x" % tuple(int(v) for v in cen[j]), round(float(cnt[j] / cnt.sum()), 2)) for j in o]
full = subprocess.run(["ffmpeg", "-v", "error", "-i", A.video, "-vf", f"fps={FPS}", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
fs0 = W0 * H0 * 3
for s in shots:
    m = (s["a"] + s["b"]) // 2
    s["palette"] = palette(frames[m])
    for tag, fi in (("a", s["a"]), ("m", m), ("b", max(s["a"], s["b"] - 1))):
        if (fi + 1) * fs0 <= len(full):
            Image.fromarray(np.frombuffer(full[fi * fs0:(fi + 1) * fs0], np.uint8).reshape(H0, W0, 3)).save(os.path.join(A.out, "keys", f"shot{s['id']:02d}_{tag}_f{fi}.jpg"), quality=92)
del full
tw, th = 108, int(108 * H / W)
for k in range(0, N, 60):
    sheet = Image.new("RGB", (tw * 10, (th + 14) * 6), "white"); dr = ImageDraw.Draw(sheet)
    for j in range(60):
        if k + j >= N: break
        x, y = (j % 10) * tw, (j // 10) * (th + 14)
        sheet.paste(Image.fromarray(frames[k + j]).resize((tw, th)), (x, y + 14))
        dr.text((x + 2, y + 1), str(k + j) + (" CUT" if (k + j) in cut[1:] else ""), fill="red" if (k + j) in cut[1:] else "black")
    sheet.save(os.path.join(A.out, "sheets", f"sheet_{k:05d}.jpg"), quality=85)

# ---------------- audio ----------------
e = run("ffmpeg", "-i", A.video, "-map", "0:a:0?", "-af", "ebur128=peak=true", "-f", "null", "-").stderr
tail = e[e.rfind("Summary:"):] if "Summary:" in e else ""
aud = " ".join(l.strip() for l in tail.splitlines() if l.strip().startswith(("I:", "LRA:", "Peak:")))

# ---------------- write ----------------
with open(os.path.join(A.out, "frames.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
json.dump(dict(fps=FPS, frames=N, cuts=cut, flashes=flashes, shots=shots), open(os.path.join(A.out, "shots.json"), "w"), indent=1)
arr = lambda k: np.array([r[k] for r in rows], float)
z, sp = arr("zoom"), np.hypot(arr("tx"), arr("ty"))
moving = (np.abs(np.nan_to_num(z)) > 0.05) | (np.nan_to_num(sp) > 0.5)
L = [f"# Reference analysis: {os.path.basename(A.video)}", "",
     f"- Source {W0}x{H0}, {dur:.2f} s, analysed {N} frames at {FPS} fps ({W}x{H}). Audio: {aud or 'n/a'}",
     f"- Shots: {len(shots)} (cuts at frames {cut[1:]}), median shot {np.median([s['sec'] for s in shots]):.2f} s, mean {np.mean([s['sec'] for s in shots]):.2f} s, cuts per 10 s {10 * (len(cut) - 1) / (N / FPS):.1f}",
     f"- White/bright flash frames: {flashes}",
     f"- Camera moving on {100 * moving.mean():.0f} % of frames; zoom median {np.nanmedian(np.abs(z[moving])) if moving.any() else 0:.2f} %/f when moving, max {np.nanmax(np.abs(z)) if np.isfinite(z).any() else 0:.2f} %/f; pan p90 {np.nanpercentile(sp, 90) if np.isfinite(sp).any() else 0:.1f} px/f (720p), max {np.nanmax(sp) if np.isfinite(sp).any() else 0:.1f}",
     f"- Colour: luma mean {arr('luma').mean():.3f} (p2 {arr('p2').mean():.3f}, p98 {arr('p98').mean():.3f}, std {arr('lstd').mean():.3f}); saturation {arr('sat').mean():.3f}; colourfulness {arr('colorful').mean():.1f}; warm share of coloured pixels {arr('warm').mean():.2f}",
     f"- Detail: edge density {arr('edge').mean():.4f}, fine-texture energy {arr('fine').mean():.2f}, sharpness centre/border ratio median {np.median(arr('sharp_c') / np.maximum(arr('sharp_b'), 1e-3)):.2f} (>1.5 = background blur / depth of field)",
     "", "## Shots", "",
     "| # | frames | sec | camera | zoom total % | zoom %/f | pan max px/f | roll deg | peak at | luma | sat | colourful | warm | edges | fine | DOF ratio | palette (share) |",
     "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
for s in shots:
    pal = " ".join(f"{c} {int(100 * v)}%" for c, v in s["palette"][:5])
    L.append(f"| {s['id']} | {s['a']}-{s['b']} | {s['sec']} | {s['kind']} | {s['zoom_total_pct']} | {s['zoom_mean_pct_per_f']} | {s['pan_max_px_per_f_720']} | {s['roll_total_deg']} | {s['peak_at']} | {s['luma']} | {s['sat']} | {s['colorful']} | {s['warm']} | {s['edge']} | {s['fine']} | {s['dof_ratio']} | {pal} |")
L += ["", "How to read: zoom %/f > 0 = the image grows (push-in / zoom-in). peak at = where the fastest frame sits in the shot (0 = starts fast and eases out, 0.5 = symmetric ease in-out, 1 = accelerates into the cut). DOF ratio = centre sharpness / top+bottom sharpness. Key frames (start / middle / end of every shot, full resolution) are in keys/, 2 s contact sheets with cut markers in sheets/.",
      "", "Next: look at the key frames shot by shot and describe, with numbers where possible, what makes objects read as real (materials, texture scale, wear, bevels, specular highlights, contact shadows, ambient occlusion, reflections, light colour), how characters are drawn and lit, and how the camera choreography follows the narration."]
open(os.path.join(A.out, "report.md"), "w").write("\n".join(L) + "\n")
print("\n".join(L[:8])); print("wrote", A.out)
