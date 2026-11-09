# The Square Peg That Saved Apollo 13

62-second cartoon 3D short about the Apollo 13 CO2 "mailbox" (April 1970). Narration: ElevenLabs "Henry – Deep, Professional, and Soothing".

| File | What it is |
|---|---|
| `IDEA.md` | The approved idea, beats and look |
| `SCRIPT.md` | Sourced facts and the approved script |
| `voice/henry_raw.mp3` | The chosen ElevenLabs take (eleven_v4, take A of two) |
| `voice/voice.wav` | Narration tightened to 62.0 s (pauses capped at 0.14 s, rubberband 1.39x, 48 kHz mono) |
| `voice/words.json` | Word timings (pocketsphinx forced alignment of `voice/script.txt`); every shot and sound is timed to these |
| `voice/make_voice.py` | Rebuilds `voice.wav` + `words.json` from a take: `python shorts/apollo13/voice/make_voice.py <take.mp3> 62` |
| `audio/mix.wav` | Final sound: voice + original score + effects, about -14.5 LUFS, peaks at -1.0 dBTP |
| `audio/cues.md` | Sound cue sheet |
| `shots.json` | Shot list for `scripts/short_qa.py` |

Code: `src/videos/apollo13/` (composition `Apollo13Short`, 1080x1920, 30 fps, 1875 frames, 29 shots). Sound:
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

## Rebuild the sound after a timing change

```bash
python audio/apollo13_sound.py
```

It also updates `public/apollo13/mix.wav`. Needs numpy and scipy.
