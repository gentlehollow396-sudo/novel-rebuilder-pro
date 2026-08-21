// src/utils/rewriteRunner.ts
import RequestQueue from './requestQueue';
import type { Provider, DiagnosticResult } from './troubleshooter';
import { runDiagnostics, recommendFastestProvider } from './troubleshooter';
import type { ParityAnalysis } from './rewriteParity';

export type SendRequestFn = (opts: {
  provider: Provider;
  prompt: string;
  signal: AbortSignal;
  onProgress?: (chunk: string) => void;
}) => Promise<{ text: string }>;

export type RewriteOptions = {
  concurrency?: number; // request queue concurrency
  timeoutMs?: number; // per-provider attempt timeout
  prefetchNext?: boolean; // whether to warm next segment
  diagnosticsTtlMs?: number; // how long to keep diagnostics before re-running (ms)
};

export type RewriteResult = {
  providerId: string | null;
  text: string;
  parity?: ParityAnalysis | null;
};

const DEFAULT_OPTIONS: Required<RewriteOptions> = {
  concurrency: 2,
  timeoutMs: 8000,
  prefetchNext: true,
  diagnosticsTtlMs: 60_000,
};

// A small in-memory cache for recent diagnostics to avoid re-running too often
let cachedDiagnostics: { results: DiagnosticResult[]; ts: number } | null = null;

export class RewriteRunner {
  private queue: RequestQueue;
  private options: Required<RewriteOptions>;

  constructor(opts?: RewriteOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...(opts || {}) };
    this.queue = new RequestQueue(this.options.concurrency);
  }

  async getDiagnostics(providers: Provider[], force = false): Promise<DiagnosticResult[]> {
    const now = Date.now();
    if (!force && cachedDiagnostics && now - cachedDiagnostics.ts < this.options.diagnosticsTtlMs) {
      return cachedDiagnostics.results;
    }
    try {
      const res = await runDiagnostics(providers, );
      cachedDiagnostics = { results: res, ts: now };
      return res;
    } catch (e) {
      // If diagnostics fail, return empty list so the caller can still attempt provider calls
      return [];
    }
  }

  // startRewrite enqueues a rewrite job into the shared queue.
  // sendRequest is required — it should perform the actual provider API call and support streaming via onProgress.
  async startRewrite(params: {
    providers: Provider[];
    prompt: string;
    sendRequest: SendRequestFn;
    requestedWordsEstimate?: number; // used to check remainingWords when available
    onProgress?: (chunk: string) => void;
    onProviderChosen?: (providerId: string) => void;
    prefetchProviders?: Provider[]; // optional list to prefetch next
    parityHook?: (analysis: ParityAnalysis | null) => void;
  }): Promise<RewriteResult> {
    const { providers, prompt, sendRequest, requestedWordsEstimate = 10000, onProgress, onProviderChosen, prefetchProviders, parityHook } = params;

    // Enqueue the work so concurrency is controlled
    return this.queue.enqueue(async (signal) => {
      // Acquire diagnostics to prefer fastest provider
      const diagnostics = await this.getDiagnostics(providers);
      // Prefer providers that are reachable and have sufficient credits
      let ordered: Provider[] = providers.slice();
      try {
        const best = recommendFastestProvider(diagnostics);
        if (best) {
          // Move best to the front
          ordered = [providers.find((p) => p.id === best.id)!, ...providers.filter((p) => p.id !== best.id)];
        }
      } catch (e) {
        // ignore ordering
      }

      // Try providers in order with timeout and fallback
      let lastErr: any = null;
      for (const provider of ordered) {
        if (signal.aborted) throw new Error('Aborted');
        if (onProviderChosen) onProviderChosen(provider.id);

        const controller = new AbortController();
        const overallSignal = controller.signal;
        // Link external abort
        const onAbort = () => controller.abort();
        signal.addEventListener('abort', onAbort);

        let timeoutId: any = null;
        try {
          // start timeout for this provider attempt
          timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

          const res = await sendRequest({ provider, prompt, signal: overallSignal, onProgress });
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', onAbort);

          // Optionally prefetch next segment(s)
          if (this.options.prefetchNext && prefetchProviders && prefetchProviders.length > 0) {
            // fire-and-forget prefetch: don't await
            void this.prefetch(prefetchProviders, prompt, sendRequest);
          }

          return { providerId: provider.id, text: res.text, parity: null };
        } catch (err) {
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', onAbort);
          lastErr = err;
          // on failure, try next provider
          continue;
        }
      }

      // all providers failed
      throw lastErr || new Error('All providers failed');
    });
  }

  // Simple prefetch that uses same sendRequest but doesn't block caller
  private async prefetch(providers: Provider[], prompt: string, sendRequest: SendRequestFn) {
    try {
      const diagnostics = await this.getDiagnostics(providers).catch(() => []);
      const best = recommendFastestProvider(diagnostics);
      const p = best ? providers.find((x) => x.id === best.id) : providers[0];
      if (!p) return;
      // use a short timeout and no progress
      const controller = new AbortController();
      setTimeout(() => controller.abort(), Math.max(3000, this.options.timeoutMs));
      try {
        await sendRequest({ provider: p, prompt, signal: controller.signal });
      } catch (e) {
        // ignore prefetch failures
      }
    } catch (e) {
      // ignore
    }
  }

  // Expose a way to clear queued items (e.g., on project close)
  clearQueue() {
    this.queue.clear();
  }
}

export default RewriteRunner;
