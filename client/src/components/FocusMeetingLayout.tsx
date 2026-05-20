import { SpeakerFloatingLayout } from "./SpeakerFloatingLayout";
import type { Participant } from "../hooks/useSocketRoom";
import type { RemoteSfuStream } from "../hooks/useMediasoup";
import type { SelfViewSettings } from "../types/layout";

type FocusMeetingLayoutProps = {
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

export function FocusMeetingLayout(props: FocusMeetingLayoutProps) {
  return (
    <section className="fixed inset-0 z-50 bg-slate-950 p-4 text-white">
      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-200 backdrop-blur">
          Focus Mode
        </span>

        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 backdrop-blur">
          E2EE On
        </span>
      </div>

      <div className="h-full pt-14">
        <SpeakerFloatingLayout {...props} />
      </div>
    </section>
  );
}
