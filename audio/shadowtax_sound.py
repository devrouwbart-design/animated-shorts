# Sound for "The King Who Taxed Shadows": synthesized SFX + an original score, ducked under the Henry narration, mixed
# to -14 LUFS. The picture runs on the narration clock, so event times are frames (s x 30) straight from
# shorts/shadowtax/voice/words.json and src/videos/shadowtax/story.ts. Reuses the shared generators (sfx_gen.py,
# instruments.py, dsp.py) and the Apollo 13 mix chain.
# usage: python audio/shadowtax_sound.py  ->  shorts/shadowtax/audio/{mix.wav, music.wav, sfx.wav, cues.md} + public/shadowtax/mix.wav
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dsp import (SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, pan, place, widen, make_ir, convolve_st, integrated,
                 true_peak, read_wav, write_wav, phase, dbg)
import sfx_gen as S
import instruments as I

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "shorts/shadowtax/audio")
os.makedirs(OUT, exist_ok=True)
FPS = 30
TOTAL = 1777                      # src/videos/shadowtax/timing.ts REAL_FRAMES
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
W = {}
for w in json.load(open(os.path.join(ROOT, "shorts/shadowtax/voice/words.json"))):
    W.setdefault(w["word"].lower(), []).append(w["start"])
def word(w, k=0):
    return W[w.lower()][k]

sfx = np.zeros((2, N))
cues = []
def ev(t, x, g_db=0.0, p=0.0, name=""):
    x = np.asarray(x, float)
    y = pan(x, p) if x.ndim == 1 else x
    place(sfx, y, t, dbg(g_db))
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

def bed(t0, t1, x, g, name="", fin=0.3, fout=0.3):
    d = t1 - t0
    ev(t0, x * env_seg(d, fin, fout)[None, :] if np.ndim(x) == 2 else x * env_seg(d, fin, fout), g, 0, name)

# ---------------- generators ----------------
def thud(r, f0=110, dur=0.3, bright=0.3):
    t = tt(dur)
    y = np.sin(phase(f0 * (1 + 0.8 * np.exp(-t / 0.01)))) * np.exp(-t / 0.06) + bp(r.standard_normal(len(t)), 200, 2500, 1) * np.exp(-t / 0.012) * bright
    return fades(y, 0.0005, 0.05)

def coin(r, f0=2900):
    """a gold coin landing on cobbles: bright ring + two little bounces"""
    t = tt(0.9)
    ring = sum(np.sin(2 * np.pi * f0 * k * t) * np.exp(-t / (0.25 / k)) / k for k in (1, 2.76, 5.4))
    out = addm(ring * 0.5, S.clink(r, f0 * 1.3, 0.12, 0.8))
    for dt, a in [(0.16, 0.5), (0.27, 0.3)]:
        i = ns(dt); c = S.clink(r, f0 * 1.1, 0.1, 0.6) * a; out[i:i + len(c)] += c[: len(out) - i]
    return fades(out, 0.0005, 0.05)

def crinkle(r, dur=0.5, dens=0.012):
    n = ns(dur)
    k = (r.random(n) < dens).astype(float) * r.standard_normal(n)
    return fades(bp(k * 4, 1500, 8000, 1) * np.exp(-tt(dur) / (dur * 0.6)), 0.002, 0.05)

def unroll(r, dur=1.0):
    """a long scroll unrolling down to the ground: paper flutter, then a soft slap"""
    n = ns(dur); t = np.arange(n) / SR
    fl = bp(colored(n, r, 0.4), 900, 6000, 1) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * t))) * np.exp(-((t - dur * 0.45) / (dur * 0.35)) ** 2)
    return addm(fl * 0.8, crinkle(r, dur, 0.02) * 0.6, np.pad(thud(r, 180, 0.25, 0.9) * 0.7, (ns(dur * 0.85), 0)))

def rip(r, dur=0.45):
    n = ns(dur); t = np.arange(n) / SR
    k = (r.random(n) < 0.08).astype(float) * r.standard_normal(n)
    return fades(bp(k * 3 + colored(n, r, 0.5) * 0.5, 900, 7000, 1) * np.exp(-((t - dur * 0.4) / (dur * 0.3)) ** 2), 0.002, 0.04)

def hiss(dur, r):
    n = ns(dur)
    return bp(colored(n, r, 0.2), 2500, 9000, 2) * (0.7 + 0.3 * smooth_noise(n, r, 9)) * np.exp(-tt(dur) / (dur * 0.6))

def tick(r):
    t = tt(0.05)
    return fades(hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.004) * 0.6 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.01) * 0.3, 0.0002, 0.01)

def honk(r, f0=330, dur=0.38):
    """a goose honk: nasal, slightly falling, buzzy"""
    t = tt(dur); f = f0 * (1.08 - 0.12 * t / dur)
    y = np.sign(np.sin(phase(f))) * 0.35 + np.sin(phase(f * 2)) * 0.2
    y = bp(y, 500, 2600, 2) * np.minimum(1, t / 0.02) * np.exp(-((t - dur * 0.4) / (dur * 0.5)) ** 2)
    return fades(y, 0.002, 0.03)

def sparkle(r, dur=0.6):
    """a little twinkle of light: three soft high glock-like blips"""
    out = np.zeros(ns(dur))
    for k, f in enumerate([2637, 3136, 3951]):
        x = I.glock(f, 0.35, r, dur=0.5); i = ns(0.07 * k); out[i:i + len(x)] += x[: len(out) - i]
    return out

def town(dur, r, crowd=1.0, birds=0.6):
    """a busy little market square: murmur of townsfolk, footsteps, a few birds"""
    n = ns(dur)
    vo = sum(S.babble(dur, r, r.uniform(110, 210), r.uniform(0.9, 1.15), 3.8, 0.45) * r.uniform(0.06, 0.1) for _ in range(5)) * crowd
    y = widen(vo + lp(colored(n, r, 1.5), 500) * 0.12, r, 13, 1.0)
    if birds: y = y + widen(S.bird_chirps(dur, r, birds), r, 7, 0.8) * 0.5
    return y

def room(dur, r):
    return widen(lp(colored(ns(dur), r, 1.8), 300) * 0.25, r, 9, 0.6)

def steps(t0, t1, every, r, g, p=0.0, name=""):
    t = t0; k = 0
    while t < t1:
        ev(t, S.stroll_step(r, 0.4), g, p + 0.2 * np.sin(k), name if k == 0 else ""); t += every * r.uniform(0.9, 1.1); k += 1

# ======================= SFX timeline =======================
R = rng(29)
# 1: the swoop over the kingdom into the square, landing on the king
_rd = fr(52); _t = np.arange(ns(_rd)) / SR
ev(0, widen(bp(colored(len(_t), R, 0.6), 250, 5000, 1) * (0.2 + 0.8 * (_t / _rd) ** 1.6) * env_seg(_rd, 0.05, 0.15), R, 11, 1.0), -10, 0, "swoop wind")
ev(fr(44), S.whoosh(0.8, R, 0.25, 300, 2600, 0.9, 0.35), -4, 0, "landing whoosh")
bed(fr(20), fr(296), town(fr(296) - fr(20), R, 1.0, 0.7), -15, "market square ambience", 1.0, 0.4)
# 2: the coin drops onto the farmer's shadow
ev(fr(76), coin(R), -3, -0.2, "COIN on the shadow")
ev(fr(100), S.whoosh(0.5, R, 0.22, 600, 4000, 0.7, 0.2), -6, 0, "flash whoosh")
# 3: the collector strides in, lays the rod down on its words
steps(fr(106), fr(128), 0.28, R, -11, 0.4, "collector's footsteps")
ev(fr(166), addm(thud(R, 220, 0.2, 0.9), S.clink(R, 1800, 0.08, 0.4)), -4, -0.1, "rod clacks onto the cobbles")
ev(word("rod") - 0.04, S.clink(R, 2400, 0.06, 0.3), -14, 0)
ev(fr(178), crinkle(R, 0.4), -10, 0.2, "ledger page")
# 4: bills: a tiny slip for the kid, a longer one for the tall man
ev(fr(222), crinkle(R, 0.25, 0.02), -6, -0.3, "tiny slip")
ev(fr(238), unroll(R, 0.6), -6, 0.3, "bill unrolls")
# 5: the town gets an idea
ev(word("clever") - 0.05, I.triangle(0.6, R, 1.2), -9, 0, "idea ding")
# 6-9: midsummer noon: crickets, the queue, tiny bills, the king's stomp
bed(fr(296), fr(488), widen(S.crickets(fr(488) - fr(296), R, 3), R, 7, 0.8) * 0.5 + town(fr(488) - fr(296), R, 0.6, 0.3), -15, "midsummer noon: crickets + murmur", 0.4, 0.3)
ev(fr(352), S.whoosh(1.2, R, 0.6, 400, 2200, 0.9, 0.4), -10, 0, "tilt up to the sun")
ev(fr(398), S.whoosh(0.6, R, 0.2, 900, 300, 0.7, 0.2), -11, 0, "tilt down to the feet")
ev(fr(426), addm(crinkle(R, 0.15, 0.03), S.clink(R, 3400, 0.06, 0.4)), -5, 0, "TINY bill")
ev(fr(462), thud(R, 70, 0.5, 0.6), -1, 0, "king's STOMP")
ev(fr(468), thud(R, 75, 0.4, 0.5), -4, 0)
ev(fr(464), widen(hiss(1.0, R), R, 7, 0.7), -9, 0, "steam from the ears")
# 10: the decree is slammed
ev(fr(511), addm(thud(R, 95, 0.4, 0.8), crinkle(R, 0.3)), -2, 0, "decree SLAM")
# 11 + 14: winter evening: cold wind, a hushed crowd
bed(fr(522), fr(668), S.breeze(fr(668) - fr(522), R, 1.0, 0.25, 700) * 1.2 + town(fr(668) - fr(522), R, 0.35, 0), -13, "winter evening wind", 0.6, 0.3)
ev(fr(596), S.whoosh(1.4, R, 0.7, 200, 1400, 1.0, 0.5), -10, 0, "crane up over the long shadows")
# 12-13: the nursery: quiet room, torch click, the swing to the side
bed(fr(662), fr(836), room(fr(836) - fr(662), R), -16, "nursery room tone", 0.2, 0.3)
ev(fr(668), addm(tick(R), S.clink(R, 1600, 0.05, 0.3)), -6, 0, "torch click on")
ev(fr(772), S.whoosh(0.9, R, 0.45, 500, 2000, 0.7, 0.3), -9, -0.3, "torch swings to the side")
ev(word("long", 1), I.triangle(0.4, R, 1.0, f=990.0), -13, 0)
bed(fr(828), fr(866), S.breeze(fr(866) - fr(828), R, 1.0, 0.2, 700), -14, "", 0.1, 0.2)
ev(fr(838), unroll(R, 1.1), -1, 0.2, "HUGE bill unrolls to the ground")
ev(fr(850), widen(S.whoa(R), R, 9, 0.8), -9, -0.2, "crowd gasps")
# 15-19: the overcast day: soft wind, a grumble of cloud, delighted townsfolk, light scattering, nothing to measure
bed(fr(858), fr(1192), S.breeze(fr(1192) - fr(858), R, 0.7, 0.15, 600) + lp(colored(ns(fr(1192) - fr(858)), R, 2.0), 120) * 0.25, -14, "overcast: soft wind + low cloud rumble", 0.8, 0.4)
bed(fr(862), fr(930), town(fr(930) - fr(862), R, 0.7, 0.0), -15, "", 0.3, 0.3)
ev(fr(915), widen(S.hurrah(R, 160, 1.0) * 0.7, R, 9, 0.9), -12, 0.1, "townsfolk chuckle")
for k in range(5): ev(fr(945 + 9 * k), sparkle(R), -14, -0.4 + 0.2 * k, "light scatters in the cloud" if k == 0 else "")
for k in range(6): ev(fr(1014 + 7 * k), sparkle(R, 0.4), -16, 0.4 - 0.16 * k, "light from everywhere" if k == 0 else "")
ev(fr(1100), crinkle(R, 0.35), -10, -0.2, "ledger page")
ev(fr(1166), S.whoosh(0.4, R, 0.15, 700, 2000, 0.6, 0.1), -10, -0.2, "shrug")
# 20-27: winter sunset
bed(fr(1182), fr(1720), S.breeze(fr(1720) - fr(1182), R, 0.8, 0.2, 650), -15, "sunset wind", 0.8, 0.5)
ev(fr(1240), S.whoosh(1.6, R, 0.8, 200, 1200, 1.0, 0.5), -11, 0, "toward the castle")
ev(fr(1290), widen(S.oof(R, "oh"), R, 7, 0.6), -14, 0, "villagers: oh")
steps(fr(1312), fr(1370), 0.11, R, -13, 0, "the whole town hurries in")
ev(fr(1304), S.whoosh(1.8, R, 0.9, 150, 1000, 1.0, 0.6), -11, 0, "high over the town")
for k, (f0, p) in enumerate([(1434, 0.3), (1446, 0.4), (1470, 0.3)]): ev(fr(f0), honk(R, 330 + 25 * k), -6, p, "goose honks" if k == 0 else "")
steps(fr(1432), fr(1452), 0.16, R, -14, 0.3)
ev(fr(1472), widen(S.whoa(R), R, 7, 0.6), -14, -0.1, "kid: whoa")
ev(fr(1531), widen(S.hurrah(R, 170, 1.0), R, 9, 1.0), -9, 0, "ZERO TAX cheer")
ev(fr(1531), S.applause(1.6, R, 24), -12, 0)
ev(fr(1573), addm(thud(R, 240, 0.15, 0.9), S.clink(R, 1900, 0.06, 0.3)), -8, 0.1, "rod tap")
steps(fr(1596), fr(1672), 0.3, R, -12, 0, "collector paces the castle shadow")
for f0 in range(1600, 1672, 18): ev(fr(f0), addm(thud(R, 230, 0.12, 0.8), S.clink(R, 1800, 0.05, 0.25)), -14, -0.1)
ev(fr(1680), unroll(R, 0.8), -4, 0.2, "the castle bill")
ev(fr(1700), thud(R, 60, 0.6, 0.4), -3, 0, "king: shock thump")
ev(fr(1702), widen(S.oof(R, "oh"), R, 7, 0.6), -11, 0)
# 28: morning: birds, a happy crowd, the bill torn in two
bed(fr(1708), DUR, widen(S.bird_chirps(DUR - fr(1708), R, 0.9), R, 7, 0.8) * 0.6 + town(DUR - fr(1708), R, 0.8, 0), -13, "morning birds + happy town", 0.4, 0.6)
ev(fr(1734), rip(R), -3, 0.2, "bill RIPPED")
ev(fr(1742), widen(S.hurrah(R, 175, 1.05), R, 9, 1.0), -10, 0, "cheer")

# ======================= music =======================
mus = np.zeros((2, N))
F = I.m2f
BPM = 104; Q = 60 / BPM
RM = rng(11)
def note(inst, t, m, dur=0.5, vel=0.6, p=0.0, g=0.0):
    if inst == "pluck": x = I.pluck(F(m), vel, RM, dur=max(0.5, dur))
    elif inst == "glock": x = I.glock(F(m), vel * 0.6, RM, dur=1.2)
    elif inst == "vibes": x = I.vibes(F(m), vel * 0.6, RM, dur=1.6)
    elif inst == "tuba": x = I.brass(F(m), dur, vel, RM, kind="tuba")
    elif inst == "horn": x = I.brass(F(m), dur, vel, RM, kind="horn")
    elif inst == "bone": x = I.brass(F(m), dur, vel, RM, kind="horn", fall=-5.0)
    elif inst == "mbox": x = I.musicbox(F(m), vel * 0.7, RM, dur=1.4)
    elif inst == "timp": x = I.timpani(F(m), vel, RM)
    elif inst == "fife": x = I.fife(F(m), dur, vel, RM)
    else: raise ValueError(inst)
    place(mus, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))
def drum(kind, t, vel=0.6, p=0.0, g=0.0):
    x = I.snare(vel, RM) if kind == "snare" else I.brush(vel, RM) if kind == "brush" else I.cymbal(vel, RM, 2.4)
    place(mus, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))
def padc(t0, t1, ms, vel=0.35, g=-3):
    place(mus, I.pad([F(m) for m in ms], t1 - t0, vel, RM, att=0.6, rel=0.8), t0, dbg(g))
def pizz(t0, t1, chords, vel=0.5, step=1.0, hi=True):
    k = 0; t = t0
    while t < t1 - 0.05:
        c = chords[(k // 4) % len(chords)]; beat = k % 4
        if beat in (0, 2): note("pluck", t, c[0] - 12, 0.6, vel, -0.2)
        else:
            for m in c[1:]: note("pluck", t, m, 0.4, vel * 0.55, 0.25)
        if hi and beat == 3 and (k // 4) % 2 == 1: note("glock", t + Q * 0.5, c[-1] + 12, 0.3, vel * 0.5, 0.3)
        t += Q * step; k += 1
def march(t0, t1, vel=0.45):
    t = t0; k = 0
    while t < t1:
        drum("brush" if k % 2 == 0 else "snare", t, vel if k % 2 == 0 else vel * 0.6, 0.0, -4 if k % 2 == 0 else -10); t += Q / 2; k += 1

C, Am, F_, G7, Dm, E7, Bb, A7, Gm = [48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 65, 71], [38, 65, 69, 74], [40, 64, 68, 71], [46, 62, 65, 70], [45, 61, 64, 67], [43, 62, 67, 70]
# 1: rising fife over the swoop, royal fanfare landing on the king, then a pompous greedy waddle
for k, m in enumerate([62, 64, 66, 67, 69, 71, 72, 74]): note("fife", fr(4) + k * fr(5), m + 12, 0.2, 0.45 + 0.03 * k, 0.3)
for k, m in enumerate([60, 64, 67]): note("horn", fr(40) + 0.14 * k, m, 0.22, 0.65)
for m in [60, 64, 67, 72]: note("horn", fr(56), m, 0.9, 0.75)
note("timp", fr(56), 36, 1.0, 0.9); drum("crash", fr(56), 0.55)
t = fr(64); k = 0
while t < fr(100): note("tuba", t, [36, 43, 41, 43][k % 4], Q * 0.7, 0.55); t += Q; k += 1
note("glock", word("shadows"), 91, 0.3, 0.6, 0.3)
# 3-4: the collector: sneaky pizz in D minor, glock on "rod" and "bill"
pizz(fr(104), fr(257), [Dm, A7, Dm, Gm], 0.42, 0.5, hi=False)
note("glock", word("rod"), 86, 0.3, 0.6, 0.3); note("glock", word("bill"), 93, 0.3, 0.6, 0.3)
note("tuba", word("longer"), 33, 0.3, 0.6); note("tuba", word("bigger"), 31, 0.5, 0.7)
# 5-8: the town gets clever: a bright little march in C with glock sparkle
march(fr(257), fr(444), 0.4)
pizz(fr(257), fr(444), [C, F_, G7, C], 0.45)
for k, m in enumerate([72, 76, 79, 84]): note("glock", word("highest") + 0.12 * k, m + 12, 0.25, 0.5, 0.3)
note("glock", word("tiny"), 96, 0.3, 0.7, 0.3); note("glock", word("tiny") + 0.15, 98, 0.3, 0.6, 0.3)
# 9-10: the king furious: tuba stomps, timpani, a dark brass sting on the decree
note("tuba", fr(462), 28, 0.5, 0.85); note("timp", fr(462), 33, 1.0, 0.9)
for k in range(5): note("tuba", fr(470) + k * Q / 2, [40, 39, 38, 37, 36][k], 0.25, 0.6)
note("timp", fr(511), 33, 1.0, 0.85); drum("crash", fr(511), 0.5)
for m in [50, 53, 56]: note("horn", fr(511), m, 0.6, 0.6)
# 11: winter evening: cold minor pad, slow low pizz
padc(fr(528), fr(668), [38, 45, 50, 53, 57], 0.34, -3)
t = fr(540); k = 0
while t < fr(660): note("pluck", t, [50, 57, 53, 57][k % 4], 0.5, 0.35, -0.1 + 0.2 * (k % 2)); t += Q; k += 1
for k in range(6): note("vibes", word("stretched") + k * Q / 2, [69, 72, 76, 79, 81, 84][k], 0.4, 0.35, 0.3)
# 12-13: the nursery: a little music-box lullaby
mel = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 81, 79, 76, 74, 72]
for k, m in enumerate(mel): note("mbox", fr(668) + k * Q * 0.6, m + 12, 0.4, 0.45, 0.2 - 0.4 * (k % 2))
padc(fr(668), fr(832), [48, 55, 64, 67], 0.25, -9)
note("glock", word("underneath"), 84, 0.4, 0.6, 0.2)
for k in range(4): note("mbox", fr(800) + k * 0.12, [72, 69, 65, 60][k] + 12, 0.4, 0.5, 0.2)
# 14: huge bills: brass stab
for m in [38, 44, 50]: note("horn", word("huge"), m, 0.7, 0.75)
note("timp", word("huge"), 38, 1.0, 0.9); drum("crash", fr(846), 0.55)
# 15-19: the cloudy plan: playful pizz in F, vibes for the scattered light, a sad trombone for "nothing"
pizz(fr(866), fr(1150), [F_, Dm, Bb, C], 0.4, 1.0)
for k in range(10): note("vibes", fr(948) + k * Q / 2, [77, 81, 84, 88, 84, 81, 77, 81, 84, 89][k], 0.4, 0.38, 0.3 - 0.6 * (k % 2))
for k, m in enumerate([55, 54, 53]): note("bone", fr(1168) + 0.3 * k, m, 0.28, 0.5)
note("bone", fr(1168) + 0.9, 52, 0.8, 0.5)
# 20-21: the king's sunset scheme: villain tuba + low pizz in G minor, "Now what?" hangs
t = fr(1192); k = 0
while t < fr(1284): note("tuba", t, [31, 38, 34, 38][k % 4], Q * 0.6, 0.55); t += Q; k += 1
pizz(fr(1192), fr(1284), [Gm, Gm, E7, A7], 0.36, 1.0, hi=False)
padc(fr(1284), fr(1306), [45, 52, 57, 61, 64], 0.3, -4)
note("vibes", word("what"), 81, 0.5, 0.45, 0.2)
# 22-24: the town hurries into the castle's shadow: quick rising pizz, goose hits, a fanfare for zero tax
t = fr(1306); k = 0
while t < fr(1408): note("pluck", t, 50 + (k // 2) % 12, 0.25, 0.42, 0.1 - 0.2 * (k % 2)); t += Q / 2; k += 1
padc(fr(1408), fr(1520), [43, 50, 55, 58, 62], 0.3, -5)
for k, f0 in enumerate([1434, 1446, 1470]): note("tuba", fr(f0) + 0.02, [43, 45, 38][k], 0.25, 0.6)
note("glock", word("own", 1), 91, 0.4, 0.6, 0.3)
for k, m in enumerate([60, 64, 67]): note("horn", word("zero") + 0.12 * k, m, 0.25, 0.65)
for m in [60, 64, 67, 72]: note("horn", word("tax", 2), m, 0.9, 0.75)
drum("crash", word("tax", 2), 0.5); note("timp", word("tax", 2), 36, 1.0, 0.8)
# 25-27: the collector follows the rules: a dry march building to the king's bill
march(fr(1548), fr(1700), 0.45)
pizz(fr(1548), fr(1700), [C, Am, F_, G7], 0.45)
for k in range(8): note("pluck", fr(1640) + k * Q / 2, 55 + 2 * k, 0.25, 0.45, 0.1)
note("timp", fr(1700), 31, 1.0, 1.0); drum("crash", fr(1700), 0.7)
for m in [43, 50, 55, 59]: note("horn", fr(1700), m, 0.9, 0.8)
# 28: morning: warm major ending and a button after the last word
padc(fr(1714), DUR, [48, 55, 64, 67, 76], 0.36, -2)
for k, m in enumerate([72, 76, 79, 84, 79, 76]): note("mbox", fr(1716) + k * Q / 2, m + 12, 0.4, 0.45, 0.2)
pizz(fr(1716), word("morning") + 0.3, [C, F_], 0.38, 0.5, hi=False)
for m in [48, 60, 64, 67, 72]: note("pluck", word("morning") + 0.45, m, 0.9, 0.8, 0, 5)
note("tuba", word("morning") + 0.45, 36, 0.6, 0.7, 0, 5); note("glock", word("morning") + 0.45, 96, 0.5, 0.6, 0, 4)

# ======================= mix (the Apollo 13 chain) =======================
voice, vsr = read_wav(os.path.join(ROOT, "shorts/shadowtax/voice/voice.wav"))
assert vsr == SR, vsr
if voice.shape[0] == 1: voice = np.concatenate([voice, voice])
v = np.zeros((2, N)); v[:, : min(N, voice.shape[1])] = voice[:, :N]
ir = make_ir(0.9, 3)
mus = 0.8 * mus + 0.2 * convolve_st(mus, ir)[:, :N]
sfx = 0.85 * sfx + 0.15 * convolve_st(sfx, ir)[:, :N]
# levels: music ~12 LU and SFX ~5 LU under the voice, then the house offsets (music +3 dB, SFX -6 dB)
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
def limit(x, thr_db=-2.4, rel=0.08):
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
for _ in range(5):
    k = 10 ** ((-14 - integrated(mix)) / 20); mix = limit(mix * k); gain *= k
tp = true_peak(mix)
if tp > -1.0: mix *= 10 ** ((-1.0 - tp) / 20)
write_wav(os.path.join(OUT, "mix.wav"), mix)
os.makedirs(os.path.join(ROOT, "public/shadowtax"), exist_ok=True)
write_wav(os.path.join(ROOT, "public/shadowtax/mix.wav"), mix)  # what the ShadowTaxShort composition plays
write_wav(os.path.join(OUT, "music.wav"), mus * gain)
write_wav(os.path.join(OUT, "sfx.wav"), sfx * gain)
with open(os.path.join(OUT, "cues.md"), "w") as fh:
    fh.write("# Shadow tax short sound cues\n\n| time (s) | frame | cue |\n|---|---|---|\n")
    for t0, name in sorted(cues): fh.write(f"| {t0:6.2f} | {round(t0 * FPS)} | {name} |\n")
print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", round(mix.shape[1] / SR, 2), "s")
