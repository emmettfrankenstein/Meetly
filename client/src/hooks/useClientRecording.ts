import { useCallback, useRef, useState } from "react";

import type {
  MeetingLayoutMode,
  MeetingLayoutPreset,
  SelfViewSettings,
} from "../types/layout";

export type ClientRecordingStatus =
  | "idle"
  | "recording"
  | "stopping"
  | "ready"
  | "error";

export type ClientRecordingRemoteStream = {
  stream: MediaStream;
  username: string;
  mediaTag?: "camera" | "screen" | "audio";
};

type UseClientRecordingInput = {
  localStream: MediaStream | null;
  localUsername: string;
  localScreenShareStream?: MediaStream | null;
  remoteStreams: ClientRecordingRemoteStream[];
  layoutMode?: MeetingLayoutMode;
  layoutPreset?: MeetingLayoutPreset;
  selfView?: SelfViewSettings;
};

type VideoSource = {
  id: string;
  label: string;
  stream: MediaStream;
  video: HTMLVideoElement;
  mediaTag: "camera" | "screen" | "audio";
  isLocal: boolean;
};

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const FPS = 30;

function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function hasLiveVideoTrack(stream: MediaStream) {
  return stream.getVideoTracks().some((track) => track.readyState === "live");
}

function hasLiveAudioTrack(stream: MediaStream) {
  return stream.getAudioTracks().some((track) => track.readyState === "live");
}

function createVideoElement(stream: MediaStream) {
  const video = document.createElement("video");

  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;

  void video.play().catch(() => {
    // Browser may delay playback; draw loop handles not-ready state.
  });

  return video;
}

async function createVideoSources(input: {
  localStream: MediaStream | null;
  localUsername: string;
  localScreenShareStream?: MediaStream | null;
  remoteStreams: ClientRecordingRemoteStream[];
}) {
  const sources: VideoSource[] = [];

  if (input.localScreenShareStream) {
    sources.push({
      id: "local-screen",
      label: `${input.localUsername || "You"} · Screen`,
      stream: input.localScreenShareStream,
      video: createVideoElement(input.localScreenShareStream),
      mediaTag: "screen",
      isLocal: true,
    });
  }

  const remoteScreenShares = input.remoteStreams.filter(
    (remoteStream) => remoteStream.mediaTag === "screen",
  );

  remoteScreenShares.forEach((remoteStream, index) => {
    sources.push({
      id: `remote-screen-${index}`,
      label: `${remoteStream.username || "Participant"} · Screen`,
      stream: remoteStream.stream,
      video: createVideoElement(remoteStream.stream),
      mediaTag: "screen",
      isLocal: false,
    });
  });

  if (input.localStream) {
    sources.push({
      id: "local-camera",
      label: input.localUsername || "You",
      stream: input.localStream,
      video: createVideoElement(input.localStream),
      mediaTag: "camera",
      isLocal: true,
    });
  }

  input.remoteStreams
    .filter((remoteStream) => remoteStream.mediaTag !== "screen")
    .forEach((remoteStream, index) => {
      sources.push({
        id: `remote-camera-${index}`,
        label: remoteStream.username || `Participant ${index + 1}`,
        stream: remoteStream.stream,
        video: createVideoElement(remoteStream.stream),
        mediaTag: remoteStream.mediaTag === "audio" ? "audio" : "camera",
        isLocal: false,
      });
    });

  await Promise.all(
    sources.map(
      (source) =>
        new Promise<void>((resolve) => {
          if (source.video.readyState >= 2) {
            resolve();
            return;
          }

          const timeout = window.setTimeout(resolve, 700);

          source.video.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve();
          };
        }),
    ),
  );

  return sources;
}

function createMixedAudioTrack(input: {
  localStream: MediaStream | null;
  remoteStreams: ClientRecordingRemoteStream[];
}) {
  const streams = [
    input.localStream,
    ...input.remoteStreams.map((remoteStream) => remoteStream.stream),
  ].filter((stream): stream is MediaStream => Boolean(stream));

  const audioStreams = streams.filter(hasLiveAudioTrack);

  if (audioStreams.length === 0) {
    return {
      audioTrack: null as MediaStreamTrack | null,
      cleanup: () => undefined,
    };
  }

  const AudioContextClass =
    window.AudioContext ||
    (
      window as Window &
        typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return {
      audioTrack: null as MediaStreamTrack | null,
      cleanup: () => undefined,
    };
  }

  const audioContext = new AudioContextClass();
  const destination = audioContext.createMediaStreamDestination();
  const sources: MediaStreamAudioSourceNode[] = [];

  audioStreams.forEach((stream) => {
    try {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(destination);
      sources.push(source);
    } catch {
      // Ignore streams the browser refuses to mix.
    }
  });

  const [audioTrack] = destination.stream.getAudioTracks();

  return {
    audioTrack: audioTrack ?? null,
    cleanup: () => {
      sources.forEach((source) => {
        try {
          source.disconnect();
        } catch {
          // ignore
        }
      });

      if (audioContext.state !== "closed") {
        void audioContext.close();
      }
    },
  };
}

export function useClientRecording({
  localStream,
  localUsername,
  localScreenShareStream,
  remoteStreams,
  layoutMode = "speaker",
  // layoutPreset = "balanced",
  selfView,
}: UseClientRecordingInput) {
  const [status, setStatus] = useState<ClientRecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const composedStreamRef = useRef<MediaStream | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const sourceVideosRef = useRef<HTMLVideoElement[]>([]);

  const stopComposedStream = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    composedStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    composedStreamRef.current = null;

    audioCleanupRef.current?.();
    audioCleanupRef.current = null;

    sourceVideosRef.current.forEach((video) => {
      video.pause();
      video.srcObject = null;
    });

    sourceVideosRef.current = [];
  }, []);

  const clearRecording = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setRecordingBlob(null);
    setRecordingUrl(null);
    setDurationSec(null);

    if (status !== "recording" && status !== "stopping") {
      setStatus("idle");
    }
  }, [status]);

  const startRecording = useCallback(async () => {
    try {
      if (status === "recording" || status === "stopping") return;

      setError(null);
      setRecordingBlob(null);
      setRecordingUrl(null);
      setDurationSec(null);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const hasAnyVideo =
        Boolean(
          localScreenShareStream && hasLiveVideoTrack(localScreenShareStream),
        ) ||
        Boolean(localStream && hasLiveVideoTrack(localStream)) ||
        remoteStreams.some((remoteStream) =>
          hasLiveVideoTrack(remoteStream.stream),
        );

      const hasAnyAudio =
        Boolean(localStream && hasLiveAudioTrack(localStream)) ||
        remoteStreams.some((remoteStream) =>
          hasLiveAudioTrack(remoteStream.stream),
        );

      if (!hasAnyVideo && !hasAnyAudio) {
        setStatus("error");
        setError("No media tracks are available to record.");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        setStatus("error");
        setError("Canvas recording is not supported in this browser.");
        return;
      }

      const videoSources = await createVideoSources({
        localStream,
        localUsername,
        localScreenShareStream,
        remoteStreams,
      });

      sourceVideosRef.current = videoSources.map((source) => source.video);

      function drawLabel(
        ctx: CanvasRenderingContext2D,
        label: string,
        x: number,
        y: number,
      ) {
        ctx.save();
        ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
        ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(120, label.length * 8 + 24), 34, 17);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "600 14px Inter, system-ui, sans-serif";
        ctx.fillText(label, x + 14, y + 22);
        ctx.restore();
      }

      function drawAvatar(
        ctx: CanvasRenderingContext2D,
        username: string,
        x: number,
        y: number,
        width: number,
        height: number,
      ) {
        ctx.save();

        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, "#0f172a");
        gradient.addColorStop(1, "#020617");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, width, height);

        const radius = Math.min(width, height) * 0.18;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#020617";
        ctx.font = `700 ${Math.max(32, radius * 0.9)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          (username || "G").slice(0, 1).toUpperCase(),
          centerX,
          centerY,
        );

        ctx.restore();
      }

      function drawVideoOrAvatar({
        ctx,
        video,
        username,
        x,
        y,
        width,
        height,
        objectFit = "cover",
      }: {
        ctx: CanvasRenderingContext2D;
        video?: HTMLVideoElement;
        username: string;
        x: number;
        y: number;
        width: number;
        height: number;
        objectFit?: "cover" | "contain";
      }) {
        ctx.save();

        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 24);
        ctx.clip();

        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          drawAvatar(ctx, username, x, y, width, height);
          ctx.restore();
          drawLabel(ctx, username, x + 16, y + height - 48);
          return;
        }

        const videoRatio = video.videoWidth / video.videoHeight;
        const targetRatio = width / height;

        let drawWidth = width;
        let drawHeight = height;
        let drawX = x;
        let drawY = y;

        if (objectFit === "cover") {
          if (videoRatio > targetRatio) {
            drawHeight = height;
            drawWidth = height * videoRatio;
            drawX = x - (drawWidth - width) / 2;
          } else {
            drawWidth = width;
            drawHeight = width / videoRatio;
            drawY = y - (drawHeight - height) / 2;
          }
        } else {
          if (videoRatio > targetRatio) {
            drawWidth = width;
            drawHeight = width / videoRatio;
            drawY = y + (height - drawHeight) / 2;
          } else {
            drawHeight = height;
            drawWidth = height * videoRatio;
            drawX = x + (width - drawWidth) / 2;
          }

          ctx.fillStyle = "#020617";
          ctx.fillRect(x, y, width, height);
        }

        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 24);
        ctx.stroke();
        ctx.restore();

        drawLabel(ctx, username, x + 16, y + height - 48);
      }

      function drawGridLayout(
        ctx: CanvasRenderingContext2D,
        sources: VideoSource[],
        width: number,
        height: number,
      ) {
        const visibleSources = sources.slice(0, 9);
        const count = Math.max(1, visibleSources.length);

        const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
        const rows = Math.ceil(count / columns);

        const gap = 16;
        const tileWidth = (width - gap * (columns + 1)) / columns;
        const tileHeight = (height - gap * (rows + 1)) / rows;

        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);

        if (visibleSources.length === 0) {
          drawVideoOrAvatar({
            ctx,
            username: "Meetly",
            x: gap,
            y: gap,
            width: width - gap * 2,
            height: height - gap * 2,
          });
          return;
        }

        visibleSources.forEach((source, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);

          const x = gap + column * (tileWidth + gap);
          const y = gap + row * (tileHeight + gap);

          drawVideoOrAvatar({
            ctx,
            video: source.video,
            username: source.isLocal ? "You" : source.label,
            x,
            y,
            width: tileWidth,
            height: tileHeight,
            objectFit: source.mediaTag === "screen" ? "contain" : "cover",
          });
        });
      }

      function drawSpeakerLayout({
        ctx,
        width,
        height,
        primary,
        cameras,
        self,
        selfView,
        hasScreenShare,
      }: {
        ctx: CanvasRenderingContext2D;
        width: number;
        height: number;
        primary?: VideoSource;
        cameras: VideoSource[];
        self?: VideoSource;
        selfView?: SelfViewSettings;
        hasScreenShare: boolean;
      }) {
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);

        const mainX = 24;
        const mainY = 24;
        const mainWidth = width - 48;
        const mainHeight = hasScreenShare ? height - 150 : height - 48;

        if (primary) {
          drawVideoOrAvatar({
            ctx,
            video: primary.video,
            username: primary.isLocal ? "You" : primary.label,
            x: mainX,
            y: mainY,
            width: mainWidth,
            height: mainHeight,
            objectFit: primary.mediaTag === "screen" ? "contain" : "cover",
          });
        } else {
          drawVideoOrAvatar({
            ctx,
            username: "Meetly",
            x: mainX,
            y: mainY,
            width: mainWidth,
            height: mainHeight,
          });
        }

        const stripSources = cameras
          .filter((source) => source.id !== primary?.id)
          .slice(0, 5);

        if (hasScreenShare && stripSources.length > 0) {
          const gap = 12;
          const tileWidth = 180;
          const tileHeight = 100;
          const y = height - tileHeight - 24;

          stripSources.forEach((source, index) => {
            drawVideoOrAvatar({
              ctx,
              video: source.video,
              username: source.isLocal ? "You" : source.label,
              x: 24 + index * (tileWidth + gap),
              y,
              width: tileWidth,
              height: tileHeight,
              objectFit: "cover",
            });
          });
        }

        if (self && selfView && !selfView.isHidden && !hasScreenShare) {
          const scaleX = width / 1280;
          const scaleY = height / 720;

          const selfWidth = Math.max(180, selfView.width * scaleX);
          const selfHeight = Math.max(110, selfView.height * scaleY);

          const selfX = Math.min(
            Math.max(12, selfView.x * scaleX),
            width - selfWidth - 12,
          );

          const selfY = Math.min(
            Math.max(12, selfView.y * scaleY),
            height - selfHeight - 12,
          );

          ctx.save();
          ctx.globalAlpha = selfView.opacity;

          drawVideoOrAvatar({
            ctx,
            video: self.video,
            username: "You",
            x: selfX,
            y: selfY,
            width: selfWidth,
            height: selfHeight,
            objectFit: "cover",
          });

          ctx.restore();
        }
      }

      function drawFullscreenLayout({
        ctx,
        width,
        height,
        primary,
        self,
        selfView,
      }: {
        ctx: CanvasRenderingContext2D;
        width: number;
        height: number;
        primary?: VideoSource;
        self?: VideoSource;
        selfView?: SelfViewSettings;
      }) {
        ctx.fillStyle = "#020617";
        ctx.fillRect(0, 0, width, height);

        if (primary) {
          drawVideoOrAvatar({
            ctx,
            video: primary.video,
            username: primary.isLocal ? "You" : primary.label,
            x: 0,
            y: 0,
            width,
            height,
            objectFit: primary.mediaTag === "screen" ? "contain" : "cover",
          });
        } else {
          drawVideoOrAvatar({
            ctx,
            username: "Meetly",
            x: 0,
            y: 0,
            width,
            height,
          });
        }

        if (self && selfView && !selfView.isHidden) {
          const scaleX = width / 1280;
          const scaleY = height / 720;

          const selfWidth = Math.max(180, selfView.width * scaleX);
          const selfHeight = Math.max(110, selfView.height * scaleY);

          const selfX = Math.min(
            Math.max(12, selfView.x * scaleX),
            width - selfWidth - 12,
          );

          const selfY = Math.min(
            Math.max(12, selfView.y * scaleY),
            height - selfHeight - 12,
          );

          ctx.save();
          ctx.globalAlpha = selfView.opacity;

          drawVideoOrAvatar({
            ctx,
            video: self.video,
            username: "You",
            x: selfX,
            y: selfY,
            width: selfWidth,
            height: selfHeight,
            objectFit: "cover",
          });

          ctx.restore();
        }
      }

      const drawFrame = () => {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const screenSources = videoSources.filter(
          (source) => source.mediaTag === "screen",
        );

        const cameraSources = videoSources.filter(
          (source) => source.mediaTag === "camera",
        );

        const visualSources = videoSources.filter(
          (source) => source.mediaTag !== "audio",
        );

        const activeScreen = screenSources[0];

        const primarySpeaker =
          cameraSources.find((source) => !source.isLocal) || cameraSources[0];

        const selfSource = cameraSources.find((source) => source.isLocal);

        if (layoutMode === "grid") {
          drawGridLayout(ctx, visualSources, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (layoutMode === "fullscreen" || layoutMode === "focus") {
          drawFullscreenLayout({
            ctx,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            primary: activeScreen || primarySpeaker,
            self: selfSource,
            selfView,
          });
        } else {
          drawSpeakerLayout({
            ctx,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            primary: activeScreen || primarySpeaker,
            cameras: cameraSources,
            self: selfSource,
            selfView,
            hasScreenShare: Boolean(activeScreen),
          });
        }

        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
      };

      drawFrame();

      const canvasStream = canvas.captureStream(FPS);
      const composedTracks: MediaStreamTrack[] = [
        ...canvasStream.getVideoTracks(),
      ];

      const mixedAudio = createMixedAudioTrack({
        localStream,
        remoteStreams,
      });

      audioCleanupRef.current = mixedAudio.cleanup;

      if (mixedAudio.audioTrack) {
        composedTracks.push(mixedAudio.audioTrack);
      }

      const composedStream = new MediaStream(composedTracks);
      composedStreamRef.current = composedStream;

      const mimeType = getSupportedMimeType();

      const recorder = new MediaRecorder(
        composedStream,
        mimeType ? { mimeType } : undefined,
      );

      chunksRef.current = [];
      const startTime = new Date();
      setStartedAt(startTime);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setStatus("error");
        setError("Browser recording failed.");
        stopComposedStream();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        setRecordingBlob(blob);
        setRecordingUrl(url);
        setDurationSec(
          Math.max(1, Math.round((Date.now() - startTime.getTime()) / 1000)),
        );
        setStatus("ready");

        stopComposedStream();
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setStatus("recording");
    } catch (recordingError) {
      console.error("Client recording failed:", recordingError);
      setStatus("error");
      setError("Unable to start browser recording.");
      stopComposedStream();
    }
  }, [
    layoutMode,
    localScreenShareStream,
    localStream,
    localUsername,
    remoteStreams,
    selfView,
    status,
    stopComposedStream,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") return;

    setStatus("stopping");
    recorder.stop();
  }, []);

  return {
    status,
    error,
    recordingBlob,
    recordingUrl,
    startedAt,
    durationSec,
    isRecording: status === "recording",
    startRecording,
    stopRecording,
    clearRecording,
  };
}
