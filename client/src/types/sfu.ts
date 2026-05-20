import type {
  AppData,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup-client/types";

export type SfuTransportParams = {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
};

export type ExistingProducer = {
  producerId: string;
  socketId: string;
  username: string;
  kind: MediaKind;
  appData?: AppData;
};

export type JoinSfuRoomResponse =
  | {
      routerRtpCapabilities: RtpCapabilities;
      existingProducers: ExistingProducer[];
    }
  | {
      error: string;
    };

export type CreateTransportResponse =
  | SfuTransportParams
  | {
      error: string;
    };

export type ProduceResponse =
  | {
      producerId: string;
    }
  | {
      error: string;
    };

export type ConsumeResponse =
  | {
      id: string;
      producerId: string;
      kind: MediaKind;
      rtpParameters: RtpParameters;
      appData?: AppData;
    }
  | {
      error: string;
    };

export function hasSfuError<T>(response: T | { error: string }): response is {
  error: string;
} {
  return (
    typeof response === "object" && response !== null && "error" in response
  );
}
