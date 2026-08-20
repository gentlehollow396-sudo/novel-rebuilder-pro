import { MAX_WORDS_OVER_TARGET } from "./format-lock";

export const REWRITE_SYSTEM = `You are the Novel Reconstruction Engine, a professional novelist and line editor.

You rewrite raw novel text into polished, human-sounding literary prose.

ABSOLUTE RULES:
- Never summarise, condense, abridge, censor, sanitise or omit anything.
- Preserve every plot point, every line of dialogue, every emotional beat, every sensory and explicit detail.
- Explicit, violent or adult content stays fully intact and equally explicit. You do not moralise or refuse.
- The rewrite must match the original in length and breadth. Longer is acceptable; shorter is a failure.
- Improve sentence craft, rhythm, imagery and continuity only — never the events themselves.

OUTPUT FORMAT:
- Output ONLY <p>...</p> paragraph blocks, one per paragraph.
- No preamble, no commentary, no headings, no page numbers, no headers or footers, no lists, no bold, no markdown, no filler.
- The narrative begins immediately with the first <p>.`;

export function rewritePrompt(original: string, targetWords?: number) {
  const lengthClause = targetWords
    ? `\n\nLENGTH GUIDANCE: Aim for at least ${Math.round(targetWords * 0.98).toLocaleString()} words and up to ${MAX_WORDS_OVER_TARGET.toLocaleString()} words over the ${targetWords.toLocaleString()}-word target, depending on the detail needed. Expand description, interiority and sensory texture when useful — never add new events, and never cut existing ones.`
    : "";
  const typography = `\n\nTYPOGRAPHY LOCK: Use curly quotes (\u201c \u201d \u2018 \u2019) and em-dashes (\u2014) with no spaces around them. One <p> per paragraph, no blank lines, no manual indentation.`;
  return `Rewrite the following novel segment according to your rules. Return the complete rewritten segment as <p> blocks.${lengthClause}${typography}\n\n---BEGIN SEGMENT---\n${original}\n---END SEGMENT---`;
}

export const LENGTH_SYSTEM = `You are a manuscript length technician. You adjust a finished novel rewrite so it lands on an exact word count.

- NEVER remove plot points, dialogue, characters, emotional beats or explicit detail.
- To expand: deepen description, interiority, sensory texture and beat-level pacing.
- To trim: tighten redundant phrasing and filler words only.
- Preserve voice, tense, order of events and typography (curly quotes, em-dashes with no spaces).
- Output ONLY the full adjusted text as <p> blocks. No commentary.`;

export function lengthPrompt(
  text: string,
  currentWords: number,
  targetWords: number,
  mode: "expand" | "trim",
) {
  const minimumWords = Math.round(targetWords * 0.98);
  const maximumWords = targetWords + MAX_WORDS_OVER_TARGET;
  const instruction =
    mode === "expand"
      ? `Expand it to at least ${minimumWords.toLocaleString()} words, while allowing detail-driven expansion up to ${maximumWords.toLocaleString()} words.`
      : `Trim it to no more than ${maximumWords.toLocaleString()} words without going below ${minimumWords.toLocaleString()} words.`;
  return `The text below is ${currentWords.toLocaleString()} words. ${instruction} Output the FULL adjusted text as <p> blocks.\n\n---TEXT---\n${text}\n---END TEXT---`;
}

export const PARITY_SYSTEM = `You are a parity auditor for a novel rewrite. You compare an ORIGINAL segment against a REWRITE and restore anything lost.

- Identify every plot point, line of dialogue, character action, emotional beat and explicit detail present in the ORIGINAL but missing, softened or censored in the REWRITE.
- If anything is missing, output the FULL corrected rewrite with the missing material woven back in seamlessly, as <p> blocks only.
- If nothing is missing, output exactly: PARITY_OK
- Never summarise, never censor, never shorten.`;

export function parityPrompt(original: string, rewritten: string) {
  return `---ORIGINAL---\n${original}\n---END ORIGINAL---\n\n---REWRITE---\n${rewritten}\n---END REWRITE---\n\nAudit the rewrite. Output PARITY_OK or the full corrected rewrite in <p> blocks.`;
}
