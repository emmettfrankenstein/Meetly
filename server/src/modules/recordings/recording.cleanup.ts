import { prisma } from "../../db/prisma";
import { deleteRecordingDir } from "./recording.storage";

import { env } from "../../config/env";

function getRetentionDays() {
  return env.RECORDING_RETENTION_DAYS;
//   return Number(process.env.RECORDING_RETENTION_DAYS) || 30;
}

export async function cleanupExpiredRecordings() {
  const retentionDays = getRetentionDays();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expiredRecordings = await prisma.recording.findMany({
    where: {
      status: {
        in: ["READY", "FAILED", "STOPPED"],
      },
      createdAt: {
        lt: cutoff,
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      storageKey: true,
    },
  });

  for (const recording of expiredRecordings) {
    try {
      await deleteRecordingDir(recording.id);

      await prisma.recording.delete({
        where: {
          id: recording.id,
        },
      });

      console.log("Expired recording deleted:", {
        recordingId: recording.id,
        status: recording.status,
        createdAt: recording.createdAt,
      });
    } catch (error) {
      console.error("Failed to delete expired recording:", {
        recordingId: recording.id,
        error,
      });
    }
  }

  return {
    deletedCount: expiredRecordings.length,
    retentionDays,
  };
}
