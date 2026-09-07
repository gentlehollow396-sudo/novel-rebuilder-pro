export type FreeAiProvider = {
  name: string;
  summary: string;
  freeTier: string;
  apiUrl: string;
  keyUrl: string;
  verified: boolean;
};

/** Hand-checked list of AI services with a genuinely free API tier. */
export const CURATED_FREE_AI: FreeAiProvider[] = [
  {
    name: "Google AI Studio (Gemini)",
    summary: "Gemini Flash models, generous free requests per day.",
    freeTier: "Free tier with daily request limits",
    apiUrl: "https://ai.google.dev/gemini-api/docs",
    keyUrl: "https://aistudio.google.com/apikey",
    verified: true,
  },
  {
    name: "Groq",
    summary: "Very fast open models (Llama, GPT-OSS) with a free developer tier.",
    freeTier: "Free tier, rate limited per minute/day",
    apiUrl: "https://console.groq.com/docs/api-reference",
    keyUrl: "https://console.groq.com/keys",
    verified: true,
  },
  {
    name: "OpenRouter (free models)",
    summary: "Router with many `:free` community models behind one API.",
    freeTier: "Free models, daily cap per account",
    apiUrl: "https://openrouter.ai/docs/api-reference/overview",
    keyUrl: "https://openrouter.ai/keys",
    verified: true,
  },
  {
    name: "Mistral AI (La Plateforme)",
    summary: "Mistral Small / Nemo models with a free experiment tier.",
    freeTier: "Free experiment plan",
    apiUrl: "https://docs.mistral.ai/api/",
    keyUrl: "https://console.mistral.ai/api-keys/",
    verified: true,
  },
  {
    name: "Cerebras Inference",
    summary: "High-throughput Llama inference, free developer key.",
    freeTier: "Free tier with daily token allowance",
    apiUrl: "https://inference-docs.cerebras.ai/",
    keyUrl: "https://cloud.cerebras.ai/",
    verified: true,
  },
  {
    name: "Together AI",
    summary: "Open-model hosting with free endpoints for some models.",
    freeTier: "Free credits + free-tier models",
    apiUrl: "https://docs.together.ai/reference",
    keyUrl: "https://api.together.ai/settings/api-keys",
    verified: true,
  },
  {
    name: "Cloudflare Workers AI",
    summary: "Edge-hosted open models, free daily neurons allowance.",
    freeTier: "Free daily allocation",
    apiUrl: "https://developers.cloudflare.com/workers-ai/",
    keyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    verified: true,
  },
  {
    name: "Hugging Face Inference",
    summary: "Thousands of open models through one inference API.",
    freeTier: "Free monthly inference credits",
    apiUrl: "https://huggingface.co/docs/api-inference/index",
    keyUrl: "https://huggingface.co/settings/tokens",
    verified: true,
  },
  {
    name: "GitHub Models",
    summary: "GPT, Llama and Phi models free for GitHub accounts.",
    freeTier: "Free with rate limits",
    apiUrl: "https://docs.github.com/en/github-models",
    keyUrl: "https://github.com/settings/tokens",
    verified: true,
  },
  {
    name: "Cohere",
    summary: "Command models with a free trial key for prototyping.",
    freeTier: "Free trial key, rate limited",
    apiUrl: "https://docs.cohere.com/reference/about",
    keyUrl: "https://dashboard.cohere.com/api-keys",
    verified: true,
  },
];
