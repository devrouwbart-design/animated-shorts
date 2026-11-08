# The Lake That Went Down the Drain

70-second cartoon 3D short about the 1980 Lake Peigneur disaster. Narration: ElevenLabs "Henry – Deep, Professional, and Soothing".

| File | What it is |
|---|---|
| `SCRIPT.md` | Sourced facts and the final script |
| `voice/voice.wav` | Narration, tightened to 69.6 s (pauses capped, sped up 1.21x) |
| `voice/words.json` | Word timings; every shot and sound is timed to these |
| `audio/mix.wav` | Final sound: voice + music + effects, -14 LUFS, peaks at -1.4 dBTP |
| `audio/cues.md` | Sound cue sheet |

Code: `src/videos/lake/` (composition `LakeShort`, 1080x1920, 30 fps). Sound: `audio/lake_sound.py` (its `mix.wav` is copied to `public/lake/mix.wav`, which the composition plays).

## Render it (on a computer with a graphics card)

From the project folder, after `npm install`:

```bash
npx remotion render src/index.ts LakeShort out/lake/final.mp4 --codec h264 --crf 16 --scale 1.3333 --gl=angle
```

That's the finished 2K vertical video (1440x2560) with the final sound already on it. `out/lake/final.mp4` is the upload.

Tips:
- Set `REMOTION_TMP` to a folder on a big drive first; every render leaves ~1 GB of temp files.
- To check a few frames before the full render: `node scripts/stills.mjs LakeShort out/lake/check_ 60,800,1990 0.5`
- On a machine without a GPU, use `--gl=swangle` (and `GL=swangle` for the stills script); it is very slow.

## Rebuild the sound after a timing change

```bash
python audio/lake_sound.py
```

It also updates `public/lake/mix.wav`, which the video plays. Needs numpy and scipy.
