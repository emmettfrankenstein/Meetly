import { io } from "socket.io-client";
import { clientEnv } from "../config/env";

// const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const SERVER_URL = clientEnv.serverUrl;

export const socket = io(SERVER_URL, {
  autoConnect: false,
  withCredentials: true,
});
