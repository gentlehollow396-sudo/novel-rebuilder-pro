// src/utils/rewriteParity.ts
// Utilities to detect excessive word reduction in rewritten segments and optionally react.

import { DiagnosticResult, ensureFastestProviderSelected } from './troubleshooter';

export type ParityAnalysis = {
  originalWords: number;
  rewrittenWords: number;
  reductionWords: number; // absolute number of words removed
  reductionPercent: number; // e.g. 42.5
  tooShort: boolean; // reductionWords >= thresholdWords
};

export function countWords(text: string): number {
  if (!text) return 0;
  // Simple word split: count runs of letters/digits/apostrophes/hyphens
  const matches = text.match(/[\p{L}\p{N}'-]+/gu);
  return matches ? matches.length : 0;
}

export function analyzeParity(original: string, rewritten: string, thresholdWords = 1000): ParityAnalysis {
  const originalWords = countWords(original);
  const rewrittenWords = countWords(rewritten);
  const reductionWords = Math.max(0, originalWords - rewrittenWords);
  const reduction = originalWords === 0 ? 0 : (reductionWords / originalWords) * 100;
  const reductionPercent = Math.round(reduction * 100) / 100;
  const tooShort = reductionWords >= thresholdWords;
  return { originalWords, rewrittenWords, reductionWords, reductionPercent, tooShort };
}

export function handleRewriteResult(
  original: string,
  rewritten: string,
  diagnostics: DiagnosticResult[] | null,
  setProvider?: (id: string) => void,
  thresholdWords = 1000
): { analysis: ParityAnalysis; actionTaken?: string | null } {
  const analysis = analyzeParity(original, rewritten, thresholdWords);
  if (!analysis.tooShort) return { analysis };

  // If we have diagnostics, attempt to switch to fastest provider to see if that yields fuller output
  if (diagnostics && setProvider) {
    const best = ensureFastestProviderSelected(diagnostics, setProvider);
    if (best) {
      return { analysis, actionTaken: `Switched provider to fastest candidate ${best.id}` };
    }
  }

  return { analysis, actionTaken: 'Too short — no diagnostics available to auto-fix' };
}

export default { countWords, analyzeParity, handleRewriteResult };
