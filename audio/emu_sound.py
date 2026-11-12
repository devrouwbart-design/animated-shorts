# Sound for "The War We Lost to a Bird": synthesized SFX + an original comic score (country pizzicato for the farm, a
# fife-and-snare army march that keeps falling apart), ducked under the Henry narration, mixed to -14 LUFS.
# Every event time comes from shorts/emu/voice/words.json (frames = s x 30) and src/videos/emu/story.ts.
# Reuses the bridge / lake generators (sfx_gen.py, instruments.py, dsp.py).
# usage: python audio/emu_sound.py   ->  shorts/emu/audio/{mix.wav, music.wav, sfx.wav, cues.md} + public/emu/mix.wav
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dsp import (SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, pan, place, widen, make_ir, convolve_st, integrated,
                 true_peak, read_wav, write_wav, phase, dbg)
import sfx_gen as S
import instruments as I

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "shorts/emu/audio")
os.makedirs(OUT, exist_ok=True)
FPS, TOTAL = 30, 2130
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
W = {}
for w in json.load(open(os.path.join(ROOT, "shorts/emu/voice/words.json"))):
    W.setdefault(w["word"], []).append(max(0.0, w["start"]))
def word(w, k=0):
    return W[w][k]

sfx = np.zeros((2, N))
cues = []
def ev(t, x, g_db=0.0, p=0.0, name=""):
    x = np.asarray(x, float)
    y = pan(x, p) if x.ndim == 1 else x
    place(sfx, y, max(0.0, t), dbg(g_db))
    if name:
        cues.append((t, name))

def addm(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out

def env_seg(dur, fin, fout):
    n = ns(dur); e = np.ones(n)
    a, b = ns(fin), ns(fout)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] *= np.linspace(1, 0, b)
    return e

def engine(dur, r, f0=38, rev=None):
    """1930s truck: low lumpy four-cylinder putter with exhaust bark and a rattling body"""
    n = ns(dur); t = np.arange(n) / SR
    f = f0 * (1 + 0.9 * (rev(t) if rev else 0)) * (1 + 0.03 * smooth_noise(n, r, 4))
    ph = phase(f)
    pulses = np.maximum(0, np.sin(ph)) ** 6 * (1 + 0.3 * np.sin(ph * 0.25 + 1))
    y = lp(pulses, 700, 2) * 1.2 + bp(colored(n, r, 0.6), 200, 1400, 1) * 0.15 * (0.5 + pulses)
    y += S.rattle(dur, r, 14) * 0.18
    return y * 0.7

def emu_boom(r, f0=58, n_pulse=3):
    """emus 'drum': a deep, hollow thudding boom from the throat sac"""
    out = np.zeros(ns(0.25 * n_pulse + 0.4))
    for k in range(n_pulse):
        d = 0.32; t = tt(d)
        y = np.sin(phase(f0 * (1 + 0.15 * np.exp(-t / 0.05)))) * np.exp(-t / 0.11) * (1 - np.exp(-t / 0.012))
        y += 0.3 * bp(r.standard_normal(len(t)), 120, 400, 1) * np.exp(-t / 0.06)
        place_mono(out, y * (1 - 0.15 * k), 0.24 * k)
    return lp(out, 500)

def place_mono(buf, x, t):
    i = ns(t); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[: j - i]

def patter(dur, r, rate=14, bright=1800, env=None):
    """many bird feet running on hard dirt"""
    out = np.zeros(ns(dur)); t = 0.0
    while t < dur:
        x = S.stroll_step(r, 0.2) * (0.5 + 0.5 * r.random())
        place_mono(out, x, t)
        t += r.exponential(1.0 / rate)
    out = bp(out, 80, bright, 1)
    if env is not None: out *= env[: len(out)]
    return out

def crunch(r):
    """beak into dry wheat"""
    d = 0.09; t = tt(d)
    return bp(r.standard_normal(len(t)), 1500, 6000, 1) * np.exp(-t / 0.02) * 0.8 + S.wood_crack(r)[: len(t)] * 0.2

def gunshot(r):
    """one Lewis-gun round: a short crack with a low body"""
    d = 0.16; t = tt(d)
    crack = hp(r.standard_normal(len(t)), 1200) * np.exp(-t / 0.008)
    body = lp(r.standard_normal(len(t)), 400) * np.exp(-t / 0.04) * 1.4 + np.sin(phase(70 + 0 * t)) * np.exp(-t / 0.05) * 0.6
    return crack * 0.9 + body

def burst(dur, r, rate=9.0):
    out = np.zeros(ns(dur + 0.2)); t = 0.0
    while t < dur:
        place_mono(out, gunshot(r) * (0.85 + 0.3 * r.random()), t); t += 1 / rate * (0.95 + 0.1 * r.random())
    return out

def hiss(dur, r, lo=1800, hi=7000):
    n = ns(dur)
    return bp(colored(n, r, 0.3), lo, hi, 1) * (0.8 + 0.2 * smooth_noise(n, r, 8))

def clink_many(r, n=6, spread=0.5):
    out = np.zeros(ns(spread + 0.3))
    for k in range(n): place_mono(out, S.clink(r, 2600 + 900 * r.random(), 0.12, 1.0) * (0.6 + 0.4 * r.random()), spread * r.random())
    return out

# ======================= SFX timeline =======================
R = rng(21)
flash = fr(152)
# hook: hot open paddock, a fly, the gun cocked; the emu blinks and booms
ev(0, S.breeze(fr(152), R, 0.6, bright=1200) * env_seg(fr(152), 0.3, 0.2), -14, 0, "outback breeze")
ev(0.3, widen(S.bird_chirps(4.5, R, 0.25), R, 9, 0.8), -16)
ev(0.8, S.clink(R, 1400, 0.2, 0.7), -10, -0.3, "gun cocked")
ev(fr(95) - 0.05, emu_boom(R), -2, 0.2, "emu booms on 'bird'")
ev(fr(124), patter(1.0, R, 22, 2400), -4, 0, "emu sprints past")
ev(fr(126), S.whoosh(0.7, R, 0.25, 400, 2600, 0.8, 0.2), -6, 0.3)
for k, f0 in enumerate([128, 132, 136]): ev(fr(f0), lp(R.standard_normal(ns(0.35)), 900) * np.exp(-tt(0.35) / 0.08) * 0.8, -10, -0.3 + 0.3 * k, "dust puffs" if k == 0 else "")
ev(flash - 0.25, S.whoosh(0.7, R, 0.2, 600, 4000, 0.7, 0.25), -4, 0, "flash whoosh")
# the farm: breeze, birds, the windmill turning
farm1 = fr(386)
ev(flash, S.breeze(farm1 - flash, R, 0.5) * env_seg(farm1 - flash, 0.5, 0.5), -16, 0, "farm breeze")
ev(flash, widen(S.bird_chirps(farm1 - flash, R, 0.5), R, 9, 0.8), -12, 0, "birds")
ev(fr(160), S.creak(3.0, R, 30, 40, rough=0.1, noise=0.03, scale=0.4) * 0.5, -18, -0.5, "windmill creak")
# the herd walks in; munching
ev(fr(386), patter(fr(471) - fr(386), R, 30, 1400, env_seg(fr(471) - fr(386), 1.0, 0.4)), -8, 0, "herd footsteps")
for k, f0 in enumerate([400, 425, 446]): ev(fr(f0), emu_boom(R, 52 + 6 * k, 2), -8, -0.4 + 0.4 * k, "emu grunts" if k == 0 else "")
for k in range(8): ev(fr(452) + 0.18 * k, crunch(R), -6, 0.1, "munching on 'dinner'" if k == 0 else "")
ev(fr(471), widen(S.bird_chirps(fr(555) - fr(471), R, 0.3), R, 9, 0.8), -16)
for k in range(5): ev(fr(480) + 0.5 * k, crunch(R), -14, 0.5)
# the army arrives: truck putters up, brakes squeak, doors, boxes
ev(fr(548), engine(fr(694) - fr(548), R, 34, rev=lambda t: np.clip(1 - t / 2.0, 0, 1) * 0.5) * env_seg(fr(694) - fr(548), 0.6, 0.5), -6, -0.3, "truck engine")
ev(fr(598), S.swing_squeak(R, 1.0) * 0.7, -10, -0.2, "brakes squeak")
ev(fr(606), S.push_thump(R), -10, -0.2, "door")
for k, f0 in enumerate([614, 626, 644]): ev(fr(f0), S.clink(R, 1100, 0.15, 0.8), -10, 0.2 * k, "gun clacks" if k == 0 else "")
ev(fr(675), addm(S.push_thump(R) * 1.2, S.wood_crack(R) * 0.5), -4, 0, "ammo boxes land")
# rain
r0, r1 = fr(690), fr(742)
ev(r0, widen(hiss(r1 - r0, R, 1200, 9000) * env_seg(r1 - r0, 0.15, 0.25), R, 12, 1.0) + 0.4 * S.water_bed(r1 - r0, R, 0.3, 1.5) * env_seg(r1 - r0, 0.15, 0.25)[None, :], -6, 0, "rain")
ev(r0 + 0.2, lp(colored(ns(2.0), R, 2.0), 160) * np.exp(-tt(2.0) / 0.7) * 2.0, -6, 0, "thunder")
# the emus split up and run off
ev(fr(737), patter(fr(812) - fr(737), R, 40, 1800, env_seg(fr(812) - fr(737), 0.2, 1.0)), -8, 0, "emus scatter")
ev(fr(796), S.whoosh(0.5, R, 0.1, 500, 2000, 0.6, 0.2), -12, 0)
# the dam: still water, birds; the ambush
d0, d1 = fr(808), fr(1070)
ev(d0, S.water_bed(d1 - d0, R, 0.3, 0.3) * env_seg(d1 - d0, 0.4, 0.4)[None, :], -16, 0, "dam water")
ev(d0, widen(S.bird_chirps(fr(984) - d0, R, 0.4), R, 9, 0.8), -14)
for k in range(10): ev(fr(875) + 0.35 * k, S.bubbles(0.2, R, 40, 600, 2400, (0.004, 0.012)) * 0.8, -12, -0.5 + 0.1 * k, "drinking slurps" if k == 0 else "")
ev(fr(930), S.clink(R, 1300, 0.2, 0.7), -12, 0, "safety off")
# open fire: Lewis gun bursts until the jam
ev(fr(990), burst(fr(1006) - fr(990), R), -1, 0, "open fire")
ev(fr(1006), burst(fr(1051) - fr(1006), R), -3, 0)
ev(fr(993), patter(2.5, R, 50, 2000, env_seg(2.5, 0.05, 1.0)), -8, 0.3, "emus flee")
for k in range(6): ev(fr(1010) + 0.3 * k, S.whoosh(0.3, R, 0.05, 1500, 4000, 0.5, 0.1), -16, -0.5 + 0.2 * k)
ev(fr(1051), addm(S.clink(R, 900, 0.25, 0.6) * 1.4, S.bolt_snap(R) * 0.3), 0, 0, "the gun jams: CLICK")
ev(fr(1053), hiss(0.9, R, 800, 3000) * np.exp(-tt(0.9) / 0.4), -12, 0, "jam smoke hiss")
# plan B: the truck
ev(fr(1070), engine(fr(1165) - fr(1070), R, 34), -8, 0, "truck idling")
ev(fr(1150), engine(1.0, R, 34, rev=lambda t: np.clip(t / 0.4, 0, 1)) * 0.9, -4, 0, "truck lurches")
# the bumpy chase
c0, c1 = fr(1165), fr(1303)
ev(c0, engine(c1 - c0, R, 50, rev=lambda t: 0.4 + 0.2 * np.sin(t * 3)) * env_seg(c1 - c0, 0.1, 0.05), -4, 0, "truck chase engine")
ev(c0, patter(c1 - c0, R, 35, 2200) * env_seg(c1 - c0, 0.2, 0.05), -8, 0.3, "emus running")
tb = c0
while tb < c1 - 0.2:
    ev(tb, addm(S.push_thump(R) * 0.8, S.rattle(0.3, R, 60, heavy=True) * 0.6), -6, -0.2, "bumps" if tb == c0 else "")
    tb += 0.28 + 0.25 * R.random()
for t0 in [fr(1205), fr(1250)]: ev(t0, burst(0.5, R, 9), -6, 0, "a burst at nothing")
# "Wait." dropout: one emu boom
ev(word("wait") + 0.1, emu_boom(R, 62, 2), -4, 0, "Wait: dropout, emu boom")
ev(word("six-foot"), S.whoosh(0.6, R, 0.3, 300, 1500, 0.7, 0.2), -10, 0, "tilt up")
# the hose
h0 = fr(1420)
ev(h0, hiss(fr(1508) - h0, R, 1500, 8000) * env_seg(fr(1508) - h0, 0.05, 0.2), -6, 0.2, "hose spray")
ev(h0 + 0.3, S.water_bed(fr(1508) - h0 - 0.3, R, 1.0, 2.5) * 0.6, -8, -0.2, "soldiers soaked")
for k in range(6): ev(fr(1488) + 0.12 * k, S.bubbles(0.15, R, 30, 1500, 3500, (0.003, 0.008)), -12, -0.3 + 0.12 * k, "drips" if k == 0 else "")
ev(fr(1512), hiss(fr(1626) - fr(1512), R, 1500, 8000) * env_seg(fr(1626) - fr(1512), 0.05, 0.4), -8, 0.2)
ev(fr(1530), patter(3.2, R, 45, 2200, env_seg(3.2, 0.05, 1.5)), -6, 0, "emus run every way")
for k in range(4): ev(fr(1530) + 0.7 * k, S.splash_big(R)[: ns(0.6)] * 0.5, -14, -0.4 + 0.25 * k)
# the major; the count
ev(fr(1640), patter(2.5, R, 3, 1200), -12, 0.3, "emu strolls past")
for k in range(3): ev(fr(1773) + 0.2 * k, clink_many(R, 8, 0.6), -10, -0.3 + 0.3 * k, "brass casings" if k == 0 else "")
for k in range(10): ev(fr(1866) + 0.09 * k, S.clink(R, 3000 + 150 * k, 0.1, 1.0), -14, -0.4 + 0.08 * k, "ten casings tinkle" if k == 0 else "")
# golden: the army goes home; coins; the coat of arms; the backfire
g0 = fr(1906)
ev(g0, widen(addm(S.crickets(DUR - g0, R, 3) * 0.4, S.bird_chirps(DUR - g0, R, 0.2)), R, 9, 0.8), -14, 0, "evening birds + crickets")
ev(g0, engine(fr(1958) - g0, R, 36) * env_seg(fr(1958) - g0, 0.2, 1.0), -8, 0.3, "truck drives away")
ev(word("paid"), clink_many(R, 7, 0.35), -6, 0.1, "coins jingle")
ev(fr(2081), engine(fr(2130) - fr(2081), R, 30) * 0.5, -18, 0.4)
ev(word("doesn't") + 0.05, addm(gunshot(R) * 1.5, lp(R.standard_normal(ns(0.6)), 300) * np.exp(-tt(0.6) / 0.15)), -6, 0.4, "truck backfires")

# ======================= music =======================
mus = np.zeros((2, N))
F = I.m2f
BPM = 116; Q = 60 / BPM
RM = rng(7)
def note(inst, t, m, dur=0.5, vel=0.6, p=0.0, g=0.0):
    if inst == "pluck": x = I.pluck(F(m), vel, RM, dur=max(0.5, dur))
    elif inst == "glock": x = I.glock(F(m), vel * 0.6, RM, dur=1.2)
    elif inst == "tuba": x = I.brass(F(m), dur, vel, RM, kind="tuba")
    elif inst == "horn": x = I.brass(F(m), dur, vel, RM, kind="horn")
    elif inst == "bone": x = I.brass(F(m), dur, vel, RM, kind="horn", fall=-5.0)
    elif inst == "mbox": x = I.musicbox(F(m), vel * 0.7, RM, dur=1.4)
    elif inst == "fife": x = I.fife(F(m), dur, vel * 0.5, RM)
    elif inst == "snare": x = I.snare(vel, RM)
    elif inst == "timp": x = I.timpani(F(m), vel, RM)
    else: raise ValueError(inst)
    place(mus, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))

def pizz_groove(t0, t1, chords, vel=0.55, hi=True, q=Q):
    """light comedic pizzicato: bass on 1 and 3, chord stabs on the offbeats"""
    k = 0; t = t0
    while t < t1 - 0.05:
        c = chords[(k // 4) % len(chords)]
        beat = k % 4
        if beat in (0, 2): note("pluck", t, c[0] - 12, 0.6, vel, -0.2)
        else:
            for m in c[1:]: note("pluck", t, m, 0.4, vel * 0.55, 0.25)
        if hi and beat == 3 and (k // 4) % 2 == 1: note("glock", t + q * 0.5, c[-1] + 12, 0.3, vel * 0.5, 0.3)
        t += q; k += 1

def march(t0, t1, vel=0.6, fife_mel=None, wobble=0.0):
    """army march: snare on every beat with a ruff on 4, tuba oom-pah, optional fife tune"""
    k = 0; t = t0
    while t < t1 - 0.05:
        beat = k % 4
        dt = wobble * (RM.random() - 0.5) * Q
        note("snare", t + dt, 0, vel=vel * (1.0 if beat == 0 else 0.6))
        if beat == 3: note("snare", t + Q * 0.5 + dt, 0, vel=vel * 0.5)
        note("tuba", t + dt, [36, 43, 36, 43][beat] if (k // 8) % 2 == 0 else [41, 36, 41, 36][beat], Q * 0.7, vel * 0.8)
        if fife_mel:
            m = fife_mel[k % len(fife_mel)]
            if m: note("fife", t + dt, m, Q * 0.9, vel * 0.9, 0.2)
        t += Q; k += 1

C, G7, Am, F_, Dm, E7 = [48, 64, 67, 72], [43, 62, 65, 71], [45, 64, 69, 72], [41, 65, 69, 72], [38, 65, 69, 74], [40, 64, 68, 71]
# hook: a western stand-off: low pluck pulse + one tuba note, a glock blink on "bird"
t = 0.0; k = 0
while t < flash - 0.2:
    note("pluck", t, [40, 40, 47, 40][k % 4] - 12, 0.4, 0.45 + 0.02 * k, -0.1)
    t += Q; k += 1
note("tuba", word("bird"), 28, 0.8, 0.7)
note("glock", word("bird", 1) + 0.15, 88, 0.3, 0.6, 0.3)
note("bone", word("won") + 0.1, 50, 0.9, 0.5)
# the farm: happy country pizz in C; plodding tuba as the herd walks in
pizz_groove(flash + 0.1, fr(386), [C, F_, C, G7], 0.5)
for k, m in enumerate([72, 76, 79, 84]): note("glock", word("wheat", 1) + 0.12 * k, m + 12, 0.2, 0.45, 0.3)
t = fr(386); k = 0
while t < fr(471):
    note("tuba", t, [36, 31, 33, 31][k % 4], Q * 0.8, 0.6); note("pluck", t + Q / 2, [55, 52, 53, 52][k % 4], 0.3, 0.35, 0.3)
    t += Q; k += 1
note("glock", word("dinner") + 0.1, 91, 0.3, 0.6)
# the farmers: indignant minor pizz; the army: march with a fife tune
pizz_groove(fr(471), fr(553), [Am, Dm, E7, Am], 0.5, hi=False)
FIFE = [72, 74, 76, 72, 79, 0, 77, 76, 74, 76, 72, 0, 71, 72, 74, 0]
march(word("army", 1) - 0.05, fr(694), 0.6, FIFE)
note("timp", word("bullets"), 43, vel=0.8)
# rain: the march falls apart; one sad trombone
for k, m in enumerate([55, 54, 53]): note("bone", word("rains") + 0.2 + 0.36 * k, m, 0.34, 0.5)
note("bone", word("rains") + 0.2 + 3 * 0.36, 52, 0.9, 0.5)
# split up: scurrying pizz runs
for k in range(16): note("pluck", fr(744) + k * Q / 4, 72 + [0, 2, 4, 7, 9, 7, 4, 2][k % 8] - (k // 8) * 12, 0.2, 0.45, -0.5 + k * 0.06)
note("tuba", word("range") + 0.1, 31, 0.7, 0.6)
# the ambush: sneaky low ostinato, building
t = fr(812); k = 0
while t < fr(990):
    note("pluck", t, [33, 33, 40, 33, 34, 33, 41, 40][k % 8], 0.3, 0.4 + 0.25 * min(1, (t - fr(812)) / 5.5), -0.2)
    if k % 4 == 2: note("pluck", t, 57, 0.2, 0.3, 0.3)
    t += Q / 2; k += 1
note("timp", fr(984), 40, vel=0.9)
# firing: snare roll until the jam; then silence and a tuba 'bwomp'
for tr, vr in I.snare_roll(fr(990), fr(1050), 0.4, 0.8, RM): place(mus, pan(I.snare(vr, RM, buzz=True), 0.0), tr, dbg(-4))
note("bone", word("jams") + 0.3, 41, 1.2, 0.7)
# Luckily: bright stab; plan B: the march again, faster; the chase: a galop
for m in [60, 64, 67, 72]: note("pluck", word("luckily"), m, 0.6, 0.6, 0.2)
note("glock", word("b") + 0.05, 84, 0.4, 0.6)
march(word("truck") - 0.3, fr(1165), 0.55, None)
Q2 = Q * 0.62; t = fr(1165); k = 0
while t < word("aim") - 0.05:
    c = [C, G7, C, G7, F_, C, G7, C][(k // 4) % 8]
    note("pluck", t, c[0] - 12 if k % 2 == 0 else c[1], 0.25, 0.55, -0.2 if k % 2 == 0 else 0.3)
    if k % 2 == 0: note("snare", t, 0, vel=0.4)
    if k % 4 == 3: note("glock", t, c[-1] + 12, 0.2, 0.35, 0.4)
    t += Q2; k += 1
for k, m in enumerate([55, 54, 53]): note("bone", word("unluckily") + 0.15 + 0.32 * k, m, 0.3, 0.45)
note("tuba", word("aim") + 0.1, 30, 0.8, 0.7)
# Wait: silence. Explanation: music box over soft pizz in F
pizz_groove(word("picture") - 0.1, fr(1626), [F_, C, Dm, G7], 0.38, hi=False)
mel = [72, 74, 76, 79, 77, 76, 74, 72, 69, 72, 74, 76, 77, 79, 81, 84]
for k, m in enumerate(mel): note("mbox", word("picture") + k * Q, m + 12, 0.5, 0.45, 0.2)
for k in range(12): note("pluck", word("never") + k * Q / 4, 84 - [0, 3, 5, 7, 10, 12][k % 6], 0.2, 0.4, -0.6 + 0.1 * k)
# the major: slow, grand-but-silly march in minor; tuba on "tanks"
march(fr(1626), fr(1732), 0.45, [69, 0, 72, 0, 71, 0, 68, 0], wobble=0.15)
note("tuba", word("tanks"), 29, 1.0, 0.85); note("timp", word("tanks"), 41, vel=0.9)
# the count: ticking pluck + glock per number
t = fr(1732); k = 0
while t < fr(1906):
    note("pluck", t, [45, 52][k % 2], 0.3, 0.4, 0.0); t += Q; k += 1
for w, m in [("nine", 76), ("hundred", 77), ("eighty-six", 79), ("ten", 81)]: note("glock", word(w), m + 12, 0.3, 0.5, 0.3)
note("glock", word("bird", 3), 96, 0.4, 0.6)
# golden: warm pad + slow pizz; proud fanfare on the coat of arms; sad trombone button for the army
place(mus, I.pad([F(48), F(55), F(64), F(67)], fr(1999) - fr(1906), 0.35, RM, att=1.2, rel=1.0), fr(1906), dbg(-3))
pizz_groove(fr(1910), fr(1999), [C, F_, C, G7], 0.42)
fan = [(0, 67, 1), (1, 72, 1), (2, 76, 1), (3, 79, 2.5)]
for b, m, d in fan:
    note("horn", word("today") + b * Q * 0.75, m - 12, Q * 0.75 * d, 0.6)
    note("fife", word("today") + b * Q * 0.75, m + 12, Q * 0.75 * d, 0.55, 0.2)
for tr, vr in I.snare_roll(word("today"), word("today") + 3 * Q * 0.75, 0.3, 0.6, RM): place(mus, pan(I.snare(vr, RM, buzz=True), 0.0), tr, dbg(-8))
place(mus, I.pad([F(48), F(55), F(64), F(72)], fr(2081) - word("arms"), 0.45, RM, att=0.4, rel=0.6), word("arms"), dbg(-2))
note("timp", word("arms"), 36, vel=0.8)
for k, m in enumerate([55, 54, 53]): note("bone", word("doesn't") + 0.25 + 0.3 * k, m, 0.28, 0.6)
note("bone", word("doesn't") + 0.25 + 3 * 0.3, 52, 1.0, 0.6)

# ======================= mix =======================
voice, vsr = read_wav(os.path.join(ROOT, "shorts/emu/voice/voice.wav"))
assert vsr == SR, vsr
if voice.shape[0] == 1: voice = np.concatenate([voice, voice])
v = np.zeros((2, N)); v[:, : min(N, voice.shape[1])] = voice[:, :N]
ir = make_ir(0.9, 3)
mus = 0.8 * mus + 0.2 * convolve_st(mus, ir)[:, :N]
sfx = 0.85 * sfx + 0.15 * convolve_st(sfx, ir)[:, :N]
# levels: music bed ~12 LU under the voice, SFX ~5 LU under; then the house offsets (music +3 dB, SFX -6 dB)
Lv = integrated(v)
def to(x, target):
    L = integrated(x)
    return x * (10 ** ((target - L) / 20)) if np.isfinite(L) else x
mus = to(mus, Lv - 12 + 3)
sfx = to(sfx, Lv - 5 - 6)
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
for _ in range(3):
    k = 10 ** ((-14 - integrated(mix)) / 20); mix = limit(mix * k); gain *= k
tp = true_peak(mix)
if tp > -1.0: mix *= 10 ** ((-1.0 - tp) / 20)
write_wav(os.path.join(OUT, "mix.wav"), mix)
os.makedirs(os.path.join(ROOT, "public/emu"), exist_ok=True)
write_wav(os.path.join(ROOT, "public/emu/mix.wav"), mix)  # what the EmuShort composition plays
write_wav(os.path.join(OUT, "music.wav"), mus * gain)
write_wav(os.path.join(OUT, "sfx.wav"), sfx * gain)
with open(os.path.join(OUT, "cues.md"), "w") as fh:
    fh.write("# Emu short sound cues\n\n| time (s) | frame | cue |\n|---|---|---|\n")
    for t0, name in sorted(cues): fh.write(f"| {t0:6.2f} | {round(t0 * FPS)} | {name} |\n")
print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", round(mix.shape[1] / SR, 2), "s")
