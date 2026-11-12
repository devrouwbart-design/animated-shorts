# The War We Lost to a Bird

71-second cartoon 3D short about the 1932 "Great Emu War" in Western Australia. Narration: ElevenLabs "Henry – Deep, Professional, and Soothing".

| File | What it is |
|---|---|
| `SCRIPT.md` | Sourced facts |
| `VOICEOVER.txt` | The script as read |
| `voice/voice.wav` | Narration, tightened to 70.4 s (pauses capped, sped up 1.23x) by `voice/make_voice.py` |
| `voice/words.json` | Word timings; every shot and sound is timed to these |
| `audio/mix.wav` | Final sound: voice + music + effects, -14 LUFS |
| `audio/cues.md` | Sound cue sheet |

Code: `src/videos/emu/` (composition `EmuShort`, 1080x1920, 30 fps, 2130 frames). Sound: `audio/emu_sound.py` (also writes `public/emu/mix.wav`, which the composition plays).

## Render it (on a computer with a graphics card)

From the project folder, after `npm install`:

```bash
npx remotion render src/index.ts EmuShort out/emu/final.mp4 --codec h264 --crf 16 --scale 1.3333 --gl=angle --timeout=120000
```

That's the finished 2K vertical video (1440x2560) with the final sound already on it. `out/emu/final.mp4` is the upload.

- Set `REMOTION_TMP` to a folder on a big drive first; every render leaves ~1 GB of temp files.
- Check a few frames first: `node scripts/stills.mjs EmuShort out/emu/check_ 100,1450,2050 0.5` (a staring emu, the hose gag, the coat-of-arms pose).
- Without a GPU (`--gl=swangle`) it takes many hours.

## Rebuild the sound after a timing change

```bash
python audio/emu_sound.py
```
