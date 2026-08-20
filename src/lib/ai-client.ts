import { loadUserApiKeys } from "./user-api-keys";

export type RouterResponse = {
  id: string;
  content: string;
  provider_used: string | null;
  tokens: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  word_count: number;
  errors?: { provider: string; error: string }[];
};

export async function callAiRouter(
  input: { system?: string; prompt: string; providerOrder?: string[] },
  signal?: AbortSignal | null,
): Promise<RouterResponse> {
  const res = await fetch("/api/public/ai-router", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, userApiKeys: loadUserApiKeys() }),
    signal: signal ?? null,
  });

  const json = (await res.json().catch(() => null)) as RouterResponse | null;
  if (!res.ok || !json || !json.content) {
    const detail = json?.errors?.map((e) => `${e.provider}: ${e.error}`).join(" · ");
    throw new Error(detail || `AI request failed (${res.status})`);
  }
  return json;
}
