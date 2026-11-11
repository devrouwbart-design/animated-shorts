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
`{look:{real:true}}`): surface detail away from edges +9 % (1.076 → 1.174), roofs/cobbles gain tone wear and a sky
sheen; turning world ink off as well drops ink 1.98 → 1.08 % and edges 0.140 → 0.122 (reference 0.77 / 0.103).
In the LookLab test scene, bevelled blocks + realMat raise highlight pixels 2.6x (1.5 → 4.0 per 1000) and give the
wall visible block relief.

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

## 10. Where ShadowTax falls short (in order of impact)
1. Cuts instead of one continuous camera (22 hard cuts vs 0).
2. Flat ink-lined world vs bevelled, textured, specular props (ink 2.6x theirs; no bevels; no wear or grime).
3. Over-saturated, over-bright palette (colourfulness 85 vs 59, luma 0.64 vs 0.45).
4. No depth of field (ratio 3.3 vs 6.2): a deliberate user choice, kept; flagged for the user.
5. Foreground detail: open cobble planes vs grass blades and props at the lens.
6. Captions 15 % too big, outline 3x too heavy, tiny words flashing (fixed in shared Captions).
7. One light per stretch of story; theirs changes time of day on beats (ShadowTax does change light, mostly by shot).
