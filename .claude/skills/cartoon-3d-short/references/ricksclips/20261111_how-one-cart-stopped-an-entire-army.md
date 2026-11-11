# Ricks Clips study: "How One Cart Stopped an Entire Army" (i4hYq1oSXTg, uploaded 2026-11-11)

Private study. Their video, frames, sheets and audio stay in `out/ref/ricksclips/` (git-ignored). Below are only our
measurements and conclusions. Compared against our newest short, `ShadowTaxShort` (src/videos/shadowtax/).

Tools: `scripts/analyze_reference.py` (every frame at 30 fps), `scripts/frame_metrics.py` (same metrics on stills,
ours vs theirs), plus one-off checks described inline. Source 1080x1920, 66.86 s, 2005 frames, -14.1 LUFS.

## 1. Summary: the 8 things that make it work
1. **One continuous camera.** 0 hard cuts in 67 s. Scenes change by quick camera moves (pull-back, orbit, truck,
   push-through), about 4.8 per 10 s; two soft dissolves at most. ShadowTax hard-cuts 22 times in 59 s.
2. **Real-looking world, flat cartoon people.** Props and buildings are bevelled, textured, lit with specular
   highlights and grime; characters are flat white-headed cards with a black outline. The world has **no ink lines**.
3. **Calmer colour than ours.** Colourfulness 59 vs our 85; luma 0.45 vs 0.64; warm share 0.43 vs 0.62.
4. **Light changes with the story.** Day → dusk → night rain → dusk → bright day for the payoff (luma 0.24 to 0.56).
5. **Depth of field almost always on.** Centre/border sharpness ratio median 6.2 (ours 3.3; ShadowTax uses no lens
   blur by the user's choice since Apollo 13).
6. **Dense foreground detail.** 3D grass blades, props and characters at different depths in most frames.
7. **One-word captions that never flash.** Short words merged ("an army", "the card"), 2.86 cards/s, 0.33 s median.
8. **Constant sound bed, compressed voice.** LRA 2.9 LU, only 1.9 % of 10 ms frames are 18 dB under the median.

## 2. Camera
### Structure
| measure | reference | ShadowTax |
|---|---|---|
| hard cuts | 0 in 66.9 s | 22 in 59.2 s (+6 crossfades, 1 white flash) |
| camera events (moves) per 10 s | 4.8 | ~4.6 shot changes, but as cuts |
| hold length between moves | median 0.83 s, mean 1.52 s, p10 0.27, p90 2.93 | shots ~2.1 s, each one creeping hold |
| move length | core median 0.43 s; with ease tails median 24 f (p10 19, p90 46) | smootherstep glides 18-40 f inside shots |
| camera moving | 80 % of frames | ~100 % (pushK creep on every hold) |

How the analyzer saw it: its cut detector found nothing; a second pass looking for single-frame spikes in picture
difference (diff > 3.5x local median) also found nothing. Every "scene change" in the contact sheets is a move: at
the day→night change the camera pulls back from a close-up and swings round to the next subject in ~1 s; the drilling
opener pushes through the character into the prop in 0.37 s.

### Speed curve of a move (mean of 20 moves, normalised, 21 samples start→end)
`0.09 0.15 0.28 0.45 0.61 0.72 0.77 0.82 0.82 0.75 0.78 0.85 0.91 1.00 0.96 0.85 0.61 0.36 0.24 0.12 0.10`
- Peak at 0.65 of the move, broad plateau 0.3-0.75. Smootherstep peaks sharply at 0.5 and is near zero for the first
  and last 15 %. Speed-profile RMS error vs this mean: smootherstep 0.159, our new `refEase` 0.096.
- Single moves vary a lot (peak positions 0.0-0.87, median 0.45), so the mean is a "house" curve, not one move.
- Position curve (implemented as `REF_MOVE_CURVE` in src/shared/camera.ts):
  `0 .01 .03 .07 .12 .18 .24 .31 .38 .44 .50 .58 .65 .73 .81 .88 .93 .96 .98 .99 1`

### Move sizes
- Image-scale change per move: median |24 %| (range -37 % to +108 %); about half the moves zoom OUT (pull-backs and
  orbit-outs), half zoom in. Biggest: +107.5 % in 13 frames (push into a detail on a key word).
- Roll per move: median |4.5°|, max 20.8°. Rolls happen during moves, not on holds.
- Pans: p90 7.9 px/f at 720p overall, peaks 13-200 (whip-like) in the fastest moves.

### Holds
- Zoom on holds: p50 +0.017 %/f, p90 +0.44 %/f; 38 % of hold frames push in (> 0.05 %/f), 32 % pull out. Not a
  steady push: a slow drift in either direction.
- Roll drift on holds: |0.05| °/f median, p90 0.53.
- Pan drift on holds: median 0.3-0.9 px/f at 720p.

### What the camera does with the words
- A move lands on nearly every sentence; inside long sentences the camera holds and the character acts.
- Payoff words get the biggest moves: the push-through on the number in the hook, the fly-out over the battlefield,
  the final pull back to the smug face with the explosion behind.

### Opening (first 1.2 s)
- 0-0.87 s: mid shot of the character doing the odd thing, push 0.15-0.2 %/f (one burst to 0.61), pan 0.5-2 px/f.
- 0.87-1.23 s: fast push-through past the character into the prop (+69 % image scale in 11 frames, peak mid-move,
  zoom up to 4.9 %/f at the end) on the fourth word. Second move at 2.0-3.6 s reveals the setting.

## 3. Realistic objects (key frames + metrics)
| metric (frame_metrics.py) | reference (33 frames, every 2 s) | ShadowTax (4 stills) |
|---|---|---|
| thin near-black ink, % of pixels | 0.77 | 1.98 |
| Canny edge density | 0.103 | 0.140 |
| fine-texture energy | 7.97 | 12.2 |
| specular-type highlights per 1000 px | 17.1 | 39.0 (mostly caption/cloud whites; not a material signal for us) |

What their props have that ours don't (described from full-resolution key frames):
- **Bevelled pieces, not boxes.** Stone walls are separate blocks, each with rounded edges that catch a thin line of
  light, standing slightly proud of recessed dark mortar; neighbouring blocks differ in tone by roughly ±10 %. Planks,
  beams, cart parts and crates are separate rounded pieces with gaps. Bevel radius looks like 4-8 % of the smallest
  side of a piece.
- **Roughness reads through highlights.** Painted wood has a soft sheen; iron (helmets, wheel rims, drill) shows a
  bright tight highlight; wet planks at night show long streaky reflections of the lanterns; stone has almost none.
- **Wear and grime.** Tone varies across every surface at the scale of one piece and finer; bases of walls and props
  are darker where they meet the ground (ambient-occlusion look); soft contact shadows under everything.
- **Texture scale is real-world.** Wood grain, stitching on clothes, rope fibres and fabric fringes are at the size
  they would be on a real object of that size.
- **Characters on top.** Flat white heads with a black outline (~8 px at 1080) and textured clothing (quilted
  diamonds, belts, stitching) — the clothes borrow the world's realism while faces stay flat.
- **Effects are volumetric.** Light shafts through an archway, smoke trails, rain streaks, a stylised fire-ball with
  real lighting on the ground.

Why our material layer alone moves the numbers only a little on ShadowTax: our world is flat faces drawn with ink, so
there are no curved or bevelled edges for highlights to land on. Real-material test on ShadowTax (inputProps
`{look:{real:true}}`): roofs/cobbles gain tone wear; with world ink off as well, surface detail away from edges +7 %
(1.076 → 1.156), ink 1.98 → 0.97 % and edges 0.140 → 0.123 (reference 0.77 / 0.103).
In the LookLab test scene, bevelled blocks + realMat + glossy fittings raise highlight pixels 5x (1.5 → 7.9 per 1000)
and give the wall visible block relief. (Numbers re-measured after fixing a flipped view direction in the sky
reflection term on 2026-11-11; the first measurements had too much sky sheen everywhere.)

## 4. Colour and light
Whole video: luma 0.437 (p2 0.116, p98 0.894, std 0.196), saturation 0.398, colourfulness 61.6, warm share 0.43.
Palette of the middle frame (night): #1c1828 31 %, #414466 25 %, #372e40 25 %, #615977 14 %, #f0e2d8 3 %.

Per story beat:
| beat | s | luma | contrast | sat | colourful | warm | edges | DOF |
|---|---|---|---|---|---|---|---|---|
| cold open, day | 0-2 | 0.55 | 0.20 | 0.36 | 65 | 0.60 | 0.107 | 1.2 |
| army arrives, day | 2-8 | 0.48 | 0.18 | 0.35 | 62 | 0.40 | 0.106 | 5.8 |
| mockery at the fort | 8-16 | 0.33 | 0.19 | 0.36 | 48 | 0.36 | 0.144 | 2.4 |
| mechanism reveal | 16-26 | 0.34 | 0.18 | 0.42 | 43 | 0.60 | 0.148 | 3.3 |
| gag, dusk | 26-30 | 0.36 | 0.19 | 0.38 | 46 | 0.21 | 0.124 | 4.0 |
| night rain | 30-34 | 0.24 | 0.16 | 0.39 | 34 | 0.13 | 0.084 | 4.9 |
| dusk attack | 34-40 | 0.40 | 0.22 | 0.30 | 41 | 0.43 | 0.082 | 7.7 |
| bright day, ignition | 40-55 | 0.51 | 0.21 | 0.46 | 82 | 0.51 | 0.103 | 6.4 |
| payoff, blast | 55-67 | 0.56 | 0.21 | 0.41 | 85 | 0.43 | 0.071 | 2.3 |

- The tension middle is dark and cool (luma 0.24-0.36, warm 0.13-0.36); the payoff returns to the brightest, most
  colourful light (colourfulness 82-85). Light is a story tool: four time-of-day changes in 67 s.
- Night: blue-violet ambient with warm emissive lanterns (bloom), so warm accents pop against cool shadow.
- Characters separate by value: white heads (near 0.9 luma) + black outline against mid-value worlds.
- ShadowTax stills: luma 0.64, colourfulness 85, warm share 0.62 — brighter and more saturated across the board.
  Their day frames alone: luma 0.40-0.52, colourfulness 53-73.

## 5. Level of detail and depth
- Depth of field: centre/border sharpness ratio > 1.5 on 85 % of frames, > 3 on 59 %, median 6.2. Wides and
  aerials are sharp (cold open 1.2, payoff 2.3); close and mid shots blur the background hard.
- Depth layers: most frames have a foreground layer (grass blades, a prop edge or a character's shoulder), the
  subject, and a blurred background with a building or landscape.
- Edge density is lower than ours (0.103 vs 0.140) even though frames look busier: their detail is soft texture and
  form, ours is lines.

## 6. Subtitles
- One card at a time, always on screen while the voice talks (100 % of frames have a card).
- Position: centre 70.3 % down the frame, centred horizontally (50.1 %).
- Size: capital height 52 px at 1080x1920 (≈ Arial Black 72 px); median card width 22 % of the frame.
- Style: white heavy sans, thin black outline (~4-5 px visible) plus a soft dark drop shadow below.
- Timing: 191 cards in 66.9 s = 2.86 per s, median 0.33 s (p10 0.13, p90 0.57). Short words are merged with a
  neighbour, so cards are 1-3 words.
- ShadowTax before: Arial Black 84 px, 15 px stroke + hard shadow, one word per card: 3.67 cards/s with 69 cards
  under 0.15 s. After (shared Captions): 72 px, 9 px stroke + soft shadow, grouped: 2.85 cards/s, median 0.34 s,
  10 cards under 0.15 s.

## 7. Characters and expressions
- Round white heads, black outline, dot eyes with heavy brows, small mouths; stick limbs; costumes textured.
- Expressions change on almost every sentence (smug, shocked, angry, sleepy); big reactions are timed to the word.
- Background characters react too (laughing, pointing), so every frame has a readable face.

## 8. Sound and pacing
- Loudness -14.1 LUFS integrated, LRA 2.9 LU, peak -1.9 dBFS: heavily compressed, no quiet passages.
- No real silences: only 1.9 % of 10 ms frames are more than 18 dB under the median.
- Loud onsets (voice syllables + SFX) ~20 per 10 s.
- Voice ~3.1 words/s (cards 2.86/s, ~1.1 words per card); ours runs at 3.7 words/s.
- Length 66.9 s.

## 9. Story shape and retention (technique only)
- Cold open on a strange action with a number, before any context (first 2 s).
- Context and stakes in the next 6 s; doubters mock the hero (8-16 s).
- An explicit curiosity line at ~13.5 s ("it gets weirder" type), then the mechanism reveal.
- A comic interlude with a light change before the climax.
- The number from the hook comes back three times.
- The payoff is the brightest, widest, loudest moment; the last 1-2 s hold on the hero's deadpan face with the
  explosion behind: punchline on the last word, no loop line.
- Something new every ~1.4 s: camera move, expression change or effect.

## 10. Nature: grass, trees, ground
Their nature looks real because the detail is spent where the lens is. Far away it is simple.
- **Near grass is hero-level geometry.**
  - Thousands of thin blades: tapered, curved, flopping every way.
  - Dark at the roots, yellow-green at the lit tips, with a few dry yellow blades.
  - Tall enough to hide the characters' feet and the bottoms of props.
  - Grass sits in the foreground of most outdoor shots.
- **Measured on 4 near-grass close-ups (bottom of the frame, 540-wide scale):**
  - hue 84-107°, saturation 0.56-0.63, mean value 0.28-0.70
  - value p5 → p95 spans 2.5-4.3x (deep shade between clumps against bright tips)
  - fine-detail energy 7-10
- **Mid-distance:** fields are flat colour patches with stripe textures; hillsides are green with darker noise
  patches (woods) and lighter ones (meadow). Haze and depth of field soften everything past the subject.
- **Trees are simple:**
  - Faceted low-poly blobs (round) or stacked cones (pine), never outlined.
  - Every tree is shaded: lit top in yellow-green, mid green, dark green underside and core.
  - Shadows on the ground under every tree.
- **ShadowTax / our current meadow (NatureLab "before" = shadowtax grassHD texture + cartoon trees):**
  - Saturation 0.99, value range 1.1x (flat), fine detail 1.3-2.5.
  - The trees are ink-outlined teal ball stacks with a two-tone flat shade.
- **Shared helpers (src/shared/nature.ts, NatureLab "after"):**
  - Measured result: saturation 0.60-0.65, value 0.49-0.51, range 1.5-1.8x, fine detail 8.8-10.1.
  - Saturation, value and fine detail now sit inside the reference ranges.
  - The value range is still low: the rest of theirs comes from cast shadows inside the turf and DOF.

## 11. How light reflects on objects (the drilled box in the opening)
The "sun reflecting on the box" is several simple effects stacked together, not one mirror reflection:
- **Three face values.** Measured at 0.0 s:
  - top face (sky + sun) #f7dd98 L 0.87
  - sunlit front #e0ae4c L 0.70
  - side turned away #907556 L 0.47
  - So top/front = 1.24 and shade/front = 0.67: the shade side keeps two thirds of the light (strong sky fill).
- **Shade keeps the hue.** Lit → shade hue moves 40° → 31° (9°), saturation 0.70 → 0.26. Our two-tone shade
  (uShadeCol [.46,.46,.56] plus an additive blue lift) turns warm wood mauve: hue moves 18°.
- **The big wood faces barely shine.**
  - Across the drilled panel in close-up, L rises only 0.71 → 0.73 (a faint broad sheen).
  - Top to bottom it falls 0.75 → 0.65 (darker toward the base).
  - Fine wood grain and bevelled edges catch thin lines of light.
- **The sparkle is on glossy dark parts.**
  - The black drill body shows sharp white rectangular glints: 4.4 % of its pixels above L 0.85, peak pure white.
  - The black brackets stay black (L 0.09) with sky-blue edges: 18 % of their pixels are blue-dominant reflections, mean RGB (61, 78, 106).
  - Brass knobs have small hot spots.
  - Contrast does the work: white glints on near-black read as "sun reflecting", while a glossy yellow face would only look washed out.
- **What we built:**
  - `SURFACE.glossBlack` / `SURFACE.brass` presets and a `top` sky boost (default +10 %) in realMaterial.ts.
  - `liftFor(color)`, which scales the two-tone shade lift with the albedo, so black stays black.
  - A neutral shade colour in LookLab.
  - LookLab crate result:
    - hue shift into shade 13° → 11° (reference 9°)
    - top/shade value 1.44 → 1.59 (reference 1.85)
    - black caps L ≈ 0.1 with a sun glint and blue edges; brass hot spot
    - highlight pixels 1.5 → 7.9 per 1000

## 12. Characters
- **Construction:** round, slightly wide heads (measured face area h/w 0.77-0.87 without hair; hair and headbands sit
  on top), stick limbs, bean bodies. Head width 150-510 px at 1080 in medium and close shots.
- **Outline:** dark plum-grey (#27-2b / 1c-26 / 28-3b), 1.9-2.5 % of the head width (median 2.2 %), fairly even all
  round. ShadowTax: 7.6-8.7 % (thick-thin `ow = 5u` swinging ±45 %), more saturated purple. About 3x heavier.
- **Face shading:** flat, no gradient and no shadow. The face colour simply takes the scene light: day #f6f1ed
  (near white), lantern night #f9e0cd, dusk #f3daca, explosion glow #feebd7. Faces stay the brightest thing in frame
  (V ≥ 0.94), so they always read.
- **The realism goes into what they wear:** quilted fabric with stitched seams, belts with metal buckles, textured hair
  with strand highlights, folded headbands, metal helmets with specular highlights. Faces stay simple.
- **Expressions** (technique, not their characters). Brows do most of the acting:
  - Brows: thick black tapered strokes, about 25 % of the head width long and 3.5 % thick, tilted up to 25-30°.
  - Deadpan / smug (the default face): upper lids cut flat across the pupils (half-lidded D eyes), level or one raised brow, tiny "o" mouth or a small line.
  - Shock: big round white eyes with a black ring and a dot pupil (each about 20 % of head width), brows high, open mouth with a pink tongue.
  - Angry: brows in a hard V, red-tinted eye whites, gritted or shouting mouth.
  - Laugh / grin: wide open D mouth with pink tongue and teeth, squeezed eyes.
  - Sleepy / bored: closed lid lines, small open mouth.
  - Changes land on the word that motivates them ("pours." → shock in the same frame). The hero changes face about once per sentence; side characters react in the background.
- **Our cast** already has the same kinds of expressions (toon.ts FACE: lid, shock, grin, laugh, stern...). The
  measurable gaps are the outline weight and textured clothing.
  - `charOutline` 0.45 (new-short default) brings ShadowTax faces from 8.1 % to 3.3 % of head width.
  - `clothTexture` (new-short default) adds quilting at the measured ±60° / 7 %-of-head spacing with lit ridges and a
    sheen, stitched front seams, stitched belts and metal buckles to our cast's clothes (ShadowTax pinned off).
  - Hair: theirs is mid brown #825d44 with a jagged, tufted edge, dark strand clumps #30251f and warm highlight strands
    #fadcac on ~6 % of the hair near the crown. `hairTexture` (new-short default) gives our `"hair"` hat touching, swept
    tufts, short dark clumps and warm highlights.

## 13. Where ShadowTax falls short (in order of impact)
1. Cuts instead of one continuous camera (22 hard cuts vs 0).
2. Flat ink-lined world vs bevelled, textured, specular props (ink 2.6x theirs; no bevels; no wear or grime).
3. Over-saturated, over-bright palette (colourfulness 85 vs 59, luma 0.64 vs 0.45).
4. No depth of field (ratio 3.3 vs 6.2): a deliberate user choice, kept; flagged for the user.
5. Foreground detail: open cobble planes vs grass blades and props at the lens.
6. Captions 15 % too big, outline 3x too heavy, tiny words flashing (fixed in shared Captions).
7. One light per stretch of story; theirs changes time of day on beats (ShadowTax does change light, mostly by shot).
8. Nature: painted flat grass and outlined ball trees vs 3D blades at the lens and shaded low-poly trees (section 10).
9. Character outlines 3x too heavy; clothes flat colour instead of textured (section 12).
10. Shade turns warm surfaces mauve; black parts go navy (fixed lift); no glossy fittings to catch the sun (section 11).
