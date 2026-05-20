import { useEffect, useMemo, useRef, useState } from "react";
import type { RemoteSfuStream } from "../hooks/useMediasoup";

type Participant = {
  socketId: string;
  username: string;
  userId?: string;
  role: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
};

type SfuVideoGridProps = {
  localStream: MediaStream | null;
  localScreenShareStream?: MediaStream | null;
  localUsername: string;
  remoteStreams: RemoteSfuStream[];
  participants: Participant[];
  currentSocketId?: string;
  isMicOn: boolean;
  isCameraOn: boolean;
};

type RemotePeerGroup = {
  peerSocketId: string;
  username: string;
  role?: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
  videoStream?: MediaStream;
  screenStream?: MediaStream;
  audioStreams: MediaStream[];
};

function getInitial(username: string) {
  return username.trim().slice(0, 1).toUpperCase() || "?";
}

function useAudioActivity(streams: MediaStream[]) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (streams.length === 0) {
      setIsSpeaking(false);
      return;
    }

    const audioContext = new AudioContext();
    const analysers: AnalyserNode[] = [];
    const sources: MediaStreamAudioSourceNode[] = [];
    let animationFrameId = 0;

    streams.forEach((stream) => {
      const audioTracks = stream.getAudioTracks();

      if (audioTracks.length === 0) return;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 512;
      source.connect(analyser);

      sources.push(source);
      analysers.push(analyser);
    });

    const checkAudioLevel = () => {
      let speaking = false;

      analysers.forEach((analyser) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        const average =
          data.reduce((sum, value) => sum + value, 0) /
          Math.max(data.length, 1);

        if (average > 18) {
          speaking = true;
        }
      });

      setIsSpeaking(speaking);
      animationFrameId = window.requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      // sources.forEach((source) => source.disconnect());
      // analysers.forEach((analyser) => analyser.disconnect());
      // void audioContext.close();

      sources.forEach((source) => {
        try {
          source.disconnect();
        } catch {
          // ignore
        }
      });

      analysers.forEach((analyser) => {
        try {
          analyser.disconnect();
        } catch {
          // ignore
        }
      });

      if (audioContext.state !== "closed") {
        void audioContext.close();
      }
    };
  }, [streams]);

  return isSpeaking;
}

function TileStatusBar({
  username,
  role,
  isMicOn,
  isCameraOn,
  isSpeaking,
}: {
  username: string;
  role?: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
  isSpeaking?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{username}</p>

          {role === "host" && (
            <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
              Host
            </span>
          )}

          {isSpeaking && (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              Speaking
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-sm text-slate-400">
        {isMicOn ? "Mic on" : "Muted"} ·{" "}
        {isCameraOn ? "Camera on" : "Camera off"}
      </div>
    </div>
  );
}

function AvatarPlaceholder({
  username,
  label,
}: {
  username: string;
  label?: string;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-950">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-400 text-4xl font-bold text-slate-950 shadow-lg shadow-cyan-400/20">
        {getInitial(username)}
      </div>

      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}

function LocalVideoCard({
  stream,
  username,
  isMicOn,
  isCameraOn,
}: {
  stream: MediaStream | null;
  username: string;
  isMicOn: boolean;
  isCameraOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isSpeaking = useAudioActivity(stream ? [stream] : []);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !stream) return;

    videoElement.srcObject = stream;

    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch (error) {
        console.warn("Local video autoplay failed:", error);
      }
    };

    videoElement.onloadedmetadata = playVideo;
    void playVideo();

    return () => {
      videoElement.onloadedmetadata = null;
    };
  }, [stream]);

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-black shadow-xl ring-2 transition ${
        isSpeaking ? "ring-emerald-400" : "ring-transparent"
      }`}
    >
      <div className="aspect-video bg-black">
        {stream && isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <AvatarPlaceholder username={username} label="Camera off" />
        )}
      </div>

      <TileStatusBar
        username={`${username || "You"} (You)`}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isSpeaking={isSpeaking}
      />
    </div>
  );
}

function RemoteVideoCard({ peer }: { peer: RemotePeerGroup }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioStreams = useMemo(() => peer.audioStreams, [peer.audioStreams]);
  const isSpeaking = useAudioActivity(audioStreams);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !peer.videoStream) return;

    videoElement.srcObject = peer.videoStream;

    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch (error) {
        console.warn("Remote video play failed:", error);
      }
    };

    videoElement.onloadedmetadata = playVideo;
    void playVideo();

    return () => {
      videoElement.onloadedmetadata = null;
    };
  }, [peer.videoStream]);

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-black shadow-xl ring-2 transition ${
        isSpeaking ? "ring-emerald-400" : "ring-transparent"
      }`}
    >
      <div className="aspect-video bg-black">
        {peer.videoStream && peer.isCameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <AvatarPlaceholder username={peer.username} label="Camera off" />
        )}
      </div>

      <TileStatusBar
        username={peer.username}
        role={peer.role}
        isMicOn={peer.isMicOn}
        isCameraOn={peer.isCameraOn}
        isSpeaking={isSpeaking}
      />

      {peer.audioStreams.map((audioStream, index) => (
        <RemoteAudio
          key={`${peer.peerSocketId}-audio-${index}`}
          stream={audioStream}
        />
      ))}
    </div>
  );
}

function LocalScreenShareCard({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) return;

    videoElement.srcObject = stream;

    videoElement.play().catch((error) => {
      console.warn("Local screen share preview failed:", error);
    });

    return () => {
      videoElement.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-xl md:col-span-2 xl:col-span-3">
      <div className="aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-contain"
        />
      </div>

      <div className="bg-slate-900 px-4 py-3">
        <p className="font-semibold">You are sharing your screen</p>
      </div>
    </div>
  );
}

function RemoteScreenShareCard({
  username,
  stream,
}: {
  username: string;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) return;

    videoElement.srcObject = stream;

    const playVideo = async () => {
      try {
        await videoElement.play();
      } catch (error) {
        console.warn("Remote screen share play failed:", error);
      }
    };

    videoElement.onloadedmetadata = playVideo;
    void playVideo();

    return () => {
      videoElement.onloadedmetadata = null;
    };
  }, [stream]);

  return (
    <div className="overflow-hidden rounded-2xl bg-black shadow-xl md:col-span-2 xl:col-span-4">
      <div className="aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-contain"
        />
      </div>

      <div className="bg-slate-900 px-4 py-3">
        <p className="font-semibold">{username} is sharing screen</p>
      </div>
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) return;

    audioElement.srcObject = stream;
    audioElement.volume = 1;

    const playAudio = async () => {
      try {
        await audioElement.play();
      } catch (error) {
        console.warn("Remote audio play failed:", error);
      }
    };

    audioElement.onloadedmetadata = playAudio;
    void playAudio();

    return () => {
      audioElement.onloadedmetadata = null;
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export function SfuVideoGrid({
  localStream,
  localScreenShareStream,
  localUsername,
  remoteStreams,
  participants,
  currentSocketId,
  isMicOn,
  isCameraOn,
}: SfuVideoGridProps) {
  const remotePeers = useMemo(() => {
    const peerMap = new Map<string, RemotePeerGroup>();

    participants
      .filter((participant) => participant.socketId !== currentSocketId)
      .forEach((participant) => {
        peerMap.set(participant.socketId, {
          peerSocketId: participant.socketId,
          username: participant.username,
          role: participant.role,
          isMicOn: participant.isMicOn,
          isCameraOn: participant.isCameraOn,
          audioStreams: [],
        });
      });

    remoteStreams.forEach((remoteStream) => {
      const existingPeer = peerMap.get(remoteStream.peerSocketId);

      const peer =
        existingPeer ||
        ({
          peerSocketId: remoteStream.peerSocketId,
          username: remoteStream.username,
          isMicOn: true,
          isCameraOn: remoteStream.kind === "video",
          audioStreams: [],
        } satisfies RemotePeerGroup);

      const appData = remoteStream.appData as { mediaTag?: string } | undefined;

      if (remoteStream.kind === "video" && appData?.mediaTag === "screen") {
        peer.screenStream = remoteStream.stream;
      } else if (remoteStream.kind === "video") {
        peer.videoStream = remoteStream.stream;
      }

      if (remoteStream.kind === "audio") {
        peer.audioStreams.push(remoteStream.stream);
      }

      peerMap.set(remoteStream.peerSocketId, peer);
    });

    return Array.from(peerMap.values());
  }, [currentSocketId, participants, remoteStreams]);

  const remoteScreenShares = remotePeers.filter((peer) => peer.screenStream);

  const hasRemoteScreenShare = remoteScreenShares.length > 0;

  return (
    <div
      className={
        hasRemoteScreenShare
          ? "grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          : "grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      }
    >
      {import.meta.env.DEV && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-400 md:col-span-2 xl:col-span-3">
          Remote streams: {remoteStreams.length} · Participants:{" "}
          {participants.length}
        </div>
      )}

      {remoteScreenShares.map((peer) => (
        <RemoteScreenShareCard
          key={`${peer.peerSocketId}-screen`}
          username={peer.username}
          stream={peer.screenStream!}
        />
      ))}

      {localScreenShareStream && (
        <LocalScreenShareCard stream={localScreenShareStream} />
      )}

      <LocalVideoCard
        stream={localStream}
        username={localUsername}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
      />

      {remotePeers.map((peer) => (
        <RemoteVideoCard key={peer.peerSocketId} peer={peer} />
      ))}

      {remotePeers.length === 0 && (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900 text-center text-slate-400">
          <div>
            <p className="font-semibold text-white">Waiting for others</p>
            <p className="mt-1 text-sm">
              Share the invite link and passcode to bring someone in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
