import type { ConnectionQuality } from "../hooks/useWebRTC";

type ConnectionQualityBadgeProps = {
  quality: ConnectionQuality;
};

export function ConnectionQualityBadge({
  quality,
}: ConnectionQualityBadgeProps) {
  const badgeClass =
    quality.label === "Excellent"
      ? "bg-emerald-950 text-emerald-300"
      : quality.label === "Good"
        ? "bg-amber-950 text-amber-300"
        : quality.label === "Poor"
          ? "bg-rose-950 text-rose-300"
          : "bg-slate-800 text-slate-400";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-white">Connection</p>

        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass}`}
        >
          {quality.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div>
          <p className="text-slate-500">RTT</p>
          <p className="font-semibold text-slate-200">
            {quality.rttMs === null ? "—" : `${quality.rttMs} ms`}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Jitter</p>
          <p className="font-semibold text-slate-200">
            {quality.jitterMs === null ? "—" : `${quality.jitterMs} ms`}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Lost</p>
          <p className="font-semibold text-slate-200">{quality.packetsLost}</p>
        </div>
      </div>
    </div>
  );
}
