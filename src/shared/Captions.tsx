// One-word subtitles in the measured Ricks Clips style (RULES.md S1-S5), shared by every short.
// Measured on the newest reference (1080x1920): centre 70 % down, centred; white heavy sans, capital height ~52 px
// (Arial Black ~72 px); a thin black outline (~4-5 px visible) plus a soft dark drop shadow; one word per card, short
// words merged with a neighbour ("an army", "the card", "of it"), so a card changes ~2.9 times per second with a
// median of 0.33 s on screen. Always on screen while the voice talks (no gaps inside sentences).
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type CapWord = { text: string; start: number; end: number };

export const CAPTION_STYLE = {
  /** vertical centre as a fraction of the frame height */
  top: 0.7,
  fontFamily: "'Arial Black', 'Segoe UI Black', Inter, sans-serif",
  fontPx: 72,
  /** stroke width; paint-order puts half of it outside the glyph, so ~4.5 px shows */
  strokePx: 9,
  shadow: "0 5px 7px rgba(0,0,0,0.7)",
  color: "#ffffff",
};

/**
 * Merge words that would flash by: a word shorter than minDur seconds joins its neighbour (the next one, or the
 * previous one at a sentence end) while the card stays within maxChars letters and maxWords words.
 */
export const groupCaps = (words: CapWord[], o: { minDur?: number; maxChars?: number; maxWords?: number } = {}): CapWord[] => {
  // defaults tuned on the shadow tax voice (3.7 words/s): 2.85 cards/s, median 0.34 s (reference 2.86, 0.33)
  const { minDur = 0.14, maxChars = 10, maxWords = 3 } = o;
  const out: (CapWord & { n: number })[] = [];
  const endsSentence = (t: string) => /[.!?,;:]$/.test(t);
  for (const w of words) {
    const last = out[out.length - 1];
    const lastShort = last && last.end - last.start < minDur && !endsSentence(last.text);
    const fits = last && last.n < maxWords && (last.text.length + 1 + w.text.length) <= maxChars && w.start - last.end < 0.15;
    if (last && lastShort && fits) { last.text += " " + w.text; last.end = w.end; last.n++; continue; }
    out.push({ ...w, n: 1 });
  }
  // a short word left at a sentence end joins the card before it
  for (let i = out.length - 1; i > 0; i--) {
    const w = out[i], p = out[i - 1];
    if (w.end - w.start < minDur * 0.6 && p.n < maxWords && p.text.length + 1 + w.text.length <= maxChars && !endsSentence(p.text) && w.start - p.end < 0.15) {
      p.text += " " + w.text; p.end = w.end; p.n += w.n; out.splice(i, 1);
    }
  }
  return out.map(({ n: _n, ...w }) => w);
};

/** the card on screen at time t (a card stays up until the next starts, or `hold` s after it ends in a pause) */
export const capAt = (caps: CapWord[], t: number, hold = 0.4) => {
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i], until = Math.min(caps[i + 1]?.start ?? Infinity, c.end + hold);
    if (t >= c.start && t < until) return c;
  }
  return null;
};

export const Captions: React.FC<{ words: CapWord[]; group?: boolean; hold?: number; style?: Partial<typeof CAPTION_STYLE> }> = ({ words, group = true, hold = 0.4, style }) => {
  const { fps } = useVideoConfig();
  const caps = React.useMemo(() => (group ? groupCaps(words) : words), [words, group]);
  const s = { ...CAPTION_STYLE, ...style };
  const c = capAt(caps, useCurrentFrame() / fps, hold);
  if (!c) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div style={{
        position: "absolute", top: `${s.top * 100}%`, transform: "translateY(-50%)",
        fontFamily: s.fontFamily, fontWeight: 900, fontSize: s.fontPx, lineHeight: 1, color: s.color,
        WebkitTextStroke: `${s.strokePx}px #000000`, paintOrder: "stroke fill", textShadow: s.shadow, whiteSpace: "nowrap",
      }}>
        {c.text}
      </div>
    </AbsoluteFill>
  );
};
