import { clientEnv } from "../config/env";

// const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const API_URL = clientEnv.serverUrl;

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
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

export function signup(input: {
  username: string;
  email: string;
  password: string;
}) {
  return request<{ user: AuthUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return request<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export function getMe() {
  return request<{ user: AuthUser }>("/api/auth/me");
}
