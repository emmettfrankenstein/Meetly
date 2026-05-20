type JsonWebKeyPublic = JsonWebKey;

export type E2eeEncryptedRoomKeyPayload = {
  version: "meetly-e2ee-room-key-v1";
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

export async function generateParticipantKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"],
  );
}

export async function exportParticipantPublicKey(publicKey: CryptoKey) {
  return crypto.subtle.exportKey("jwk", publicKey);
}

export async function importParticipantPublicKey(
  publicKeyJwk: JsonWebKeyPublic,
) {
  return crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
}

export async function generateRoomCryptoKey() {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function deriveWrappingKey(input: {
  privateKey: CryptoKey;
  peerPublicKey: CryptoKey;
}) {
  return crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: input.peerPublicKey,
    },
    input.privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptRoomKeyForPeer(input: {
  roomKey: CryptoKey;
  wrappingKey: CryptoKey;
}): Promise<E2eeEncryptedRoomKeyPayload> {
  const rawRoomKey = await crypto.subtle.exportKey("raw", input.roomKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.wrappingKey,
    rawRoomKey,
  );

  return {
    version: "meetly-e2ee-room-key-v1",
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

export async function decryptRoomKeyFromHost(input: {
  encryptedRoomKey: E2eeEncryptedRoomKeyPayload;
  wrappingKey: CryptoKey;
}) {
  const iv = base64ToArrayBuffer(input.encryptedRoomKey.iv);
  const ciphertext = base64ToArrayBuffer(input.encryptedRoomKey.ciphertext);

  const rawRoomKey = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    input.wrappingKey,
    ciphertext,
  );

  return crypto.subtle.importKey(
    "raw",
    rawRoomKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportRoomCryptoKey(roomKey: CryptoKey) {
  const rawKey = await crypto.subtle.exportKey("raw", roomKey);
  return arrayBufferToBase64(rawKey);
}

export async function importRoomCryptoKey(rawKeyBase64: string) {
  const rawKey = base64ToArrayBuffer(rawKeyBase64);

  return crypto.subtle.importKey(
    "raw",
    rawKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}
