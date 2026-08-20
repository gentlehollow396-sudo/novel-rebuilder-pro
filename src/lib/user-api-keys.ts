export type UserApiKeys = {
  gemini?: string;
  groq?: string;
};

const STORAGE_KEY = "nre.user-api-keys.v1";

function readStoredKeys(): UserApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      gemini: typeof parsed.gemini === "string" ? parsed.gemini : undefined,
      groq: typeof parsed.groq === "string" ? parsed.groq : undefined,
    };
  } catch {
    return {};
  }
}

export function loadUserApiKeys(): UserApiKeys {
  return readStoredKeys();
}

export function saveUserApiKeys(keys: UserApiKeys) {
  if (typeof window === "undefined") return;
  const next = Object.fromEntries(
    Object.entries(keys).filter(([, value]) => typeof value === "string" && value.trim()),
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearUserApiKeys() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
