const KEY_VERSION = "meetly-e2ee-v1";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export async function generateRawE2eeKey() {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );

  const rawKey = await window.crypto.subtle.exportKey("raw", key);

  return arrayBufferToBase64(rawKey);
}

export async function importE2eeKey(rawKeyBase64: string) {
  const rawKey = base64ToArrayBuffer(rawKeyBase64.trim());

  return window.crypto.subtle.importKey(
    "raw",
    rawKey,
    {
      name: "AES-GCM",
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export function formatE2eeKeyForSharing(rawKeyBase64: string) {
  return `${KEY_VERSION}.${rawKeyBase64}`;
}

export function parseSharedE2eeKey(sharedKey: string) {
  const trimmed = sharedKey.trim();

  if (!trimmed.startsWith(`${KEY_VERSION}.`)) {
    throw new Error("Invalid Meetly E2EE key format");
  }

  return trimmed.slice(`${KEY_VERSION}.`.length);
}

export function isValidSharedE2eeKey(sharedKey: string) {
  try {
    parseSharedE2eeKey(sharedKey);
    return true;
  } catch {
    return false;
  }
}
