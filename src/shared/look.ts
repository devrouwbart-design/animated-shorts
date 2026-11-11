// Look switches shared by every short (Ricks Clips rules M1-M5 and L3, references/ricksclips/RULES.md).
// New shorts start from NEW_SHORT_LOOK: realistic materials on, world ink off (the user chose this on 2026-11-11).
// Finished shorts pin their own defaults so they keep rendering as they were approved.
// Any render can still override them for A/B stills: inputProps { look: { real }, post: { ink } }.
import { getInputProps } from "remotion";

export type LookFlags = {
  /** realistic surfaces from shared/realMaterial.ts on world materials */
  real: boolean;
  /** black ink outlines on the 3D world (characters always keep their own outline) */
  worldInk: boolean;
  /** character outline weight (1 = our earlier 5 % of head width; Ricks Clips measure ~2.2 % -> 0.45) */
  charOutline: number;
  /** textured clothing on characters: quilting, stitched seams, metal buckles (Ricks Clips rule K5) */
  clothTexture: boolean;
};

/** the default for every new short */
export const NEW_SHORT_LOOK: LookFlags = { real: true, worldInk: false, charOutline: 0.45, clothTexture: true };

/** the short's defaults, overridden by inputProps when a render passes them */
export const lookFlags = (defaults: LookFlags = NEW_SHORT_LOOK): LookFlags => {
  const p = getInputProps() as { look?: { real?: boolean; charOutline?: number; cloth?: boolean }; post?: { ink?: boolean } };
  return { real: p.look?.real ?? defaults.real, worldInk: p.post?.ink ?? defaults.worldInk, charOutline: p.look?.charOutline ?? defaults.charOutline,
    clothTexture: p.look?.cloth ?? defaults.clothTexture };
};
