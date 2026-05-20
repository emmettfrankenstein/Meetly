import { clientEnv } from "../config/env";

// const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const API_URL = clientEnv.serverUrl;

export type Meeting = {
  id: string;
  roomId: string;
  title: string | null;
  passcode: string;
  isE2eeEnabled: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateMeetingInput = {
  title?: string;
  passcode?: string;
  // isE2eeEnabled?: boolean;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

export function verifyMeetingPasscode(input: {
  roomId: string;
  passcode: string;
}) {
  return request<{ allowed: boolean; meeting: Meeting }>(
    `/api/meetings/${input.roomId}/verify-passcode`,
    {
      method: "POST",
      body: JSON.stringify({
        passcode: input.passcode,
      }),
    },
  );
}

export async function createMeeting(input: CreateMeetingInput) {
  return request<{ meeting: Meeting }>("/api/meetings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMeetings() {
  return request<{ meetings: Meeting[] }>("/api/meetings");
}

export function getMeetingByRoomId(roomId: string) {
  return request<{ meeting: Meeting }>(`/api/meetings/${roomId}`);
}
