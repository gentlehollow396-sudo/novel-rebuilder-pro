import { createFileRoute } from "@tanstack/react-router";
import { CURATED_FREE_AI, type FreeAiProvider } from "@/lib/free-ai-providers";

const SYSTEM =
  "You track AI inference providers. Reply with JSON only, no prose, no code fences.";

function buildPrompt(known: string[]): string {
  return [
    "List AI services that currently offer a genuinely FREE API tier for text generation.",
    "Exclude these already-known services: " + known.join(", ") + ".",
    "Return JSON of this exact shape:",
    '{"providers":[{"name":"","summary":"","freeTier":"","apiUrl":"","keyUrl":""}]}',
    "apiUrl must be the API documentation page, keyUrl the page where a key is created.",
    "Only include services you are confident exist. Max 8 entries.",
  ].join("\n");
}

function parseProviders(text: string): FreeAiProvider[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { providers?: unknown };
    if (!Array.isArray(parsed.providers)) return [];
    return parsed.providers
      .map((raw) => {
        const p = (raw ?? {}) as Record<string, unknown>;
        const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
        return {
          name: str("name"),
          summary: str("summary"),
          freeTier: str("freeTier") || "Free tier",
          apiUrl: str("apiUrl"),
          keyUrl: str("keyUrl") || str("apiUrl"),
          verified: false,
        } satisfies FreeAiProvider;
      })
      .filter((p) => p.name && /^https?:\/\//.test(p.apiUrl));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/public/free-ai-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const known = CURATED_FREE_AI.map((p) => p.name);
        const origin = new URL(request.url).origin;

        let discovered: FreeAiProvider[] = [];
        let error: string | null = null;

        try {
          const res = await fetch(`${origin}/api/public/ai-router`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system: SYSTEM,
              prompt: buildPrompt(known),
              maxTokens: 2000,
              temperature: 0.2,
            }),
          });
          const json = (await res.json().catch(() => null)) as
            | { content?: string; errors?: { provider: string; error: string }[] }
            | null;
          if (json?.content) discovered = parseProviders(json.content);
          else error = json?.errors?.map((e) => `${e.provider}: ${e.error}`).join(" · ") ?? "AI scan failed";
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        const seen = new Set(known.map((n) => n.toLowerCase()));
        const fresh = discovered.filter((p) => {
          const k = p.name.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        return Response.json({
          scannedAt: new Date().toISOString(),
          curated: CURATED_FREE_AI,
          discovered: fresh,
          error,
        });
      },
    },
  },
});
