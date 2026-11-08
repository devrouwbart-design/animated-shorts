import React from "react";
import { Composition, Audio, staticFile } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { LakeShort, LAKE_FRAMES } from "./videos/lake/Lake";

/** the lake short with its final sound mix (voice + music + effects, shorts/lake/audio/mix.wav) */
const LakeWithVoice: React.FC = () => (
  <>
    <LakeShort />
    <Audio src={staticFile("lake/mix.wav")} />
  </>
);

// Register each new short here, next to BridgeShort (1080x1920, 30 fps).
export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="LakeShort" component={LakeWithVoice} durationInFrames={LAKE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
