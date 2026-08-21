// src/utils/troubleshooter.ts
// Utilities to diagnose AI provider connectivity, latency, and quota (word) availability.
// Designed to be run in-browser. Does not store keys; it expects provider test URLs to be reachable
// from the client or to be proxied by the project's Lovable gateway when needed.

export type Provider = {
  id: string;
  name: string;
  // A lightweight URL that can be used to test connectivity for the provider.
  // If the provider needs an API key, the project/user key should be used in the browser
  // and this endpoint should be one that accepts an unauthenticated OPTIONS/GET for connectivity,
  // or returns 401/403 which we'll treat as "reachable but auth required".
  testUrl?: string;
  // Optional endpoint that returns usage/credits/remaining words in JSON { remainingWords: number }
  // This is provider-specific and may require authentication.
  remainingWordsUrl?: string;
};

export type DiagnosticResult = {
  id: string;
  name: string;
  ok: boolean;
  latencyMs?: number | null;
  error?: string | null;
  remainingWords?: number | null;
};

const DEFAULT_TIMEOUT = 7000;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function pingUrl(url: string, timeout = DEFAULT_TIMEOUT): Promise<number> {
  const start = performance.now();
  // Try an OPTIONS first (lightweight). If it fails, fall back to GET.
  try {
    const res = await fetchWithTimeout(url, { method: 'OPTIONS' }, timeout);
    const elapsed = Math.round(performance.now() - start);
    // Treat non-network errors (401/403/404/400) as reachable — upstream will decide auth.
    if (!res) throw new Error('No response');
    return elapsed;
  } catch (err) {
    // If OPTIONS failed due to CORS or method not allowed, try GET
    try {
      const start2 = performance.now();
      const res2 = await fetchWithTimeout(url, { method: 'GET' }, timeout);
      const elapsed2 = Math.round(performance.now() - start2);
      if (!res2) throw new Error('No response');
      return elapsed2;
    } catch (err2) {
      // rethrow the last error
      throw err2;
    }
  }
}

async function checkRemainingWords(url: string, timeout = DEFAULT_TIMEOUT): Promise<number> {
  // Expect JSON with { remainingWords: number } or some provider-specific shape
  const res = await fetchWithTimeout(url, { method: 'GET' }, timeout);
  if (!res.ok) {
    // Treat non-2xx as unknown
    throw new Error(`Status ${res.status}`);
  }
  const json = await res.json();
  // Try common shapes
  if (typeof json.remainingWords === 'number') return json.remainingWords;
  if (typeof json.remaining_word_count === 'number') return json.remaining_word_count;
  if (typeof json.credits === 'number') return json.credits;
  // If shape unknown, attempt to find any small numeric field
  for (const k of Object.keys(json)) {
    const v = (json as any)[k];
    if (typeof v === 'number' && v < 100000000) return v;
  }
  throw new Error('Unexpected response shape for remaining words');
}

export async function checkProvider(provider: Provider): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    id: provider.id,
    name: provider.name,
    ok: false,
    latencyMs: null,
    remainingWords: null,
    error: null,
  };

  if (!provider.testUrl) {
    result.error = 'No testUrl configured';
    return result;
  }

  try {
    const t0 = performance.now();
    const latency = await pingUrl(provider.testUrl);
    result.latencyMs = latency;
    result.ok = true;
  } catch (err: any) {
    // network/CORS/timeout etc.
    // Classify some error messages
    if (err.name === 'AbortError') result.error = 'Timeout';
    else result.error = String(err?.message ?? err);
    result.ok = false;
  }

  // If a remainingWordsUrl is provided, try to fetch it but don't fail the whole check if it errors
  if (provider.remainingWordsUrl) {
    try {
      const remaining = await checkRemainingWords(provider.remainingWordsUrl);
      result.remainingWords = remaining;
    } catch (err: any) {
      // keep as null but surface the message in error if there was no other error
      if (!result.error) result.error = `RemainingWords: ${String(err?.message ?? err)}`;
    }
  }

  return result;
}

export async function runDiagnostics(providers: Provider[], timeout = DEFAULT_TIMEOUT): Promise<DiagnosticResult[]> {
  // Run checks in parallel but allow each to use the passed timeout
  const checks = providers.map((p) => checkProvider(p));
  return Promise.all(checks);
}

export function recommendFastestProvider(results: DiagnosticResult[]): DiagnosticResult | null {
  // Prefer providers that are ok and have remainingWords > 0 (if available), then sort by latency
  const candidates = results.filter((r) => r.ok && (r.remainingWords === null || r.remainingWords > 0));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const la = a.latencyMs ?? 1e9;
    const lb = b.latencyMs ?? 1e9;
    // smaller latency wins
    return la - lb;
  });
  return candidates[0];
}

export function detectWordShortage(results: DiagnosticResult[], requestedWords = 10000): { shortage: boolean; providersUnder?: string[] } {
  const under = results
    .filter((r) => typeof r.remainingWords === 'number' && r.remainingWords < requestedWords)
    .map((r) => r.id);
  return { shortage: under.length > 0, providersUnder: under };
}

export function ensureFastestProviderSelected(
  results: DiagnosticResult[],
  setProvider: (providerId: string) => void
): DiagnosticResult | null {
  const best = recommendFastestProvider(results);
  if (!best) return null;
  setProvider(best.id);
  return best;
}

export default {
  checkProvider,
  runDiagnostics,
  recommendFastestProvider,
  detectWordShortage,
  ensureFastestProviderSelected,
};
