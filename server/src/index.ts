import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes";
import { meetingRouter } from "./modules/meetings/meeting.routes";
import { prisma } from "./db/prisma";
import { initMediasoupWorkers } from "./modules/sfu/sfu.worker";
import { registerSfuSocketHandlers } from "./modules/sfu/sfu.socket";
import {
  recordingRouter,
  setRecordingSocketServer,
} from "./modules/recordings/recording.routes";
import { cleanupExpiredRecordings } from "./modules/recordings/recording.cleanup";
import { isRoomRecording } from "./modules/recordings/recording.manager";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { apiLimiter } from "./middleware/rateLimiters";
import { env, allowedOrigins } from "./config/env";
import { e2eeRecordingRouter } from "./modules/recordings/e2eeRecording.routes";

dotenv.config();

const app = express();

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  }),
);

const server = http.createServer(app);

const PORT = env.PORT;

const CLIENT_URLS = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

type E2eePublicKeyEntry = {
  socketId: string;
  username: string;
  publicKeyJwk: JsonWebKey;
};

const roomE2eePublicKeys = new Map<string, Map<string, E2eePublicKeyEntry>>();

type RoomUser = {
  socketId: string;
  username: string;
  userId?: string;
  role: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
};

const roomUsers = new Map<string, RoomUser[]>();
const socketToRoom = new Map<string, string>();
const socketToUser = new Map<string, RoomUser>();

function getRoomUsers(roomId: string) {
  return roomUsers.get(roomId) || [];
}

async function getRecentChatMessages(roomId: string) {
  return prisma.chatMessage.findMany({
    where: {
      roomId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });
}

async function saveChatMessage(input: {
  type: "user" | "system";
  message: string;
  username: string;
  socketId?: string;
  userId?: string;
  roomId: string;
}) {
  const meeting = await prisma.meeting.findUnique({
    where: {
      roomId: input.roomId,
    },
    select: {
      id: true,
    },
  });

  return prisma.chatMessage.create({
    data: {
      type: input.type,
      message: input.message,
      username: input.username,
      socketId: input.socketId,
      userId: input.userId,
      roomId: input.roomId,
      meetingId: meeting?.id,
    },
  });
}

function isSocketHost(socketId: string) {
  const roomId = socketToRoom.get(socketId);

  if (!roomId) return false;

  const users = roomUsers.get(roomId) || [];

  const user = users.find((participant) => participant.socketId === socketId);

  return user?.role === "host";
}

function addUserToRoom(roomId: string, user: RoomUser) {
  const users = getRoomUsers(roomId);

  const alreadyExists = users.some(
    (existingUser) => existingUser.socketId === user.socketId,
  );

  if (alreadyExists) return users;

  const updatedUsers = [...users, user];
  roomUsers.set(roomId, updatedUsers);

  socketToRoom.set(user.socketId, roomId);
  socketToUser.set(user.socketId, user);

  return updatedUsers;
}

function removeUserFromRoom(socketId: string) {
  const roomId = socketToRoom.get(socketId);
  const user = socketToUser.get(socketId);

  if (!roomId || !user) {
    return null;
  }

  const updatedUsers = getRoomUsers(roomId).filter(
    (roomUser) => roomUser.socketId !== socketId,
  );

  if (updatedUsers.length === 0) {
    roomUsers.delete(roomId);
  } else {
    roomUsers.set(roomId, updatedUsers);
  }

  socketToRoom.delete(socketId);
  socketToUser.delete(socketId);

  return {
    roomId,
    user,
    users: updatedUsers,
  };
}

function getSocketRoomId(socketId: string) {
  return socketToRoom.get(socketId);
}

function getRoomHostSocketId(roomId: string) {
  const users = roomUsers.get(roomId) || [];
  return users.find((participant) => participant.role === "host")?.socketId;
}

function getSocketUsername(socketId: string) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return "Guest";

  const users = roomUsers.get(roomId) || [];
  return (
    users.find((participant) => participant.socketId === socketId)?.username ||
    "Guest"
  );
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/meetings", meetingRouter);

app.use("/api", recordingRouter);
app.use(e2eeRecordingRouter);

app.get("/health", async (_req, res) => {
  res.json({
    ok: true,
    service: "meetly-server",
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setRecordingSocketServer(io);

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  registerSfuSocketHandlers(io, socket);

  socket.on(
    "join-room",
    async ({ roomId, username, userId, role, isMicOn, isCameraOn }) => {
      socket.join(roomId);

      const user: RoomUser = {
        socketId: socket.id,
        username: username || "Anonymous",
        userId,
        role: role === "host" ? "host" : "guest",
        isMicOn: Boolean(isMicOn),
        isCameraOn: Boolean(isCameraOn),
      };

      const users = addUserToRoom(roomId, user);

      console.log(`${user.username} joined room ${roomId} as ${user.role}`);

      const chatHistory = await getRecentChatMessages(roomId);

      socket.emit("recording:state", {
        isRecording: isRoomRecording(roomId),
        roomId,
      });

      socket.emit("joined-room", {
        roomId,
        socketId: socket.id,
        users,
        chatMessages: chatHistory,
      });

      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        username: user.username,
      });

      io.to(roomId).emit("participants-updated", {
        users,
      });

      // socket.to(roomId).emit("chat-message", {
      //   id: crypto.randomUUID(),
      //   type: "system",
      //   message: `${user.username} joined the room`,
      //   username: "System",
      //   createdAt: new Date().toISOString(),
      // });

      const systemMessage = await saveChatMessage({
        type: "system",
        message: `${user.username} joined the room`,
        username: "System",
        roomId,
      });

      socket.to(roomId).emit("chat-message", systemMessage);
    },
  );

  socket.on("offer", ({ targetSocketId, offer }) => {
    socket.to(targetSocketId).emit("offer", {
      fromSocketId: socket.id,
      offer,
    });
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    socket.to(targetSocketId).emit("answer", {
      fromSocketId: socket.id,
      answer,
    });
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit("ice-candidate", {
      fromSocketId: socket.id,
      candidate,
    });
  });

  socket.on(
    "e2ee:public-key",
    (payload: { roomId: string; publicKeyJwk: JsonWebKey }) => {
      const actualRoomId = getSocketRoomId(socket.id);

      if (!actualRoomId || actualRoomId !== payload.roomId) {
        socket.emit("e2ee:error", {
          message: "You must join the room before publishing an E2EE key.",
        });
        return;
      }

      const username = getSocketUsername(socket.id);

      let roomKeys = roomE2eePublicKeys.get(payload.roomId);

      if (!roomKeys) {
        roomKeys = new Map();
        roomE2eePublicKeys.set(payload.roomId, roomKeys);
      }

      const entry: E2eePublicKeyEntry = {
        socketId: socket.id,
        username,
        publicKeyJwk: payload.publicKeyJwk,
      };

      roomKeys.set(socket.id, entry);

      const existingKeys = [...roomKeys.values()].filter(
        (peer) => peer.socketId !== socket.id,
      );

      existingKeys.forEach((peer) => {
        socket.emit("e2ee:peer-public-key", peer);
      });

      socket.to(payload.roomId).emit("e2ee:peer-public-key", entry);
    },
  );

  socket.on("e2ee:request-room-key", (payload: { roomId: string }) => {
    const actualRoomId = getSocketRoomId(socket.id);

    if (!actualRoomId || actualRoomId !== payload.roomId) {
      socket.emit("e2ee:error", {
        message: "You must join the room before requesting an E2EE key.",
      });
      return;
    }

    const hostSocketId = getRoomHostSocketId(payload.roomId);

    if (!hostSocketId) {
      socket.emit("e2ee:error", {
        message: "No host is available to provide the encrypted room key.",
      });
      return;
    }

    io.to(hostSocketId).emit("e2ee:room-key-requested", {
      roomId: payload.roomId,
      requesterSocketId: socket.id,
      username: getSocketUsername(socket.id),
    });
  });

  socket.on(
    "e2ee:encrypted-room-key",
    (payload: {
      roomId: string;
      targetSocketId: string;
      encryptedRoomKey: {
        version: "meetly-e2ee-room-key-v1";
        iv: string;
        ciphertext: string;
      };
    }) => {
      const actualRoomId = getSocketRoomId(socket.id);

      if (!actualRoomId || actualRoomId !== payload.roomId) {
        socket.emit("e2ee:error", {
          message: "You must join the room before sending an E2EE key.",
        });
        return;
      }

      if (!isSocketHost(socket.id)) {
        socket.emit("e2ee:error", {
          message: "Only the host can distribute E2EE room keys.",
        });
        return;
      }

      io.to(payload.targetSocketId).emit("e2ee:encrypted-room-key", {
        roomId: payload.roomId,
        senderSocketId: socket.id,
        encryptedRoomKey: payload.encryptedRoomKey,
      });
    },
  );

  socket.on("chat-message", async ({ roomId, message }) => {
    const user = socketToUser.get(socket.id);

    if (!user) return;

    const trimmedMessage = String(message || "").trim();

    if (!trimmedMessage) return;

    if (trimmedMessage.length > 1000) {
      socket.emit("chat-error", {
        message: "Message is too long. Please keep it under 1000 characters.",
      });

      return;
    }

    const savedMessage = await saveChatMessage({
      type: "user",
      message: trimmedMessage,
      username: user.username,
      socketId: socket.id,
      userId: user.userId,
      roomId,
    });

    io.to(roomId).emit("chat-message", savedMessage);

    // io.to(roomId).emit("chat-message", {
    //   id: crypto.randomUUID(),
    //   type: "user",
    //   message: trimmedMessage,
    //   username: user.username,
    //   socketId: socket.id,
    //   createdAt: new Date().toISOString(),
    // });
  });

  socket.on("end-meeting", ({ roomId }) => {
    if (!isSocketHost(socket.id)) {
      socket.emit("room-error", {
        message: "Only the host can perform this action",
      });
      return;
    }

    const user = socketToUser.get(socket.id);

    if (!user || user.role !== "host") {
      socket.emit("meeting-error", {
        message: "Only the host can end this meeting",
      });

      return;
    }

    io.to(roomId).emit("meeting-ended", {
      message: "The host ended the meeting",
    });

    const users = getRoomUsers(roomId);

    users.forEach((roomUser) => {
      const targetSocket = io.sockets.sockets.get(roomUser.socketId);
      targetSocket?.leave(roomId);

      socketToRoom.delete(roomUser.socketId);
      socketToUser.delete(roomUser.socketId);
    });

    roomUsers.delete(roomId);
  });

  socket.on("media-status-updated", ({ isMicOn, isCameraOn }) => {
    const roomId = socketToRoom.get(socket.id);
    const currentUser = socketToUser.get(socket.id);

    if (!roomId || !currentUser) return;

    const users = getRoomUsers(roomId).map((user) => {
      if (user.socketId !== socket.id) return user;

      return {
        ...user,
        isMicOn: Boolean(isMicOn),
        isCameraOn: Boolean(isCameraOn),
      };
    });

    roomUsers.set(roomId, users);

    socketToUser.set(socket.id, {
      ...currentUser,
      isMicOn: Boolean(isMicOn),
      isCameraOn: Boolean(isCameraOn),
    });

    io.to(roomId).emit("participants-updated", {
      users,
    });
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const result = removeUserFromRoom(socket.id);

    if (!result) return;

    const { roomId, user, users } = result;
    // const roomId = socketToRoom.get(socket.id);

    if (roomId) {
      const roomKeys = roomE2eePublicKeys.get(roomId);

      if (roomKeys) {
        roomKeys.delete(socket.id);

        if (roomKeys.size === 0) {
          roomE2eePublicKeys.delete(roomId);
        }
      }

      socket.to(roomId).emit("e2ee:peer-left", {
        socketId: socket.id,
      });
    }

    socket.to(roomId).emit("user-left", {
      socketId: socket.id,
    });

    io.to(roomId).emit("participants-updated", {
      users,
    });

    const systemMessage = await saveChatMessage({
      type: "system",
      message: `${user.username} left the room`,
      username: "System",
      roomId,
    });

    socket.to(roomId).emit("chat-message", systemMessage);

    // socket.to(roomId).emit("chat-message", {
    //   id: crypto.randomUUID(),
    //   type: "system",
    //   message: `${user.username} left the room`,
    //   username: "System",
    //   createdAt: new Date().toISOString(),
    // });
  });
});

// server.listen(PORT, () => {
//   console.log(`Meetly server running on http://localhost:${PORT}`);
// });

async function startServer() {
  await initMediasoupWorkers();

  cleanupExpiredRecordings().catch((error) => {
    console.error("Startup recording cleanup failed:", error);
  });

  server.listen(PORT, () => {
    console.log(`Meetly server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start Meetly server:", error);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down Meetly server...`);

  server.close(async () => {
    await prisma.$disconnect();
    console.log("Server and database connections closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
