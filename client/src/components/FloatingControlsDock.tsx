type FloatingControlsDockProps = {
  isCollapsed: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  layoutMode: string;
  isHost?: boolean;
  onToggleCollapsed: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onOpenDevices: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onOpenLayout: () => void;
  onOpenStatus: () => void;
  onOpenChat: () => void;
  onOpenRecordings: () => void;
  onEndMeeting?: () => void;
  onLeave: () => void;
};

function DockButton({
  label,
  active = false,
  danger = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  const classes = danger
    ? "bg-red-500 text-white hover:bg-red-400"
    : active
      ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
      : "bg-slate-800/90 text-slate-200 hover:bg-slate-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-semibold shadow-lg transition ${classes}`}
    >
      {label}
    </button>
  );
}

export function FloatingControlsDock({
  isCollapsed,
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isRecording,
  layoutMode,
  isHost = false,
  onToggleCollapsed,
  onToggleMic,
  onToggleCamera,
  onOpenDevices,
  onToggleScreenShare,
  onToggleRecording,
  onOpenLayout,
  onOpenStatus,
  onOpenChat,
  onOpenRecordings,
  onLeave,
  onEndMeeting,
}: FloatingControlsDockProps) {
  if (isCollapsed) {
    return (
      <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-full border border-slate-700 bg-slate-950/90 px-5 py-3 text-sm font-semibold text-slate-100 shadow-2xl backdrop-blur hover:bg-slate-900"
        >
          Controls ↑
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-xl">
        <DockButton label="↓" onClick={onToggleCollapsed} />

        <DockButton
          label={isMicOn ? "Mic" : "Unmute"}
          active={isMicOn}
          onClick={onToggleMic}
        />

        <DockButton
          label={isCameraOn ? "Camera" : "Camera on"}
          active={isCameraOn}
          onClick={onToggleCamera}
        />

        <DockButton label="Devices" onClick={onOpenDevices} />
        <DockButton
          label={isScreenSharing ? "Stop share" : "Share"}
          active={isScreenSharing}
          onClick={onToggleScreenShare}
        />

        <DockButton
          label={isRecording ? "● Recording" : "Record"}
          active={isRecording}
          onClick={onToggleRecording}
        />

        <DockButton label={`Layout: ${layoutMode}`} onClick={onOpenLayout} />

        <DockButton label="Status" onClick={onOpenStatus} />

        <DockButton label="Chat" onClick={onOpenChat} />

        <DockButton label="Recordings" onClick={onOpenRecordings} />

        {isHost && onEndMeeting && (
          <DockButton label="End meeting" danger onClick={onEndMeeting} />
        )}
        <DockButton label="Leave" danger onClick={onLeave} />
      </div>
    </div>
  );
}
