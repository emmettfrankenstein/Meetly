import { useEffect, useMemo, useRef } from "react";
import type { Participant } from "../hooks/useSocketRoom";
import type { RemoteSfuStream } from "../hooks/useMediasoup";
import type { SelfViewSettings } from "../types/layout";

type FullscreenMeetingLayoutProps = {
  localStream: MediaStream | null;
  localUsername: string;
  remoteStreams: RemoteSfuStream[];
  participants: Participant[];
  currentSocketId?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  selfView: SelfViewSettings;
  onSelfViewChange: (settings: Partial<SelfViewSettings>) => void;
  onExitFullscreenMode: () => void;
  onOpenStatusPanel: () => void;
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function VideoSurface({
  stream,
  username,
  muted = false,
  objectFit = "cover",
}: {
  stream: MediaStream | null;
  username: string;
  muted?: boolean;
  objectFit?: "cover" | "contain";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;

    if (stream) {
      video.play().catch((error) => {
        console.warn("Fullscreen video autoplay failed:", error);
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const hasVideo =
    stream?.getVideoTracks().some((track) => track.readyState === "live") ??
    false;

  if (!hasVideo) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-cyan-400 text-6xl font-bold text-slate-950 shadow-2xl">
          {(username || "G").slice(0, 1).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted={muted}
      playsInline
      className={`h-full w-full ${
        objectFit === "contain" ? "object-contain" : "object-cover"
      }`}
    />
  );
}

function normalizeMediaTag(value?: string) {
  if (value === "screen") return "screen";
  if (value === "audio") return "audio";
  if (value === "camera" || value === "video") return "camera";
  return "camera";
}

function getRemoteMediaTag(remoteStream: RemoteSfuStream) {
  const directMediaTag = (
    remoteStream as unknown as {
      mediaTag?: string;
    }
  ).mediaTag;

  const appData = remoteStream.appData as
    | { mediaTag?: string; username?: string }
    | undefined;

  return normalizeMediaTag(directMediaTag || appData?.mediaTag);
}

export function FullscreenMeetingLayout({
  localStream,
  localUsername,
  remoteStreams,
  participants,
  currentSocketId,
  isMicOn,
  isCameraOn,
  selfView,
  onSelfViewChange,
  onExitFullscreenMode,
  onOpenStatusPanel,
}: FullscreenMeetingLayoutProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  function hasLiveVideo(stream: MediaStream | null | undefined) {
    return Boolean(
      stream?.getVideoTracks().some((track) => track.readyState === "live"),
    );
  }

  const stageTarget = useMemo(() => {
    const remoteScreen = remoteStreams.find((remoteStream) => {
      //   const appData = remoteStream.appData as
      //     | { mediaTag?: "camera" | "screen" | "audio" }
      //     | undefined;

      //   return appData?.mediaTag === "screen";

      const mediaTag = getRemoteMediaTag(remoteStream);
      return mediaTag === "screen" && hasLiveVideo(remoteStream.stream);
    });

    if (remoteScreen) {
      return {
        username: `${remoteScreen.username || "Participant"} · Screen`,
        stream: remoteScreen.stream,
        isLocal: false,
        objectFit: "contain" as const,
      };
    }

    const remoteCamera = remoteStreams.find((remoteStream) => {
      //   const appData = remoteStream.appData as
      //     | { mediaTag?: "camera" | "screen" | "audio" }
      //     | undefined;

      //   return remoteStream.kind === "video" && appData?.mediaTag !== "screen";

      const mediaTag = getRemoteMediaTag(remoteStream);
      return mediaTag === "camera" && hasLiveVideo(remoteStream.stream);
    });

    if (remoteCamera) {
      return {
        username: remoteCamera.username || "Participant",
        stream: remoteCamera.stream,
        isLocal: false,
        objectFit: "cover" as const,
      };
    }

    const firstRemoteParticipant = participants.find(
      (participant) => participant.socketId !== currentSocketId,
    );

    if (firstRemoteParticipant) {
      return {
        username: firstRemoteParticipant.username,
        stream: null,
        isLocal: false,
        objectFit: "cover" as const,
      };
    }

    return {
      username: localUsername || "You",
      stream: localStream,
      isLocal: true,
      objectFit: "cover" as const,
    };
  }, [
    currentSocketId,
    localStream,
    localUsername,
    participants,
    remoteStreams,
  ]);

  const participantCount = participants.length || 1;

  function clampSelfView(input: Partial<SelfViewSettings>) {
    const stage = stageRef.current;

    const stageWidth = stage?.clientWidth ?? window.innerWidth;
    const stageHeight = stage?.clientHeight ?? window.innerHeight;

    const width = Math.min(
      Math.max(input.width ?? selfView.width, 220),
      Math.max(240, stageWidth - 24),
    );

    const height = Math.min(
      Math.max(input.height ?? selfView.height, 140),
      Math.max(160, stageHeight - 24),
    );

    const x = Math.min(
      Math.max(input.x ?? selfView.x, 12),
      Math.max(12, stageWidth - width - 12),
    );

    const y = Math.min(
      Math.max(input.y ?? selfView.y, 12),
      Math.max(12, stageHeight - height - 12),
    );

    onSelfViewChange({
      ...input,
      x,
      y,
      width,
      height,
    });
  }

  function handleSelfViewDragStart(event: React.PointerEvent<HTMLDivElement>) {
    if (selfView.isLocked) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = selfView.x;
    const startTop = selfView.y;

    event.currentTarget.setPointerCapture(event.pointerId);

    function handleMove(moveEvent: PointerEvent) {
      clampSelfView({
        x: startLeft + moveEvent.clientX - startX,
        y: startTop + moveEvent.clientY - startY,
        width: selfView.width,
        height: selfView.height,
      });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function handleResizeStart(
    event: React.PointerEvent<HTMLDivElement>,
    direction: ResizeDirection,
  ) {
    if (selfView.isLocked) return;

    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = selfView.x;
    const startTop = selfView.y;
    const startWidth = selfView.width;
    const startHeight = selfView.height;

    event.currentTarget.setPointerCapture(event.pointerId);

    function handleMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let nextX = startLeft;
      let nextY = startTop;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (direction.includes("e")) nextWidth = startWidth + deltaX;
      if (direction.includes("s")) nextHeight = startHeight + deltaY;
      if (direction.includes("w")) {
        nextWidth = startWidth - deltaX;
        nextX = startLeft + deltaX;
      }
      if (direction.includes("n")) {
        nextHeight = startHeight - deltaY;
        nextY = startTop + deltaY;
      }

      clampSelfView({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <section
      ref={stageRef}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950 text-white"
    >
      <div className="absolute inset-0">
        <VideoSurface
          stream={stageTarget.stream}
          username={stageTarget.username}
          muted={stageTarget.isLocal}
          objectFit={stageTarget.objectFit}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950/90 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950/90 to-transparent" />

      <header className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            Meetly
          </span>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 backdrop-blur">
            E2EE On
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenStatusPanel}
            className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur hover:bg-slate-900"
          >
            Status
          </button>

          <button
            type="button"
            onClick={onExitFullscreenMode}
            className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur hover:bg-slate-900"
          >
            Exit
          </button>
        </div>
      </header>

      <div className="absolute bottom-24 left-5 rounded-2xl bg-slate-950/70 px-4 py-3 shadow-xl backdrop-blur">
        <p className="text-base font-bold text-white">{stageTarget.username}</p>
        <p className="mt-1 text-xs text-slate-300">
          {participantCount} participant{participantCount === 1 ? "" : "s"}
        </p>
      </div>

      <button
        type="button"
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-2xl border border-l-0 border-slate-700 bg-slate-950/70 px-3 py-8 text-sm font-semibold text-slate-300 backdrop-blur hover:bg-slate-900"
        aria-label="Participant drawer"
      >
        ›
      </button>

      {!selfView.isHidden && (
        <div
          className={`absolute overflow-hidden rounded-2xl border border-cyan-400/60 bg-slate-950 shadow-2xl ${
            selfView.isLocked ? "cursor-default" : "cursor-move"
          }`}
          style={{
            left: selfView.x,
            top: selfView.y,
            width: selfView.width,
            height: selfView.height,
            opacity: selfView.opacity,
            touchAction: "none",
          }}
          onPointerDown={handleSelfViewDragStart}
        >
          <VideoSurface
            stream={localStream}
            username={localUsername || "You"}
            muted
          />

          <div className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            You
          </div>

          <div className="absolute left-1/2 top-2 flex -translate-x-1/2 gap-1">
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
            <span className="h-1 w-1 rounded-full bg-slate-300/80" />
          </div>

          <div className="absolute right-3 top-3 flex gap-2">
            {selfView.backgroundEffect !== "none" && (
              <div className="rounded-full bg-slate-950/75 px-2 py-1 text-xs text-cyan-100 backdrop-blur">
                {selfView.backgroundEffect === "blur" ? "Blur" : "BG removed"}
              </div>
            )}

            {selfView.isLocked && (
              <div className="rounded-full bg-slate-950/75 px-2 py-1 text-xs text-slate-300 backdrop-blur">
                Locked
              </div>
            )}
          </div>

          {!selfView.isLocked && (
            <>
              <ResizeHandle direction="n" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="s" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="e" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="w" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="ne" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="nw" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="se" onResizeStart={handleResizeStart} />
              <ResizeHandle direction="sw" onResizeStart={handleResizeStart} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ResizeHandle({
  direction,
  onResizeStart,
}: {
  direction: ResizeDirection;
  onResizeStart: (
    event: React.PointerEvent<HTMLDivElement>,
    direction: ResizeDirection,
  ) => void;
}) {
  const baseClass = "absolute z-20 bg-transparent";

  const classes: Record<ResizeDirection, string> = {
    n: "left-4 right-4 top-0 h-2 cursor-ns-resize",
    s: "bottom-0 left-4 right-4 h-2 cursor-ns-resize",
    e: "bottom-4 right-0 top-4 w-2 cursor-ew-resize",
    w: "bottom-4 left-0 top-4 w-2 cursor-ew-resize",
    ne: "right-0 top-0 h-5 w-5 cursor-nesw-resize",
    nw: "left-0 top-0 h-5 w-5 cursor-nwse-resize",
    se: "bottom-0 right-0 h-6 w-6 cursor-nwse-resize",
    sw: "bottom-0 left-0 h-5 w-5 cursor-nesw-resize",
  };

  return (
    <div
      className={`${baseClass} ${classes[direction]}`}
      onPointerDown={(event) => onResizeStart(event, direction)}
    >
      {direction === "se" && (
        <div className="absolute bottom-1 right-1 h-4 w-4 rounded-tl-md border-l border-t border-cyan-200/80" />
      )}
    </div>
  );
}
