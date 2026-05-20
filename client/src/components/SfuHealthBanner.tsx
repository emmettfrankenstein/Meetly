type SfuHealthBannerProps = {
  health: "idle" | "connecting" | "connected" | "degraded" | "failed";
  status: string;
  sendTransportState: string;
  recvTransportState: string;
  onReconnect: () => void;
};

export function SfuHealthBanner({
  health,
  status,
  sendTransportState,
  recvTransportState,
  onReconnect,
}: SfuHealthBannerProps) {
  if (health === "connected") return null;

  const label =
    health === "connecting"
      ? "Connecting media..."
      : health === "degraded"
        ? "Media connection unstable"
        : health === "failed"
          ? "Media connection failed"
          : "Media not connected";

  const tone =
    health === "failed"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
      : health === "degraded"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : "border-cyan-500/40 bg-cyan-500/10 text-cyan-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-sm opacity-80">{status}</p>
          <p className="mt-1 text-xs opacity-70">
            Send: {sendTransportState} · Receive: {recvTransportState}
          </p>
        </div>

        {(health === "failed" || health === "degraded") && (
          <button
            type="button"
            onClick={onReconnect}
            className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          >
            Reconnect media
          </button>
        )}
      </div>
    </div>
  );
}
