// One-word subtitles in the Ricks Clips look: one spoken word at a time, white heavy type with a thick black
// outline, centred about 70 % down the frame. Words and times come from timing.ts (made by
// shorts/shadowtax/voice/make_timing.py: times from voice/words.json, spelling and punctuation from voice/script.txt).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPS } from "./timing";

const HOLD = 0.4; // seconds a word stays up after it ends when the next word is late (pauses)

const wordAt = (t: number) => {
  for (let i = 0; i < CAPS.length; i++) {
    const c = CAPS[i];
    const until = Math.min(CAPS[i + 1]?.start ?? Infinity, c.end + HOLD);
    if (t >= c.start && t < until) return c;
  }
  return null;
};

export const Captions: React.FC = () => {
  const { fps } = useVideoConfig();
  const word = wordAt(useCurrentFrame() / fps);
  if (!word) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: "70%",
          transform: "translateY(-50%)",
          fontFamily: "'Arial Black', 'Segoe UI Black', Inter, sans-serif",
          fontWeight: 900,
          fontSize: 84,
          lineHeight: 1,
          color: "#ffffff",
          WebkitTextStroke: "15px #000000",
          paintOrder: "stroke fill",
          textShadow: "0 6px 0 rgba(0,0,0,0.85)",
          whiteSpace: "nowrap",
        }}
      >
        {word.text}
      </div>
    </AbsoluteFill>
  );
};
