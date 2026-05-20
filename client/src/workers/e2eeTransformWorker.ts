/// <reference lib="webworker" />

export {};

type TransformOperation = "encrypt" | "decrypt";

type TransformOptions = {
  operation: TransformOperation;
  keyData: ArrayBuffer;
};

type EncodedFrame = RTCEncodedVideoFrame | RTCEncodedAudioFrame;

let frameCounter = 0;
let failedFrames = 0;

const IV_LENGTH = 12;
const COUNTER_LENGTH = 4;
const VIDEO_UNENCRYPTED_HEADER_BYTES = 10;
const AUDIO_UNENCRYPTED_HEADER_BYTES = 1;

function createIv(counter: number) {
  const iv = new Uint8Array(IV_LENGTH);
  const view = new DataView(iv.buffer);

  view.setUint32(IV_LENGTH - COUNTER_LENGTH, counter, false);

  return iv;
}

function getUnencryptedHeaderBytes(frame: EncodedFrame) {
  const maybeVideoFrame = frame as RTCEncodedVideoFrame;

  if (typeof maybeVideoFrame.type === "string") {
    return VIDEO_UNENCRYPTED_HEADER_BYTES;
  }

  return AUDIO_UNENCRYPTED_HEADER_BYTES;
}

async function importAesKey(keyData: ArrayBuffer) {
  return crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptFrame(frame: EncodedFrame, key: CryptoKey) {
  const input = new Uint8Array(frame.data);
  const headerBytes = Math.min(getUnencryptedHeaderBytes(frame), input.length);

  const clearHeader = input.slice(0, headerBytes);
  const payload = input.slice(headerBytes);

  if (payload.byteLength === 0) {
    return frame;
  }

  const counter = frameCounter;
  frameCounter += 1;

  const iv = createIv(counter);

  const encryptedPayload = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    payload,
  );

  const encryptedPayloadBytes = new Uint8Array(encryptedPayload);

  const output = new Uint8Array(
    clearHeader.byteLength + IV_LENGTH + encryptedPayloadBytes.byteLength,
  );

  output.set(clearHeader, 0);
  output.set(iv, clearHeader.byteLength);
  output.set(encryptedPayloadBytes, clearHeader.byteLength + IV_LENGTH);

  frame.data = output.buffer;

  return frame;
}

async function decryptFrame(frame: EncodedFrame, key: CryptoKey) {
  const input = new Uint8Array(frame.data);
  const headerBytes = Math.min(getUnencryptedHeaderBytes(frame), input.length);

  if (input.byteLength <= headerBytes + IV_LENGTH) {
    return frame;
  }

  const clearHeader = input.slice(0, headerBytes);
  const iv = input.slice(headerBytes, headerBytes + IV_LENGTH);
  const encryptedPayload = input.slice(headerBytes + IV_LENGTH);

  const decryptedPayload = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedPayload,
  );

  const decryptedPayloadBytes = new Uint8Array(decryptedPayload);
  const output = new Uint8Array(
    clearHeader.byteLength + decryptedPayloadBytes.byteLength,
  );

  output.set(clearHeader, 0);
  output.set(decryptedPayloadBytes, clearHeader.byteLength);

  frame.data = output.buffer;

  return frame;
}

const workerSelf = self as unknown as DedicatedWorkerGlobalScope & {
  onrtctransform: ((event: RTCTransformEvent) => void) | null;
};

workerSelf.onrtctransform = async (event: RTCTransformEvent) => {
  const transformer = event.transformer;
  const options = transformer.options as TransformOptions;

  const key = await importAesKey(options.keyData);
  const operation = options.operation;

  const transformStream = new TransformStream<EncodedFrame, EncodedFrame>({
    async transform(frame, controller) {
      try {
        const transformedFrame =
          operation === "encrypt"
            ? await encryptFrame(frame, key)
            : await decryptFrame(frame, key);

        controller.enqueue(transformedFrame);
      } catch (error) {
        failedFrames += 1;

        if (failedFrames <= 3 || failedFrames % 250 === 0) {
          console.warn("E2EE frame transform failed:", {
            operation,
            failedFrames,
            error,
          });
        }

        // Drop failed encrypted/decrypted frame instead of forwarding broken bytes.
      }
    },
  });

  transformer.readable
    .pipeThrough(transformStream)
    .pipeTo(transformer.writable)
    .catch((error) => {
      console.warn("E2EE transform pipe failed:", error);
    });
};
