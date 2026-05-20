import { clientEnv } from "../config/env";

// const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const API_BASE_URL = clientEnv.serverUrl;

export type E2eeRecordingDto = {
  id: string;
  meetingId: string;
  createdById: string;
  status: "READY" | "FAILED";
  storageKey: string;
  metadata: unknown;
  sizeBytes: number;
  durationSec?: number | null;
  startedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Request failed");
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function uploadE2eeRecording(input: {
  roomId: string;
  encryptedBlob: Blob;
  metadata: unknown;
}) {
  const formData = new FormData();

  formData.append("recording", input.encryptedBlob, "recording.encrypted");
  formData.append("metadata", JSON.stringify(input.metadata));

  return request<{ recording: E2eeRecordingDto }>(
    `/api/meetings/${input.roomId}/e2ee-recordings`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function downloadE2eeRecordingBlob(recordingId: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/e2ee-recordings/${recordingId}/download`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Failed to download encrypted recording.");
  }

  return response.blob();
}

export async function listE2eeRecordings(roomId: string) {
  return request<{ recordings: E2eeRecordingDto[] }>(
    `/api/meetings/${roomId}/e2ee-recordings`,
  );
}

export async function deleteE2eeRecording(recordingId: string) {
  return request<null>(`/api/e2ee-recordings/${recordingId}`, {
    method: "DELETE",
  });
}
