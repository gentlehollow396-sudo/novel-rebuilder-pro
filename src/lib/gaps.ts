/**
 * Finds material from the original segment that does not appear in the rewrite,
 * so a human can spot missing dialogue or plot details and patch them by hand.
 */

export type GapKind = "dialogue" | "detail";

export type Gap = {
  id: string;
  kind: GapKind;
  /** The original sentence / spoken line that looks missing. */
  text: string;
  /** 0-1 best similarity found against the rewrite. */
  score: number;
};

const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","as","by",
  "it","he","she","they","i","you","we","his","her","their","my","your","that",
  "this","was","were","is","are","be","been","had","have","has","not","no","so",
]);

function keyWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP.has(w));
  return words;
}

/** Splits prose into sentences, keeping quoted speech whole. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts = normalized.match(/[^.!?…]+[.!?…]+["”’']*|\S[^.!?…]*$/g) ?? [normalized];
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function isDialogue(sentence: string) {
  return /["“][^"”]{2,}["”]/.test(sentence);
}

/** Overlap of a sentence's distinctive words against the rewrite's vocabulary. */
function coverage(words: string[], pool: Set<string>) {
  if (words.length === 0) return 1;
  let hit = 0;
  for (const w of words) if (pool.has(w)) hit++;
  return hit / words.length;
}

/**
 * Returns original sentences whose distinctive wording is largely absent from the
 * rewrite. Threshold is deliberately loose — a rewrite rephrases, so only badly
 * covered sentences surface.
 */
export function findGaps(original: string, rewritten: string, threshold = 0.45): Gap[] {
  if (!rewritten.trim()) return [];
  const pool = new Set(keyWords(rewritten));
  const gaps: Gap[] = [];

  splitSentences(original).forEach((sentence, index) => {
    const words = keyWords(sentence);
    if (words.length < 4) return;
    const score = coverage(words, pool);
    if (score >= threshold) return;
    gaps.push({
      id: `${index}`,
      kind: isDialogue(sentence) ? "dialogue" : "detail",
      text: sentence,
      score,
    });
  });

  return gaps;
}
