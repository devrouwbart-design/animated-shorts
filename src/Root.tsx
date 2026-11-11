import React from "react";
import { Composition, Audio, staticFile } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { LakeShort, LAKE_FRAMES } from "./videos/lake/Lake";
import { Apollo13Short, APOLLO13_FRAMES } from "./videos/apollo13/Apollo13";
import { Captions as Apollo13Captions } from "./videos/apollo13/Captions";
import { ShadowTaxShort, SHADOWTAX_FRAMES } from "./videos/shadowtax/ShadowTax";
import { Captions as ShadowTaxCaptions } from "./videos/shadowtax/Captions";
import { LookLab, LOOKLAB_FRAMES } from "./videos/looklab/LookLab";
import { NatureLab, NATURELAB_FRAMES } from "./videos/looklab/NatureLab";

/** the lake short with its final sound mix (voice + music + effects, shorts/lake/audio/mix.wav) */
const LakeWithVoice: React.FC = () => (
  <>
    <LakeShort />
    <Audio src={staticFile("lake/mix.wav")} />
  </>
);

/** the Apollo 13 short with one-word subtitles and its final sound mix (shorts/apollo13/audio/mix.wav) */
const Apollo13WithSound: React.FC = () => (
  <>
    <Apollo13Short />
    <Apollo13Captions />
    <Audio src={staticFile("apollo13/mix.wav")} />
  </>
);

/** the shadow tax short with one-word subtitles and its final sound mix (shorts/shadowtax/audio/mix.wav) */
const ShadowTaxWithSound: React.FC = () => (
  <>
    <ShadowTaxShort />
    <ShadowTaxCaptions />
    <Audio src={staticFile("shadowtax/mix.wav")} />
  </>
);

// Register each new short here, next to BridgeShort (1080x1920, 30 fps).
export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Apollo13Short" component={Apollo13WithSound} durationInFrames={APOLLO13_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ShadowTaxShort" component={ShadowTaxWithSound} durationInFrames={SHADOWTAX_FRAMES} fps={30} width={1080} height={1920} />
    {/* test scene for the shared look code (src/shared), before/after via inputProps { variant } */}
    <Composition id="LookLab" component={LookLab} durationInFrames={LOOKLAB_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="NatureLab" component={NatureLab} durationInFrames={NATURELAB_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="LakeShort" component={LakeWithVoice} durationInFrames={LAKE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
