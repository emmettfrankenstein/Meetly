import { useState } from "react";

import type { Participant } from "../hooks/useSocketRoom";

type StatusPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  e2eeStatus: string;
  e2eeTransformStatus: string;
  sfuStatus: string;
  sfuHealth: string;
  sendTransportState: string;
  recvTransportState: string;
  localRecordingStatus: string;
  participants: Participant[];
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  mediaStatus: string;
  currentSocketId?: string;
};

function StatusCard({
  title,
  children,
  tone = "slate",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "slate" | "green" | "yellow" | "red" | "cyan";
}) {
  const toneClasses = {
    slate: "border-slate-700 bg-slate-900",
    green: "border-emerald-500/30 bg-emerald-500/10",
    yellow: "border-yellow-500/30 bg-yellow-500/10",
    red: "border-red-500/30 bg-red-500/10",
    cyan: "border-cyan-500/30 bg-cyan-500/10",
  };

  return (
    <section className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <p className="font-semibold text-white">{title}</p>
      <div className="mt-2 text-sm text-slate-300">{children}</div>
    </section>
  );
}

export function StatusPanel({
  isOpen,
  onClose,
  e2eeStatus,
  e2eeTransformStatus,
  sfuStatus,
  sfuHealth,
  sendTransportState,
  recvTransportState,
  localRecordingStatus,
  participants,
  isMicOn,
  isCameraOn,
  isScreenSharing,
  mediaStatus,
  currentSocketId,
}: StatusPanelProps) {
  if (!isOpen) return null;

  const encryptionTone = e2eeStatus === "ready" ? "green" : "yellow";
  const mediaTone = sfuHealth === "healthy" ? "green" : "yellow";

  const [activeTab, setActiveTab] = useState<
    "overview" | "people" | "network" | "encryption" | "shortcuts"
  >("overview");

  return (
    <>
      <button
        type="button"
        aria-label="Close status panel"
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-[1px]"
      />
      <aside className="fixed right-4 top-20 z-[91] flex max-h-[calc(100vh-7rem)] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/95 text-slate-200 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Meetly Status
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">Overview</h2>
            <p className="mt-1 text-xs text-slate-400">
              Health, people, network, encryption, and shortcuts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-sm font-bold text-slate-300 hover:bg-slate-800"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3">
          {[
            ["overview", "Overview"],
            ["people", "People"],
            ["network", "Network"],
            ["encryption", "E2EE"],
            ["shortcuts", "Shortcuts"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as typeof activeTab)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === id
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          {activeTab === "overview" && (
            <>
              <StatusCard title="Meeting health" tone={mediaTone}>
                <p>
                  SFU:{" "}
                  <span className="font-semibold text-white">{sfuStatus}</span>
                </p>
                <p className="mt-1">
                  Health:{" "}
                  <span className="font-semibold text-white">{sfuHealth}</span>
                </p>
                <p className="mt-1">
                  Recording:{" "}
                  <span className="font-semibold text-white">
                    {localRecordingStatus}
                  </span>
                </p>
              </StatusCard>

              <StatusCard title="Your devices">
                <p>Mic: {isMicOn ? "On" : "Muted"}</p>
                <p className="mt-1">Camera: {isCameraOn ? "On" : "Off"}</p>
                <p className="mt-1">
                  Screen: {isScreenSharing ? "Sharing" : "Not sharing"}
                </p>
                <p className="mt-2 text-xs text-slate-500">{mediaStatus}</p>
              </StatusCard>
            </>
          )}

          {activeTab === "people" && (
            <StatusCard title={`Participants (${participants.length})`}>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {participant.username}
                        {participant.socketId === currentSocketId && (
                          <span className="ml-2 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {participant.role === "host" ? "Host" : "Guest"}
                      </p>
                    </div>

                    <p className="shrink-0 text-xs text-slate-400">
                      {participant.isMicOn ? "Mic" : "Muted"} ·{" "}
                      {participant.isCameraOn ? "Camera" : "No cam"}
                    </p>
                  </div>
                ))}
              </div>
            </StatusCard>
          )}

          {activeTab === "network" && (
            <StatusCard title="Connection" tone={mediaTone}>
              <p>SFU status: {sfuStatus}</p>
              <p className="mt-1">Send transport: {sendTransportState}</p>
              <p className="mt-1">Receive transport: {recvTransportState}</p>
              <p className="mt-2 text-xs text-slate-500">
                If media freezes, try toggling camera or rejoining the meeting.
              </p>
            </StatusCard>
          )}

          {activeTab === "encryption" && (
            <StatusCard title="End-to-end encryption" tone={encryptionTone}>
              <p>Key exchange: {e2eeStatus}</p>
              <p className="mt-1">Media transforms: {e2eeTransformStatus}</p>
              <p className="mt-2 text-xs text-slate-500">
                Meeting media and chat use browser-side encryption keys.
              </p>
            </StatusCard>
          )}

          {activeTab === "shortcuts" && (
            <StatusCard title="Keyboard shortcuts">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>
                  <span className="font-semibold text-white">M</span> · Mic
                </p>
                <p>
                  <span className="font-semibold text-white">V</span> · Camera
                </p>
                <p>
                  <span className="font-semibold text-white">R</span> · Record
                </p>
                <p>
                  <span className="font-semibold text-white">S</span> · Share
                </p>
                <p>
                  <span className="font-semibold text-white">L</span> · Layout
                </p>
                <p>
                  <span className="font-semibold text-white">P</span> · Status
                </p>
                <p>
                  <span className="font-semibold text-white">C</span> · Chat
                </p>
                <p>
                  <span className="font-semibold text-white">F</span> ·
                  Fullscreen
                </p>
                <p>
                  <span className="font-semibold text-white">X</span> · Focus
                </p>
                <p>
                  <span className="font-semibold text-white">Esc</span> · Close
                </p>
              </div>
            </StatusCard>
          )}
        </div>
      </aside>
    </>
  );
}
