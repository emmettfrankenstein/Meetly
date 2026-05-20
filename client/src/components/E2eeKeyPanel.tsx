import { useState } from "react";

type E2eeKeyPanelProps = {
  isE2eeEnabled: boolean;
  isHost: boolean;
  status: "not-required" | "missing" | "ready" | "error";
  error: string;
  sharedKey: string;
  onGenerateKey: () => Promise<void>;
  onImportKey: (value: string) => Promise<void>;
  onClearKey: () => void;
};

export function E2eeKeyPanel({
  isE2eeEnabled,
  isHost,
  status,
  error,
  sharedKey,
  onGenerateKey,
  onImportKey,
  onClearKey,
}: E2eeKeyPanelProps) {
  const [inputKey, setInputKey] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy key");

  if (!isE2eeEnabled) {
    return null;
  }

  async function copyKey() {
    if (!sharedKey) return;

    await navigator.clipboard.writeText(sharedKey);
    setCopyLabel("Copied");

    window.setTimeout(() => {
      setCopyLabel("Copy key");
    }, 1500);
  }

  return (
    <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">
            End-to-end encryption key
          </h2>
          <p className="mt-1 text-emerald-100/80">
            The encryption key stays in the browser and is never sent to Meetly.
          </p>
          <p className="mt-2 text-xs text-emerald-100/70">
            Experimental: if participants use different keys, media may connect
            but audio/video will not decode.
          </p>
        </div>

        {status === "ready" && (
          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
            Key ready
          </span>
        )}

        {status === "missing" && (
          <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
            Key required
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-100">
          {error}
        </div>
      )}

      {isHost && status !== "ready" && (
        <button
          type="button"
          onClick={() => void onGenerateKey()}
          className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300"
        >
          Generate meeting key
        </button>
      )}

      {isHost && sharedKey && (
        <div className="mt-4 space-y-3">
          <p className="text-emerald-100/80">
            Share this key with trusted participants through a secure channel.
          </p>

          <textarea
            readOnly
            value={sharedKey}
            className="h-24 w-full resize-none rounded-xl border border-emerald-400/30 bg-slate-950 p-3 font-mono text-xs text-emerald-100 outline-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copyKey()}
              className="rounded-xl bg-slate-950/60 px-4 py-2 font-semibold text-white hover:bg-slate-950"
            >
              {copyLabel}
            </button>

            <button
              type="button"
              onClick={onClearKey}
              className="rounded-xl bg-rose-500/20 px-4 py-2 font-semibold text-rose-100 hover:bg-rose-500/30"
            >
              Clear key
            </button>
          </div>
        </div>
      )}

      {!isHost && status !== "ready" && (
        <div className="mt-4 space-y-3">
          <p className="text-emerald-100/80">
            Ask the host for the meeting encryption key, then paste it below.
          </p>

          <textarea
            value={inputKey}
            onChange={(event) => setInputKey(event.target.value)}
            placeholder="meetly-e2ee-v1..."
            className="h-24 w-full resize-none rounded-xl border border-emerald-400/30 bg-slate-950 p-3 font-mono text-xs text-emerald-100 outline-none placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={() => void onImportKey(inputKey)}
            className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300"
          >
            Import key
          </button>
        </div>
      )}

      {status === "ready" && !isHost && (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
          Encryption key imported. You can join encrypted media.
        </div>
      )}
    </section>
  );
}
