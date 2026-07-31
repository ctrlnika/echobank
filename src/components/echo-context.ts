import { createContext, useContext } from "react";

export type EchoPrefs = {
  displayName: string;
  speechRate: number;
  verbosity: "brief" | "standard" | "detailed";
  hapticsEnabled: boolean;
  earconsEnabled: boolean;
  autoSpeak: boolean;
  onboarded: boolean;
};

export type EchoContextValue = {
  prefs: EchoPrefs;
  /** Speak a sentence now, cancelling anything currently being said. */
  say: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  isListening: boolean;
  startListening: () => void;
  recognitionSupported: boolean;
  /** The last thing EchoBank said — mirrored on screen as a live caption. */
  lastSpoken: string;
};

export const EchoContext = createContext<EchoContextValue | null>(null);

export function useEcho(): EchoContextValue {
  const value = useContext(EchoContext);
  if (!value) throw new Error("useEcho must be used inside the EchoBank app layout");
  return value;
}
