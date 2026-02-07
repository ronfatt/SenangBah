export function nowIso() {
  return new Date().toISOString();
}

export function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isEmptyOrNonsense(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  // must contain at least one letter
  return !/[A-Za-z]/.test(trimmed);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
