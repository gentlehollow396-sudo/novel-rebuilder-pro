import type { Segment } from "@/lib/project-store";

/**
 * Rough public list prices in USD per 1M tokens for the models the router uses.
 * Used only for budgeting estimates shown in the costs panel.
 */
export const PROVIDER_PRICING: Record<string, { in: number; out: number; label: string }> = {
  lovable: { in: 0.3, out: 2.5, label: "Lovable AI (Gemini Flash)" },
  openrouter: { in: 3, out: 15, label: "OpenRouter (Claude Sonnet)" },
  gemini: { in: 0.3, out: 2.5, label: "Gemini Flash" },
  groq: { in: 0.15, out: 0.75, label: "Groq (GPT-OSS 120B)" },
};

export type UsageRow = {
  provider: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
};

export function estimateCost(provider: string, promptTokens: number, completionTokens: number) {
  const price = PROVIDER_PRICING[provider];
  if (!price) return 0;
  return (promptTokens * price.in + completionTokens * price.out) / 1_000_000;
}

export function providerLabel(provider: string) {
  return PROVIDER_PRICING[provider]?.label ?? provider;
}

/** Collapses a segment's recorded calls into one row per provider. */
export function rowsFor(usage: Segment["usage"]): UsageRow[] {
  const map = new Map<string, UsageRow>();
  for (const call of usage ?? []) {
    const row =
      map.get(call.provider) ??
      ({
        provider: call.provider,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      } satisfies UsageRow);
    row.calls += 1;
    row.promptTokens += call.promptTokens;
    row.completionTokens += call.completionTokens;
    row.totalTokens += call.totalTokens;
    row.cost += estimateCost(call.provider, call.promptTokens, call.completionTokens);
    map.set(call.provider, row);
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

export function mergeRows(all: UsageRow[][]): UsageRow[] {
  return rowsFor(
    all.flat().flatMap((row) =>
      Array.from({ length: row.calls }, (_, i) => ({
        provider: row.provider,
        promptTokens: i === 0 ? row.promptTokens : 0,
        completionTokens: i === 0 ? row.completionTokens : 0,
        totalTokens: i === 0 ? row.totalTokens : 0,
      })),
    ),
  );
}

export function formatUsd(value: number) {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
