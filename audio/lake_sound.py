# Sound for "The Lake That Went Down the Drain": synthesized SFX + an original quirky score, ducked under the Henry
# narration, mixed to -14 LUFS. Every event time comes from shorts/lake/voice/words.json (frames = s x 30) and
# src/videos/lake/story.ts. Reuses the bridge short's generators (sfx_gen.py, instruments.py, dsp.py).
# usage: python audio/lake_sound.py   ->  shorts/lake/audio/{mix.wav, music.wav, sfx.wav, cues.md}
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dsp import (SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, pan, place, widen, make_ir, convolve_st, integrated,
                 true_peak, read_wav, write_wav, phase, dbg)
import sfx_gen as S
import instruments as I

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "shorts/lake/audio")
os.makedirs(OUT, exist_ok=True)
FPS, TOTAL = 30, 2100
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
W = {}
for w in json.load(open(os.path.join(ROOT, "shorts/lake/voice/words.json"))):
    W.setdefault(w["word"], []).append(w["start"])
def word(w, k=0):
    return W[w][k]

sfx = np.zeros((2, N))
cues = []
def ev(t, x, g_db=0.0, p=0.0, name=""):
    x = np.asarray(x, float)
    y = pan(x, p) if x.ndim == 1 else x
    place(sfx, y, t, dbg(g_db))
    if name:
        cues.append((t, name))

def addm(*xs):
    """sum mono signals of different lengths (zero-padded)"""
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out

def env_seg(dur, fin, fout):
    n = ns(dur); e = np.ones(n)
    a, b = ns(fin), ns(fout)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] *= np.linspace(1, 0, b)
    return e

def roar(dur, r, lo=60, hi=900, swirl=0.6):
    """whirlpool roar: low rumble + rushing band noise with a slow swirling wobble"""
    n = ns(dur); t = np.arange(n) / SR
    rum = lp(colored(n, r, 2.0), 120, 2) * 1.2
    rush = bp(colored(n, r, 0.8), lo * 3, hi * 3, 1) * (0.6 + swirl * 0.4 * np.sin(2 * np.pi * 0.7 * t))
    gur = S.bubbles(dur, r, 60, 150, 900, (0.01, 0.05)) * 0.8
    return widen(rum + rush + gur, r, 12, 0.8)

def motor(dur, r, f0=95, rev=None):
    """small outboard: buzzy pulse train through a box resonance"""
    n = ns(dur); t = np.arange(n) / SR
    f = f0 * (1 + 0.6 * (rev(t) if rev else 0)) * (1 + 0.02 * smooth_noise(n, r, 6))
    ph = phase(f)
    y = np.sign(np.sin(ph)) * 0.3 + 0.5 * np.sin(2 * ph)
    y = bp(y, 120, 2400, 1) + bp(colored(n, r, 0.5), 800, 3000, 1) * 0.1
    return y * 0.6

def drill_hum(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    y = 0.5 * np.sin(phase(55 + 2 * np.sin(2 * np.pi * 3 * t))) + 0.25 * np.sign(np.sin(phase(110))) * 0.4
    y += S.rattle(dur, r, 18) * 0.25
    return lp(y, 1500)

def metal_clank(r, f0=180):
    t = tt(0.6)
    return addm(S.clink(r, f0 * 3, 0.5, 0.8) * 1.2, S.wood_crack(r) * 0.5, np.exp(-t / 0.18) * np.sin(phase(f0)) * 0.9)

def steel_groan(dur, r, rate0=40, rate1=70):
    return S.creak(dur, r, rate0, rate1, rough=0.2, noise=0.06, scale=0.6)

def gulp(r, f0=90, dur=0.9):
    t = tt(dur)
    y = np.exp(-t / 0.25) * np.sin(phase(f0 * (1 + 1.5 * np.exp(-t / 0.08)))) * 1.4
    y += S.bubbles(dur, r, 400 * np.exp(-t / 0.3) + 10, 200, 1500, (0.01, 0.04), np.exp(-t / 0.4)) * 0.9
    return fades(y, 0.002, 0.1)

def cork_pop(r):
    t = tt(0.35)
    y = np.exp(-t / 0.03) * np.sin(phase(520 * (1 + 2.5 * np.exp(-t / 0.01)))) * 1.0
    y += bp(r.standard_normal(len(t)), 800, 5000, 1) * np.exp(-t / 0.006) * 0.8
    return fades(y, 0.0005, 0.05)

def klaxon(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    f = np.where((t % 0.6) < 0.3, 620, 470)
    y = np.sign(np.sin(phase(f))) * 0.35 + np.sin(phase(f * 2)) * 0.2
    return bp(y, 300, 3000, 2) * 0.8

def winch(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    y = np.sin(phase(70 + 30 * np.minimum(1, t / 0.6))) * 0.5 + S.rattle(dur, r, 25) * 0.4
    return lp(y, 2000) * env_seg(dur, 0.2, 0.4)

def plug_pop(r):
    t = tt(0.25)
    return fades(np.exp(-t / 0.02) * np.sin(phase(380 * (1 + 1.2 * np.exp(-t / 0.01)))) + 0.4 * hp(r.standard_normal(len(t)), 2000) * np.exp(-t / 0.004), 0.0005, 0.04)

def drain_gurgle(dur, r, grow=1.0):
    n = ns(dur); t = np.arange(n) / SR
    rate = 30 + 220 * grow * np.minimum(1, t / dur)
    y = S.bubbles(dur, r, rate, 120, 900, (0.012, 0.05)) * 1.1
    y += lp(colored(n, r, 1.2), 400) * 0.3 * (0.4 + 0.6 * t / dur)
    return y

def flop(r):
    t = tt(0.2)
    return fades(bp(r.standard_normal(len(t)), 300, 2500, 1) * np.exp(-t / 0.03) + np.exp(-t / 0.05) * np.sin(phase(140)) * 0.6, 0.0005, 0.04)

# ======================= SFX timeline =======================
R = rng(11)
flash = fr(219)
ev(0.0, roar(flash + 0.3, R) * env_seg(flash + 0.3, 0.05, 0.4), -2, 0, "whirlpool roar (hook)")
for k, t0 in enumerate([0.6, 2.4, 4.4]): ev(t0, S.whoosh(1.6, R, 0.6, 250, 1400, 0.9, 0.5) * 0.5, -6, 0.6 * (-1) ** k)
ev(word("rig"), steel_groan(1.2, R), -6, -0.2, "rig groan")
ev(word("tugboat"), gulp(R, 80), -4, 0.3)
for k in range(4): ev(word("eleven") + 0.25 * k, gulp(R, 100 + 15 * k, 0.6), -8, -0.5 + 0.3 * k)
ev(flash - 0.25, S.whoosh(0.7, R, 0.2, 600, 4000, 0.7, 0.25), -4, 0, "flash whoosh")
# calm lake + garden
calm0, calm1 = flash, fr(550)
ev(calm0, S.water_bed(calm1 - calm0, R, 0.5, 0.5) * env_seg(calm1 - calm0, 0.4, 1.0)[None, :], -12, 0, "calm water")
ev(calm0, widen(S.bird_chirps(fr(405) - calm0, R, 0.7), R, 9, 0.8), -10, 0, "birds")
ev(calm0, S.breeze(fr(405) - calm0, R, 0.6), -16)
for k, tf in enumerate([11.45, 11.85, 12.2]): ev(tf, S.bubbles(0.35, R, 300, 500, 2500, (0.004, 0.015)) * 1.2, -8, 0.4 - 0.4 * k, "fish plip" if k == 0 else "")
ev(word("right") - 0.1, drill_hum(word("stuck") - word("right") + 0.1, R) * env_seg(word("stuck") - word("right") + 0.1, 0.5, 0.02), -6, 0.1, "drill hum")
ev(word("stuck"), metal_clank(R, 140), -1, 0, "drill jams CLANK")
ev(word("stuck") + 0.05, lp(colored(ns(0.8), R, 2.0), 100) * np.exp(-tt(0.8) / 0.25), -2)
ev(word("then"), steel_groan(2.0, R, 30, 55), -4, -0.3, "rig tilts: groans")
ev(fr(590), steel_groan(1.4, R, 45, 80), -6, 0.3)
for k, tp in enumerate([21.23, 21.5, 21.75]): ev(tp, addm(S.wood_crack(R) * 0.8, S.bolt_snap(R) * 0.7), -2, -0.4 + 0.4 * k, "pop" if k == 0 else "")
for k in range(3): ev(21.6 + 0.12 * k + 0.4, addm(S.bubbles(0.4, R, 200, 300, 2200, (0.005, 0.02)), lp(R.standard_normal(ns(0.4)), 600) * np.exp(-tt(0.4) / 0.05) * 0.5), -8, 0.2, "crew lands in boat" if k == 0 else "")
ev(word("away"), motor(2.4, R, 90, lambda t: np.minimum(1, t / 0.5)) * env_seg(2.4, 0.05, 0.9), -6, 0.4, "outboard away")
ev(word("behind"), roar(fr(1122) - word("behind"), R) * np.minimum(1, np.linspace(0, 4, ns(fr(1122) - word("behind"))))[None, :], -6, 0, "the lake starts to spin")
ev(word("spin") - 0.3, S.whoosh(2.0, R, 1.2, 150, 900, 1.0, 0.7), -4, 0)
ev(word("swallows"), S.splash_big(R), -3, 0, "rig swallowed")
ev(word("swallows") - 0.2, steel_groan(1.6, R, 25, 45), -5, 0)
ev(word("tugboat", 1), gulp(R, 85), -3, 0.3, "tug gulp")
for k in range(6): ev(word("barges", 1) + 0.33 * k, gulp(R, 95 + 12 * k, 0.7), -6, -0.6 + 0.24 * k, "barges gulp" if k == 0 else "")
ev(word("fisherman"), motor(word("shore", 1) - word("fisherman"), R, 130, lambda t: 0.5 + 0.5 * np.minimum(1, t / 0.4)) * env_seg(word("shore", 1) - word("fisherman"), 0.05, 0.05), -7, -0.3, "skiff motor")
ev(word("shore", 1), addm(S.push_thump(R) * 1.2, S.bubbles(0.5, R, 200, 300, 1800, (0.005, 0.02))), -3, 0, "skiff beaches THUD")
ev(word("even"), roar(fr(1122) - word("even"), R, 90, 1600, 0.2) * env_seg(fr(1122) - word("even"), 0.8, 0.02)[None, :], -5, 0.2, "waterfall")
ev(word("backwards"), S.whoosh(1.0, R, 0.6, 300, 1600), -8, 0.4)
# "Wait." everything stops; a single drip; then the dive
ev(word("wait") + 0.12, S.bubbles(0.3, R, 3, 1500, 2500, (0.006, 0.01), rise=(15, 25)) * 2.0, -8, 0, "Wait: dropout, one drip")
ev(word("where") - 0.1, S.whoosh(1.5, R, 1.2, 200, 3000, 0.9, 0.2), -2, 0, "dive whoosh")
# salt mine
m0 = fr(1170)
ev(m0, widen(lp(colored(ns(fr(1368) - m0), R, 2.0), 180) * 0.5 + S.bubbles(fr(1368) - m0, R, 1.5, 1200, 3000, (0.005, 0.012), rise=(8, 20)) * 0.8, R, 15, 1.0), -10, 0, "mine room tone + drips")
for k in range(10): ev(m0 + 0.4 + 0.55 * k, S.stroll_step(R, 0.3), -14, -0.3 + 0.06 * k)
ev(word("spots"), S.whoosh(0.4, R, 0.05, 900, 2500, 0.6, 0.15), -8, 0, "electrician spots")
ev(word("rushing") - 0.2, roar(fr(1368) - word("rushing") + 0.2, R, 120, 1400, 0.3) * np.minimum(1, np.linspace(0, 2.5, ns(fr(1368) - word("rushing") + 0.2)))[None, :], -4, 0, "flood down the tunnel")
ev(fr(1345), klaxon(fr(1430) - fr(1345), R) * env_seg(fr(1430) - fr(1345), 0.02, 0.3), -6, 0.3, "ALARM")
ev(fr(1385), winch(1.8, R), -5, -0.2, "elevator winch")
# the empty bed
ev(fr(1430), S.breeze(fr(1486) - fr(1430), R, 0.4), -14, 0, "empty bed: breeze")
for k in range(5): ev(fr(1436) + 0.3 * k + 0.07 * (k % 2), flop(R), -10, 0.3 - 0.15 * k, "fish flop" if k == 0 else "")
# roof drill
ev(fr(1486), lp(colored(ns(fr(1558) - fr(1486)), R, 2.0), 160) * 0.5, -12)
ev(word("punched") - 0.15, addm(S.rattle(0.5, R, 70, heavy=True) * 1.2, S.wood_crack(R) * 0.8), -1, 0, "drill punches the roof")
ev(fr(1526), roar(fr(1558) - fr(1526), R, 150, 2000, 0.2), -4, 0, "water gushes in")
# bathroom
b0 = fr(1558)
ev(b0, widen(S.bubbles(fr(1651) - b0, R, 1.0, 1800, 3500, (0.005, 0.01), rise=(10, 20)), R, 7, 1.0) * 0.8 + 0.15 * S.water_bed(fr(1651) - b0, R, 0.2, 0.2), -10, 0, "bathroom: drips, still water")
ev(word("plug"), plug_pop(R), -2, 0.2, "plug pop")
ev(word("swirls"), drain_gurgle(fr(1651) - word("swirls"), R, 0.5), -4, 0.1, "gurgle")
ev(fr(1651), drain_gurgle(fr(1840) - fr(1651), R, 1.0) * env_seg(fr(1840) - fr(1651), 0.05, 0.6), -3, 0, "salt drain grows: gurgle builds")
ev(word("dissolves"), S.bubbles(0.8, R, 160, 2500, 6000, (0.002, 0.006), rise=(10, 40)) * 0.7, -8, 0, "fizz")
# golden refill + corks
g0 = fr(1840)
ev(g0, roar(DUR - g0, R, 90, 1200, 0.1) * env_seg(DUR - g0, 0.6, 4.0)[None, :] * 0.6, -10, 0.2, "refill waterfall (gentle)")
ev(g0, widen(addm(S.crickets(DUR - g0, R, 3) * 0.4, S.bird_chirps(DUR - g0, R, 0.25)), R, 9, 0.8), -14, 0, "evening birds + crickets")
for k in range(9):
    tp = fr(1958 + k * 6) + 0.1
    ev(tp, cork_pop(R), -2, -0.6 + 0.15 * k, "cork pops" if k == 0 else "")
    ev(tp + 0.02, S.bubbles(0.6, R, 200, 300, 2000, (0.005, 0.02)) * 0.8, -10, -0.6 + 0.15 * k)

# ======================= music =======================
mus = np.zeros((2, N))
F = I.m2f
BPM = 112; Q = 60 / BPM
RM = rng(5)
def note(inst, t, m, dur=0.5, vel=0.6, p=0.0, g=0.0):
    if inst == "pluck": x = I.pluck(F(m), vel, RM, dur=max(0.5, dur))
    elif inst == "glock": x = I.glock(F(m), vel * 0.6, RM, dur=1.2)
    elif inst == "tuba": x = I.brass(F(m), dur, vel, RM, kind="tuba")
    elif inst == "bone": x = I.brass(F(m), dur, vel, RM, kind="horn", fall=-5.0)
    elif inst == "mbox": x = I.musicbox(F(m), vel * 0.7, RM, dur=1.4)
    else: raise ValueError(inst)
    place(mus, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))

def pizz_groove(t0, t1, chords, vel=0.55, hi=True):
    """light comedic pizzicato: bass on 1 and 3, chord stabs on the offbeats"""
    k = 0; t = t0
    while t < t1 - 0.05:
        c = chords[(k // 4) % len(chords)]
        beat = k % 4
        if beat in (0, 2): note("pluck", t, c[0] - 12, 0.6, vel, -0.2)
        else:
            for m in c[1:]: note("pluck", t + Q * 0.0, m, 0.4, vel * 0.55, 0.25)
        if hi and beat == 3 and (k // 4) % 2 == 1: note("glock", t + Q * 0.5, c[-1] + 12, 0.3, vel * 0.5, 0.3)
        t += Q; k += 1

C, G7, Am, F_, Dm, E7 = [48, 64, 67, 72], [43, 62, 65, 71], [45, 64, 69, 72], [41, 65, 69, 72], [38, 65, 69, 74], [40, 64, 68, 71]
# hook: tense low ostinato, rising
t = 0.0; k = 0
while t < flash - 0.2:
    m = [45, 45, 52, 45, 46, 45, 53, 52][k % 8] - 12
    note("pluck", t, m, 0.4, 0.5 + 0.03 * (k // 8), -0.1)
    if k % 4 == 0: note("tuba", t, m, Q * 1.6, 0.45)
    t += Q / 2; k += 1
# calm: happy pizzicato in C (garden, fish, rig)
pizz_groove(flash + 0.1, fr(533), [C, Am, F_, G7], 0.5)
for k, (tt0, m) in enumerate([(word("fish"), 84), (word("fish") + 0.2, 88), (word("garden"), 91)]): note("glock", tt0, m, 0.3, 0.5, 0.3)
note("tuba", word("stuck"), 31, 0.6, 0.8)  # the clunk
# trouble: minor ostinato building to the canal, with tuba hits on the big moments
t = word("then"); k = 0
while t < word("wait") - 0.1:
    prog = [Am, Am, Dm, E7][(k // 8) % 4]
    note("pluck", t, prog[0] - 12 + (0 if k % 2 == 0 else 7), 0.3, 0.45 + 0.25 * min(1, (t - word("then")) / 18), -0.2)
    if k % 2 == 1: note("pluck", t, prog[1 + (k // 2) % 3], 0.25, 0.35, 0.3)
    t += Q / 2; k += 1
for tt0 in [word("swallows"), word("tugboat", 1), word("barges", 1), word("waterfall")]: note("tuba", tt0, 33, 0.9, 0.85)
# Wait: silence. Mine: low pulse + glock pings
t = fr(1170); k = 0
while t < fr(1345):
    note("pluck", t, 33 if k % 4 else 28, 0.5, 0.45, -0.1)
    if k % 8 == 6: note("glock", t, 76, 0.3, 0.35, 0.4)
    t += Q; k += 1
# alarm: fast repeated notes; "Luckily": bright major stab; "Unluckily": sad trombone slide
for k in range(8): note("pluck", fr(1345) + k * Q / 2, 45 + (k % 2) * 3, 0.2, 0.55)
for m in [60, 64, 67, 72]: note("pluck", word("luckily"), m, 0.6, 0.6, 0.2)
note("glock", word("luckily") + 0.05, 84, 0.4, 0.6)
for k, m in enumerate([55, 54, 53]): note("bone", word("unluckily") + 0.15 + 0.38 * k, m, 0.36, 0.55)
note("bone", word("unluckily") + 0.15 + 3 * 0.38, 52, 1.1, 0.55)
# explanation: music box over a soft pizz in F, building on "So the faster ... bigger"
pizz_groove(fr(1486), fr(1840), [F_, C, Dm, G7], 0.38, hi=False)
mel = [72, 74, 76, 79, 77, 76, 74, 72, 69, 72, 74, 76]
for k, m in enumerate(mel): note("mbox", word("picture") + k * Q, m + 12, 0.5, 0.45, 0.2)
for k in range(8): note("pluck", word("so") + k * Q / 2, 60 + k, 0.25, 0.4 + 0.04 * k, 0.1)
# golden: warm pad + slow pizz; cork pops get glock blips; final button on "saltier"
place(mus, I.pad([F(48), F(55), F(64), F(67)], fr(1958) - fr(1840), 0.35, RM, att=1.2, rel=1.0), fr(1840), dbg(-3))
pizz_groove(fr(1918), word("saltier") - 0.2, [C, F_, C, G7], 0.45)
for k in range(9): note("glock", fr(1958 + k * 6) + 0.1, [79, 81, 83, 84, 86, 88, 89, 91, 93][k], 0.2, 0.45, -0.4 + 0.1 * k)
for m in [48, 60, 64, 67, 72]: note("pluck", word("saltier") + 0.45, m, 0.9, 0.7)
note("tuba", word("saltier") + 0.45, 36, 0.8, 0.7)

# ======================= mix =======================
voice, vsr = read_wav(os.path.join(ROOT, "shorts/lake/voice/voice.wav"))
assert vsr == SR, vsr
if voice.shape[0] == 1: voice = np.concatenate([voice, voice])
v = np.zeros((2, N)); v[:, : min(N, voice.shape[1])] = voice[:, :N]
ir = make_ir(0.9, 3)
mus = 0.8 * mus + 0.2 * convolve_st(mus, ir)[:, :N]
sfx = 0.85 * sfx + 0.15 * convolve_st(sfx, ir)[:, :N]
# levels: music bed ~16 LU under the voice, SFX ~8 LU under; then the house offsets (music +3 dB, SFX -6 dB)
Lv = integrated(v)
def to(x, target):
    L = integrated(x)
    return x * (10 ** ((target - L) / 20)) if np.isfinite(L) else x
mus = to(mus, Lv - 16 + 3)
sfx = to(sfx, Lv - 8 - 6)
# duck the music under the voice (envelope follower on the voice)
ve = np.abs(v[0]); win = ns(0.15)
ve = np.convolve(ve, np.ones(win) / win, mode="same")
duck = 1 - 0.45 * np.clip(ve / (np.percentile(ve, 95) + 1e-9), 0, 1)
mus *= duck[None, :]
mix = v + mus + sfx
def limit(x, thr_db=-1.5, rel=0.08):
    """look-ahead peak limiter: gain follows the 2 ms peak envelope, instant attack, smooth release"""
    thr = 10 ** (thr_db / 20); w = ns(0.002)
    pk = np.max(np.abs(x), axis=0)
    pk = np.maximum.reduce([np.roll(pk, -k) for k in range(w)])
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9))
    a = np.exp(-1 / (rel * SR)); out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    return x * out[None, :]
gain = 1.0
for _ in range(3):  # normalise, limit, re-measure
    k = 10 ** ((-14 - integrated(mix)) / 20); mix = limit(mix * k); gain *= k
tp = true_peak(mix)
if tp > -1.0: mix *= 10 ** ((-1.0 - tp) / 20)
write_wav(os.path.join(OUT, "mix.wav"), mix)
write_wav(os.path.join(OUT, "music.wav"), mus * gain)
write_wav(os.path.join(OUT, "sfx.wav"), sfx * gain)
with open(os.path.join(OUT, "cues.md"), "w") as fh:
    fh.write("# Lake short sound cues\n\n| time (s) | frame | cue |\n|---|---|---|\n")
    for t0, name in sorted(cues): fh.write(f"| {t0:6.2f} | {round(t0 * FPS)} | {name} |\n")
print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", round(mix.shape[1] / SR, 2), "s")
