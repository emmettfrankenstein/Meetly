import fs from "fs/promises";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth } from "../../middleware/requireAuth";
import { recordingLimiter } from "../../middleware/rateLimiters";
import {
  deleteE2eeRecordingDirectory,
  ensureE2eeRecordingDirectory,
  getE2eeRecordingFilePath,
  writeE2eeRecordingMetadata,
} from "./e2eeRecording.storage";

export const e2eeRecordingRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 5000, // 5000 MB
  },
});

const roomIdParamSchema = z.object({
  roomId: z.string().min(3).max(64),
});

const recordingIdParamSchema = z.object({
  recordingId: z.string().min(10).max(128),
});

const metadataSchema = z.object({
  version: z.literal("meetly-recording-e2ee-v1"),
  iv: z.string().min(8),
  originalType: z.string().min(1).max(100),
  encryptedAt: z.string().min(1),
  durationSec: z.coerce.number().int().positive().optional(),
  startedAt: z.string().optional(),
});

async function getMeetingForHost(roomId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    select: {
      id: true,
      roomId: true,
      createdById: true,
      isE2eeEnabled: true,
    },
  });

  if (!meeting) {
    return null;
  }

  if (meeting.createdById !== userId) {
    return null;
  }

  return meeting;
}

e2eeRecordingRouter.post(
  "/api/meetings/:roomId/e2ee-recordings",
  requireAuth,
  recordingLimiter,
  upload.single("recording"),
  async (req, res) => {
    try {
      const params = roomIdParamSchema.parse(req.params);

      const meeting = await getMeetingForHost(params.roomId, req.user!.id);

      if (!meeting) {
        return res.status(404).json({
          message: "Meeting not found or you are not the host.",
        });
      }

      if (!meeting.isE2eeEnabled) {
        return res.status(400).json({
          message:
            "Encrypted recording upload is only available for E2EE meetings.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Encrypted recording file is required.",
        });
      }

      const rawMetadata = req.body.metadata;

      if (typeof rawMetadata !== "string") {
        return res.status(400).json({
          message: "Recording metadata is required.",
        });
      }

      const metadata = metadataSchema.parse(JSON.parse(rawMetadata));

      const recording = await prisma.e2eeRecording.create({
        data: {
          meetingId: meeting.id,
          createdById: req.user!.id,
          storageKey: "",
          metadata,
          sizeBytes: req.file.size,
          durationSec: metadata.durationSec,
          startedAt: metadata.startedAt
            ? new Date(metadata.startedAt)
            : undefined,
        },
      });

      await ensureE2eeRecordingDirectory(recording.id);

      const filePath = getE2eeRecordingFilePath(recording.id);
      await fs.writeFile(filePath, req.file.buffer);

      const storageKey = `e2ee/${recording.id}/recording.encrypted`;

      await writeE2eeRecordingMetadata({
        recordingId: recording.id,
        metadata,
      });

      const updatedRecording = await prisma.e2eeRecording.update({
        where: { id: recording.id },
        data: {
          storageKey,
        },
      });

      return res.status(201).json({
        recording: updatedRecording,
      });
    } catch (error) {
      console.error("Failed to upload E2EE recording:", error);

      return res.status(400).json({
        message: "Failed to upload encrypted recording.",
      });
    }
  },
);

e2eeRecordingRouter.get(
  "/api/meetings/:roomId/e2ee-recordings",
  requireAuth,
  async (req, res) => {
    try {
      const params = roomIdParamSchema.parse(req.params);

      const meeting = await getMeetingForHost(params.roomId, req.user!.id);

      if (!meeting) {
        return res.status(404).json({
          message: "Meeting not found or you are not the host.",
        });
      }

      const recordings = await prisma.e2eeRecording.findMany({
        where: {
          meetingId: meeting.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json({ recordings });
    } catch {
      return res.status(400).json({
        message: "Failed to load encrypted recordings.",
      });
    }
  },
);

e2eeRecordingRouter.get(
  "/api/e2ee-recordings/:recordingId/download",
  requireAuth,
  async (req, res) => {
    try {
      const params = recordingIdParamSchema.parse(req.params);

      const recording = await prisma.e2eeRecording.findUnique({
        where: {
          id: params.recordingId,
        },
        include: {
          meeting: {
            select: {
              createdById: true,
            },
          },
        },
      });

      if (!recording || recording.meeting.createdById !== req.user!.id) {
        return res.status(404).json({
          message: "Recording not found.",
        });
      }

      const filePath = getE2eeRecordingFilePath(recording.id);

      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="meetly-e2ee-${recording.id}.encrypted"`,
      );

      return res.sendFile(filePath);
    } catch (error) {
      console.error("Failed to download E2EE recording:", error);

      return res.status(400).json({
        message: "Failed to download encrypted recording.",
      });
    }
  },
);

e2eeRecordingRouter.delete(
  "/api/e2ee-recordings/:recordingId",
  requireAuth,
  recordingLimiter,
  async (req, res) => {
    try {
      const params = recordingIdParamSchema.parse(req.params);

      const recording = await prisma.e2eeRecording.findUnique({
        where: {
          id: params.recordingId,
        },
        include: {
          meeting: {
            select: {
              createdById: true,
            },
          },
        },
      });

      if (!recording || recording.meeting.createdById !== req.user!.id) {
        return res.status(404).json({
          message: "Recording not found.",
        });
      }

      await deleteE2eeRecordingDirectory(recording.id);

      await prisma.e2eeRecording.delete({
        where: {
          id: recording.id,
        },
      });

      return res.status(204).send();
    } catch {
      return res.status(400).json({
        message: "Failed to delete encrypted recording.",
      });
    }
  },
);
