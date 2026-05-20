import { useState } from "react";
import type { Meeting } from "../services/meetingApi";
import {
  copyToClipboard,
  createInviteMessage,
  getMeetingUrl,
} from "../utils/invite";

type InviteModalProps = {
  meeting: Meeting;
  onClose: () => void;
};

export function InviteModal({ meeting, onClose }: InviteModalProps) {
  const [copiedMessage, setCopiedMessage] = useState("");

  const meetingUrl = getMeetingUrl(meeting.roomId);
  const inviteMessage = createInviteMessage(meeting);

  async function handleCopy(label: string, value: string) {
    try {
      await copyToClipboard(value);
      setCopiedMessage(`${label} copied`);
    } catch {
      setCopiedMessage("Could not copy. Select and copy manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
              Invite
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {meeting.title || "Meetly Meeting"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Share this link and passcode with participants.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-300">
              Meeting link
            </p>
            <div className="flex gap-2">
              <input
                value={meetingUrl}
                readOnly
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
              />
              <button
                onClick={() => handleCopy("Link", meetingUrl)}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-300">
              Passcode
            </p>
            <div className="flex gap-2">
              <input
                value={meeting.passcode}
                readOnly
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
              />
              <button
                onClick={() => handleCopy("Passcode", meeting.passcode)}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-300">
              Full invite message
            </p>
            <textarea
              value={inviteMessage}
              readOnly
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"
            />

            <button
              onClick={() => handleCopy("Invite", inviteMessage)}
              className="mt-2 w-full rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Copy full invite
            </button>
          </div>

          {copiedMessage && (
            <p className="rounded-xl border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm text-emerald-200">
              {copiedMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
