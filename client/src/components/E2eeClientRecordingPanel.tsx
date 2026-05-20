import type { ClientRecordingStatus } from "../hooks/useClientRecording";

type UploadedE2eeRecording = {
  id: string;
  metadata: unknown;
  sizeBytes: number;
  durationSec?: number | null;
  createdAt: string;
};

type E2eeClientRecordingPanelProps = {
  canRecord: boolean;
  isE2eeEnabled: boolean;
  status: ClientRecordingStatus;
  error?: string | null;
  recordingUrl?: string | null;
  recordingBlob?: Blob | null;
  encryptedRecordingUrl?: string | null;
  encryptedRecordingSize?: number | null;
  isEncrypting?: boolean;
  durationSec?: number | null;
  startedAt?: Date | null;
  isUploading?: boolean;
  uploadError?: string | null;
  uploadedRecordings?: UploadedE2eeRecording[];
  decryptedPlaybackUrl?: string | null;
  playbackError?: string | null;
  decryptingRecordingId?: string | null;
  layoutMode?: string;
  onPlayUploaded?: (recording: UploadedE2eeRecording) => void | Promise<void>;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onEncrypt?: () => void;
  onUpload?: () => void;
  onDeleteUploaded?: (recordingId: string) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return null;

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;

  if (minutes === 0) return `${remainingSeconds}s`;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function E2eeClientRecordingPanel({
  canRecord,
  isE2eeEnabled,
  status,
  error,
  recordingUrl,
  recordingBlob,
  encryptedRecordingUrl,
  encryptedRecordingSize,
  isEncrypting = false,
  durationSec,
  startedAt,
  isUploading = false,
  uploadError,
  uploadedRecordings = [],
  decryptedPlaybackUrl,
  playbackError,
  decryptingRecordingId,
  layoutMode,
  onPlayUploaded,
  onStart,
  onStop,
  onClear,
  onEncrypt,
  onUpload,
  onDeleteUploaded,
}: E2eeClientRecordingPanelProps) {
  if (!isE2eeEnabled) return null;

  const isRecording = status === "recording";
  const isStopping = status === "stopping";
  const hasReadyRecording = Boolean(recordingUrl && recordingBlob);
  const durationLabel = formatDuration(durationSec);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/95 text-slate-200 shadow-2xl">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Saved
            </p>

            <h2 className="mt-1 truncate text-base font-bold text-white">
              Local recordings
            </h2>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isRecording
                ? "bg-red-500/15 text-red-100"
                : hasReadyRecording
                  ? "bg-emerald-500/15 text-emerald-100"
                  : "bg-slate-800 text-slate-300"
            }`}
          >
            {isRecording ? "Recording" : hasReadyRecording ? "Ready" : status}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
          {layoutMode && (
            <span>
              Layout: <span className="text-slate-300">{layoutMode}</span>
            </span>
          )}

          {startedAt && (
            <span>
              Started:{" "}
              <span className="text-slate-300">
                {startedAt.toLocaleTimeString()}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                isRecording ? "bg-red-400" : "bg-slate-500"
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                {isRecording
                  ? "Recording in background"
                  : isStopping
                    ? "Finalizing recording"
                    : hasReadyRecording
                      ? "Recording ready to save"
                      : "No recording ready"}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                {isRecording
                  ? "You can keep using the meeting. Open this panel later to save the file."
                  : hasReadyRecording
                    ? "Save the WebM file to your device before leaving the meeting."
                    : "Use the Record button in the floating dock to start a local recording."}
              </p>

              {durationLabel && (
                <p className="mt-2 text-xs text-slate-500">
                  Duration:{" "}
                  <span className="text-slate-300">{durationLabel}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
            {error}
          </div>
        )}

        {canRecord && (
          <div className="grid grid-cols-2 gap-2">
            {!isRecording && !isStopping && (
              <button
                type="button"
                onClick={onStart}
                className="rounded-2xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
              >
                Start
              </button>
            )}

            {isRecording && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-2xl bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-400"
              >
                Stop
              </button>
            )}

            {hasReadyRecording && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-2xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {recordingUrl && recordingBlob && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>
                Size:{" "}
                <span className="font-semibold text-white">
                  {formatBytes(recordingBlob.size)}
                </span>
              </span>

              {durationLabel && (
                <span>
                  Duration:{" "}
                  <span className="font-semibold text-white">
                    {durationLabel}
                  </span>
                </span>
              )}
            </div>

            <video
              src={recordingUrl || undefined}
              controls
              className="max-h-48 w-full rounded-xl bg-black"
            />

            <a
              href={recordingUrl || "#"}
              download={`meetly-recording-${new Date()
                .toISOString()
                .replace(/[:.]/g, "-")}.webm`}
              className="flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Save recording
            </a>

            {onEncrypt && (
              <button
                type="button"
                onClick={onEncrypt}
                disabled={isEncrypting}
                className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEncrypting ? "Encrypting..." : "Create encrypted copy"}
              </button>
            )}
          </div>
        )}

        {encryptedRecordingUrl && encryptedRecordingSize && (
          <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-100">
              Encrypted copy ready
            </p>

            <p className="text-xs text-emerald-100/75">
              Size: {formatBytes(encryptedRecordingSize)}
            </p>

            <a
              href={encryptedRecordingUrl}
              download={`meetly-encrypted-recording-${new Date()
                .toISOString()
                .replace(/[:.]/g, "-")}.bin`}
              className="flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              Save encrypted copy
            </a>

            {onUpload && (
              <button
                type="button"
                onClick={onUpload}
                disabled={isUploading}
                className="w-full rounded-2xl border border-cyan-500/40 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Upload encrypted backup"}
              </button>
            )}
          </div>
        )}

        {uploadError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
            {uploadError}
          </div>
        )}

        {uploadedRecordings.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-sm font-semibold text-white">
              Encrypted backups
            </p>

            <div className="mt-3 space-y-2">
              {uploadedRecordings.map((recording) => (
                <div
                  key={recording.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        {new Date(recording.createdAt).toLocaleString()}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {formatBytes(recording.sizeBytes)}
                        {recording.durationSec
                          ? ` · ${formatDuration(recording.durationSec)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {onPlayUploaded && (
                        <button
                          type="button"
                          onClick={() => void onPlayUploaded(recording)}
                          disabled={decryptingRecordingId === recording.id}
                          className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {decryptingRecordingId === recording.id
                            ? "..."
                            : "Play"}
                        </button>
                      )}

                      {onDeleteUploaded && (
                        <button
                          type="button"
                          onClick={() => onDeleteUploaded(recording.id)}
                          className="rounded-lg border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {playbackError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
            {playbackError}
          </div>
        )}

        {decryptedPlaybackUrl && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3">
            <p className="mb-2 text-sm font-semibold text-cyan-100">
              Decrypted playback
            </p>

            <video
              src={decryptedPlaybackUrl}
              controls
              className="max-h-56 w-full rounded-xl bg-black"
            />

            <a
              href={decryptedPlaybackUrl}
              download={`meetly-decrypted-recording-${new Date()
                .toISOString()
                .replace(/[:.]/g, "-")}.webm`}
              className="mt-3 flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Download decrypted copy
            </a>
          </div>
        )}

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs leading-5 text-yellow-100/90">
          Keep this tab open until your recording is saved. Local recordings are
          created in your browser and are not automatically uploaded.
        </div>
      </div>
    </section>
  );
}
