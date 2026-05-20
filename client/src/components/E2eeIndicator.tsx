type E2eeIndicatorProps = {
  isEnabled: boolean;
};

export function E2eeIndicator({ isEnabled }: E2eeIndicatorProps) {
  if (!isEnabled) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100">
      <span className="text-base">🔒</span>
      End-to-end encrypted
    </div>
  );
}
