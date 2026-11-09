import React from "react";
import { Composition, Audio, staticFile } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { LakeShort, LAKE_FRAMES } from "./videos/lake/Lake";
import { Apollo13Short, APOLLO13_FRAMES } from "./videos/apollo13/Apollo13";

/** the lake short with its final sound mix (voice + music + effects, shorts/lake/audio/mix.wav) */
const LakeWithVoice: React.FC = () => (
  <>
    <LakeShort />
    <Audio src={staticFile("lake/mix.wav")} />
  </>
);

/** the Apollo 13 short with its final sound mix (shorts/apollo13/audio/mix.wav) */
const Apollo13WithSound: React.FC = () => (
  <>
    <Apollo13Short />
    <Audio src={staticFile("apollo13/mix.wav")} />
  </>
);

// Register each new short here, next to BridgeShort (1080x1920, 30 fps).
export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="Apollo13Short" component={Apollo13WithSound} durationInFrames={APOLLO13_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="LakeShort" component={LakeWithVoice} durationInFrames={LAKE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
