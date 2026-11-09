# The Square Peg That Saved Apollo 13

73-second cartoon 3D short about the Apollo 13 CO2 "mailbox" (April 1970). Narration: ElevenLabs "Henry – Deep, Professional, and Soothing".

| File | What it is |
|---|---|
| `IDEA.md` | The approved idea, beats and look |
| `SCRIPT.md` | Sourced facts and the approved script |
| `voice/henry_raw.mp3` | The chosen ElevenLabs take (eleven_v4, take A of two) |
| `voice/voice.wav` | Narration at a natural pace, 72.2 s (pauses capped at 0.18 s, atempo 1.21x as the lake short, 48 kHz mono) |
| `voice/words.json` | Word timings (pocketsphinx forced alignment of `voice/script.txt`); every shot and sound is timed to these |
| `voice/make_voice.py` | Rebuilds `voice.wav` + `words.json` from a take: `python shorts/apollo13/voice/make_voice.py henry_raw.mp3 x1.21 0.18` |
| `voice/words_story.json` | Word timings of the first (62 s) cut: the picture and sound are written on this "story clock" |
| `voice/make_timing.py` | Maps the current narration onto the story clock word by word and builds the subtitles: writes `src/videos/apollo13/timing.ts` and `voice/warp.json`. Run it after any voice change, then the sound script |
| `audio/mix.wav` | Final sound: voice + original score + effects, about -14.8 LUFS, peaks at -1.0 dBTP |
| `audio/cues.md` | Sound cue sheet |
| `shots.json` | Shot list for `scripts/short_qa.py` |

Code: `src/videos/apollo13/` (composition `Apollo13Short`, 1080x1920, 30 fps, 2181 frames, 29 shots, one-word subtitles in the Ricks Clips look from `Captions.tsx`). Sound:
`audio/apollo13_sound.py` (its `mix.wav` is copied to `public/apollo13/mix.wav`, which the composition plays).

Sets: space (Apollo stack, stars, Earth and Moon placed per shot), the lunar-module cabin (CO2 meter, round filter
holder, overhead hatch, the duct-taped mailbox), 1970 mission control (tiered consoles, trajectory wall screen, the junk
table), a hotel room for the charger analogy, the Pacific splashdown and the sunset raft.

## Render it (on a computer with a graphics card)

From the project folder, after `npm install`:

```bash
npx remotion render src/index.ts Apollo13Short out/apollo13/final.mp4 --codec h264 --crf 16 --scale 1.3333 --gl=angle
```

That's the finished 2K vertical video (1440x2560) with the final sound on it. `out/apollo13/final.mp4` is the upload.

Tips:
- Set `REMOTION_TMP` to a folder with plenty of space first (on this PC: `C:/remotion-tmp`).
- Check a few frames before the full render: `node scripts/stills.mjs Apollo13Short out/apollo13/check_ 60,300,1530 0.5`
- QA: `python scripts/short_qa.py out/apollo13/final.mp4 out/apollo13/qa shorts/apollo13/shots.json`
- On a machine without a GPU, use `--gl=swangle` (and `GL=swangle` for the stills script); it is very slow.

## Rebuild after a voice change

```bash
python shorts/apollo13/voice/make_voice.py shorts/apollo13/voice/henry_raw.mp3 x1.21 0.18
```

```bash
python shorts/apollo13/voice/make_timing.py
```

```bash
python audio/apollo13_sound.py
```

It also updates `public/apollo13/mix.wav`. Needs numpy and scipy.
