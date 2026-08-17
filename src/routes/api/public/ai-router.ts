import { createFileRoute } from "@tanstack/react-router";

/**
 * AI Router — serverless backend edge function.
 *
 * POST /api/public/ai-router
 * Body: { prompt, system?, providerOrder?, model?, maxTokens?, temperature? }
 * Returns: { id, content, provider_used, tokens: {...}, word_count }
 */

// --- Hardcoded fallback service credentials (replace before deploying) ---
const GEMINI_API_KEY = "PASTE_KEY_HERE";
const GROQ_API_KEY = "PASTE_KEY_HERE";
const CLOUDFLARE_API_KEY = "PASTE_KEY_HERE";
const CLOUDFLARE_URL = "PASTE_URL_HERE";

// OPENROUTER key comes from the environment (Deno.env.get when available).
function readEnv(name: string): string | undefined {
  const d = (globalThis as { Deno?: { env?: { get(n: string): string | undefined } } }).Deno;
  if (d?.env?.get) return d.env.get(name);
  return process.env[name];
}

type Provider = "lovable" | "openrouter" | "gemini" | "groq" | "cloudflare";

const DEFAULT_ORDER: Provider[] = ["lovable", "openrouter", "gemini", "groq", "cloudflare"];

const MODELS: Record<Provider, string> = {
  lovable: "google/gemini-2.5-flash",
  openrouter: "anthropic/claude-sonnet-4.6",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  cloudflare: "@cf/meta/llama-3.1-8b-instruct",
};

type Body = {
  prompt?: string;
  system?: string;
  model?: string;
  providerOrder?: string[];
  maxTokens?: number;
  temperature?: number;
};

type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };
type Result = { content: string; tokens: Usage };

const emptyUsage = (): Usage => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });

function usageFromOpenAI(u: unknown): Usage {
  const o = (u ?? {}) as Record<string, number | undefined>;
  const prompt_tokens = o["prompt_tokens"] ?? 0;
  const completion_tokens = o["completion_tokens"] ?? 0;
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: o["total_tokens"] ?? prompt_tokens + completion_tokens,
  };
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function assertKey(key: string | undefined, provider: Provider): string {
  if (!key || key === "PASTE_KEY_HERE" || key === "PASTE_URL_HERE") {
    throw new Error(`${provider}: API key is not configured`);
  }
  return key;
}

async function callOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  extraHeaders: Record<string, string> = {},
  extraBody: Record<string, unknown> = {},
): Promise<Result> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
      ...extraBody,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: unknown;
  };
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    tokens: usageFromOpenAI(json.usage),
  };
}

async function callGemini(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<Result> {
  const key = assertKey(readEnv("GEMINI_API_KEY") ?? GEMINI_API_KEY, "gemini");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const content =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const u = json.usageMetadata ?? {};
  return {
    content,
    tokens: {
      prompt_tokens: u.promptTokenCount ?? 0,
      completion_tokens: u.candidatesTokenCount ?? 0,
      total_tokens: u.totalTokenCount ?? 0,
    },
  };
}

async function callCloudflare(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<Result> {
  const key = assertKey(readEnv("CLOUDFLARE_API_KEY") ?? CLOUDFLARE_API_KEY, "cloudflare");
  const base = (readEnv("CLOUDFLARE_URL") ?? CLOUDFLARE_URL).replace(/\/$/, "");
  if (!base || base === "PASTE_URL_HERE") throw new Error("cloudflare: account URL is not configured");

  const res = await fetch(`${base}/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    result?: { response?: string; usage?: unknown };
  };
  return {
    content: json.result?.response ?? "",
    tokens: usageFromOpenAI(json.result?.usage),
  };
}

async function callProvider(
  provider: Provider,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<Result> {
  switch (provider) {
    case "lovable":
      return callOpenAICompatible(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        assertKey(readEnv("LOVABLE_API_KEY"), "lovable"),
        model,
        system,
        prompt,
        maxTokens,
        temperature,
      );
    case "openrouter":
      return callOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        assertKey(readEnv("OPENROUTER_API_KEY"), "openrouter"),
        model,
        system,
        prompt,
        maxTokens,
        temperature,
        { "X-Title": "Novel Reconstruction Engine" },
        { service_tier: "priority" },
      );
    case "groq":
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        assertKey(readEnv("GROQ_API_KEY") ?? GROQ_API_KEY, "groq"),
        model,
        system,
        prompt,
        maxTokens,
        temperature,
      );
    case "gemini":
      return callGemini(model, system, prompt, maxTokens, temperature);
    case "cloudflare":
      return callCloudflare(model, system, prompt, maxTokens, temperature);
  }
}

export const Route = createFileRoute("/api/public/ai-router")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const prompt = (body.prompt ?? "").slice(0, 400000);
        if (!prompt.trim()) return new Response("Missing prompt", { status: 400 });
        const system = (body.system ?? "").slice(0, 20000);
        const maxTokens = Math.min(Math.max(body.maxTokens ?? 8192, 16), 32000);
        const temperature = Math.min(Math.max(body.temperature ?? 0.7, 0), 2);

        const requested = Array.isArray(body.providerOrder) ? body.providerOrder : [];
        const order = requested.filter((p): p is Provider =>
          DEFAULT_ORDER.includes(p as Provider),
        );
        const chain = order.length ? order : DEFAULT_ORDER;

        const errors: { provider: Provider; error: string }[] = [];

        for (const provider of chain) {
          const model = body.model && chain.length === 1 ? body.model : MODELS[provider];
          try {
            const result = await callProvider(
              provider,
              model,
              system,
              prompt,
              maxTokens,
              temperature,
            );
            if (!result.content.trim()) throw new Error("empty response");
            return Response.json({
              id: crypto.randomUUID(),
              content: result.content,
              provider_used: provider,
              tokens: result.tokens,
              word_count: wordCount(result.content),
            });
          } catch (e) {
            errors.push({ provider, error: e instanceof Error ? e.message : String(e) });
          }
        }

        return Response.json(
          {
            id: crypto.randomUUID(),
            content: "",
            provider_used: null,
            tokens: emptyUsage(),
            word_count: 0,
            errors,
          },
          { status: 502 },
        );
      },
    },
  },
});
