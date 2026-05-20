import { useEffect, useRef } from "react";
import type { MediaDeviceOption } from "../hooks/useLocalMedia";

type PreJoinLobbyProps = {
  meetingTitle: string;
  localStream: MediaStream | null;
  username: string;
  onUsernameChange: (username: string) => void;

  audioDevices: MediaDeviceOption[];
  videoDevices: MediaDeviceOption[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;

  isMicOn: boolean;
  isCameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;

  onJoin: () => void;
  mediaStatus: string;
};

export function PreJoinLobby({
  meetingTitle,
  localStream,
  username,
  onUsernameChange,
  audioDevices,
  videoDevices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onAudioDeviceChange,
  onVideoDeviceChange,
  isMicOn,
  isCameraOn,
  onToggleMic,
  onToggleCamera,
  onJoin,
  mediaStatus,
}: PreJoinLobbyProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);

  // useEffect(() => {
  //   if (previewRef.current) {
  //     previewRef.current.srcObject = localStream;
  //   }
  // }, [localStream]);

  useEffect(() => {
    if (!previewRef.current) return;

    previewRef.current.srcObject = localStream;

    if (localStream) {
      previewRef.current.play().catch((error) => {
        console.warn("Preview video autoplay failed:", error);
      });
    }
  }, [localStream]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Meetly Lobby
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            {meetingTitle || "Ready to join?"}
          </h1>

          <p className="mt-3 text-slate-300">
            Check your camera and microphone before entering the meeting.
          </p>

          <div className="mt-6 overflow-hidden rounded-3xl bg-black shadow-2xl">
            {/* <div className="aspect-video bg-black">
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            </div> */}
            <div className="aspect-video bg-black">
              {localStream && isCameraOn ? (
                <video
                  ref={previewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-950">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-400 text-4xl font-bold text-slate-950">
                    {(username || "G").slice(0, 1).toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
              <p className="font-semibold">{username || "You"}</p>
              <p className="text-sm text-slate-400">
                {isMicOn ? "Mic on" : "Muted"} ·{" "}
                {isCameraOn ? "Camera on" : "Camera off"}
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-2xl font-bold">Join settings</h2>
          <p className="mt-2 text-sm text-slate-400">{mediaStatus}</p>

          <div className="mt-6 space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Display name</span>
              <input
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Camera</span>
              <select
                value={selectedVideoDeviceId}
                onChange={(event) => onVideoDeviceChange(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              >
                {videoDevices.length === 0 ? (
                  <option value="">No camera found</option>
                ) : (
                  videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Microphone</span>
              <select
                value={selectedAudioDeviceId}
                onChange={(event) => onAudioDeviceChange(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              >
                {audioDevices.length === 0 ? (
                  <option value="">No microphone found</option>
                ) : (
                  audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onToggleMic}
                className="rounded-xl border border-slate-700 px-4 py-3 font-semibold hover:bg-slate-800"
              >
                {isMicOn ? "Mute" : "Unmute"}
              </button>

              <button
                onClick={onToggleCamera}
                className="rounded-xl border border-slate-700 px-4 py-3 font-semibold hover:bg-slate-800"
              >
                {isCameraOn ? "Camera off" : "Camera on"}
              </button>
            </div>

            <button
              onClick={onJoin}
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950"
            >
              Join meeting
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
