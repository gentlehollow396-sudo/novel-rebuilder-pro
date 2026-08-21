// .lovable/gateway/worker.js
// Cloudflare Worker that provides lightweight test and usage endpoints for providers.
// This worker proxies provider "test" and "usage" checks and normalizes responses.
// Configure per-provider endpoints via environment variables in your Cloudflare Worker bindings.

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/+/, '').split('/'); // e.g. ['test','gemini'] or ['usage','openrouter']

  if (parts.length < 2) {
    return new Response(JSON.stringify({ error: 'Invalid path. Use /test/:provider or /usage/:provider' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const action = parts[0];
  const provider = parts[1];

  if (action === 'test') {
    return handleTest(provider);
  } else if (action === 'usage') {
    return handleUsage(provider);
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}

function providerBindingName(provider, suffix) {
  // e.g. PROVIDER_TEST_URL_GEMINI or PROVIDER_USAGE_URL_OPENROUTER
  const name = `PROVIDER_${provider.toUpperCase()}_${suffix}`.replace(/[^A-Z0-9_]/g, '_');
  return name;
}

async function handleTest(provider) {
  try {
    const binding = providerBindingName(provider, 'TEST_URL');
    const url = GLOBAL_THIS[binding];
    if (!url) {
      return new Response(JSON.stringify({ error: 'No test URL configured for provider', provider }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    const start = Date.now();
    // Try OPTIONS first
    try {
      const res = await fetch(url, { method: 'OPTIONS' });
      const latency = Date.now() - start;
      return new Response(JSON.stringify({ ok: true, status: res.status, latencyMs: latency }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      // fallback to GET
    }
    const res2 = await fetch(url, { method: 'GET' });
    const latency2 = Date.now() - start;
    return new Response(JSON.stringify({ ok: true, status: res2.status, latencyMs: latency2 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleUsage(provider) {
  try {
    const binding = providerBindingName(provider, 'USAGE_URL');
    const url = GLOBAL_THIS[binding];
    const apiKeyBinding = providerBindingName(provider, 'API_KEY');
    const apiKey = GLOBAL_THIS[apiKeyBinding];
    if (!url) {
      return new Response(JSON.stringify({ error: 'No usage URL configured for provider', provider }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const headers = {};
    if (apiKey) headers['Authorization'] = apiKey;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Upstream returned non-200', status: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const json = await res.json();
    // normalize common shapes
    const remaining = (json && (json.remainingWords ?? json.remaining_word_count ?? json.credits ?? json.quota)) ?? null;
    if (typeof remaining === 'number') {
      return new Response(JSON.stringify({ remainingWords: remaining }), { headers: { 'Content-Type': 'application/json' } });
    }
    // Attempt to find any numeric field
    for (const k of Object.keys(json || {})) {
      const v = json[k];
      if (typeof v === 'number' && v < 1e9) {
        return new Response(JSON.stringify({ remainingWords: v, rawKey: k }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Could not parse usage response', raw: json }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
