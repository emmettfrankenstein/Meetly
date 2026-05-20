type RecordingIndicatorProps = {
  isRecording: boolean;
};

export function RecordingIndicator({ isRecording }: RecordingIndicatorProps) {
  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
      Recording
    </div>
  );
}
