# Sound for "The Square Peg That Saved Apollo 13": synthesized SFX + an original score, ducked under the Henry
# narration, mixed to -14 LUFS. Event times are frames (s x 30) from shorts/apollo13/voice/words.json and
# src/videos/apollo13/story.ts. Reuses the bridge/lake generators (sfx_gen.py, instruments.py, dsp.py).
# usage: python audio/apollo13_sound.py   ->  shorts/apollo13/audio/{mix.wav, music.wav, sfx.wav, cues.md} + public/apollo13/mix.wav
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from dsp import (SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, pan, place, widen, make_ir, convolve_st, integrated,
                 true_peak, read_wav, write_wav, phase, dbg)
import sfx_gen as S
import instruments as I

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "shorts/apollo13/audio")
os.makedirs(OUT, exist_ok=True)
# frames in this file are STORY frames (the picture's clock, see shorts/apollo13/voice/make_timing.py); fr() maps a story
# frame to seconds of the real narration, so every sound lands where the picture puts it
FPS = 30
_W = json.load(open(os.path.join(ROOT, "shorts/apollo13/voice/warp.json")))
TOTAL = _W["real_frames"]
_STORY = np.array(_W["story"])
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: float(np.interp(f, _STORY, np.arange(len(_STORY)))) / FPS
W = {}
for w in json.load(open(os.path.join(ROOT, "shorts/apollo13/voice/words.json"))):
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

# ---------------- generators ----------------
def cabin_hum(dur, r):
    """lunar-module cabin: fans + pumps, a soft 400 Hz electrical whine (spacecraft power is 400 Hz AC)"""
    n = ns(dur); t = np.arange(n) / SR
    fan = bp(colored(n, r, 1.0), 150, 1800, 1) * 0.5
    hum = 0.08 * np.sin(2 * np.pi * 400 * t) + 0.05 * np.sin(2 * np.pi * 800 * t)
    pump = lp(colored(n, r, 2.0), 90) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.8 * t))
    return widen(fan + hum + pump, r, 9, 0.7)

def space_drone(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    y = 0.4 * np.sin(phase(55 + 0.5 * np.sin(2 * np.pi * 0.1 * t))) + 0.25 * np.sin(phase(82.5)) + lp(colored(n, r, 1.5), 300) * 0.4
    return widen(y, r, 15, 1.0)

def quindar(r, f=2525, dur=0.25):
    """the mission-control 'beep' that keyed the radio"""
    t = tt(dur)
    return fades(0.5 * np.sin(2 * np.pi * f * t), 0.004, 0.02)

def static(dur, r, dens=1.0):
    n = ns(dur)
    y = bp(colored(n, r, 0.3), 900, 5000, 1) * 0.25
    k = r.random(n) < 0.0006 * dens
    y += bp(k.astype(float) * r.standard_normal(n) * 6, 1200, 6000, 1)
    return y

def boom(r, dur=2.6):
    """the tank explodes: sub thump + low noise burst + metal shrapnel"""
    t = tt(dur)
    sub = np.sin(phase(70 * np.exp(-t / 0.5) + 28)) * np.exp(-t / 0.7) * 1.4
    burst = lp(colored(len(t), r, 1.2), 900) * np.exp(-t / 0.35) * 1.6
    crack = hp(r.standard_normal(len(t)), 1500) * np.exp(-t / 0.03) * 0.8
    return fades(addm(sub, burst, crack, S.rattle(1.2, r, 60, heavy=True) * 0.7), 0.0005, 0.4)

def hiss(dur, r, level=1.0):
    """venting oxygen: a steady, slightly fluttering hiss"""
    n = ns(dur); t = np.arange(n) / SR
    y = bp(colored(n, r, 0.2), 2000, 9000, 2) * (0.75 + 0.25 * smooth_noise(n, r, 7)) * level
    return widen(y, r, 7, 0.9)

def alarm(dur, r, period=14 / 30):
    """master alarm: bright two-tone beeps in time with the red lamps (7 frames on, 7 off)"""
    n = ns(dur); t = np.arange(n) / SR
    on = ((t % period) < period / 2).astype(float)
    on = lp(on, 60, 1)
    y = (np.sign(np.sin(2 * np.pi * 1450 * t)) * 0.3 + np.sin(2 * np.pi * 2900 * t) * 0.15) * on
    return bp(y, 600, 5000, 1)

def power_down(r, dur=1.4):
    t = tt(dur)
    return fades(np.sin(phase(900 * np.exp(-t / 0.5) + 60)) * np.exp(-t / 0.9) * 0.5, 0.01, 0.2)

def tape_rip(r, dur=0.32):
    """duct tape pulled off the roll: rapid sticky crackle with a rising squeal"""
    n = ns(dur); t = np.arange(n) / SR
    k = (r.random(n) < 0.05).astype(float) * r.standard_normal(n)
    y = bp(k * 3 + colored(n, r, 0.5) * 0.4, 1200, 7000, 1) * np.exp(-((t - dur * 0.45) / (dur * 0.35)) ** 2)
    y += 0.12 * np.sin(phase(900 + 1400 * t / dur)) * np.exp(-((t - dur * 0.5) / (dur * 0.3)) ** 2)
    return fades(y, 0.002, 0.03)

def crinkle(r, dur=0.5):
    n = ns(dur)
    k = (r.random(n) < 0.012).astype(float) * r.standard_normal(n)
    return fades(bp(k * 4, 2000, 9000, 1) * np.exp(-tt(dur) / (dur * 0.5)), 0.002, 0.05)

def thud(r, f0=110, dur=0.3, bright=0.3):
    t = tt(dur)
    y = np.sin(phase(f0 * (1 + 0.8 * np.exp(-t / 0.01)))) * np.exp(-t / 0.06) + bp(r.standard_normal(len(t)), 200, 2500, 1) * np.exp(-t / 0.012) * bright
    return fades(y, 0.0005, 0.05)

def clank(r, f0=320):
    t = tt(0.5)
    return addm(S.clink(r, f0 * 2.5, 0.35, 0.7), thud(r, f0 * 0.4, 0.3, 0.6), np.exp(-t / 0.12) * np.sin(phase(f0)) * 0.6)

def boing(r, f0=180, dur=0.6):
    t = tt(dur)
    return fades(np.sin(phase(f0 * (1 + 0.25 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.25)))) * np.exp(-t / 0.22) * 0.7, 0.002, 0.05)

def breath(r, dur=0.7, f_lo=500, f_hi=2500, inhale=False):
    n = ns(dur); t = np.arange(n) / SR
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** (1.5 if not inhale else 0.8)
    return bp(colored(n, r, 0.6), f_lo, f_hi, 1) * e * 0.6

def tick(r):
    t = tt(0.05)
    return fades(hp(r.standard_normal(len(t)), 3000) * np.exp(-t / 0.004) * 0.6 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.01) * 0.3, 0.0002, 0.01)

def jet_by(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    e = np.exp(-((t - dur * 0.5) / (dur * 0.3)) ** 2)
    y = lp(colored(n, r, 1.0), 2500) * e + 0.15 * np.sin(phase(380 * (1.05 - 0.1 * t / dur))) * e
    return np.stack([y * (1 - t / dur * 0.7), y * (0.3 + t / dur * 0.7)])

def scratch(r, dur=0.5):
    """record scratch: a noisy tone swept back and forth fast"""
    n = ns(dur); t = np.arange(n) / SR
    f = 600 + 900 * np.abs(np.sin(2 * np.pi * 3.5 * t))
    y = np.sign(np.sin(phase(f))) * 0.25 + bp(colored(n, r, 0.3), 800, 5000, 1) * 0.5
    return fades(bp(y, 300, 6000, 1) * np.exp(-t / (dur * 0.7)), 0.002, 0.05)

def room_mcc(dur, r):
    """mission control: low murmur of many voices, ventilation, teletype"""
    n = ns(dur)
    y = lp(colored(n, r, 1.5), 400) * 0.25
    vo = sum(S.babble(dur, r, r.uniform(95, 160), r.uniform(0.9, 1.1), 3.5, 0.5) * r.uniform(0.08, 0.14) for _ in range(5))
    tty = np.zeros(n)
    for k in range(int(dur * 6)):
        i = ns(r.uniform(0, dur)); c = tick(r) * 0.5; tty[i:i + len(c)] += c[: n - i]
    return widen(y + vo + tty * 0.5, r, 13, 1.0)

def sea_bed(dur, r):
    return S.water_bed(dur, r, 0.6, 0.6)

# ======================= SFX timeline =======================
R = rng(13)
# hook in the cabin: hum, the floating items whoosh past
# opening outside: space drone, a rising rush toward the window, a soft "whoomp" through the glass (story frame 50)
ev(0, space_drone(fr(56), R) * env_seg(fr(56), 0.02, 0.25)[None, :], -10, 0, "space drone (opening)")
_rd = fr(50) - fr(8); _t = np.arange(ns(_rd)) / SR
ev(fr(8), widen(bp(colored(len(_t), R, 0.6), 300, 6000, 1) * (_t / _rd) ** 2.2, R, 11, 1.0), -9, 0, "rush toward the window")
ev(fr(46), S.whoosh(0.7, R, 0.12, 400, 3000, 0.8, 0.35), -3, 0, "through the window whoosh")
ev(fr(50), thud(R, 75, 0.5, 0.3), -8, 0, "whoomp: inside")
ev(fr(50), cabin_hum(fr(130) - fr(50), R) * env_seg(fr(130) - fr(50), 0.15, 0.2)[None, :], -10, 0, "cabin hum (hook)")
for f0, p in [(58, -0.5), (80, 0.4), (104, -0.3)]: ev(fr(f0), S.whoosh(0.9, R, 0.45, 300, 1600, 0.8, 0.3), -9, p)
ev(word("duct"), tape_rip(R), -1, -0.3, "tape rip (duct tape)")
ev(word("plastic"), crinkle(R, 0.6), -2, 0.3, "bag crinkle")
ev(word("sock"), boing(R, 220, 0.5), -5, -0.2, "sock boing")
ev(fr(128), S.whoosh(0.6, R, 0.25, 600, 4000, 0.7, 0.2), -5, 0, "flash whoosh")
# space: drone, a passing whoosh on the camera glide, a quiet radio beep
ev(fr(130), space_drone(fr(292) - fr(130), R) * env_seg(fr(292) - fr(130), 0.5, 0.05)[None, :], -12, 0, "space drone")
ev(fr(228), S.whoosh(1.6, R, 0.9, 150, 900, 1.0, 0.5), -10, 0)
ev(word("moon") - 0.1, quindar(R, 2525, 0.2), -20, 0.4)
# the bang
ev(fr(292), boom(R), -5, 0, "BANG: oxygen tank explodes")
ev(fr(292), widen(S.rattle(0.9, R, 80), R, 9, 1.0), -8, 0)
ev(fr(325), thud(R, 70, 0.6, 0.5), -6, 0.2, "second jolt")
ev(fr(293), hiss(fr(349) - fr(293), R) * env_seg(fr(349) - fr(293), 0.02, 0.1)[None, :], -12, 0, "venting oxygen hiss")
# alarms (shots 4-5) + radio crackle
ev(fr(349), alarm(fr(405) - fr(349), R, (fr(405) - fr(349)) / 4) * env_seg(fr(405) - fr(349), 0.005, 0.15), -2, 0, "MASTER ALARM")
ev(fr(349), cabin_hum(fr(405) - fr(349), R), -14)
ev(word("crackles") - 0.05, static(fr(405) - word("crackles") + 0.4, R, 4), -5, 0.1, "radio crackle")
# mission control hears it
ev(fr(405), quindar(R), -9, 0.2, "Quindar beep")
ev(fr(405), room_mcc(fr(442) - fr(405), R) * env_seg(fr(442) - fr(405), 0.05, 0.1)[None, :], -12, 0, "mission control room")
ev(fr(405), static(fr(442) - fr(405), R, 1.5), -18, 0.3)
ev(fr(428), widen(S.oof(R, "oh") * 0.6, R, 9, 0.7), -14, -0.2, "controllers: oh")
# the main ship is dying
ev(fr(442), hiss(fr(482) - fr(442), R, 0.8) * env_seg(fr(482) - fr(442), 0.1, 0.2)[None, :], -12, 0.2, "still venting")
ev(fr(444), power_down(R), -10, 0, "power-down whine")
ev(fr(448), S.creak(1.2, R, 30, 50, rough=0.2, noise=0.06, scale=0.6), -10, -0.3)
# into the lander: drops, the stuck one, the pop
ev(fr(482), cabin_hum(fr(545) - fr(482), R), -13, 0, "lander cabin")
for f0, p in [(482, -0.2), (494, 0.2)]: ev(fr(f0), S.whoosh(0.6, R, 0.4, 250, 1400, 0.8, 0.2), -10, p); ev(fr(f0 + 18), thud(R, 130, 0.25, 0.2), -10, p)
ev(fr(506), S.creak(1.0, R, 60, 110, rough=0.15, noise=0.05, scale=0.8), -9, 0, "squeeze creak")
ev(word("squeeze"), widen(S.oof(R, "ugh"), R, 7, 0.6), -14, 0)
ev(fr(524), addm(thud(R, 420, 0.15, 0.8), boing(R, 300, 0.35) * 0.6), -1, 0, "POP through the hatch")
ev(fr(545), space_drone(fr(608) - fr(545), R), -14, 0)
ev(fr(608), cabin_hum(fr(736) - fr(608), R), -14)
ev(fr(616), S.creak(0.6, R, 80, 140, rough=0.15, noise=0.05, scale=0.8), -9, 0, "three squished")
ev(word("three", 1), widen(S.oof(R, "oof"), R, 7, 0.6), -13, 0.2)
# oxygen fine, then breath
ev(word("enough") - 0.05, tick(R), -8, 0, "gauge click")
ev(word("breathe"), breath(R, 0.75), -8, 0.2, "exhale")
# CO2 meter ticking up
for k in range(int((818 - 736) / 15)): ev(fr(736 + 15 * k), tick(R), -14, 0.1)
for f0 in range(752, 812, 16): ev(fr(f0), breath(R, 0.6, 350, 1800), -16, -0.2)
ev(word("creeps"), S.creak(0.5, R, 120, 160, rough=0.1, noise=0.03, scale=0.4), -12, 0.1, "needle creaks up")
# square vs round
ev(fr(818), S.whoosh(0.5, R, 0.2, 400, 1800, 0.7, 0.2), -10, 0.2, "canister held up")
ev(fr(866), S.whoosh(0.35, R, 0.15, 800, 2400, 0.6, 0.1), -12, 0)
ev(fr(915), clank(R, 260), 0, -0.3, "CLONK: square on round")
ev(fr(924), clank(R, 240), -3, -0.3)
# hotel abroad
ev(fr(926), lp(colored(ns(fr(1011) - fr(926)), R, 1.5), 500) * 0.2, -14, 0, "hotel room tone")
for k in range(5): ev(fr(930) + 0.42 * k, S.stroll_step(R, 0.3), -10, -0.4 + 0.15 * k, "footsteps" if k == 0 else "")
ev(fr(930), jet_by(1.3, R), -13, 0, "jet lands outside")
ev(fr(986), addm(thud(R, 900, 0.08, 1.0), S.clink(R, 2400, 0.08, 0.6)), -1, 0, "plug: plastic clack")
ev(fr(988), boing(R, 140, 0.5), -12, 0)
# up here
ev(fr(1011), space_drone(fr(1064) - fr(1011), R) * env_seg(fr(1064) - fr(1011), 0.3, 0.1)[None, :], -11, 0, "lonely space")
# out of air: gasps
ev(fr(1064), cabin_hum(fr(1090) - fr(1064), R), -15)
for k, f0 in enumerate([1064, 1074, 1083]): ev(fr(f0), breath(R, 0.35, 700, 3000, inhale=True), -10, -0.3 + 0.3 * k, "gasps" if k == 0 else "")
ev(word("air"), thud(R, 55, 0.5, 0.1), -6, 0, "air: low thump")
# mission control: the junk pile
ev(fr(1086), room_mcc(fr(1450) - fr(1086), R) * env_seg(fr(1450) - fr(1086), 0.3, 0.2)[None, :], -13, 0, "mission control room")
for k in range(4): ev(fr(1162) + 0.3 * k, thud(R, 150, 0.2, 0.3), -14, 0.2)
ev(fr(1166 - 8), thud(R, 180, 0.25, 0.5), -9, 0, "canister on the table")
for f0 in [1213, 1218]: ev(fr(f0 - 1), crinkle(R, 0.45), -2, -0.2, "bags" if f0 == 1213 else "")
for f0 in [1233, 1238]: ev(fr(f0 - 1), thud(R, 210, 0.18, 0.9), -3, 0.3, "cardboard slaps" if f0 == 1233 else "")
for f0 in [1255, 1262]: ev(fr(f0 - 1), addm(thud(R, 90, 0.3, 0.3), boing(R, 90, 0.3) * 0.5), -4, -0.1, "hoses flop" if f0 == 1255 else "")
ev(fr(1280), boing(R, 260, 0.45), -4, 0.1, "the sock (boing)")
for k, f0 in enumerate([1303, 1310, 1317]): ev(fr(f0 - 1), clank(R, 380 + 40 * k), -4, 0.3 - 0.2 * k, "tape rolls clunk" if k == 0 else "")
# building the box + radio
ev(fr(1340), S.creak(0.5, R, 70, 90, rough=0.25, noise=0.1, scale=0.6), -12, 0, "cardboard")
for k, f0 in enumerate([1366, 1371, 1376]): ev(fr(f0), tape_rip(R, 0.25), -10, -0.2 + 0.2 * k, "tape" if k == 0 else "")
ev(fr(1384), S.creak(0.4, R, 140, 200, rough=0.1, noise=0.05, scale=0.5), -12, 0, "hose squeak")
ev(fr(1408), quindar(R), -9, 0.2, "Quindar beep")
ev(fr(1408), static(fr(1450) - fr(1408), R, 2), -15, 0.2, "radio static")
# step by step: tape rips in the cabin
ev(fr(1450), cabin_hum(fr(1635) - fr(1450), R) * env_seg(fr(1635) - fr(1450), 0.1, 0.5)[None, :], -15, 0, "cabin")
for k, f0 in enumerate([1450, 1459, 1463]): ev(fr(f0), tape_rip(R, 0.3), 0, -0.3 + 0.25 * k, "STEP rip" if k == 0 else "")
ev(word("mailbox") - 0.05, I.triangle(0.6, R, 1.6), -10, 0.2, "mailbox shimmer")
# CO2 drops
ev(fr(1566), S.whoosh(0.8, R, 0.3, 1500, 300, 0.8, 0.3), -9, 0, "needle drops")
ev(fr(1592), breath(R, 1.0, 400, 2000), -9, 0, "relieved sigh")
# splashdown
ev(fr(1601), widen(S.flag_flutter(fr(1625) - fr(1601), R), R, 9, 0.8) * 0.6 + S.breeze(fr(1625) - fr(1601), R, 0.8), -10, 0, "parachutes flutter + wind")
ev(fr(1601), sea_bed(fr(1635) - fr(1601), R) * env_seg(fr(1635) - fr(1601), 0.3, 0.1)[None, :], -14)
ev(fr(1625), S.splash_big(R), -6, 0, "SPLASHDOWN")
# the famous line: scratch, the real one: beep + static
ev(fr(1635), static(fr(1694) - fr(1635), R, 1.0), -19, 0.2)
ev(fr(1693), scratch(R), 0, 0, "record scratch: nobody said it")
ev(fr(1714), quindar(R), -9, 0.2, "Quindar beep")
ev(fr(1714), room_mcc(fr(1787) - fr(1714), R) * env_seg(fr(1787) - fr(1714), 0.2, 0.3)[None, :], -15)
ev(fr(1714), static(fr(1787) - fr(1714), R, 1.2), -18, 0.3)
# home: waves at sunset
ev(fr(1782), sea_bed(DUR - fr(1782), R) * env_seg(DUR - fr(1782), 0.6, 1.0)[None, :], -11, 0, "sunset waves")
ev(fr(1813), S.whoosh(0.4, R, 0.15, 900, 2600, 0.6, 0.15), -12, 0.3, "sock up")

# ======================= music =======================
mus = np.zeros((2, N))
F = I.m2f
BPM = 100; Q = 60 / BPM
RM = rng(7)
def note(inst, t, m, dur=0.5, vel=0.6, p=0.0, g=0.0):
    if inst == "pluck": x = I.pluck(F(m), vel, RM, dur=max(0.5, dur))
    elif inst == "glock": x = I.glock(F(m), vel * 0.6, RM, dur=1.2)
    elif inst == "vibes": x = I.vibes(F(m), vel * 0.6, RM, dur=1.6)
    elif inst == "tuba": x = I.brass(F(m), dur, vel, RM, kind="tuba")
    elif inst == "horn": x = I.brass(F(m), dur, vel, RM, kind="horn")
    elif inst == "bone": x = I.brass(F(m), dur, vel, RM, kind="horn", fall=-5.0)
    elif inst == "mbox": x = I.musicbox(F(m), vel * 0.7, RM, dur=1.4)
    elif inst == "timp": x = I.timpani(F(m), vel, RM)
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

C, Am, F_, G7, Dm, E7, Bb = [48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 65, 71], [38, 65, 69, 74], [40, 64, 68, 71], [46, 62, 65, 70]
# opening: a shimmering vibes arpeggio rising with the rush, then the sneaky pizz in D minor inside, glock on each item
for k in range(10): note("vibes", fr(4) + k * (fr(48) - fr(4)) / 10, [62, 65, 69, 72, 74, 77, 81, 84, 86, 89][k], 0.4, 0.35 + 0.04 * k, 0.4 - 0.08 * k)
drum("crash", fr(50), 0.45, 0, -9)
pizz(fr(50), fr(126), [Dm, Am, Dm, E7], 0.42, 0.5, hi=False)
for t0, m in [(word("duct"), 86), (word("plastic"), 88), (word("sock"), 93)]: note("glock", t0, m, 0.3, 0.6, 0.3)
# space: wonder (Cmaj9 pad + vibes arpeggio)
padc(fr(130), fr(292), [48, 55, 64, 71, 74], 0.33, -4)
arp = [60, 64, 67, 71, 74, 71, 67, 64]
t = fr(134); k = 0
while t < fr(288): note("vibes", t, arp[k % 8] + 12, 0.5, 0.42, 0.3 - 0.6 * (k % 2)); t += Q / 2; k += 1
# bang: timpani + crash, then a tense minor ostinato through the alarm and the dying ship
note("timp", fr(292), 33, 1.0, 1.0); drum("crash", fr(292), 0.7)
t = fr(300); k = 0
while t < fr(482):
    c = [Am, F_, E7, E7][(k // 8) % 4]
    note("pluck", t, c[0] - 12 + (0 if k % 2 == 0 else 7), 0.3, 0.42 + 0.15 * min(1, (t - fr(300)) / 4), -0.2)
    if k % 4 == 2: note("pluck", t, c[1 + (k // 4) % 3], 0.25, 0.32, 0.3)
    t += Q / 2; k += 1
note("tuba", fr(442), 28, 1.2, 0.7)  # the ship is dying
# squeeze: comic tuba waddle in D minor, hits on squeeze / three / four
t = fr(482); k = 0
while t < fr(736):
    note("tuba", t, [38, 45, 41, 45][k % 4] - 12 + 12, Q * 0.8, 0.55, 0); t += Q; k += 1
pizz(fr(482), fr(736), [Dm, Dm, Bb, E7], 0.35, 1.0, hi=False)
for t0, m in [(word("squeeze"), 50), (fr(524), 62), (word("three", 1), 50), (word("four"), 52)]: note("horn", t0, m, 0.35, 0.6, 0.2)
note("glock", word("enough"), 84, 0.3, 0.7, 0.2); note("glock", word("enough") + 0.12, 91, 0.3, 0.6, 0.2)
# CO2 creeping: ticking staccato rising chromatically
t = fr(736); k = 0
while t < fr(818): note("pluck", t, 57 + k // 3, 0.25, 0.35 + 0.01 * k, 0.1); t += Q / 2; k += 1
# square... round: tuba bonk, then a sad trombone after the clonk
note("tuba", word("square"), 36, 0.4, 0.75); note("tuba", word("round"), 31, 0.4, 0.75)
for k, m in enumerate([55, 54, 53]): note("bone", fr(917) + 0.3 * k, m, 0.28, 0.5)
note("bone", fr(917) + 0.9, 52, 0.9, 0.5)
# abroad: light music-box tune over pizz in F
pizz(fr(930), fr(1011), [F_, C, Dm, G7], 0.33, 1.0, hi=False)
for k, m in enumerate([72, 76, 79, 77, 76, 74, 72, 74, 76, 72]): note("mbox", fr(932) + k * Q / 2, m + 12, 0.4, 0.4, 0.25)
note("tuba", fr(986), 34, 0.3, 0.6)
# up here: low drone, "air" hit
padc(fr(1011), fr(1090), [33, 40, 45, 48], 0.3, -6)
note("timp", word("air"), 33, 1.0, 0.8)
# heroes on the ground: can-do march in C, brushes, glock blips on every item
t = fr(1090); k = 0
while t < fr(1450):
    if k % 2 == 0: drum("brush", t, 0.45, -0.1, -4)
    else: drum("snare", t, 0.3, 0.1, -10)
    t += Q / 2; k += 1
pizz(fr(1090), fr(1332), [C, F_, G7, C], 0.45)
for t0, m in [(fr(1166), 79), (fr(1213), 84), (fr(1233), 86), (fr(1255), 88), (fr(1281), 91), (fr(1303), 93), (fr(1310), 95), (fr(1317), 96)]: note("glock", t0, m, 0.3, 0.6, 0.3)
# invent + radio: building, rising bass
pizz(fr(1332), fr(1477), [Am, F_, C, G7], 0.5)
for k in range(10): note("pluck", fr(1408) + k * Q / 2, 48 + k, 0.25, 0.4 + 0.03 * k, 0.1)
# the mailbox: brass fanfare
for k, m in enumerate([60, 64, 67, 72]): note("horn", fr(1508) + 0.18 * k, m, 0.3, 0.6, 0.0)
for m in [60, 64, 67, 72]: note("horn", word("mailbox"), m, 1.0, 0.7)
note("timp", word("mailbox"), 36, 1.0, 0.8); drum("crash", word("mailbox"), 0.5)
# relief: warm major pad + glock arps, timpani on splashdown
padc(fr(1546), fr(1635), [48, 55, 64, 67, 72], 0.38, -3)
for k in range(12): note("glock", fr(1570) + k * Q / 2, [72, 76, 79, 84][k % 4] + 12, 0.25, 0.45, 0.3 - 0.6 * (k % 2))
note("timp", fr(1625), 36, 1.0, 0.9); drum("crash", fr(1625), 0.6)
# famous line: suspended music, cut dead by the scratch
padc(fr(1635), fr(1693), [50, 57, 62, 69], 0.3, -6)
for k in range(5): note("vibes", fr(1640) + k * Q, [74, 76, 74, 79, 78][k], 0.5, 0.35, 0.2)
# the real words: soft pizz, then a warm sunset ending and a button after the last word
pizz(fr(1716), fr(1787), [F_, C, Dm, G7], 0.32, 1.0, hi=False)
padc(fr(1785), DUR, [48, 55, 64, 67, 76], 0.36, -2)
for k, m in enumerate([72, 74, 76, 79, 81, 79]): note("mbox", fr(1790) + k * Q, m + 12, 0.5, 0.45, 0.2)
note("glock", word("sock", 1), 91, 0.4, 0.7, 0.3)
for m in [48, 60, 64, 67, 72]: note("pluck", word("way") + 0.35, m, 0.9, 0.8, 0, 5)
note("tuba", word("way") + 0.35, 36, 0.6, 0.7, 0, 5); note("glock", word("way") + 0.35, 96, 0.5, 0.6, 0, 4)

# ======================= mix =======================
voice, vsr = read_wav(os.path.join(ROOT, "shorts/apollo13/voice/voice.wav"))
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
os.makedirs(os.path.join(ROOT, "public/apollo13"), exist_ok=True)
write_wav(os.path.join(ROOT, "public/apollo13/mix.wav"), mix)  # what the Apollo13Short composition plays
write_wav(os.path.join(OUT, "music.wav"), mus * gain)
write_wav(os.path.join(OUT, "sfx.wav"), sfx * gain)
with open(os.path.join(OUT, "cues.md"), "w") as fh:
    fh.write("# Apollo 13 short sound cues\n\n| time (s) | frame | cue |\n|---|---|---|\n")
    for t0, name in sorted(cues): fh.write(f"| {t0:6.2f} | {round(t0 * FPS)} | {name} |\n")
print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", round(mix.shape[1] / SR, 2), "s")
