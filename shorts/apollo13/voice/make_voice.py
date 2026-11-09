"""Apollo 13 voice: tighten pauses, speed up to the target length, force-align the script to get word timings.

python shorts/apollo13/voice/make_voice.py [take.mp3] [target_seconds]
  -> voice.wav (48 kHz mono) + words.json [{word, start, end}] next to this file.
Needs ffmpeg (with rubberband) on PATH, numpy, pocketsphinx.
"""
import json, os, re, subprocess, sys
import numpy as np
from pocketsphinx import Decoder

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "henry_raw.mp3")
TARGET = float(sys.argv[2]) if len(sys.argv) > 2 else 62.0
CAP = 0.14          # longest pause kept (s)
SR = 48000


def run(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True)


def load(path, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def silences(path, db=-38, d=0.12):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=n={db}dB:d={d}", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(st, en))


# 1. cap every pause at CAP by cutting out its middle (keeps the breath tails at both ends)
x = load(SRC, SR)
keep, pos = [], 0
for s, e in silences(SRC):
    if e - s <= CAP:
        continue
    a, b = s + CAP / 2, e - CAP / 2
    keep.append(x[pos:int(a * SR)]); pos = int(b * SR)
keep.append(x[pos:])
lead = np.zeros(int(0.12 * SR), np.float32)
y = np.concatenate([lead] + keep)
# trim trailing silence to 0.25 s
nz = np.nonzero(np.abs(y) > 10 ** (-40 / 20))[0]
y = y[: nz[-1] + int(0.25 * SR)]
tight = os.path.join(HERE, "_tight.wav")
import wave
with wave.open(tight, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
dur = len(y) / SR
tempo = dur / TARGET
print(f"tightened {dur:.2f} s -> tempo {tempo:.3f}")

# 2. speed up without changing pitch (rubberband sounds cleaner than atempo above ~1.25)
out = os.path.join(HERE, "voice.wav")
run("ffmpeg", "-y", "-v", "error", "-i", tight, "-af", f"rubberband=tempo={tempo:.4f}:pitch=1:transients=crisp:formant=preserved,aresample={SR}", "-ac", "1", "-c:a", "pcm_s16le", out)
os.remove(tight)
vd = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out).stdout)
print(f"voice.wav {vd:.2f} s")

# 3. forced alignment of the exact script text (pocketsphinx, 16 kHz)
txt = open(os.path.join(HERE, "script.txt"), encoding="utf8").read()
toks = re.findall(r"[A-Za-z']+", txt)
dec = Decoder(samprate=16000, bestpath=False, loglevel="ERROR")
dec.add_word("lander's", "L AE N D ER Z", True)
dec.set_align_text(" ".join(t.lower() for t in toks))
pcm = (np.clip(load(out, 16000), -1, 1) * 32767).astype("<i2").tobytes()
dec.start_utt(); dec.process_raw(pcm, full_utt=True); dec.end_utt()
segs = [s for s in dec.seg() if s.word not in ("<s>", "</s>", "<sil>", "(NULL)")]
words = []
for i, s in enumerate(segs):
    w = re.sub(r"\(\d+\)$", "", s.word)
    words.append({"word": toks[i] if i < len(toks) else w, "start": round(s.start_frame / 100, 3), "end": round((s.end_frame + 1) / 100, 3)})
print(f"aligned {len(words)} / {len(toks)} words")
assert len(words) == len(toks), "alignment lost words"
json.dump(words, open(os.path.join(HERE, "words.json"), "w"), indent=1)

# 4. sentence starts vs pause ends
ends = [e for _, e in silences(out, -38, 0.08)]
starts = [i for i, t in enumerate(toks) if i == 0 or re.search(r"[.?!:]\W*$", re.findall(r"\S+", txt)[i - 1])]
for i in starts:
    near = min(ends, key=lambda e: abs(e - words[i]["start"])) if ends else -1
    print(f"{words[i]['start']:7.2f}  pause end {near:7.2f}  d={words[i]['start'] - near:+.2f}  {toks[i]}")
