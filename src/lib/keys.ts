export type ProviderId = "gemini" | "openrouter" | "cloudflare" | "groq" | "opensource";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
  cloudflare: "Cloudflare Workers AI",
  groq: "Groq",
  opensource: "Open-source fallback",
};

export type UserKeys = {
  gemini: string;
  openrouter: string;
  cloudflare: string; // accountId:apiToken
  groq: string;
};

export const EMPTY_KEYS: UserKeys = { gemini: "", openrouter: "", cloudflare: "", groq: "" };

const KEYS_STORAGE = "nre.keys.v1";
const USAGE_STORAGE = "nre.usage.v1";
const PROVIDER_STORAGE = "nre.provider.v1";

export function loadKeys(): UserKeys {
  if (typeof window === "undefined") return EMPTY_KEYS;
  try {
    return { ...EMPTY_KEYS, ...JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "{}") };
  } catch {
    return EMPTY_KEYS;
  }
}

export function saveKeys(keys: UserKeys) {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

export type UsageEntry = { rewrites: number; words: number };
export type UsageMap = Partial<Record<string, UsageEntry>>;

export function loadUsage(): UsageMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(USAGE_STORAGE) ?? "{}");
  } catch {
    return {};
  }
}

export function recordUsage(label: string, words: number): UsageMap {
  const usage = loadUsage();
  const prev = usage[label] ?? { rewrites: 0, words: 0 };
  usage[label] = { rewrites: prev.rewrites + 1, words: prev.words + words };
  localStorage.setItem(USAGE_STORAGE, JSON.stringify(usage));
  return usage;
}

export function resetUsage() {
  localStorage.removeItem(USAGE_STORAGE);
}

export function loadPreferredProvider(): ProviderId {
  if (typeof window === "undefined") return "gemini";
  return (localStorage.getItem(PROVIDER_STORAGE) as ProviderId) || "gemini";
}

export function savePreferredProvider(p: ProviderId) {
  localStorage.setItem(PROVIDER_STORAGE, p);
}

export function keyFormatOk(provider: keyof UserKeys, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (provider) {
    case "gemini":
      // Accept any prefix (AIza, AQ..., etc.) — only reject obviously malformed values.
      return v.length >= 8 && !/\s/.test(v);
    case "openrouter":
      return v.startsWith("sk-or-") || v.length > 20;
    case "groq":
      return v.startsWith("gsk_") || v.length > 20;
    case "cloudflare":
      return /^[^:\s]+:[^:\s]+$/.test(v);
  }
}
