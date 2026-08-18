import type { Project } from "./project-store";

const PROJECT_KEY = "nre.autosave.project.v1";
const DRAFT_PREFIX = "nre.autosave.draft.";

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** Mirrors the whole project into LocalStorage so progress survives offline reloads. */
export function autosaveProject(project: Project | null) {
  if (typeof window === "undefined") return;
  safe(() => {
    if (project) window.localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    else window.localStorage.removeItem(PROJECT_KEY);
  });
}

export function loadAutosavedProject(): Project | null {
  if (typeof window === "undefined") return null;
  return safe(() => {
    const raw = window.localStorage.getItem(PROJECT_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  });
}

export function saveDraft(segmentId: number, text: string) {
  if (typeof window === "undefined") return;
  safe(() => window.localStorage.setItem(`${DRAFT_PREFIX}${segmentId}`, text));
}

export function loadDraft(segmentId: number): string | null {
  if (typeof window === "undefined") return null;
  return safe(() => window.localStorage.getItem(`${DRAFT_PREFIX}${segmentId}`));
}

export function clearDraft(segmentId: number) {
  if (typeof window === "undefined") return;
  safe(() => window.localStorage.removeItem(`${DRAFT_PREFIX}${segmentId}`));
}
