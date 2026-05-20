const CHAT_PREFIX = "meetly-chat-e2ee-v1";

export type EncryptedChatPayload = {
  version: "meetly-chat-e2ee-v1";
  iv: string;
  ciphertext: string;
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

export function isEncryptedChatPayload(
  value: unknown,
): value is EncryptedChatPayload {
  if (typeof value !== "object" || value === null) return false;

  const payload = value as Partial<EncryptedChatPayload>;

  return (
    payload.version === CHAT_PREFIX &&
    typeof payload.iv === "string" &&
    typeof payload.ciphertext === "string"
  );
}

export function looksLikeEncryptedChatMessage(value: string) {
  try {
    return isEncryptedChatPayload(JSON.parse(value));
  } catch {
    return false;
  }
}

export async function encryptChatMessage(input: {
  message: string;
  key: CryptoKey;
}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedMessage = new TextEncoder().encode(input.message);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.key,
    encodedMessage,
  );

  const payload: EncryptedChatPayload = {
    version: CHAT_PREFIX,
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };

  return JSON.stringify(payload);
}

export async function decryptChatMessage(input: {
  encryptedMessage: string;
  key: CryptoKey;
}) {
  const parsed = JSON.parse(input.encryptedMessage);

  if (!isEncryptedChatPayload(parsed)) {
    throw new Error("Invalid encrypted chat payload");
  }

  const iv = base64ToArrayBuffer(parsed.iv);
  const ciphertext = base64ToArrayBuffer(parsed.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
