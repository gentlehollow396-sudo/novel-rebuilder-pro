import { createFileRoute } from "@tanstack/react-router";

type Body = {
  prompt?: string;
  system?: string;
  model?: string;
  stream?: boolean;
};

const BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export const Route = createFileRoute("/api/public/openrouter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["OPENROUTER_API_KEY"];
        if (!apiKey) {
          return new Response("OPENROUTER_API_KEY is not configured", { status: 503 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const prompt = (body.prompt ?? "").slice(0, 400000);
        if (!prompt.trim()) return new Response("Missing prompt", { status: 400 });

        const system = (body.system ?? "").slice(0, 20000);
        const model = (body.model ?? DEFAULT_MODEL).slice(0, 200);
        const stream = body.stream === true;

        const upstream = await fetch(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-Title": "Novel Reconstruction Engine",
          },
          body: JSON.stringify({
            model,
            stream,
            service_tier: "priority",
            messages: [
              ...(system ? [{ role: "system", content: system }] : []),
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          return new Response(
            `OpenRouter failed [${upstream.status}]: ${detail.slice(0, 400)}`,
            { status: upstream.status === 429 ? 429 : 502 },
          );
        }

        if (stream && upstream.body) {
          return new Response(upstream.body, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
          });
        }

        const json = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return Response.json({
          model,
          text: json.choices?.[0]?.message?.content ?? "",
        });
      },
    },
  },
});
