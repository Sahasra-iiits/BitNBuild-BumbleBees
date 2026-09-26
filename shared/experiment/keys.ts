// Keyboard key naming shared by the builder (recording allowed keys) and the
// runtime (matching presses), so both sides always agree on a key's identity.

const MODIFIER_KEYS = new Set(['shift', 'control', 'alt', 'meta', 'altgraph', 'capslock', 'fn', 'os']);

/** Keys the builder refuses to record and the "any key" runtime mode ignores. */
const NON_RESPONSE_KEYS = new Set(['tab', 'escape', 'unidentified', 'dead', 'process']);

/** Normalizes a KeyboardEvent.key value: single characters lowercased, space -> "space". */
export function normalizeKey(key: string): string {
  if (key === ' ' || key === 'Spacebar') return 'space';
  return key.toLowerCase();
}

export function isModifierKey(normalizedKey: string): boolean {
  return MODIFIER_KEYS.has(normalizedKey);
}

/** True for keys that may be configured as responses (and count for "any key"). */
export function isAssignableResponseKey(normalizedKey: string): boolean {
  return normalizedKey.length > 0 && !isModifierKey(normalizedKey) && !NON_RESPONSE_KEYS.has(normalizedKey);
}

export function displayKey(normalizedKey: string): string {
  const named: Record<string, string> = {
    space: 'Space',
    enter: 'Enter',
    arrowleft: '←',
    arrowright: '→',
    arrowup: '↑',
    arrowdown: '↓',
    backspace: 'Backspace',
  };
  if (named[normalizedKey]) return named[normalizedKey];
  return normalizedKey.length === 1 ? normalizedKey.toUpperCase() : normalizedKey;
}

export interface KeyEventLike {
  key: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * Returns the normalized key when the event may count as a response for the given
 * allowed-key list, otherwise null. Held-key auto-repeat and shortcut chords
 * (Ctrl/Meta/Alt) never count, so browser shortcuts keep working and one physical
 * press can produce at most one response.
 */
export function matchResponseKey(event: KeyEventLike, allowedKeys: readonly string[]): string | null {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = normalizeKey(event.key);
  if (allowedKeys.length === 0) return isAssignableResponseKey(key) ? key : null;
  return allowedKeys.includes(key) ? key : null;
}
