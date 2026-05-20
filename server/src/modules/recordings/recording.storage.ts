import fs from "fs/promises";
import path from "path";
import { env } from "../../config/env";

const recordingsDir = env.RECORDINGS_DIR;

export function getRecordingsDir() {
  return path.resolve(process.cwd(), recordingsDir);
}

export function getRecordingDir(recordingId: string) {
  return path.join(getRecordingsDir(), recordingId);
}

export function getRecordingOutputPath(recordingId: string) {
  return path.join(getRecordingDir(recordingId), "recording.webm");
}

export function getRecordingSdpPath(recordingId: string) {
  return path.join(getRecordingDir(recordingId), "input.sdp");
}

export async function ensureRecordingDir(recordingId: string) {
  const directory = getRecordingDir(recordingId);

  await fs.mkdir(directory, {
    recursive: true,
  });

  return directory;
}

export async function getFileSizeBytes(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return null;
  }
}

export async function deleteRecordingDir(recordingId: string) {
  const directory = getRecordingDir(recordingId);

  await fs.rm(directory, {
    recursive: true,
    force: true,
  });
}
