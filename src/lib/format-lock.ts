import { countWords, parseProse } from "./segments";

export const DEFAULT_WORDS_PER_PAGE = 275;
export const TARGET_TOLERANCE = 0.02; // ±2%

export type RewriteLanguage =
  | "English"
  | "Spanish"
  | "French"
  | "German"
  | "Italian"
  | "Portuguese"
  | "Japanese"
  | "Chinese"
  | "Other";

export type DetailLevel = "standard" | "detailed" | "maximal";

const LANGUAGE_MULTIPLIERS: Record<RewriteLanguage, number> = {
  English: 1,
  Spanish: 1.09,
  French: 1.08,
  German: 1.06,
  Italian: 1.07,
  Portuguese: 1.08,
  Japanese: 1.12,
  Chinese: 1.14,
  Other: 1.05,
};

const DETAIL_MULTIPLIERS: Record<DetailLevel, number> = {
  standard: 1,
  detailed: 1.12,
  maximal: 1.2,
};

export function defaultWordsPerPageFor(
  language?: RewriteLanguage,
  detailLevel?: DetailLevel,
): number {
  const languageMultiplier = LANGUAGE_MULTIPLIERS[language ?? "English"] ?? 1;
  const detailMultiplier = DETAIL_MULTIPLIERS[detailLevel ?? "detailed"] ?? 1;
  return Math.round(DEFAULT_WORDS_PER_PAGE * languageMultiplier * detailMultiplier);
}

/**
 * Manuscript typography lockdown. Applied to every provider's output so
 * OpenRouter, Gemini, Groq and Cloudflare all render identically.
 * - curly quotes and apostrophes
 * - em-dashes with no surrounding spaces
 * - single spaces, no double returns, no manual indents (indent is applied by style)
 */
export function normalizeTypography(paragraph: string): string {
  let text = paragraph
    .replace(/\r/g, "")
    .replace(/[ \t]*\n[ \t]*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // Ellipses
  text = text.replace(/\.\s?\.\s?\./g, "…");

  // Dashes → em-dash, no surrounding spaces
  text = text
    .replace(/\s*(--+|—|–)\s*/g, "—")
    .replace(/—{2,}/g, "—");

  // Apostrophes (contractions and possessives first)
  text = text.replace(/(\p{L})'(\p{L})/gu, "$1’$2").replace(/(\p{L})'(?=\s|$|[.,!?;:”])/gu, "$1’");

  // Double quotes → curly, alternating open/close
  let openDouble = true;
  text = text.replace(/"/g, () => (openDouble = !openDouble) ? "”" : "“");

  // Remaining single quotes → curly, alternating
  let openSingle = true;
  text = text.replace(/'/g, () => (openSingle = !openSingle) ? "’" : "‘");

  // Space hygiene around punctuation
  text = text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])(?=[\p{L}])/gu, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text;
}

/** Runs the typography lock over an entire rewrite and returns clean <p> blocks. */
export function applyFormatLock(html: string): string {
  return parseProse(html)
    .map(normalizeTypography)
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

export function pagesFromWords(words: number, wordsPerPage: number) {
  return words / Math.max(wordsPerPage, 1);
}

export function targetWordsFor(pages: number, wordsPerPage: number) {
  return Math.round(Math.max(pages, 0) * Math.max(wordsPerPage, 1));
}

export type LengthCheck = {
  words: number;
  target: number;
  drift: number; // fraction, negative = short
  action: "ok" | "expand" | "trim";
};

export function checkLength(text: string, target: number): LengthCheck {
  const words = countWords(text);
  const drift = target > 0 ? (words - target) / target : 0;
  const action =
    Math.abs(drift) <= TARGET_TOLERANCE ? "ok" : drift < 0 ? "expand" : "trim";
  return { words, target, drift, action };
}
