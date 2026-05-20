type E2eeMediaStatusBannerProps = {
  isE2eeEnabled: boolean;
  transformStatus: "off" | "attaching" | "active" | "failed";
};

export function E2eeMediaStatusBanner({
  isE2eeEnabled,
  transformStatus,
}: E2eeMediaStatusBannerProps) {
  if (!isE2eeEnabled) return null;

  if (transformStatus === "active") {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Encrypted media transforms are active.
      </div>
    );
  }

  if (transformStatus === "failed") {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        <p className="font-semibold">Encrypted media transform failed.</p>
        <p className="mt-1">
          Reconnect media, verify everyone imported the same E2EE key, or try
          Chrome/Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      Encrypted media is preparing. Join may take a few seconds.
    </div>
  );
}
