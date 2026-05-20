const RECORDING_PREFIX = "meetly-recording-e2ee-v1";

export type EncryptedRecordingMetadata = {
  version: "meetly-recording-e2ee-v1";
  iv: string;
  originalType: string;
  encryptedAt: string;
  durationSec?: number;
  startedAt?: string;
};

export type EncryptedRecordingResult = {
  encryptedBlob: Blob;
  metadata: EncryptedRecordingMetadata;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function base64ToArrayBuffer(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export async function encryptRecordingBlob(input: {
  recordingBlob: Blob;
  key: CryptoKey;
}): Promise<EncryptedRecordingResult> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const recordingBuffer = await input.recordingBlob.arrayBuffer();

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.key,
    recordingBuffer,
  );

  return {
    encryptedBlob: new Blob([encryptedBuffer], {
      type: "application/octet-stream",
    }),
    metadata: {
      version: RECORDING_PREFIX,
      iv: arrayBufferToBase64(iv.buffer),
      originalType: input.recordingBlob.type || "video/webm",
      encryptedAt: new Date().toISOString(),
    },
  };
}

export async function decryptRecordingBlob(input: {
  encryptedBlob: Blob;
  metadata: EncryptedRecordingMetadata;
  key: CryptoKey;
}) {
  const encryptedBuffer = await input.encryptedBlob.arrayBuffer();
  const iv = base64ToArrayBuffer(input.metadata.iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.key,
    encryptedBuffer,
  );

  return new Blob([decryptedBuffer], {
    type: input.metadata.originalType || "video/webm",
  });
}

export function createEncryptedRecordingPackage(input: {
  encryptedBlob: Blob;
  metadata: EncryptedRecordingMetadata;
}) {
  const metadataBlob = new Blob([JSON.stringify(input.metadata, null, 2)], {
    type: "application/json",
  });

  return {
    encryptedBlob: input.encryptedBlob,
    metadataBlob,
  };
}
