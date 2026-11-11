# Ricks Clips rules for our shorts

Concrete, testable rules measured from Ricks Clips (@RicksClips3000). Every rule names the measured value, the
video it came from and where it lives in our code. Update this file with every study (STUDY_GUIDE.md).
Learn the technique only: never copy their stories, characters or shots.

Studies so far:
- `20261111_how-one-cart-stopped-an-entire-army.md` (i4hYq1oSXTg, 66.9 s): the source of every value below
  unless noted otherwise.

How to test a short against these rules:
- Motion: render a clip, then `python scripts/analyze_reference.py <our.mp4> out/<name>/an/` (same report as for theirs).
- Look: `python scripts/frame_metrics.py "ours=out/<name>/x_*.jpg" "ref=out/cmp/refs/r_*.jpg"`.
- Side by side: `python scripts/sbs_sheet.py out.jpg --ours ... --ref ...`.
- A/B switches: `PROPS='{"look":{"real":true},"post":{"ink":false}}' node scripts/stills.mjs <Comp> out/<name>/x_ <frames> 0.5`.

## Camera (src/shared/camera.ts)
- **C1. One continuous camera, no hard cuts.**
  - Measured: 0 cuts in 66.9 s; about 4.8 camera moves per 10 s carry every scene change.
  - Code: `continuous(beats, f)`, one `Beat` per narration beat; `move: 0` only for a rare hard cut.
  - Test: analyze_reference.py reports ≤ 1 cut per 20 s.
- **C2. Moves use the measured ease, not smootherstep.**
  - Measured: speed peaks at 0.65 of the move with a broad middle (curve in the study file).
  - Code: `refEase` / `REF_MOVE_CURVE`. Speed-profile RMS error vs the reference: 0.096 (smootherstep 0.159).
  - Test: in per-move speed profiles from frames.csv, the peak sits between 0.45 and 0.7.
- **C3. Move length 0.43 s core, about 24 f with ease tails (p10 19, p90 46).**
  - Code: `REF_MOVE_FRAMES = 24`; push-throughs on a key word 11-13 f.
- **C4. Holds are short and drift: median 0.83 s (p90 2.9 s).**
  - Drift values: zoom between -0.05 and +0.44 %/f in both directions, roll ≤ 0.05 °/f, pan 0.3-0.9 px/f at 720p.
  - Code: `holdDrift(cam, t)` with defaults push 0.15 %/f, truck 0.004 m/f, roll 0.6 °/s.
  - Replaces the always-pushing `pushK` creep in story.ts.
- **C5. Half the moves go out, half in.**
  - Image scale per move: median |24 %|, range -37 to +108 %. Roll per move: median 4.5°, max 21°, mid-move only.
  - Code: `flyBetween(a, b, u, arc, rollDeg)`. `arc` 0.12-0.15 pulls the lens back mid-move.
- **C6. Opening: about 0.9 s mid shot creeping at 0.15-0.2 %/f, then a push-through of about +69 % in 0.37 s on the 3rd-4th word.**
  - Code: `openingBeats(a, b, fPush = 26, pushFrames = 12)`.
- **C7. The biggest moves land on payoff words.**
  - Measured: +108 % in 13 f into a detail; a fly-out over the battlefield; a pull-back for the last line.
  - Code: give those beats `move` 11-14 and large framing changes; keep the 7 f kicks (story.ts `KICKS`) for impacts.

## Materials and props (src/shared/realMaterial.ts, src/shared/bevel.ts)
- **M1. Every prop material has roughness and a sun highlight.**
  - Measured: stone 0.82, raw wood 0.72, painted wood 0.45, iron 0.35 (metal), cloth 0.92, wet 0.22. Values are judged from highlight size on full-resolution frames.
  - Code: `realMat(params, SURFACE.<kind>, twoTone)` keeps the short's two-tone palette and adds GGX specular masked by the shadow.
  - ShadowTax opt-in: inputProps `{look:{real:true}}` → build.ts `REAL_LOOK` / `surfaceOf(key)`.
- **M2. Wear at the scale of one piece.**
  - Measured: neighbouring blocks/planks differ about ±10 % in value.
  - Code: `wear` (±17 % at 1) with `wearScale` ≈ one piece (stone 0.45 m, wood 0.35 m); per-block vertex tone in `blockWall({ jitter: 0.14 })`.
  - Keep the albedo out of the tone-map shoulder (lit stone ≤ #b8ab98), or the jitter flattens.
- **M3. Grime and contact darkening at the base.**
  - Code: `grime` 0.25-0.45 over the lowest `grimeH` 0.45 m above `groundY`.
- **M4. Sky reflection on glossy and wet surfaces only.**
  - Code: `sky` 0 (cloth) … 0.7 (wet). Set `REAL.uRealSky` per light (world.ts already does: `L.sky`).
- **M5. Highlights need edges.** Specular on flat faces barely shows (ShadowTax real look: +9 % surface detail, almost no visible highlight). Pair M1 with G1/G2.
- **G1. No hard boxes for props.**
  - Bevel radius 4-8 % of the smallest side.
  - Code: `roundedBox(w, h, d)` (default `BEVEL_FRAC = 0.06`), `roundedBoxBetween(min, max)` as a drop-in for `boxGeo`, `plank()`.
- **G2. Stone walls are separate blocks with recessed dark mortar.**
  - Running bond; blocks about 0.55 x 0.28 m against 1.5 m characters.
  - Code: `blockWall({ w, h, block, gap: 0.02-0.03, proud: 0.025, bevel: 0.02-0.035, jitter: 0.14 })` → `{ blocks, mortar }`.
  - LookLab result: highlight pixels 2.6x, visible block relief.
- **G3. Multi-part props.** Crates, carts and benches are built from separate planks with gaps and braces, not one textured box (LookLab crate).
- **G4. Side light shows relief.** Put the sun 60-90° off the lens axis on hero props, not behind the lens.

## Colour and light (per-short lights.ts / grade.ts)
- **L1. Calmer palette.**
  - Target colourfulness 50-70 on day shots, up to 85 only on the payoff.
  - Target day luma 0.40-0.52; warm share 0.4-0.6.
  - ShadowTax now: colourfulness 85, luma 0.64, warm share 0.62.
  - Code: `LOOK.<light>.sat` (1.18 day) and grade strength.
- **L2. Light follows the story.**
  - Tension beats are darker and cooler (luma 0.24-0.36, warm 0.13-0.36). The payoff is the brightest and most colourful (luma 0.51-0.56, colourfulness 82-85).
  - Measured: 4 time-of-day changes in 67 s.
  - Code: `SHOTS[].light`.
- **L3. No world ink.**
  - Measured: thin near-black lines 0.77 % of pixels (almost all character outlines). ShadowTax: 1.98 %; with world ink off: 1.08 %.
  - Code: `post.ink` toggle (ShadowTax.tsx `toggles`) / ink.ts. Characters keep their own outline.
  - Open: ink is the proven look of our earlier reference; switch it off per short only with the user's OK.
- **L4. Night = cool ambient + warm emissive.** Blue-violet shade, warm lanterns with bloom (threshold 1.0, as in the post chain).

## Detail and depth
- **D1. Depth of field on close and mid shots.**
  - Measured: centre/border sharpness ratio median 6.2; > 1.5 on 85 % of frames. Wides and aerials stay sharp.
  - ShadowTax: 3.3, because `dofAt` returns `cInf: 0` (the user's preference since Apollo 13).
  - Ask before changing; the lens pass and `DOF` values are ready in story.ts / lensblur.ts.
- **D2. A foreground layer in most frames.** Grass blades, a prop edge or a shoulder at the lens. Code: story.ts `FOREGROUND`.
- **D3. Detail is texture and form, not lines.**
  - Edge density target ≈ 0.10 (ShadowTax 0.14) while fine detail stays high.

## Subtitles (src/shared/Captions.tsx)
- **S1. Position:** centre 70 % down, centred. Code: `CAPTION_STYLE.top = 0.7`.
- **S2. Size:** capital height 52 px at 1080x1920. Code: `fontPx: 72` (Arial Black). ShadowTax used 84.
- **S3. Outline:** thin, about 4-5 px visible, plus a soft shadow.
  - Code: `strokePx: 9` (half shows with paint-order), `shadow: 0 5px 7px rgba(0,0,0,.7)`.
  - ShadowTax used a 15 px stroke and a hard shadow.
- **S4. Rhythm:** 2.86 cards/s, median 0.33 s, 1-3 words per card, no flashes.
  - Code: `groupCaps` defaults `minDur 0.14, maxChars 10, maxWords 3`.
  - ShadowTax: 3.67 → 2.85 cards/s; cards under 0.15 s: 69 → 10.
- **S5. Always on while the voice talks.** Hold 0.4 s into pauses. Code: `capAt(..., hold = 0.4)`.

## Sound and pacing (per-short audio/ mix scripts)
- **P1. Compressed, constant bed.**
  - Measured: -14 LUFS, LRA ≤ 3 LU; less than 2 % of frames 18 dB under the median (no dead air).
- **P2. Voice speed:** theirs ~3.1 words/s; ours 3.7.
  - Keep ours but never let cards flash (S4).
- **P3. Something new every ~1.4 s:** a camera move, an expression change or an effect.
- **P4. Story shape.**
  - Open cold on a strange action with a number in the first 2 s.
  - Add a curiosity line at about 20 % of the runtime ("it gets weirder").
  - Bring the hook number back 2-3 times.
  - Make the payoff the brightest and widest frame.
  - End on the hero's deadpan face for 1-2 s with the punchline as the last word.

## Characters (per-short toon.ts / cast.ts)
- **K1. Flat faces, textured clothes.** Faces stay flat and bright (near 0.9 luma) with a black outline of about 8 px at 1080. Costumes carry fabric texture (quilting, stitching, belts).
- **K2. A new expression on almost every sentence.** Background characters react too.
