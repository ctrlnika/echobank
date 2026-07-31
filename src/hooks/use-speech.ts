import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech wrapper. Recognition and synthesis in one hook, because in this
 * app they are one conversation: we must never listen while we are talking,
 * or the microphone hears our own voice and loops.
 */

interface RecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow the microphone, or type your command instead.",
  "service-not-allowed": "Microphone access is blocked. Allow the microphone, or type your command instead.",
  "no-speech": "I didn't hear anything. Tap and hold the big button, then speak.",
  aborted: "",
  network: "Voice input needs a connection. Please type your command instead.",
  "audio-capture": "I can't find a microphone. Please type your command instead.",
};

type Options = {
  onResult?: (transcript: string) => void;
  onError?: (message: string) => void;
  lang?: string;
};

export function useSpeech({ onResult, onError, lang = "en-GB" }: Options = {}) {
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const rateRef = useRef(1);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    setRecognitionSupported(Boolean(getRecognitionCtor()));
    setSynthesisSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate;
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rateRef.current;
    utterance.lang = "en-GB";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.(
        "Voice input isn't supported in this browser. Everything still works by typing or by keyboard.",
      );
      return;
    }
    cancelSpeech();

    // Recreate every time: some browsers refuse to restart one instance.
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setInterim("");
    };
    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }

      setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        onResultRef.current?.(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const message = ERROR_MESSAGES[event.error] ?? "Voice input failed. Please type your command instead.";
      if (message) onErrorRef.current?.(message);
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterim("");
    };

    try {
      recognition.start();
    } catch {
      // start() throws when already running — harmless.
    }
  }, [cancelSpeech, lang]);

  return {
    recognitionSupported,
    synthesisSupported,
    isListening,
    isSpeaking,
    interim,
    speak,
    cancelSpeech,
    setRate,
    startListening,
    stopListening,
  };
}
