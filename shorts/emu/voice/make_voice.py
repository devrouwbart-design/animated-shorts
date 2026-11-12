# Emu short voice: Henry raw take -> tightened voice.wav + words.json (no speech-to-text needed).
# The 28 phrases of script.txt match the 28 speech segments found by silence detection. Inside a phrase, comma parts
# are anchored to the longest internal silences, and words are spread by syllable weight.
# Then pauses are capped (longer after punch lines) and the whole take is sped up with rubberband (pitch kept).
# usage: python shorts/emu/voice/make_voice.py
import os, re, json, subprocess
import numpy as np
from scipy.io import wavfile

D = os.path.dirname(os.path.abspath(__file__))
RAW, OUT_WAV, OUT_JSON = os.path.join(D, "raw.wav"), os.path.join(D, "voice.wav"), os.path.join(D, "words.json")
SPEED = 1.23          # same idea as the lake take (1.21x)
GAP, PUNCH = 0.22, 0.48   # raw-time pause after a phrase / after a punch line (before speed-up)

PHRASES = [l.strip() for l in open(os.path.join(D, "script.txt")) if l.strip()]
PUNCH_AFTER = {1, 12, 16, 17, 22, 26}   # "bird won." "gun jams." "Wait." "six-foot bird?" "...tanks." "...instead."

sr, x = wavfile.read(RAW)
x = x.astype(np.float64) / 32768.0
hop = sr // 100
n = len(x) // hop
db = 20 * np.log10(np.sqrt(np.array([np.mean(x[i * hop:(i + 1) * hop] ** 2) for i in range(n)])) + 1e-9)
sp = db > (np.percentile(db, 95) - 38)

def segments(minsil):
    segs, i = [], 0
    while i < n:
        if not sp[i]:
            i += 1; continue
        j = i
        while j < n:
            if sp[j]:
                j += 1; continue
            k = j
            while k < n and not sp[k]: k += 1
            if k - j >= minsil or k >= n: break
            j = k
        segs.append((i, j)); i = j
    return [(a, b) for a, b in segs if b - a > 6]

SEGS = segments(15)
assert len(SEGS) == len(PHRASES), (len(SEGS), len(PHRASES))

def syl(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    s = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and not w.endswith(("le", "ee")) and s > 1: s -= 1
    return max(1, s) + 0.35   # small constant per word

def inner_gaps(a, b):
    """internal silences (start, end) in frames inside a segment, length >= 5 frames"""
    gaps, i = [], a
    while i < b:
        if not sp[i]:
            k = i
            while k < b and not sp[k]: k += 1
            if k - i >= 5: gaps.append((i, k))
            i = k
        else: i += 1
    return gaps

words = []   # raw time
for (a, b), text in zip(SEGS, PHRASES):
    parts = [p.strip() for p in re.split(r"(?<=[,:])\s+", text) if p.strip()]
    gaps = sorted(sorted(inner_gaps(a, b), key=lambda g: g[1] - g[0], reverse=True)[:len(parts) - 1])
    if len(gaps) < len(parts) - 1:          # not enough audible comma pauses: merge parts
        parts = [" ".join(parts)]; gaps = []
    bounds, s = [], a
    for g in gaps: bounds.append((s, g[0])); s = g[1]
    bounds.append((s, b))
    for (pa, pb), part in zip(bounds, parts):
        ws = part.split()
        wt = np.array([syl(w) for w in ws]); edges = np.concatenate([[0], np.cumsum(wt)]) / wt.sum()
        for k, w in enumerate(ws):
            t0 = (pa + edges[k] * (pb - pa)) / 100; t1 = (pa + edges[k + 1] * (pb - pa)) / 100
            words.append({"word": re.sub(r"[^a-z'\-]", "", w.lower()), "start": t0, "end": t1})

# rebuild with capped pauses, then speed up
pieces, new_starts, t = [], [], 0.0
for i, (a, b) in enumerate(SEGS):
    pad = 0.04
    sa, sb = max(0, int((a / 100 - pad) * sr)), min(len(x), int((b / 100 + pad) * sr))
    new_starts.append(t - (a / 100 - sa / sr))
    pieces.append(x[sa:sb]); t += (sb - sa) / sr
    if i < len(SEGS) - 1:
        g = min(PUNCH if i in PUNCH_AFTER else GAP, (SEGS[i + 1][0] - b) / 100)
        pieces.append(np.zeros(int(g * sr))); t += g
pieces.append(np.zeros(int(0.25 * sr)))
y = np.concatenate(pieces)
tmp = os.path.join(D, "_tight.wav")
wavfile.write(tmp, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", f"rubberband=tempo={SPEED}:pitchq=quality:transients=smooth",
                "-ar", "48000", "-ac", "1", OUT_WAV], check=True)
os.remove(tmp)

seg_of = []
for w in words:
    i = max(k for k, (a, b) in enumerate(SEGS) if a / 100 <= w["start"] + 1e-6)
    seg_of.append(i)
out = []
for w, i in zip(words, seg_of):
    off = new_starts[i] - SEGS[i][0] / 100   # raw time -> tightened time inside segment i
    out.append({"word": w["word"], "start": round((w["start"] + off) / SPEED, 3), "end": round((w["end"] + off) / SPEED, 3)})
json.dump(out, open(OUT_JSON, "w"), indent=0)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUT_WAV],
                           capture_output=True, text=True).stdout)
print(f"voice.wav {dur:.2f} s, {len(out)} words, last word ends {out[-1]['end']:.2f} s")
