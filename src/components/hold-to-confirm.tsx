import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { playEarcon } from "@/lib/audio";

/**
 * Press-and-hold confirmation.
 *
 * A tap is too easy to make by accident when you can't see the button, so
 * money only moves after a deliberate hold. The hold ticks audibly and
 * haptically each 250ms, so progress is knowable without looking.
 */
/**
 * How many hold-to-confirm buttons are currently on screen and enabled.
 * While one is mounted, the space key belongs to it (hold to send) rather
 * than to the global tap-and-speak shortcut.
 */
let armedHolds = 0;
export function hasArmedHold(): boolean {
  return armedHolds > 0;
}

export function HoldToConfirm({
  label,
  holdLabel,
  onConfirm,
  durationMs = 1600,
  disabled = false,
  tone = "primary",
}: {
  label: string;
  holdLabel?: string;
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const lastTick = useRef(0);
  const done = useRef(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (disabled || holding) return;
    done.current = false;
    startedAt.current = performance.now();
    lastTick.current = 0;
    setHolding(true);
    haptic("select");

    const step = () => {
      const elapsed = performance.now() - startedAt.current;
      const ratio = Math.min(1, elapsed / durationMs);
      setProgress(ratio);

      const tickIndex = Math.floor(elapsed / 250);
      if (tickIndex > lastTick.current) {
        lastTick.current = tickIndex;
        haptic("countdown");
        playEarcon("tick");
      }

      if (ratio >= 1) {
        if (!done.current) {
          done.current = true;
          haptic("success");
          onConfirm();
        }
        stop();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [disabled, holding, durationMs, onConfirm, stop]);

  const cancel = useCallback(() => {
    if (!holding) return;
    if (!done.current) haptic("tick");
    stop();
  }, [holding, stop]);

  // Space anywhere on the page drives this button while it is on screen, so a
  // blind user never has to hunt for focus before sending a payment.
  useEffect(() => {
    if (disabled) return;
    armedHolds += 1;

    function isSpace(event: KeyboardEvent) {
      return event.code === "Space" || event.key === " ";
    }
    function typing(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      return !!target && (target.isContentEditable || !!target.closest("input, textarea, select, [contenteditable='true']"));
    }
    function onDown(event: KeyboardEvent) {
      if (!isSpace(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event)) return;
      event.preventDefault();
      if (event.repeat) return;
      start();
    }
    function onUp(event: KeyboardEvent) {
      if (!isSpace(event) || typing(event)) return;
      event.preventDefault();
      cancel();
    }
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      armedHolds = Math.max(0, armedHolds - 1);
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, [disabled, start, cancel]);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!e.repeat) start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter") cancel();
      }}
      aria-label={`${label}. Press and hold for ${(durationMs / 1000).toFixed(1)} seconds to confirm.`}
      className={[
        "relative min-h-16 w-full touch-none select-none overflow-hidden rounded-2xl px-6 text-lg font-bold transition disabled:opacity-50",
        tone === "danger"
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary text-primary-foreground",
      ].join(" ")}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-foreground/25 transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{holding ? (holdLabel ?? "Keep holding…") : label}</span>
    </button>
  );
}
