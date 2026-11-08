# Claude Animated Shorts

A ready-to-use project for making 55-70 s vertical animated story shorts with Claude Code: 2D cartoon characters in a
colourful 3D world, rendered with three.js inside Remotion on your own computer. HyperFrames (HTML-to-video) is
installed alongside it for title cards, motion graphics, local text-to-speech and word timings.

Based on [mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) (MIT).

## Setup (once per computer)
You need Node 22+, Python 3 and ffmpeg.

```bash
npm install
```

The free Kenney 3D prop kits (CC0, ~500 models) are already included in `public/kenney/`.

## Make a short
Open this folder in Claude Code and say: *"Use the cartoon short skill and make a short about ..."*.
Claude follows `.claude/skills/cartoon-3d-short/SKILL.md`: facts, script, voice, shot plan, stills, render, sound.

## Commands
| Command | What it does |
|---|---|
| `npm run studio` | Open Remotion Studio to preview |
| `npm run render:bridge` | Render the example bridge short (1080x1920) |
| `npm run render:bridge:2k` | Render it at 1440x2560 |
| `npx hyperframes --help` | HyperFrames CLI (init, preview, render, tts, transcribe, ...) |

On a machine without a GPU, add `--gl=swangle` to Remotion render commands. Set `REMOTION_TMP` to a folder on a big
drive: every Remotion bundle copies `public/` into the temp folder and never deletes it.

## Layout
| Path | What it is |
|---|---|
| `.claude/skills/cartoon-3d-short/` | The main skill: pipeline, rules, look values, templates, style references |
| `.claude/skills/remotion-*` | Official Remotion skills |
| `.claude/skills/hyperframes*`, `media-use` | Official HyperFrames skills |
| `src/` | Remotion project (`Root.tsx` registers each short; `videos/bridge/` is the example) |
| `scripts/`, `audio/` | Stills, QA and merge helpers; synthesized SFX, music and mix |
| `shorts/<name>/` | Per-short script, voice and sound files |
| `hyperframes/<name>/` | HyperFrames projects |
| `public/` | Static assets for Remotion |

Versions are pinned on purpose (Remotion 4.0.290 and friends). Newer combinations render a blank canvas; see the
skill before upgrading.

## License
Code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
