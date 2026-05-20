import { prisma } from "../../db/prisma";
import type { RecordingSession } from "./recording.types";
import {
  ensureRecordingDir,
  getFileSizeBytes,
  getRecordingOutputPath,
  getRecordingSdpPath,
} from "./recording.storage";
import {
  checkFfmpegAvailable,
  spawnFfmpegForSdpRecording,
  stopFfmpegProcess,
} from "./ffmpeg.process";

import fs from "fs/promises";
import {
  createRecordingConsumersForRoom,
  resumeRecordingConsumers,
} from "./recording.rtp";
import { createRecordingSdp } from "./recording.sdp";

import {
  defaultRecordingPolicy,
  describeRecordingSelection,
} from "./recording.policy";

const sessionsByRoomId = new Map<string, RecordingSession>();

export function getActiveRecordingSession(roomId: string) {
  return sessionsByRoomId.get(roomId) || null;
}

export function isRoomRecording(roomId: string) {
  return sessionsByRoomId.has(roomId);
}

export async function startRecordingSession(input: {
  roomId: string;
  meetingId: string;
  recordingId: string;
  startedByUserId: string;
}) {
  const existingSession = sessionsByRoomId.get(input.roomId);

  if (existingSession) {
    throw new Error("A recording session is already active for this room");
  }

  const session: RecordingSession = {
    recordingId: input.recordingId,
    roomId: input.roomId,
    meetingId: input.meetingId,
    startedByUserId: input.startedByUserId,
    status: "starting",
    startedAt: new Date(),
    policy: defaultRecordingPolicy,
    consumers: [],
  };

  sessionsByRoomId.set(input.roomId, session);

  try {
    /**
     * Next milestone:
     * - create mediasoup PlainTransport
     * - consume active producers
     * - pipe RTP into FFmpeg
     * - write output file
     */

    const ffmpegAvailable = await checkFfmpegAvailable();

    if (!ffmpegAvailable) {
      throw new Error(
        "FFmpeg is not available. Install FFmpeg or set FFMPEG_PATH.",
      );
    }

    await ensureRecordingDir(input.recordingId);

    session.outputPath = getRecordingOutputPath(input.recordingId);
    session.sdpPath = getRecordingSdpPath(input.recordingId);

    // session.consumers = await createRecordingConsumersForRoom(input.roomId);

    const selectedProducers = describeRecordingSelection(
      input.roomId,
      session.policy,
    );

    console.log("Recording producer selection:", {
      roomId: input.roomId,
      selectedProducers,
    });

    session.consumers = await createRecordingConsumersForRoom(
      input.roomId,
      session.policy,
    );

    if (session.consumers.length === 0) {
      throw new Error(
        "No recordable media producers found. Ask a participant to turn on camera or microphone before recording.",
      );
    }

    const sdp = createRecordingSdp(session.consumers);

    await fs.writeFile(session.sdpPath, sdp, "utf8");

    session.ffmpegProcess = spawnFfmpegForSdpRecording({
      sdpPath: session.sdpPath,
      outputPath: session.outputPath,
      onOutput: (line) => {
        session.ffmpegLastOutput = line.slice(-2000);
      },
    });

    session.ffmpegProcess.once("close", async (code, signal) => {
      console.log("FFmpeg recording process closed:", {
        roomId: input.roomId,
        recordingId: input.recordingId,
        code,
        signal,
      });

      const activeSession = sessionsByRoomId.get(input.roomId);

      if (
        activeSession?.recordingId === input.recordingId &&
        !activeSession.isStopping
      ) {
        activeSession.ffmpegExitCode = code;
        activeSession.ffmpegExitSignal = signal;

        await failRecordingSession(
          input.roomId,
          `FFmpeg exited unexpectedly with code ${code} signal ${signal}. Last output: ${
            activeSession.ffmpegLastOutput || "No FFmpeg output"
          }`,
        );
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await resumeRecordingConsumers(session.consumers);

    session.status = "recording";

    await prisma.recording.update({
      where: {
        id: input.recordingId,
      },
      data: {
        status: "PROCESSING",
        storageKey: session.outputPath,
      },
    });

    console.log("Recording session started:", {
      roomId: input.roomId,
      recordingId: input.recordingId,
      outputPath: session.outputPath,
      sdpPath: session.sdpPath,
      storageKey: session.outputPath,
    });
    console.log("Recording session started:", {
      roomId: input.roomId,
      recordingId: input.recordingId,
      outputPath: session.outputPath,
      sdpPath: session.sdpPath,
      consumerCount: session.consumers.length,
      consumers: session.consumers.map((consumerInfo) => ({
        producerId: consumerInfo.producerId,
        consumerId: consumerInfo.consumerId,
        kind: consumerInfo.kind,
        rtpPort: consumerInfo.rtpPort,
      })),
    });

    return session;
  } catch (error) {
    session.status = "failed";
    session.errorMessage =
      error instanceof Error ? error.message : "Recording session failed";

    sessionsByRoomId.delete(input.roomId);

    await prisma.recording.update({
      where: {
        id: input.recordingId,
      },
      data: {
        status: "FAILED",
        errorMessage: session.errorMessage,
      },
    });

    throw error;
  }
}

export async function stopRecordingSession(roomId: string) {
  const session = sessionsByRoomId.get(roomId);

  if (!session) {
    return null;
  }

  session.status = "stopping";
  session.isStopping = true;

  const stoppedAt = new Date();
  const durationSec = Math.max(
    0,
    Math.round((stoppedAt.getTime() - session.startedAt.getTime()) / 1000),
  );

  /**
   * Next milestone:
   * - stop FFmpeg process
   * - close mediasoup recording consumers/transports
   * - upload file to object storage
   * - set status READY if file exists
   */

  if (session.ffmpegProcess) {
    await stopFfmpegProcess(session.ffmpegProcess);
  }

  session.status = "stopped";
  session.stoppedAt = stoppedAt;

  session.consumers.forEach((consumerInfo) => {
    consumerInfo.consumer.close();
    consumerInfo.transport.close();
  });

  session.consumers = [];

  sessionsByRoomId.delete(roomId);

  const sizeBytes = session.outputPath
    ? await getFileSizeBytes(session.outputPath)
    : null;

  //   const finalStatus = sizeBytes && sizeBytes > 0 ? "READY" : "STOPPED";
  const minimumUsefulRecordingBytes = 50_000;

  const finalStatus =
    sizeBytes && sizeBytes >= minimumUsefulRecordingBytes ? "READY" : "FAILED";

  const errorMessage =
    finalStatus === "FAILED"
      ? `Recording file was too small or missing. Size: ${sizeBytes ?? 0} bytes. Last FFmpeg output: ${
          session.ffmpegLastOutput || "No FFmpeg output"
        }`
      : null;

  const recording = await prisma.recording.update({
    where: {
      id: session.recordingId,
    },
    data: {
      status: finalStatus,
      stoppedAt,
      durationSec,
      sizeBytes,
      storageKey: session.outputPath,
      playbackUrl:
        finalStatus === "READY"
          ? `/api/recordings/${session.recordingId}/play`
          : null,
      errorMessage,
      downloadUrl:
        finalStatus === "READY"
          ? `/api/recordings/${session.recordingId}/download`
          : null,
    },
  });

  console.log("Recording session stopped:", {
    roomId,
    recordingId: session.recordingId,
    durationSec,
  });

  return recording;
}

export async function failRecordingSession(
  roomId: string,
  errorMessage: string,
) {
  const session = sessionsByRoomId.get(roomId);

  if (!session) {
    return null;
  }

  session.status = "failed";
  session.errorMessage = errorMessage;

  sessionsByRoomId.delete(roomId);

  const recording = await prisma.recording.update({
    where: {
      id: session.recordingId,
    },
    data: {
      status: "FAILED",
      errorMessage,
      stoppedAt: new Date(),
    },
  });

  console.error("Recording session failed:", {
    roomId,
    recordingId: session.recordingId,
    errorMessage,
  });

  return recording;
}

export function listActiveRecordingSessions() {
  return Array.from(sessionsByRoomId.values());
}
