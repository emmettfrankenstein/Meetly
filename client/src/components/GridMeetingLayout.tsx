import { useEffect, useMemo, useRef } from "react";
import type { Participant } from "../hooks/useSocketRoom";
import type { RemoteSfuStream } from "../hooks/useMediasoup";

type GridMeetingLayoutProps = {
  localStream: MediaStream | null;
  localScreenShareStream?: MediaStream | null;
  localUsername: string;
  remoteStreams: RemoteSfuStream[];
  participants: Participant[];
  currentSocketId?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
};

type GridTile = {
  id: string;
  username: string;
  stream: MediaStream | null;
  isLocal: boolean;
  isScreen: boolean;
  isMicOn?: boolean;
  isCameraOn?: boolean;
};

function VideoTile({ tile }: { tile: GridTile }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.srcObject = tile.stream;

    if (tile.stream) {
      video.play().catch((error) => {
        console.warn("Grid video autoplay failed:", error);
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [tile.stream]);

  const hasVideo =
    tile.stream
      ?.getVideoTracks()
      .some((track) => track.readyState === "live") ?? false;

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl ${
        tile.isScreen ? "md:col-span-2 2xl:col-span-3" : ""
      }`}
    >
      <div className={tile.isScreen ? "aspect-video" : "aspect-video"}>
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            muted={tile.isLocal}
            playsInline
            className={`h-full w-full ${
              tile.isScreen ? "object-contain" : "object-cover"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-400 text-4xl font-bold text-slate-950 shadow-xl">
              {(tile.username || "G").slice(0, 1).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {tile.isLocal ? "You" : tile.username}
        </span>

        {tile.isScreen && (
          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100 backdrop-blur">
            Screen
          </span>
        )}

        {!tile.isScreen && (
          <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-300 backdrop-blur">
            {tile.isMicOn ? "Mic on" : "Muted"}
          </span>
        )}
      </div>
    </article>
  );
}

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

export function GridMeetingLayout({
  localStream,
  localScreenShareStream,
  localUsername,
  remoteStreams,
  participants,
  currentSocketId,
  isMicOn,
  isCameraOn,
}: GridMeetingLayoutProps) {
  const tiles = useMemo<GridTile[]>(() => {
    const result: GridTile[] = [];

    if (localScreenShareStream) {
      result.push({
        id: "local-screen",
        username: `${localUsername || "You"} · Screen`,
        stream: localScreenShareStream,
        isLocal: true,
        isScreen: true,
      });
    }

    remoteStreams.forEach((remoteStream) => {
      const mediaTag = getRemoteMediaTag(remoteStream);

      if (mediaTag === "screen" && hasLiveVideo(remoteStream.stream)) {
        result.push({
          id: `${remoteStream.peerSocketId}-screen`,
          username: `${remoteStream.username || "Participant"} · Screen`,
          stream: remoteStream.stream,
          isLocal: false,
          isScreen: true,
        });
      }
    });

    result.push({
      id: currentSocketId || "local",
      username: localUsername || "You",
      stream: localStream,
      isLocal: true,
      isScreen: false,
      isMicOn,
      isCameraOn,
    });

    participants
      .filter((participant) => participant.socketId !== currentSocketId)
      .forEach((participant) => {
        const cameraStream = remoteStreams.find((remoteStream) => {
          const mediaTag = getRemoteMediaTag(remoteStream);

          return (
            remoteStream.peerSocketId === participant.socketId &&
            mediaTag === "camera" &&
            hasLiveVideo(remoteStream.stream)
          );
        });

        result.push({
          id: participant.socketId,
          username: participant.username,
          stream: cameraStream?.stream ?? null,
          isLocal: false,
          isScreen: false,
          isMicOn: participant.isMicOn,
          isCameraOn: participant.isCameraOn,
        });
      });

    return result;
  }, [
    currentSocketId,
    isCameraOn,
    isMicOn,
    localScreenShareStream,
    localStream,
    localUsername,
    participants,
    remoteStreams,
  ]);

  // if (tiles.length === 1 && tiles[0].isLocal) {
  //   return (
  //     <section className="space-y-4">
  //       <div>
  //         <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
  //           Meetly Layout
  //         </p>
  //         <h2 className="mt-1 text-xl font-bold text-white">
  //           Grid / Side-by-side
  //         </h2>
  //       </div>

  //       <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
  //         <div>
  //           <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-400 text-3xl font-bold text-slate-950">
  //             M
  //           </div>

  //           <h3 className="mt-5 text-xl font-bold text-white">
  //             Waiting for others
  //           </h3>

  //           <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
  //             When participants join, they’ll appear here in a clean grid.
  //           </p>
  //         </div>
  //       </div>
  //     </section>
  //   );
  // }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            Meetly Layout
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            Grid / Side-by-side
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
            E2EE On
          </span> */}

          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
            {tiles.length} tile{tiles.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {tiles.map((tile) => (
          <VideoTile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}
