type EncodedTransformCapableSender = RTCRtpSender & {
  transform?: RTCRtpScriptTransform;
};

type EncodedTransformCapableReceiver = RTCRtpReceiver & {
  transform?: RTCRtpScriptTransform;
};

type E2eeTransformHandle = {
  worker: Worker;
  cleanup: () => void;
};

export function supportsEncodedInsertableStreams() {
  return typeof RTCRtpScriptTransform !== "undefined";
}

async function exportRawKey(cryptoKey: CryptoKey) {
  return window.crypto.subtle.exportKey("raw", cryptoKey);
}

function createE2eeWorker() {
  return new Worker(
    new URL("../workers/e2eeTransformWorker.ts", import.meta.url),
    {
      type: "module",
    },
  );
}

export async function attachSenderE2eeTransform(input: {
  sender: RTCRtpSender;
  cryptoKey: CryptoKey;
}): Promise<E2eeTransformHandle> {
  if (!supportsEncodedInsertableStreams()) {
    throw new Error("Encoded media transforms are not supported");
  }

  const keyData = await exportRawKey(input.cryptoKey);
  const worker = createE2eeWorker();

  const sender = input.sender as EncodedTransformCapableSender;

  sender.transform = new RTCRtpScriptTransform(worker, {
    operation: "encrypt",
    keyData,
  });

  console.log("Attached E2EE sender transform");

  return {
    worker,
    cleanup: () => worker.terminate(),
  };
}

export async function attachReceiverE2eeTransform(input: {
  receiver: RTCRtpReceiver;
  cryptoKey: CryptoKey;
}): Promise<E2eeTransformHandle> {
  if (!supportsEncodedInsertableStreams()) {
    throw new Error("Encoded media transforms are not supported");
  }

  const keyData = await exportRawKey(input.cryptoKey);
  const worker = createE2eeWorker();

  const receiver = input.receiver as EncodedTransformCapableReceiver;

  receiver.transform = new RTCRtpScriptTransform(worker, {
    operation: "decrypt",
    keyData,
  });

  console.log("Attached E2EE receiver transform");

  return {
    worker,
    cleanup: () => worker.terminate(),
  };
}
