import fs from "fs/promises";
import path from "path";
import { env } from "../../config/env";

export function getE2eeRecordingDirectory(recordingId: string) {
  return path.resolve(env.RECORDINGS_DIR, "e2ee", recordingId);
}

export function getE2eeRecordingFilePath(recordingId: string) {
  return path.join(
    getE2eeRecordingDirectory(recordingId),
    "recording.encrypted",
  );
}

export function getE2eeRecordingMetadataPath(recordingId: string) {
  return path.join(getE2eeRecordingDirectory(recordingId), "metadata.json");
}

export async function ensureE2eeRecordingDirectory(recordingId: string) {
  await fs.mkdir(getE2eeRecordingDirectory(recordingId), {
    recursive: true,
  });
}

export async function writeE2eeRecordingMetadata(input: {
  recordingId: string;
  metadata: unknown;
}) {
  await fs.writeFile(
    getE2eeRecordingMetadataPath(input.recordingId),
    JSON.stringify(input.metadata, null, 2),
    "utf8",
  );
}

export async function deleteE2eeRecordingDirectory(recordingId: string) {
  await fs.rm(getE2eeRecordingDirectory(recordingId), {
    recursive: true,
    force: true,
  });
}
