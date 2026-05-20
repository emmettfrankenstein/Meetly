import { useEffect, useMemo, useState } from "react";
import {
  deleteRecording,
  listRecordings,
  startRecording,
  stopRecording,
  type Recording,
} from "../services/recordingApi";

export type RecordingPanelProps = {
  roomId: string;
  isHost: boolean;
  isRecordingActive?: boolean;
  isE2eeEnabled?: boolean;
};
import { clientEnv } from "../config/env";

const API_BASE_URL = clientEnv.serverUrl;
// const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

function formatDuration(seconds?: number | null) {
  if (!seconds) return "—";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "—";

  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;

  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;

  return `${mb.toFixed(1)} MB`;
}

function getRecordingStatusLabel(status: Recording["status"]) {
  switch (status) {
    case "PROCESSING":
      return "Recording in progress";
    case "READY":
      return "Ready to play";
    case "FAILED":
      return "Recording failed";
    case "STOPPED":
      return "Stopped";
    default:
      return status;
  }
}

function getRecordingStatusClass(status: Recording["status"]) {
  switch (status) {
    case "PROCESSING":
      return "border-rose-400/30 bg-rose-500/10 text-rose-100";
    case "READY":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "FAILED":
      return "border-rose-400/30 bg-rose-500/10 text-rose-100";
    case "STOPPED":
      return "border-slate-700 bg-slate-900 text-slate-300";
    default:
      return "border-slate-700 bg-slate-900 text-slate-300";
  }
}

function buildServerUrl(path?: string | null) {
  if (!path) return null;

  if (path.startsWith("http")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

export function RecordingPanel({
  roomId,
  isHost,
  isRecordingActive,
  isE2eeEnabled,
}: RecordingPanelProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");

  const activeRecording = useMemo(
    () => recordings.find((recording) => recording.status === "PROCESSING"),
    [recordings],
  );

  async function refreshRecordings() {
    if (!isHost) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await listRecordings(roomId);
      setRecordings(response.recordings);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load recordings",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartRecording() {
    if (isE2eeEnabled) {
      setError("Recording is disabled for end-to-end encrypted meetings.");
      return;
    }

    try {
      setIsMutating(true);
      setError("");

      const response = await startRecording(roomId);

      setRecordings((current) => [response.recording, ...current]);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to start recording",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteRecording(recordingId: string) {
    const confirmed = window.confirm(
      "Delete this recording? This removes the local file and metadata.",
    );

    if (!confirmed) return;

    try {
      setIsMutating(true);
      setError("");

      await deleteRecording(recordingId);

      setRecordings((current) =>
        current.filter((recording) => recording.id !== recordingId),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to delete recording",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleStopRecording() {
    try {
      setIsMutating(true);
      setError("");

      const response = await stopRecording(roomId);

      setRecordings((current) =>
        current.map((recording) =>
          recording.id === response.recording.id
            ? response.recording
            : recording,
        ),
      );

      window.setTimeout(() => {
        void refreshRecordings();
      }, 1500);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to stop recording",
      );
    } finally {
      setIsMutating(false);
    }
  }

  useEffect(() => {
    void refreshRecordings();
  }, [roomId, isHost]);

  if (!isHost) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Recording</h2>
          {/* {isE2eeEnabled && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Recording is disabled because this meeting is end-to-end
              encrypted.
            </div>
          )} */}
          {isE2eeEnabled && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">Recording disabled</p>
              <p className="mt-1">
                End-to-end encrypted media cannot be decoded by the server, so
                server-side recording is disabled for this meeting.
              </p>
            </div>
          )}
          <p className="mt-1 text-sm text-slate-400">
            Host-only recording controls and playback.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshRecordings}
            disabled={isLoading || isMutating}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>

          {activeRecording || isRecordingActive ? (
            <button
              type="button"
              onClick={handleStopRecording}
              disabled={isMutating || isE2eeEnabled}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={isMutating || isE2eeEnabled}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Record
            </button>
          )}
        </div>
      </div>

      {(activeRecording || isRecordingActive) && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Recording in progress. Stop recording to generate playback.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {isLoading && (
          <p className="text-sm text-slate-400">Loading recordings...</p>
        )}

        {!isLoading && recordings.length === 0 && (
          <p className="text-sm text-slate-500">No recordings yet.</p>
        )}

        {recordings.map((recording) => {
          const playbackHref = buildServerUrl(recording.playbackUrl);
          const downloadHref = buildServerUrl(recording.downloadUrl);

          return (
            <div
              key={recording.id}
              className={`rounded-xl border px-4 py-3 text-sm ${getRecordingStatusClass(
                recording.status,
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {getRecordingStatusLabel(recording.status)}
                  </p>

                  <p className="mt-1 opacity-80">
                    Duration: {formatDuration(recording.durationSec)} · Size:{" "}
                    {formatFileSize(recording.sizeBytes)}
                  </p>

                  <p className="mt-1 text-xs opacity-60">
                    Started: {new Date(recording.startedAt).toLocaleString()}
                  </p>

                  {recording.errorMessage && (
                    <p className="mt-2 text-rose-200">
                      Error: {recording.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  {recording.status === "READY" && playbackHref && (
                    <a
                      href={playbackHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-slate-950/40 px-3 py-2 font-semibold text-white hover:bg-slate-950/60"
                    >
                      Play
                    </a>
                  )}

                  {recording.status === "READY" && downloadHref && (
                    <a
                      href={downloadHref}
                      className="rounded-lg bg-slate-950/40 px-3 py-2 font-semibold text-white hover:bg-slate-950/60"
                    >
                      Download
                    </a>
                  )}

                  {recording.status !== "READY" && (
                    <span className="rounded-lg bg-slate-950/30 px-3 py-2 opacity-70">
                      Not ready
                    </span>
                  )}

                  {recording.status !== "PROCESSING" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRecording(recording.id)}
                      disabled={isMutating}
                      className="rounded-lg bg-rose-500/20 px-3 py-2 font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
