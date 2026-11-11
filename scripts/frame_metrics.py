# Per-image look metrics, the same ones analyze_reference.py uses, plus a few that tell "realistic materials" from
# "flat toon" (ink share, specular share, in-surface texture), so our stills can be compared with reference frames.
# Usage: python scripts/frame_metrics.py <label>=<img|glob> [<label>=<img|glob> ...]   (all images scaled to 540 wide)
# Prints one row per label (mean over its images).
import glob, sys
import numpy as np
import cv2

def metrics(path):
    im = cv2.imread(path)
    h, w = im.shape[:2]
    im = cv2.resize(im, (540, round(h * 540 / w)), interpolation=cv2.INTER_AREA)
    H = im.shape[0]
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    L = g.astype(np.float32) / 255
    sat = hsv[..., 1].astype(np.float32) / 255
    b, gg, r = [im[..., i].astype(np.float32) for i in range(3)]
    rg, yb = r - gg, 0.5 * (r + gg) - b
    colorful = float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean()))
    edges = cv2.Canny(g, 60, 150) > 0
    fine = float(np.mean(np.abs(g.astype(np.float32) - cv2.GaussianBlur(g, (0, 0), 2.5).astype(np.float32))))
    # ink: thin near-black strokes (dark pixels that are thin = removed by a 5 px opening)
    dark = (L < 0.08).astype(np.uint8)
    thin = dark & (1 - cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)))
    # specular: small bright, low-saturation spots well above their neighbourhood (highlights on bevels, metal, wet)
    loc = cv2.GaussianBlur(L, (0, 0), 6)
    spec = (L > 0.8) & (sat < 0.3) & (L - loc > 0.12)
    # in-surface texture: fine-detail energy measured away from edges (wear, grain, blade detail vs flat paint)
    far = cv2.dilate(edges.astype(np.uint8), np.ones((7, 7), np.uint8)) == 0
    hp = np.abs(L - cv2.GaussianBlur(L, (0, 0), 1.5))
    surf = float(hp[far].mean() * 255) if far.any() else 0.0
    c = g[H // 4: 3 * H // 4, 135:405]
    bd = np.concatenate([g[: H // 6], g[-H // 6:]])
    dof = cv2.Laplacian(c, cv2.CV_32F).var() / max(1e-3, cv2.Laplacian(bd, cv2.CV_32F).var())
    hue = hsv[..., 0].astype(np.float32) * 2
    lit = sat > 0.15
    warm = float(np.mean(((hue < 70) | (hue > 330))[lit])) if lit.any() else 0
    return dict(luma=L.mean(), p2=np.percentile(L, 2), p98=np.percentile(L, 98), sat=sat.mean(), colorful=colorful, warm=warm,
                edge=edges.mean(), fine=fine, ink=thin.mean() * 100, spec=spec.mean() * 1000, surf=surf, dof=dof)

rows = []
for a in sys.argv[1:]:
    label, pat = a.split("=", 1)
    files = sorted(glob.glob(pat))
    ms = [metrics(p) for p in files]
    rows.append((label, len(files), {k: float(np.mean([m[k] for m in ms])) for k in ms[0]}))
keys = list(rows[0][2])
print("| set | n | " + " | ".join(keys) + " |")
print("|---|---|" + "---|" * len(keys))
for label, n, m in rows:
    print(f"| {label} | {n} | " + " | ".join(f"{m[k]:.3f}" if m[k] < 10 else f"{m[k]:.1f}" for k in keys) + " |")
print("ink = % of pixels in thin near-black strokes; spec = highlight pixels per 1000; surf = fine detail away from edges (x255); dof = centre/border sharpness")
