import type { Participant } from "../hooks/useSocketRoom";

type ParticipantsPanelProps = {
  participants: Participant[];
};

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  return (
    <aside className="rounded-2xl bg-slate-900 p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">Participants</p>
          <p className="text-sm text-slate-400">
            {participants.length} in room
          </p>
        </div>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-slate-500">No participants yet.</p>
      ) : (
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.socketId}
              className="flex items-center gap-3 rounded-xl bg-slate-800 px-3 py-2"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400 font-bold text-slate-950">
                {participant.username.slice(0, 1).toUpperCase()}
              </div>

              {/* <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-white">
                    {participant.username}
                  </p>

                  {participant.role === "host" && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-950">
                      Host
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  {participant.socketId.slice(0, 8)}
                </p>
              </div> */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-white">
                    {participant.username}
                  </p>

                  {participant.role === "host" && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-950">
                      Host
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      participant.isMicOn
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-rose-950 text-rose-300"
                    }`}
                  >
                    {participant.isMicOn ? "Mic on" : "Muted"}
                  </span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      participant.isCameraOn
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-rose-950 text-rose-300"
                    }`}
                  >
                    {participant.isCameraOn ? "Camera on" : "Camera off"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {participant.socketId.slice(0, 8)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
