type RTCEncodedVideoFrame = {
  data: ArrayBuffer;
  type?: "key" | "delta" | string;
  timestamp?: number;
};

type RTCEncodedAudioFrame = {
  data: ArrayBuffer;
  timestamp?: number;
};

declare class RTCRtpScriptTransform {
  constructor(worker: Worker, options?: unknown);
}

type RTCTransformEvent = Event & {
  transformer: {
    readable: ReadableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>;
    writable: WritableStream<RTCEncodedVideoFrame | RTCEncodedAudioFrame>;
    options?: unknown;
  };
};

interface DedicatedWorkerGlobalScope {
  onrtctransform: ((event: RTCTransformEvent) => void) | null;
}

declare const self: DedicatedWorkerGlobalScope;
