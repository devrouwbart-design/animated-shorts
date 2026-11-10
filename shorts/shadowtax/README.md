# The King Who Taxed Shadows

59-second cartoon 3D short: a greedy king taxes shadows, the town dodges it with real shadow science (high noon sun,
clouds, standing inside another shadow), and the collector finally bills the king for his castle's shadow.
Narration: ElevenLabs "Henry – Deep, Professional, and Soothing" (eleven_v4).

| File | What it is |
|---|---|
| `IDEA.md` | The approved idea, beats and look |
| `SCRIPT.md` | The science checks and the approved script (214 words) |
| `voice/henry_raw.mp3` | The ElevenLabs take (made in the ElevenLabs app, eleven_v4) |
| `voice/voice.wav` | Narration at a natural pace, 58.6 s (pauses capped at 0.18 s, atempo 1.21x, 48 kHz mono) |
| `voice/words.json` | Word timings (pocketsphinx forced alignment of `voice/script.txt`); every shot and sound is timed to these |
| `voice/make_voice.py` | Rebuilds `voice.wav` + `words.json` from a take: `python shorts/shadowtax/voice/make_voice.py shorts/shadowtax/voice/henry_raw.mp3 x1.21 0.18` |
| `voice/make_timing.py` | Writes `src/videos/shadowtax/timing.ts` (film length + one-word subtitles). The picture runs on the narration clock, so there is no story-clock warp |
| `audio/mix.wav` | Final sound: voice + original score + effects, -14 LUFS, peaks at -1.5 dBTP |
| `audio/cues.md` | Sound cue sheet |
| `shots.json` | Shot list for `scripts/short_qa.py` |

Code: `src/videos/shadowtax/` (composition `ShadowTaxShort`, 1080x1920, 30 fps, 1777 frames, 28 shots, one-word subtitles
in the Ricks Clips look, no lens blur). Sound: `audio/shadowtax_sound.py` (its `mix.wav` is copied to
`public/shadowtax/mix.wav`, which the composition plays).

How the shadows work: the sun is placed in world compass terms per shot (`story.ts`, north = -z): midsummer noon
(az 180, el 63.4: shadows half your height), a winter evening (az 218, el 4.5: shadows ~22 m), thick overcast (no
direct sun at all), the winter sunset right behind the castle (az 236, el 3) and a winter dawn (az 122, el 6).
Characters are flat cards, so each gets a silhouette shadow on the ground: its own drawing laid flat, pointing away
from the sun, length = height / tan(elevation), left out when a ray toward the sun hits the castle or a house
(`world.ts`). The toy king on the nursery table is a cardboard cut-out that casts a real shadow from the torch.

## Render it (on a computer with a graphics card)

```bash
npx remotion render src/index.ts ShadowTaxShort out/shadowtax/final.mp4 --codec h264 --crf 16 --scale 1.3333 --gl=angle --concurrency=4 --timeout=300000
```

That's the finished 2K vertical video (1440x2560) with the final sound on it. The world (town, countryside, castle hill) is big:
each browser tab needs a while to build it, so keep `--concurrency=4 --timeout=300000` (the default 8 tabs / 30 s timed out).

Tips:
- Point the temp folder at a drive with space first (on this PC: `C:/remotion-tmp`).
- Check a few frames first: `node scripts/stills.mjs ShadowTaxShort out/shadowtax/check_ 60,560,1458 0.5`
- QA: `python scripts/short_qa.py out/shadowtax/final.mp4 out/shadowtax/qa shorts/shadowtax/shots.json`

## Rebuild after a voice change

```bash
python shorts/shadowtax/voice/make_voice.py shorts/shadowtax/voice/henry_raw.mp3 x1.21 0.18
```

```bash
python shorts/shadowtax/voice/make_timing.py
```

```bash
python audio/shadowtax_sound.py
```

A new take changes the word times: shot boundaries in `story.ts` and the event frames in `shadowtax_sound.py` are
written in frames of this take, so re-time them too.
