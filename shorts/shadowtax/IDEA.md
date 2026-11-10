# The King Who Taxed Shadows (approved idea, invented story)

Cartoon 3D short in the house style (`.claude/skills/cartoon-3d-short/`), about 60 s (55-65 s), narrated by
ElevenLabs "Henry – Deep, Professional, and Soothing" (voice_id `pVnrL6sighQX7hVz89cp`).
The story is FICTION (a fairy-tale kingdom, our own characters); the science inside it must be REAL and accurate.
Open as a tale ("Once, a greedy king...") so viewers know it is a story.

## Story
A greedy medieval king invents a new tax: every citizen pays by the length of their shadow, measured by his royal
tax collector with a long measuring rod.
1. Hook (one line, absurd): "A greedy king once made his people pay a tax on their shadows."
2. Straight into "You see, ..." (the user's preference): the king measured every shadow with a rod: the longer the shadow, the bigger the bill.
3. The town gets clever, round 1: everyone turns up at noon in midsummer, when the sun is highest and shadows are shortest. Tiny bills. The king fumes.
4. The king strikes back: tax day moves to a winter evening, when the sun is low and shadows stretch across the square. Huge bills, villagers gasp.
5. Round 2: the townsfolk wait for a cloudy day. Thick cloud spreads the light out, so nobody has a sharp shadow at all. The collector measures nothing. The king rages.
6. Mystery beat: "So the king picked a sunny winter sunset, with no clouds in the sky. Now what?"
7. The final trick: at sunset the whole town crowds into the long shadow of the king's own castle. Someone standing inside a shadow casts no shadow of their own. Zero tax.
8. Twist ending: the collector, following the rules exactly, measures the biggest shadow in the kingdom, the castle's, stretching over the whole town, and hands the bill to the king. (Optional last line about the king abolishing the tax that night.)

## Real science to explain (one idea, everyday analogy)
- Shadow length depends on how high the sun is: high sun (noon, summer) = short shadow; low sun (evening, winter) = long shadow. Analogy: a torch held straight above a toy vs. from the side.
- Overcast light comes from the whole sky at once, so shadows go soft and nearly vanish.
- Inside another object's shadow you cast none, because no direct sunlight reaches you.
Keep all claims accurate; no fake science.

## Look
A colourful fairy-tale medieval town square in the cartoon 3D style: castle on a hill, market stalls, cobbles
(Kenney fantasy-town-kit props are in public/kenney/), a fat little king with a crown and ermine cape, a skinny tax
collector with a measuring rod and ledger, townsfolk (baker, farmer, kids, a goose). Big readable sun positions:
midsummer noon, winter sunset (golden light preset), an overcast day. Long dramatic shadows are the star: make sure
the sun direction and shadows are clearly visible in every tax-day shot. English only. (Subtitles: see the preferences below.)
Start from the lake short template (`src/videos/lake/`): shots timed to word timings.

## Length and the user's latest preferences (from the Apollo 13 short)
- Target length: about 60 s. Henry at the natural pace (pauses capped at 0.18 s, atempo 1.21x) reads ~3.3-3.5 words/s,
  so write the script at about 200 words (Apollo 13's 62 s plan came out at 72 s).
- Use the newest template: `src/videos/apollo13/` and `shorts/apollo13/` (voice scripts `voice/make_voice.py`,
  `voice/make_timing.py`, sound `audio/apollo13_sound.py`).
- One-word subtitles in the Ricks Clips look (copy `src/videos/apollo13/Captions.tsx`). This replaces the old
  "no captions" rule.
- No depth-of-field blur: every shot sharp (as `DOF_SCALE = 0` in the Apollo 13 story.ts).
- An eye-catching opening in the first ~2 s (Apollo 13 rushed in from outside through a window): e.g. swoop from high
  over the kingdom down into the town square as the hook line starts.
