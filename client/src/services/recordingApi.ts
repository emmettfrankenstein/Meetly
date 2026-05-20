import { clientEnv } from "../config/env";

// const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const API_BASE_URL = clientEnv.serverUrl;

export type RecordingStatus = "PROCESSING" | "READY" | "FAILED" | "STOPPED";

export type Recording = {
  id: string;
  meetingId: string;
  createdById: string;
  status: RecordingStatus;
  startedAt: string;
  stoppedAt?: string | null;
  durationSec?: number | null;
  storageKey?: string | null;
  playbackUrl?: string | null;
  downloadUrl?: string | null;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Recording request failed");
  }

  return data as T;
}

export async function listRecordings(roomId: string) {
  return request<{ recordings: Recording[] }>(
    `/api/meetings/${roomId}/recordings`,
  );
}

export async function startRecording(roomId: string) {
  return request<{ recording: Recording; message: string }>(
    `/api/meetings/${roomId}/recordings/start`,
    {
      method: "POST",
    },
  );
}

export async function stopRecording(roomId: string) {
  return request<{ recording: Recording; message: string }>(
    `/api/meetings/${roomId}/recordings/stop`,
    {
      method: "POST",
    },
  );
}

export async function deleteRecording(recordingId: string) {
  return request<{ deleted: true; recordingId: string }>(
    `/api/recordings/${recordingId}`,
    {
      method: "DELETE",
    },
  );
}
