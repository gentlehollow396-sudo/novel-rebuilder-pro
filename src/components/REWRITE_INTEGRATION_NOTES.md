// src/components/REWRITE_INTEGRATION_NOTES.md

Integration notes — RewriteRunner and RequestQueue

Files added:
- src/utils/requestQueue.ts
  - A tiny request queue class with configurable concurrency, abort support, and clear().
- src/utils/rewriteRunner.ts
  - RewriteRunner: enqueues rewrite jobs, prefers fastest provider (via diagnostics), applies per-provider timeouts and fallbacks, and supports optional prefetching of next segments.

How to integrate into your rewrite flow

1) Implement a sendRequest function that performs the provider API call. It must match the SendRequestFn signature:

  async function sendRequest({ provider, prompt, signal, onProgress }) {
    // Use fetch or provider SDK to call provider; honor the AbortSignal and call onProgress as you stream tokens.
    // Return { text } when complete.
  }

2) Create a shared RewriteRunner instance in the app (singleton) with desired options:

  import RewriteRunner from 'src/utils/rewriteRunner';
  const runner = new RewriteRunner({ concurrency: 2, timeoutMs: 8000, prefetchNext: true });

3) Start a rewrite when the user requests it:

  const result = await runner.startRewrite({
    providers: myProviders,
    prompt: rewritePrompt,
    sendRequest,
    requestedWordsEstimate: 10000,
    onProgress: (chunk) => { /* append to streaming UI */ },
    onProviderChosen: (id) => { /* show which provider is being tried */ },
    prefetchProviders: myProviders, // optional — used to warm the next segment
  });

4) On completion, result.text contains the full rewritten text. Run parity analysis as usual and trigger retries if needed.

Notes and best practices
- sendRequest must respect the passed AbortSignal and should throw when aborted.
- The runner handles timeouts per provider attempt and will try the next provider on error/timeout.
- Prefetch consumes credits — make this opt-in or toggleable by users if cost is a concern.
- Tune concurrency and timeoutMs for your user base and expected provider latencies.
