export const WORDS_PER_SEGMENT = 5000;

export function countWords(text: string) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

const PAGE_NUMBER_LINE = /^\s*(page\s*)?[-–—[(]*\s*\d{1,4}\s*[-–—\])]*\s*$/i;

/** Normalises raw PDF page text into clean paragraphs. */
export function toParagraphs(pages: string[], stripHeadings: boolean): string[] {
  const cleaned = pages.map((page) => {
    const lines = page.split("\n");
    const kept = lines.filter((line) => {
      if (!stripHeadings) return true;
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (PAGE_NUMBER_LINE.test(trimmed)) return false;
      return true;
    });
    return kept.join("\n");
  });

  const raw = cleaned.join("\n\n");
  return raw
    .replace(/-\n(?=\p{Ll})/gu, "")
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

/** Groups paragraphs into ~10,000-word segments, never splitting a paragraph. */
export function chunkParagraphs(paragraphs: string[], target = WORDS_PER_SEGMENT): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  let words = 0;

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    if (words > 0 && words + paragraphWords > target) {
      segments.push(current.join("\n\n"));
      current = [];
      words = 0;
    }
    current.push(paragraph);
    words += paragraphWords;
  }
  if (current.length) segments.push(current.join("\n\n"));
  return segments;
}

/** Turns model output into a clean list of paragraphs, stripping any stray markup. */
export function parseProse(output: string): string[] {
  const withoutComments = output.replace(/<!--[\s\S]*?-->/g, "");
  const hasTags = /<p[\s>]/i.test(withoutComments);
  const source = hasTags
    ? (withoutComments.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? []).map((block) =>
        block.replace(/<\/?[^>]+>/g, ""),
      )
    : withoutComments.split(/\n\s*\n+/);

  return source
    .map((block) =>
      block
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/^\s*#+\s*/, "")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export const VERIFIED_MARKER = "<!-- SEGMENT_VERIFIED_BY_AI -->";

/**
 * Counts spoken lines in a passage. A dialogue line is any run of text inside
 * straight or curly double quotes; used to verify no speech is lost in a rewrite.
 */
export function countDialogueLines(text: string): number {
  const normalized = text.replace(/[“”]/g, '"');
  const matches = normalized.match(/"[^"]{1,4000}"/g);
  return matches ? matches.filter((m) => m.replace(/"/g, "").trim().length > 0).length : 0;
}
