/**
 * Fuzzy payee matching for speech input.
 *
 * Browser speech recognition biases towards dictionary words, so short or
 * non-English names get mangled: "Nika" comes back as "new car", "Tariq" as
 * "tarik". We compare a rough phonetic skeleton instead of the letters, so
 * mishearings that *sound* like the payee still land on the right person.
 */

const VOWELS = /[aeiouy]/g;

/** Consonant skeleton: lowercase, drop spaces/punctuation/vowels, collapse repeats and common homophones. */
function skeleton(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/ck|q|kh/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/h/g, "")
    .replace(VOWELS, "")
    .replace(/(.)\1+/g, "$1");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/**
 * Best saved payee for a heard name, or null when nothing is close enough.
 * Returns the payee's stored spelling so downstream lookups match exactly.
 */
export function matchPayeeName(heard: string, names: readonly string[]): string | null {
  const spoken = heard.trim().toLowerCase();
  if (!spoken || names.length === 0) return null;

  const exact = names.find((n) => n.toLowerCase() === spoken);
  if (exact) return exact;

  const starts = names.find((n) => spoken.startsWith(n.toLowerCase()) || n.toLowerCase().startsWith(spoken));
  if (starts) return starts;

  const spokenSkeleton = skeleton(spoken);
  if (!spokenSkeleton) return null;

  let best: { name: string; score: number } | null = null;
  for (const name of names) {
    const nameSkeleton = skeleton(name);
    if (!nameSkeleton) continue;
    const distance = levenshtein(spokenSkeleton, nameSkeleton);
    // Allow one slip per two skeleton characters, at least one.
    const tolerance = Math.max(1, Math.floor(nameSkeleton.length / 2));
    if (distance <= tolerance && (!best || distance < best.score)) {
      best = { name, score: distance };
    }
  }
  return best?.name ?? null;
}

/** Rewrites a heard payee inside a fuller phrase, e.g. "pay new car ten pounds". */
export function resolveHeardPayee(heard: string, names: readonly string[]): string {
  return matchPayeeName(heard, names) ?? heard;
}
