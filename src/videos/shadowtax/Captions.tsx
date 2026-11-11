// One-word subtitles in the Ricks Clips look, from the shared component (src/shared/Captions.tsx: measured size,
// thin outline + soft shadow, 70 % down, tiny words merged so cards change ~2.9 times per second).
// Words and times come from timing.ts (made by shorts/shadowtax/voice/make_timing.py).
import React from "react";
import { Captions as SharedCaptions } from "../../shared/Captions";
import { CAPS } from "./timing";

export const Captions: React.FC = () => <SharedCaptions words={CAPS} />;
