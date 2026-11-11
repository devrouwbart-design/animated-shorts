# Studying a Ricks Clips (@RicksClips3000) short

Goal: learn, in numbers and concrete rules, why their shorts feel real and fun to watch, and fold that into our
pipeline. Their videos are PRIVATE STUDY MATERIAL: never commit their video, frames, sheets or audio to git, never
publish them, never copy their stories, characters or shots. Only our written findings (numbers, rules, our own code)
go into the repo.

## 1. Get the video (on the user's computer; cloud sessions cannot reach YouTube)
- Newest upload: `yt-dlp --flat-playlist --playlist-end 3 --print "%(upload_date)s %(id)s %(title)s" https://www.youtube.com/@RicksClips3000/shorts`
  (shorts tab; check the videos tab too and take the most recent of both).
- Download the best quality into `out/ref/ricksclips/` (git-ignored): `yt-dlp -f "bv*+ba/b" -o "out/ref/ricksclips/%(upload_date)s_%(id)s.%(ext)s" <url>`
  (`pip install yt-dlp`; ffmpeg must be on PATH).

## 2. Measure every frame
`python scripts/analyze_reference.py out/ref/ricksclips/<file>.mp4 out/ref/ricksclips/<id>/`
gives report.md (shots, camera zoom/pan/roll per frame, ease profile, colour, detail, depth of field, palettes,
loudness), frames.csv (every frame), keys/ (start/middle/end of each shot, full resolution) and sheets/ (2 s contact
sheets, 60 frames each, cuts marked).

## 3. Look and describe (use the key frames and sheets, compare with our renders side by side)
Write numbers wherever possible; adjectives only when nothing can be measured.
- **Realistic objects:** what materials look like (roughness, specular highlights, reflections, bevelled/rounded
  edges vs hard boxes), texture scale and wear (scratches, dirt, labels, stitching), ambient occlusion in corners,
  contact shadows, subsurface/soft looks, how much geometric detail props have (count of distinct parts), how real
  objects are mixed with cartoon characters, whether props are photoreal, stylised-real or toon.
- **Camera:** shot lengths, how often it cuts, zoom/push speed (%/frame), pans, rolls, whip pans, speed ramps, ease
  in/out (peak position), what the camera does on each spoken beat (does it move on every sentence? every word?),
  opening move in the first 1-2 s, how close shots are (face fills x % of frame), low/high angles.
- **Colour and light:** luma, contrast, saturation per shot; palette; warm/cool split; rim light; bloom/glow; fog and
  haze; time-of-day changes per beat; how characters separate from backgrounds.
- **Level of detail:** edge density and fine texture vs ours; background density (how many objects in frame); depth
  layers (foreground/mid/background); depth of field on or off.
- **Characters:** proportions, outlines (thickness, colour), shading, expressions, how often they change, mouth/eye
  animation, how they are lit by the scene.
- **Text and subtitles:** font, size (% of frame width), colour, outline, position, words per caption, timing vs voice.
- **Sound and pacing:** loudness, music bed level vs voice, SFX density (events per 10 s), voice speed (words/s),
  hook length, where the payoff lands, video length.
- **Retention tricks:** what changes on screen every ~1-2 s, curiosity gaps, visual surprises, loop endings.

## 4. Write it down (this is what goes into git)
- `references/ricksclips/<upload_date>_<slug>.md`: the full measured report for that video (numbers + findings).
- `references/ricksclips/RULES.md`: the running list of concrete, testable rules for our shorts (e.g. "push-in
  0.3-0.6 %/f on every hold", "cut every 1.2-2.5 s", "props have bevels >= 2 cm and a roughness map"), each with
  the measured value it comes from and how to apply it in our code (file + constant). Update it with every study.
- Update `SKILL.md` where a rule changes our pipeline, and implement reusable improvements in shared code where it
  pays off (e.g. a realistic-material helper, bevelled prop geometry, camera move presets matching the measured curves),
  then check them on stills against the reference key frames with `scripts/sbs_sheet.py`.
