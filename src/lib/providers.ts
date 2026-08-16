import { keyFormatOk, PROVIDER_LABELS, type ProviderId, type UserKeys } from "./keys";

export type Delta = (chunk: string) => void;

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
  ) {
    super(message);
  }
}

async function readSSE(res: Response, pick: (json: unknown) => string | undefined, onDelta: Delta) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const piece = pick(JSON.parse(data));
        if (piece) {
          out += piece;
          onDelta(piece);
        }
      } catch (error) {
        // Upstream error frames must surface; malformed keep-alives are ignored.
        if (error instanceof ProviderError) throw error;
      }

    }
  }
  return out;
}

async function failure(provider: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new ProviderError(provider, `${provider} failed [${res.status}]: ${body.slice(0, 400)}`);
}

type Call = {
  system: string;
  prompt: string;
  onDelta: Delta;
  signal?: AbortSignal | null;
};

const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-pro-latest"];

async function callGemini(apiKey: string, { system, prompt, onDelta, signal }: Call) {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal ?? null,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 65536 },
          safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
          ].map((category) => ({ category, threshold: "BLOCK_NONE" })),
        }),
      },
    );
    if (res.ok) {
      return readSSE(
        res,
        (json) =>
          (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]
            ?.content?.parts?.[0]?.text,
        onDelta,
      );
    }
    // A retired / unavailable model (404) must not end the run: try the next id.
    const body = await res.text().catch(() => "");
    lastError = new ProviderError("Gemini", `Gemini failed [${res.status}]: ${body.slice(0, 400)}`);
    if (res.status !== 404) break;
  }
  throw lastError;
}

async function callOpenAICompatible(
  provider: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  { system, prompt, onDelta, signal }: Call,
) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "OpenRouter" ? { "X-Title": "Novel Reconstruction Engine" } : {}),
    },
    signal: signal ?? null,
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.8,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) await failure(provider, res);
  return readSSE(
    res,
    (json) =>
      (json as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content,
    onDelta,
  );
}

async function callCloudflare(credentials: string, call: Call) {
  const [accountId, apiToken] = credentials.split(":");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
      signal: call.signal ?? null,
      body: JSON.stringify({
        stream: true,
        max_tokens: 16000,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.prompt },
        ],
      }),
    },
  );
  if (!res.ok) await failure("Cloudflare Workers AI", res);
  return readSSE(res, (json) => (json as { response?: string }).response, call.onDelta);
}

/** Project-key + open-source fallback, proxied so project secrets stay server-side. */
async function callProjectChain(startAt: ProviderId | "opensource", call: Call) {
  const res = await fetch("/api/public/ai-rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: call.signal ?? null,
    body: JSON.stringify({ system: call.system, prompt: call.prompt, startAt }),
  });
  if (!res.ok) await failure("Project providers", res);
  return readSSE(
    res,
    (json) => {
      const frame = json as { text?: string; error?: string };
      if (frame.error) throw new ProviderError("Project providers", frame.error);
      return frame.text;
    },
    call.onDelta,
  );

}

export type Attempt = { label: string; error?: string };

export type RunResult = { text: string; servedBy: string; attempts: Attempt[] };

function userChain(keys: UserKeys, preferred: ProviderId): ProviderId[] {
  const order: ProviderId[] = ["gemini", "openrouter", "cloudflare", "groq"];
  const available = order.filter((p) => keys[p as keyof UserKeys]?.trim());
  if (preferred !== "opensource" && available.includes(preferred)) {
    return [preferred, ...available.filter((p) => p !== preferred)];
  }
  return available;
}

/**
 * Runs the rewrite through the fallback chain:
 * user Gemini -> user OpenRouter -> user Cloudflare -> user Groq ->
 * project Gemini -> project OpenRouter -> project Cloudflare -> project Groq -> open-source.
 */
export async function runWithFallback(
  keys: UserKeys,
  preferred: ProviderId,
  call: Call,
): Promise<RunResult> {
  const attempts: Attempt[] = [];
  const chain = preferred === "opensource" ? [] : userChain(keys, preferred);

  for (const provider of chain) {
    const label = `Your ${PROVIDER_LABELS[provider]}`;
    try {
      let text: string;
      if (provider === "gemini") text = await callGemini(keys.gemini.trim(), call);
      else if (provider === "openrouter")
        text = await callOpenAICompatible(
          "OpenRouter",
          "https://openrouter.ai/api/v1",
          keys.openrouter.trim(),
          "meta-llama/llama-3.3-70b-instruct",
          call,
        );
      else if (provider === "groq")
        text = await callOpenAICompatible(
          "Groq",
          "https://api.groq.com/openai/v1",
          keys.groq.trim(),
          "llama-3.3-70b-versatile",
          call,
        );
      else text = await callCloudflare(keys.cloudflare.trim(), call);

      if (text.trim()) {
        attempts.push({ label });
        return { text, servedBy: label, attempts };
      }
      attempts.push({ label, error: "Empty response" });
    } catch (error) {
      if (call.signal?.aborted) throw error;
      attempts.push({ label, error: (error as Error).message });
    }
  }

  const text = await callProjectChain(preferred, call);
  attempts.push({ label: "Project / open-source providers" });
  return { text, servedBy: "Project / open-source providers", attempts };
}

/* ---------------------------- key validation ---------------------------- */

export type ValidationResult = { ok: boolean; detail: string };

export async function validateKey(
  provider: keyof UserKeys,
  value: string,
): Promise<ValidationResult> {
  const key = value.trim();
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      );
      if (!res.ok) return { ok: false, detail: `Rejected (${res.status})` };
      const data = (await res.json()) as { models?: unknown[] };
      return { ok: true, detail: `Connected · ${data.models?.length ?? 0} models available` };
    }
    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/key", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { ok: false, detail: `Rejected (${res.status})` };
      const { data } = (await res.json()) as {
        data?: { usage?: number; limit?: number | null; limit_remaining?: number | null };
      };
      const usage = data?.usage ?? 0;
      const remaining =
        data?.limit_remaining ?? (data?.limit != null ? data.limit - usage : undefined);
      return {
        ok: true,
        detail: `Connected · used $${usage.toFixed(4)}${
          remaining != null ? ` · $${remaining.toFixed(4)} left` : " · no spend limit set"
        }`,
      };
    }
    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { ok: false, detail: `Rejected (${res.status})` };
      const data = (await res.json()) as { data?: unknown[] };
      return { ok: true, detail: `Connected · ${data.data?.length ?? 0} models available` };
    }
    const [accountId, apiToken] = key.split(":");
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=1`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) return { ok: false, detail: `Rejected (${res.status})` };
    return { ok: true, detail: "Connected · Workers AI reachable" };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

/* ------------------------------ diagnostics ------------------------------ */

export type DiagnosticStep = {
  label: string;
  status: "ok" | "fail" | "warn";
  detail: string;
  hint?: string;
};

const ENDPOINTS: Record<keyof UserKeys, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  openrouter: "https://openrouter.ai/api/v1/key",
  groq: "https://api.groq.com/openai/v1/models",
  cloudflare: "https://api.cloudflare.com/client/v4/accounts/<id>/ai/models/search",
};

function statusHint(provider: keyof UserKeys, status: number): string {
  if (status === 400) return "Malformed key or request — re-copy the key from the provider console.";
  if (status === 401 || status === 403)
    return provider === "gemini"
      ? "Key rejected: it may be revoked, restricted to other APIs/referrers, or the Generative Language API is not enabled on that Google Cloud project."
      : "Key rejected: revoked, expired, or lacking permission for this endpoint.";
  if (status === 404)
    return provider === "cloudflare"
      ? "Account ID not found — check the accountId part before the colon."
      : "Endpoint or model not found for this key.";
  if (status === 429) return "Rate limited or out of quota/credits — wait, or top up the account.";
  if (status >= 500) return "Provider outage — retry in a few minutes.";
  return "Unexpected response from the provider.";
}

/** Deep check that explains *why* a key fails, step by step. */
export async function diagnoseKey(
  provider: keyof UserKeys,
  value: string,
): Promise<DiagnosticStep[]> {
  const steps: DiagnosticStep[] = [];
  const key = value.trim();

  // 1. Presence
  if (!key) {
    steps.push({
      label: "Key present",
      status: "fail",
      detail: "No key entered.",
      hint: "Paste the key into the field above, then troubleshoot again.",
    });
    return steps;
  }
  steps.push({ label: "Key present", status: "ok", detail: `${key.length} characters` });

  // 2. Obvious copy/paste damage
  if (/\s/.test(value) && value.trim() !== value) {
    steps.push({
      label: "Whitespace",
      status: "warn",
      detail: "Leading/trailing spaces detected — they are trimmed automatically.",
    });
  }
  if (/\s/.test(key)) {
    steps.push({
      label: "Whitespace",
      status: "fail",
      detail: "The key contains spaces or line breaks.",
      hint: "Re-copy the key; a line break usually means it was pasted from a wrapped view.",
    });
  }
  if (/^["'].*["']$/.test(key)) {
    steps.push({
      label: "Quoting",
      status: "fail",
      detail: "The key is wrapped in quotes.",
      hint: "Remove the surrounding quote characters.",
    });
  }

  // 3. Format
  const formatOk = keyFormatOk(provider, key);
  steps.push({
    label: "Format",
    status: formatOk ? "ok" : "fail",
    detail: formatOk
      ? "Matches the expected shape for this provider."
      : provider === "cloudflare"
        ? "Expected accountId:apiToken (two values separated by a colon)."
        : "Does not look like a valid key for this provider.",
    ...(formatOk ? {} : { hint: "Check you pasted the key for the right provider." }),
  });
  if (!formatOk) return steps;

  // 4. Live call
  const started = performance.now();
  try {
    const result = await validateKey(provider, key);
    const ms = Math.round(performance.now() - started);
    const status = Number(/\((\d{3})\)/.exec(result.detail)?.[1] ?? 0);
    steps.push({
      label: "Provider response",
      status: result.ok ? "ok" : "fail",
      detail: `${result.detail} · ${ms}ms`,
      ...(result.ok ? {} : { hint: statusHint(provider, status) }),
    });
    if (result.ok && provider === "openrouter" && /\$0\.0000 left/.test(result.detail)) {
      steps.push({
        label: "Credits",
        status: "warn",
        detail: "No spend remaining on this key — calls will fail with 402/429.",
        hint: "Top up credits or raise the key's spend limit.",
      });
    }
  } catch (error) {
    steps.push({
      label: "Network",
      status: "fail",
      detail: (error as Error).message,
      hint: `Could not reach ${ENDPOINTS[provider]} — check your connection, VPN, ad-blocker, or browser extensions blocking the request.`,
    });
  }

  return steps;
}
