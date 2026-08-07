import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useEcho } from "@/components/echo-context";
import { playEarcon, unlockAudio } from "@/lib/audio";
import { deleteCardFn, listCardsFn, saveCardFn, scanCardFn } from "@/lib/card.functions";
import { formatCardNumber, speakCard } from "@/lib/card-speech";

export const Route = createFileRoute("/_authenticated/app/cards")({
  component: Cards,
  head: () => ({
    meta: [
      { title: "Read my card aloud · EchoBank" },
      {
        name: "description",
        content:
          "Point your camera at a bank card and EchoBank reads the number, expiry and name aloud, then saves the card so you can hear it again.",
      },
      { property: "og:title", content: "Read my card aloud · EchoBank" },
      {
        property: "og:description",
        content: "An accessible camera that reads bank card details aloud, digit by digit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Scan = Awaited<ReturnType<typeof scanCardFn>>;

const cardsQuery = {
  queryKey: ["cards"] as const,
  queryFn: () => listCardsFn(),
};

function Cards() {
  const { say, prefs } = useEcho();
  const queryClient = useQueryClient();
  const { data: cards } = useQuery(cardsQuery);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("Camera is off. Start the camera, then hold your card in front of it.");
  const [scan, setScan] = useState<Scan | null>(null);
  const [label, setLabel] = useState("My card");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    unlockAudio();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const message = "This browser can't use the camera. You can still type the card details below.";
      setStatus(message);
      say(message);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
      playEarcon("navigate");
      const message =
        "Camera on. Hold the card flat, about twenty centimetres away, then press the big Read my card button. " +
        "You don't need to aim precisely.";
      setStatus(message);
      say(message);
    } catch {
      const message = "I couldn't open the camera. Allow camera access, or type the card details below.";
      setStatus(message);
      say(message);
    }
  }, [say]);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) throw new Error("The camera isn't ready yet.");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't capture the photo.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.85);
      return scanCardFn({ data: { image } });
    },
    onMutate: () => {
      playEarcon("listening");
      setStatus("Reading your card… hold still.");
      say("Reading your card. Hold still.");
    },
    onSuccess: (result) => {
      setScan(result);
      if (!result.ok) {
        playEarcon("warning");
        setStatus(result.spokenHint);
        say(result.spokenHint);
        return;
      }
      playEarcon("success");
      const spoken = `${result.spokenHint} ${speakCard({
        brand: result.brand,
        number: result.number,
        last4: result.last4 ?? "",
        expiry: result.expiry,
        holderName: result.holderName,
        includeFullNumber: true,
      })}`;
      setLabel(`${result.brand} ending ${result.last4}`);
      setStatus(spoken);
      say(spoken);
    },
    onError: (error: Error) => {
      playEarcon("error");
      toast.error(error.message);
      say(error.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!scan?.ok || !scan.last4) throw new Error("There's no card to save yet.");
      return saveCardFn({
        data: {
          label: label.trim() || "My card",
          brand: scan.brand,
          last4: scan.last4,
          ...(scan.bin6 ? { bin6: scan.bin6 } : {}),
          ...(scan.expiry ? { expiry: scan.expiry } : {}),
          ...(scan.holderName ? { holderName: scan.holderName } : {}),
        },
      });
    },
    onSuccess: async (result) => {
      playEarcon("success");
      say(result.spoken);
      toast.success(result.spoken);
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (error: Error) => {
      playEarcon("error");
      toast.error(error.message);
      say(error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteCardFn({ data: { id } }),
    onSuccess: async (result) => {
      say(result.spoken);
      await queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  return (
    <div className="space-y-8 py-4">
      <section aria-labelledby="camera-heading">
        <h1 id="camera-heading" className="font-display text-2xl font-extrabold text-foreground">
          Read my card
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Hold a bank card in front of the camera. EchoBank reads the number aloud, digit by digit, and can remember the
          card so you can hear it again later.
        </p>

        <p aria-live="polite" className="mt-4 rounded-2xl border border-border bg-card p-4 text-base text-foreground">
          {status}
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-accent">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Camera view. Point it at your bank card."
            className={`aspect-video w-full object-cover ${cameraOn ? "" : "hidden"}`}
          />
          {!cameraOn ? (
            <p className="flex aspect-video items-center justify-center px-6 text-center text-base text-muted-foreground">
              The camera is off.
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          {cameraOn ? (
            <>
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="min-h-16 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground disabled:opacity-60"
              >
                {scanMutation.isPending ? "Reading your card…" : "Read my card"}
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setStatus("Camera off.");
                  say("Camera off.");
                }}
                className="min-h-14 rounded-2xl border border-border px-6 text-base font-semibold text-foreground hover:bg-accent"
              >
                Turn the camera off
              </button>
            </>
          ) : (
            <button
              onClick={() => void startCamera()}
              className="min-h-16 rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground"
            >
              Start the camera
            </button>
          )}
        </div>
      </section>

      {scan?.ok && scan.number ? (
        <section aria-labelledby="result-heading" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="result-heading" className="font-display text-xl font-bold text-foreground">
            What I read
          </h2>
          <p className="mt-3 font-display text-3xl font-extrabold tabular-nums tracking-wide text-foreground">
            {formatCardNumber(scan.number)}
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            {scan.brand}
            {scan.expiry ? ` · expires ${scan.expiry}` : ""}
            {scan.holderName ? ` · ${scan.holderName}` : ""}
          </p>
          {!scan.checksumOk ? (
            <p className="mt-3 text-base font-semibold text-destructive">
              These digits didn't pass the card checksum — please check them before relying on them.
            </p>
          ) : null}

          <div className="mt-4 grid gap-3">
            <button
              onClick={() =>
                say(
                  speakCard({
                    brand: scan.brand,
                    number: scan.number,
                    last4: scan.last4 ?? "",
                    expiry: scan.expiry,
                    holderName: scan.holderName,
                    includeFullNumber: true,
                  }),
                )
              }
              className="min-h-14 rounded-2xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
            >
              Read it to me again
            </button>

            <label className="text-base font-semibold text-foreground" htmlFor="card-label">
              Name this card
            </label>
            <input
              id="card-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="min-h-14 rounded-2xl border border-border bg-background px-4 text-lg text-foreground"
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="min-h-14 rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground disabled:opacity-60"
            >
              Remember this card
            </button>
            <p className="text-sm text-muted-foreground">
              For your safety only the last four digits, the expiry and the name are kept. The full number stays on this
              device and is never saved or sent anywhere else.
            </p>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="font-display text-xl font-bold text-foreground">
          My saved cards
        </h2>
        {cards && cards.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  onClick={() => {
                    playEarcon("tick");
                    say(
                      `${card.label}. ` +
                        speakCard({
                          brand: card.brand,
                          number: null,
                          last4: card.last4,
                          expiry: card.expiry,
                          holderName: card.holderName,
                          includeFullNumber: false,
                        }),
                    );
                  }}
                  className="min-h-14 flex-1 text-left"
                >
                  <span className="block text-lg font-semibold text-foreground">{card.label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {card.brand} · ending {card.last4}
                    {card.expiry ? ` · expires ${card.expiry}` : ""}
                  </span>
                </button>
                <button
                  onClick={() => removeMutation.mutate(card.id)}
                  aria-label={`Remove ${card.label}`}
                  className="min-h-11 min-w-11 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-base text-muted-foreground">
            No cards saved yet. Read a card above and choose “Remember this card”.
          </p>
        )}
      </section>

      {!prefs.autoSpeak ? (
        <p className="text-sm text-muted-foreground">
          Tip: every button on this page speaks when you press it, whether or not automatic speech is on.
        </p>
      ) : null}
    </div>
  );
}
