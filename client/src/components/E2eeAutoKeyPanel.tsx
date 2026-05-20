type E2eeAutoKeyPanelProps = {
  isE2eeEnabled: boolean;
  isHost: boolean;
  status: "off" | "preparing" | "waiting-for-host" | "ready" | "error";
  error?: string | null;
};

export function E2eeAutoKeyPanel({
  isE2eeEnabled,
  isHost,
  status,
  error,
}: E2eeAutoKeyPanelProps) {
  if (!isE2eeEnabled) return null;

  const label =
    status === "ready"
      ? "Encrypted meeting key ready"
      : status === "waiting-for-host"
        ? "Waiting for encrypted key from host"
        : status === "preparing"
          ? "Preparing encrypted meeting"
          : status === "error"
            ? "Encrypted key exchange failed"
            : "End-to-end encryption";

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
      <p className="font-semibold">Automatic E2EE</p>

      <p className="mt-1 text-emerald-100/80">{label}</p>

      <p className="mt-2 text-xs text-emerald-100/70">
        {isHost
          ? "You create the encrypted room key automatically. Guests receive it through encrypted key exchange."
          : "The host will automatically share the encrypted room key with you. No manual key copy is needed."}
      </p>

      {error && (
        <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-100">
          {error}
        </p>
      )}
    </div>
  );
}
