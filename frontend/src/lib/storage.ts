// localStorage access that never throws: storage can be unavailable (privacy mode,
// disabled cookies), full (quota), or contain corrupted JSON from an older build.

export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed;
    window.localStorage.removeItem(key);
    return null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored (unavailable or quota exceeded). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
