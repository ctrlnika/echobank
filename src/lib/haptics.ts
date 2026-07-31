/**
 * Haptic vocabulary. Each pattern is deliberately distinguishable by feel alone,
 * so a customer knows what happened without hearing or seeing anything.
 */
export type HapticPattern =
  | "tick" // focus moved
  | "select" // control activated
  | "confirm" // something committed
  | "warning" // caution — check this
  | "error" // it did not work
  | "success" // money moved successfully
  | "countdown"; // one beat of a press-and-hold countdown

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 8,
  select: 16,
  confirm: [24, 40, 24],
  warning: [60, 70, 60],
  error: [90, 60, 90, 60, 90],
  success: [18, 50, 18, 50, 70],
  countdown: 12,
};

let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

export function haptic(pattern: HapticPattern) {
  if (!enabled) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Vibration is a progressive enhancement — never let it break a flow.
  }
}
