import path from "path";
import fs from "fs/promises";
import type { Server } from "socket.io";
import { z } from "zod";

import { Router } from "express";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middleware/requireAuth";
import {
  getActiveRecordingSession,
  startRecordingSession,
  stopRecordingSession,
  listActiveRecordingSessions,
} from "./recording.manager";
import { deleteRecordingDir } from "./recording.storage";
import { checkFfmpegAvailable, getFfmpegPath } from "./ffmpeg.process";
import { cleanupExpiredRecordings } from "./recording.cleanup";

import { env } from "../../config/env";
import { recordingLimiter } from "../../middleware/rateLimiters";

export const recordingRouter = Router();

let io: Server | null = null;

export function setRecordingSocketServer(socketServer: Server) {
  io = socketServer;
}

recordingRouter.use(requireAuth);

const roomIdParamSchema = z.object({
  roomId: z.string().min(3).max(64),
});

const recordingIdParamSchema = z.object({
  recordingId: z.string().min(10).max(128),
});

recordingRouter.get("/meetings/:roomId/recordings", async (req, res) => {
  try {
    const userId = req.user!.id;

    const { roomId } = roomIdParamSchema.parse(req.params);

    const meeting = await prisma.meeting.findUnique({
      where: {
        roomId,
      },
      include: {
        recordings: {
          orderBy: {
            startedAt: "desc",
          },
        },
      },
    });

    if (!meeting) {
      res.status(404).json({ message: "Meeting not found" });
      return;
    }

    const isOwner = meeting.createdById === userId;

    if (!isOwner) {
      res
        .status(403)
        .json({ message: "Only the host can view recordings for now" });
      return;
    }

    res.json({
      recordings: meeting.recordings,
    });
  } catch (error) {
    console.error("Failed to list recordings:", error);
    res.status(500).json({ message: "Failed to list recordings" });
  }
});

recordingRouter.post(
  "/meetings/:roomId/recordings/start",
  recordingLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { roomId } = roomIdParamSchema.parse(req.params);

      const meeting = await prisma.meeting.findUnique({
        where: {
          roomId,
        },
      });

      if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
      }

      if (meeting.createdById !== userId) {
        res.status(403).json({ message: "Only the host can start recording" });
        return;
      }

      if (meeting.isE2eeEnabled) {
        console.warn("Blocked recording attempt for E2EE meeting:", {
          roomId,
          meetingId: meeting.id,
          userId,
        });

        res.status(400).json({
          message: "Recording is disabled for end-to-end encrypted meetings",
        });
        return;
      }
      const activeRecording = await prisma.recording.findFirst({
        where: {
          meetingId: meeting.id,
          status: "PROCESSING",
        },
      });

      if (activeRecording) {
        res.status(409).json({
          message: "A recording is already in progress",
          recording: activeRecording,
        });
        return;
      }

      const activeSession = getActiveRecordingSession(roomId);

      if (activeSession) {
        res.status(409).json({
          message: "A recording session is already active",
          session: activeSession,
        });
        return;
      }

      const recording = await prisma.recording.create({
        data: {
          meetingId: meeting.id,
          createdById: userId,
          status: "PROCESSING",
        },
      });

      await startRecordingSession({
        roomId,
        meetingId: meeting.id,
        recordingId: recording.id,
        startedByUserId: userId,
      });

      io?.to(roomId).emit("recording:started", {
        recordingId: recording.id,
        roomId,
        startedByUserId: userId,
        startedAt: recording.startedAt,
      });

      res.status(201).json({
        recording,
        message: "Recording session started",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      res.status(500).json({ message: "Failed to start recording" });
    }
  },
);

recordingRouter.post(
  "/meetings/:roomId/recordings/stop",
  recordingLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { roomId } = roomIdParamSchema.parse(req.params);

      const meeting = await prisma.meeting.findUnique({
        where: {
          roomId,
        },
      });

      if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
      }

      if (meeting.createdById !== userId) {
        res.status(403).json({ message: "Only the host can stop recording" });
        return;
      }

      const activeRecording = await prisma.recording.findFirst({
        where: {
          meetingId: meeting.id,
          status: "PROCESSING",
        },
        orderBy: {
          startedAt: "desc",
        },
      });

      if (!activeRecording) {
        res.status(404).json({ message: "No active recording found" });
        return;
      }

      const recording = await stopRecordingSession(roomId);

      if (!recording) {
        const stoppedAt = new Date();
        const durationSec = Math.max(
          0,
          Math.round(
            (stoppedAt.getTime() - activeRecording.startedAt.getTime()) / 1000,
          ),
        );

        const fallbackRecording = await prisma.recording.update({
          where: {
            id: activeRecording.id,
          },
          data: {
            status: "STOPPED",
            stoppedAt,
            durationSec,
          },
        });

        io?.to(roomId).emit("recording:stopped", {
          recordingId: fallbackRecording.id,
          roomId,
          stoppedAt: fallbackRecording.stoppedAt,
          status: fallbackRecording.status,
        });

        res.json({
          recording: fallbackRecording,
          message: "Recording stopped without active worker session",
        });

        return;
      }

      io?.to(roomId).emit("recording:stopped", {
        recordingId: recording.id,
        roomId,
        stoppedAt: recording.stoppedAt,
        status: recording.status,
      });

      res.json({
        recording,
        message: "Recording session stopped",
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
      res.status(500).json({ message: "Failed to stop recording" });
    }
  },
);

recordingRouter.get("/recordings/active-sessions", async (req, res) => {
  if (env.NODE_ENV === "production") {
    res.status(404).json({ message: "Not found" });
    return;
  }
  try {
    const sessions = listActiveRecordingSessions();

    res.json({
      sessions,
    });
  } catch (error) {
    console.error("Failed to list active recording sessions:", error);
    res
      .status(500)
      .json({ message: "Failed to list active recording sessions" });
  }
});

recordingRouter.get("/recordings/ffmpeg-health", async (req, res) => {
  if (env.NODE_ENV === "production") {
    res.status(404).json({ message: "Not found" });
    return;
  }
  try {
    const available = await checkFfmpegAvailable();

    res.json({
      available,
      ffmpegPath: getFfmpegPath(),
    });
  } catch (error) {
    console.error("Failed to check FFmpeg:", error);
    res.status(500).json({
      available: false,
      message: "Failed to check FFmpeg",
    });
  }
});

recordingRouter.get("/recordings/:recordingId/play", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { recordingId } = recordingIdParamSchema.parse(req.params);

    const recording = await prisma.recording.findUnique({
      where: {
        id: recordingId,
      },
      include: {
        meeting: true,
      },
    });

    if (!recording) {
      res.status(404).json({ message: "Recording not found" });
      return;
    }

    if (recording.meeting.createdById !== userId) {
      res
        .status(403)
        .json({ message: "Only the host can play this recording" });
      return;
    }

    if (!recording.storageKey) {
      res.status(404).json({ message: "Recording file not available" });
      return;
    }

    const filePath = path.resolve(recording.storageKey);

    await fs.access(filePath);

    res.setHeader("Content-Type", "video/webm");
    res.sendFile(filePath);
  } catch (error) {
    console.error("Failed to play recording:", error);
    res.status(500).json({ message: "Failed to play recording" });
  }
});

recordingRouter.get("/recordings/:recordingId/download", async (req, res) => {
  try {
    const userId = req.user!.id;
    const { recordingId } = recordingIdParamSchema.parse(req.params);

    const recording = await prisma.recording.findUnique({
      where: {
        id: recordingId,
      },
      include: {
        meeting: true,
      },
    });

    if (!recording) {
      res.status(404).json({ message: "Recording not found" });
      return;
    }

    if (recording.meeting.createdById !== userId) {
      res
        .status(403)
        .json({ message: "Only the host can download this recording" });
      return;
    }

    if (recording.status !== "READY") {
      res.status(400).json({ message: "Recording is not ready for download" });
      return;
    }

    if (!recording.storageKey) {
      res.status(404).json({ message: "Recording file not available" });
      return;
    }

    const filePath = path.resolve(recording.storageKey);

    await fs.access(filePath);

    const filename = `meetly-${recording.meeting.roomId}-${recording.id}.webm`;

    res.download(filePath, filename);
  } catch (error) {
    console.error("Failed to download recording:", error);
    res.status(500).json({ message: "Failed to download recording" });
  }
});

recordingRouter.delete(
  "/recordings/:recordingId",
  recordingLimiter,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { recordingId } = recordingIdParamSchema.parse(req.params);

      const recording = await prisma.recording.findUnique({
        where: {
          id: recordingId,
        },
        include: {
          meeting: true,
        },
      });

      if (!recording) {
        res.status(404).json({ message: "Recording not found" });
        return;
      }

      if (recording.meeting.createdById !== userId) {
        res
          .status(403)
          .json({ message: "Only the host can delete this recording" });
        return;
      }

      if (recording.status === "PROCESSING") {
        res.status(400).json({
          message: "Stop the active recording before deleting it",
        });
        return;
      }

      await deleteRecordingDir(recording.id);

      await prisma.recording.delete({
        where: {
          id: recording.id,
        },
      });

      res.json({
        deleted: true,
        recordingId,
      });
    } catch (error) {
      console.error("Failed to delete recording:", error);
      res.status(500).json({ message: "Failed to delete recording" });
    }
  },
);
recordingRouter.post("/recordings/cleanup-expired", async (req, res) => {
  if (env.NODE_ENV === "production") {
    res.status(404).json({ message: "Not found" });
    return;
  }
  try {
    const result = await cleanupExpiredRecordings();

    res.json(result);
  } catch (error) {
    console.error("Failed to cleanup expired recordings:", error);
    res.status(500).json({ message: "Failed to cleanup expired recordings" });
  }
});
