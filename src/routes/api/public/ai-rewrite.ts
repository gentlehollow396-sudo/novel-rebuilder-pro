import { createFileRoute } from "@tanstack/react-router";

type Body = { system?: string; prompt?: string; startAt?: string };

const encoder = new TextEncoder();

function frame(text: string) {
  return encoder.encode(`data: ${JSON.stringify({ text })}\n\n`);
}

type Upstream = { label: string; run: () => Promise<Response>; pick: (json: unknown) => string | undefined };

function openAIPick(json: unknown) {
  return (json as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
}

function buildChain(system: string, prompt: string): Upstream[] {
  const chain: Upstream[] = [];
  const messages = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];

  const gemini = process.env["GEMINI_API_KEY"];
  if (gemini) {
    chain.push({
      label: "Project Gemini",
      pick: (json) =>
        (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]
          ?.content?.parts?.[0]?.text,
      run: () =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${gemini}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 65536 },
            }),
          },
        ),
    });
  }

  const openrouter = process.env["OPENROUTER_API_KEY"];
  if (openrouter) {
    chain.push({
      label: "Project OpenRouter",
      pick: openAIPick,
      run: () =>
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openrouter}` },
          body: JSON.stringify({
            model: "meta-llama/llama-3.3-70b-instruct",
            stream: true,
            messages,
          }),
        }),
    });
  }

  const cfAccount = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const cfToken = process.env["CLOUDFLARE_API_TOKEN"];
  if (cfAccount && cfToken) {
    chain.push({
      label: "Project Cloudflare Workers AI",
      pick: (json) => (json as { response?: string }).response,
      run: () =>
        fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfToken}` },
            body: JSON.stringify({ stream: true, max_tokens: 16000, messages }),
          },
        ),
    });
  }

  const groq = process.env["GROQ_API_KEY"];
  if (groq) {
    chain.push({
      label: "Project Groq",
      pick: openAIPick,
      run: () =>
        fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groq}` },
          body: JSON.stringify({ model: "llama-3.3-70b-versatile", stream: true, messages }),
        }),
    });
  }

  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    for (const model of ["google/gemini-3-flash", "openai/gpt-5.2-chat"]) {
      chain.push({
        label: `Free provider (${model})`,
        pick: openAIPick,
        run: () =>
          fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}` },
            body: JSON.stringify({ model, stream: true, messages }),
          }),
      });
    }
  }

  return chain;
}

async function pipe(upstream: Upstream, controller: ReadableStreamDefaultController<Uint8Array>) {
  const res = await upstream.run();
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${upstream.label} failed [${res.status}]: ${detail.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = 0;
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
        const piece = upstream.pick(JSON.parse(data));
        if (piece) {
          emitted += piece.length;
          controller.enqueue(frame(piece));
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (emitted === 0) throw new Error(`${upstream.label} returned nothing`);
}

export const Route = createFileRoute("/api/public/ai-rewrite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const system = (body.system ?? "").slice(0, 20000);
        const prompt = (body.prompt ?? "").slice(0, 400000);
        if (!prompt.trim()) return new Response("Missing prompt", { status: 400 });

        const chain = buildChain(system, prompt);
        if (chain.length === 0) {
          return new Response("No project AI providers are configured", { status: 503 });
        }

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const errors: string[] = [];
            for (const upstream of chain) {
              try {
                await pipe(upstream, controller);
                controller.close();
                return;
              } catch (error) {
                errors.push((error as Error).message);
              }
            }
            controller.enqueue(frame(""));
            controller.error(new Error(errors.join(" | ")));
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
