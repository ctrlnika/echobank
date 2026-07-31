/**
 * EchoBank earcon engine.
 *
 * Ported and extended from the original prototype, which got the important
 * things right: one shared AudioContext, a soft attack/release envelope, and a
 * gentle low-pass so nothing clicks or bites.
 *
 * An earcon is a two-to-three note motif that identifies a *kind* of thing.
 * Together they form a grammar: rising = money in, falling = money out,
 * an unresolved tritone = caution, a perfect fifth = done.
 */

export type Earcon =
  | "groceries"
  | "transport"
  | "bills"
  | "transfer"
  | "income"
  | "other"
  | "success"
  | "warning"
  | "error"
  | "scam"
  | "navigate"
  | "listening"
  | "tick";

let ctx: AudioContext | null = null;
let masterVolume = 0.9;
let enabled = true;

export function setEarconsEnabled(value: boolean) {
  enabled = value;
}

export function setEarconVolume(value: number) {
  masterVolume = Math.min(1, Math.max(0, value));
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from the first user gesture to unlock audio on iOS/Safari. */
export function unlockAudio() {
  getCtx();
}

type Note = { freq: number; start: number; dur: number };
type Spec = { notes: Note[]; type: OscillatorType; peak: number };

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const D5 = 587.33;
const F5 = 698.46;
const B4 = 493.88;
const G4 = 392.0;
const C4 = 261.63;
const Eb5 = 622.25;

const SPECS: Record<Earcon, Spec> = {
  // Everyday, friendly rising third.
  groceries: { type: "sine", peak: 0.16, notes: [{ freq: C5, start: 0, dur: 0.16 }, { freq: E5, start: 0.13, dur: 0.2 }] },
  // Quick double blip — in transit.
  transport: { type: "triangle", peak: 0.14, notes: [{ freq: A5, start: 0, dur: 0.08 }, { freq: A5, start: 0.12, dur: 0.12 }] },
  // Two low, settled notes — something regular and unavoidable.
  bills: { type: "sine", peak: 0.17, notes: [{ freq: G4, start: 0, dur: 0.18 }, { freq: D5, start: 0.15, dur: 0.2 }] },
  // Handover: mid, up, settle.
  transfer: { type: "sine", peak: 0.15, notes: [{ freq: D5, start: 0, dur: 0.12 }, { freq: G5, start: 0.11, dur: 0.18 }] },
  // Money in: bright ascending triad.
  income: {
    type: "sine",
    peak: 0.18,
    notes: [
      { freq: C5, start: 0, dur: 0.12 },
      { freq: E5, start: 0.1, dur: 0.12 },
      { freq: G5, start: 0.2, dur: 0.26 },
    ],
  },
  other: { type: "sine", peak: 0.13, notes: [{ freq: C5, start: 0, dur: 0.18 }] },
  // Resolved perfect fifth — it is done, and it is fine.
  success: {
    type: "sine",
    peak: 0.2,
    notes: [
      { freq: G5, start: 0, dur: 0.12 },
      { freq: C5 * 2, start: 0.1, dur: 0.3 },
    ],
  },
  // Unresolved, slightly sour — stop and think.
  warning: { type: "triangle", peak: 0.18, notes: [{ freq: F5, start: 0, dur: 0.16 }, { freq: B4, start: 0.14, dur: 0.28 }] },
  error: { type: "triangle", peak: 0.18, notes: [{ freq: Eb5, start: 0, dur: 0.14 }, { freq: C4, start: 0.13, dur: 0.3 }] },
  // Scam: the warning motif, repeated. Impossible to mistake for anything else.
  scam: {
    type: "triangle",
    peak: 0.2,
    notes: [
      { freq: F5, start: 0, dur: 0.14 },
      { freq: B4, start: 0.13, dur: 0.16 },
      { freq: F5, start: 0.3, dur: 0.14 },
      { freq: B4, start: 0.43, dur: 0.3 },
    ],
  },
  // A soft landmark tone as you move between sections.
  navigate: { type: "sine", peak: 0.1, notes: [{ freq: E5, start: 0, dur: 0.09 }] },
  listening: { type: "sine", peak: 0.14, notes: [{ freq: C5, start: 0, dur: 0.08 }, { freq: G5, start: 0.07, dur: 0.12 }] },
  tick: { type: "sine", peak: 0.07, notes: [{ freq: A5, start: 0, dur: 0.04 }] },
};

export function playEarcon(name: Earcon) {
  if (!enabled) return;
  const audio = getCtx();
  if (!audio) return;

  const spec = SPECS[name];
  const now = audio.currentTime;

  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 4200;
  filter.connect(audio.destination);

  for (const note of spec.notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = spec.type;
    osc.frequency.value = note.freq;

    const start = now + note.start;
    const end = start + note.dur;
    const peak = spec.peak * masterVolume;
    const attack = 0.012;

    // Linear ramps only — exponential ramps to zero are invalid and click.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.setValueAtTime(peak, Math.max(start + attack, end - 0.06));
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
