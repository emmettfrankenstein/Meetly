import type { ChildProcessWithoutNullStreams } from "child_process";
import type { types } from "mediasoup";

export type RecordingSessionStatus =
  | "starting"
  | "recording"
  | "stopping"
  | "stopped"
  | "failed";

export type RecordingProducerPolicy = {
  includeAudio: boolean;
  includeCameraVideo: boolean;
  includeScreenShare: boolean;
  maxAudioTracks: number;
  maxVideoTracks: number;
};

export type RecordingTrackKind = "audio" | "video";

export type RecordingConsumerInfo = {
  producerId: string;
  consumerId: string;
  kind: RecordingTrackKind;
  rtpPort: number;
  rtcpPort?: number;
  transport: types.PlainTransport;
  consumer: types.Consumer;
};

export type RecordingSession = {
  recordingId: string;
  roomId: string;
  meetingId: string;
  startedByUserId: string;
  status: RecordingSessionStatus;
  startedAt: Date;
  stoppedAt?: Date;
  errorMessage?: string;

  outputPath?: string;
  sdpPath?: string;
  ffmpegProcess?: ChildProcessWithoutNullStreams;
  isStopping?: boolean;

  ffmpegLastOutput?: string;
  ffmpegExitCode?: number | null;
  ffmpegExitSignal?: NodeJS.Signals | null;

  policy: RecordingProducerPolicy;
  consumers: RecordingConsumerInfo[];
};
