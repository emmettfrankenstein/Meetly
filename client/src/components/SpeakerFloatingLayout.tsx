import { useEffect, useMemo, useRef } from "react";
import type { Participant } from "../hooks/useSocketRoom";
import type { RemoteSfuStream } from "../hooks/useMediasoup";
import type { SelfViewSettings } from "../types/layout";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type SpeakerFloatingLayoutProps = {
  localStream: MediaStream | null;
  localUsername: string;
  remoteStreams: RemoteSfuStream[];
  participants: Participant[];
  currentSocketId?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
  selfView: SelfViewSettings;
  onSelfViewChange: (settings: Partial<SelfViewSettings>) => void;
};

type StageParticipant = {
  socketId: string;
  username: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
};

// function EmptyMeetingState() {
//   return (
//     <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 p-8 text-center">
//       <div>
//         <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-400 text-3xl font-bold text-slate-950 shadow-xl">
//           M
//         </div>

//         <h3 className="mt-5 text-xl font-bold text-white">
//           You’re the only one here
//         </h3>

//         <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
//           Invite others to join this encrypted meeting. Your camera, chat, and
//           local recording are ready.
//         </p>
//       </div>
//     </div>
//   );
// }

function hasLiveVideo(stream: MediaStream | null | undefined) {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live"),
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

function VideoTile({
  stream,
  username,
  muted = false,
  className = "",
  objectFit = "cover",
}: {
  stream: MediaStream | null;
  username: string;
  muted?: boolean;
  className?: string;
  objectFit?: "cover" | "contain";
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.srcObject = stream;

    if (stream) {
      video.play().catch((error) => {
        console.warn("Video autoplay failed:", error);
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const hasVideo =
    stream?.getVideoTracks().some((track) => track.readyState === "live") ??
    false;

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          className={`h-full w-full ${
            objectFit === "contain" ? "object-contain" : "object-cover"
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-cyan-300/30 bg-cyan-400 text-5xl font-black text-slate-950 shadow-2xl">
            {(username || "G").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl bg-slate-950/75 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur">
        <span>{username}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
      </div>
    </div>
  );
}

export function SpeakerFloatingLayout({
  localStream,
  localUsername,
  remoteStreams,
  participants,
  currentSocketId,
  isMicOn,
  isCameraOn,
  selfView,
  onSelfViewChange,
}: SpeakerFloatingLayoutProps) {
  const stageRef = useRef<HTMLElement | null>(null);

  const stageParticipant = useMemo<StageParticipant>(() => {
    const remoteScreenStream = remoteStreams.find((remoteStream) => {
      const mediaTag = getRemoteMediaTag(remoteStream);
      return mediaTag === "screen" && hasLiveVideo(remoteStream.stream);
    });

    if (remoteScreenStream) {
      return {
        socketId: remoteScreenStream.peerSocketId,
        username: `${remoteScreenStream.username || "Participant"} · Screen`,
        stream: remoteScreenStream.stream,
        isLocal: false,
        isCameraOn: true,
        isMicOn: true,
      };
    }

    const remoteCameraStream = remoteStreams.find((remoteStream) => {
      const mediaTag = getRemoteMediaTag(remoteStream);
      return mediaTag === "camera" && hasLiveVideo(remoteStream.stream);
    });

    if (remoteCameraStream) {
      return {
        socketId: remoteCameraStream.peerSocketId,
        username: remoteCameraStream.username || "Participant",
        stream: remoteCameraStream.stream,
        isLocal: false,
        isCameraOn: true,
        isMicOn: true,
      };
    }

    const firstRemoteParticipant = participants.find(
      (participant) => participant.socketId !== currentSocketId,
    );

    if (firstRemoteParticipant) {
      return {
        socketId: firstRemoteParticipant.socketId,
        username: firstRemoteParticipant.username,
        stream: null,
        isLocal: false,
        isCameraOn: firstRemoteParticipant.isCameraOn,
        isMicOn: firstRemoteParticipant.isMicOn,
      };
    }

    return {
      socketId: currentSocketId || "local",
      username: localUsername || "You",
      stream: localStream,
      isLocal: true,
      isCameraOn,
      isMicOn,
    };
  }, [
    currentSocketId,
    isCameraOn,
    isMicOn,
    localStream,
    localUsername,
    participants,
    remoteStreams,
  ]);

  const remoteParticipantTiles = useMemo(() => {
    return participants.filter(
      (participant) => participant.socketId !== currentSocketId,
    );
  }, [currentSocketId, participants]);

  function clampSelfView(input: Partial<SelfViewSettings>) {
    const stage = stageRef.current;

    const stageWidth = stage?.clientWidth ?? 1280;
    const stageHeight = stage?.clientHeight ?? 720;

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
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      clampSelfView({
        x: startLeft + deltaX,
        y: startTop + deltaY,
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

      if (direction.includes("e")) {
        nextWidth = startWidth + deltaX;
      }

      if (direction.includes("s")) {
        nextHeight = startHeight + deltaY;
      }

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
      className="relative h-[calc(100vh-150px)] min-h-[560px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
    >
      <div
        className={
          selfView.backgroundEffect === "remove"
            ? "h-full w-full bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950"
            : "h-full w-full"
        }
      >
        <VideoTile
          stream={stageParticipant.stream}
          username={stageParticipant.username}
          muted={stageParticipant.isLocal}
          className={`h-full w-full ${
            selfView.backgroundEffect === "blur" && stageParticipant.isLocal
              ? "brightness-105"
              : ""
          }`}
          objectFit={
            stageParticipant.username.includes("Screen") ? "contain" : "cover"
          }
        />
      </div>

      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        {/* <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 backdrop-blur">
          E2EE On
        </span> */}

        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur">
          Speaker View
        </span>
      </div>

      {remoteParticipantTiles.length > 0 && (
        <div className="absolute left-4 top-16 flex max-w-[320px] flex-col gap-3">
          {remoteParticipantTiles.slice(0, 3).map((participant) => (
            <div
              key={participant.socketId}
              className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 shadow-lg backdrop-blur"
            >
              <p className="font-semibold text-white">{participant.username}</p>
              <p className="text-xs text-slate-400">
                {participant.isMicOn ? "Mic on" : "Muted"} ·{" "}
                {participant.isCameraOn ? "Camera on" : "Camera off"}
              </p>
            </div>
          ))}

          {remoteParticipantTiles.length > 3 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-200 shadow-lg backdrop-blur">
              +{remoteParticipantTiles.length - 3} more
            </div>
          )}
        </div>
      )}

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
          <VideoTile
            stream={localStream}
            username={localUsername || "You"}
            muted
            className="h-full w-full"
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
