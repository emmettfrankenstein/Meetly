type E2eeSupportPanelProps = {
  isE2eeEnabled: boolean;
  isSupported: boolean;
  isSecureContextAvailable: boolean;
  hasWebCrypto: boolean;
  hasInsertableStreams: boolean;
};

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span
        className={
          ok ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"
        }
      >
        {ok ? "OK" : "Missing"}
      </span>
    </li>
  );
}

export function E2eeSupportPanel({
  isE2eeEnabled,
  isSupported,
  isSecureContextAvailable,
  hasWebCrypto,
  hasInsertableStreams,
}: E2eeSupportPanelProps) {
  if (!isE2eeEnabled) return null;

  return (
    <section
      className={`rounded-2xl border p-4 text-sm ${
        isSupported
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-50"
          : "border-rose-400/30 bg-rose-500/10 text-rose-50"
      }`}
    >
      <h2 className="font-semibold text-white">E2EE browser support</h2>

      <ul className="mt-3 space-y-2">
        <StatusLine label="Secure context" ok={isSecureContextAvailable} />
        <StatusLine label="Web Crypto" ok={hasWebCrypto} />
        <StatusLine
          label="Encoded media transforms"
          ok={hasInsertableStreams}
        />
      </ul>

      {!isSupported && (
        <p className="mt-3 text-rose-100/80">
          This browser may not support encrypted media transforms. Try Chrome or
          Edge on localhost/HTTPS.
        </p>
      )}
    </section>
  );
}
