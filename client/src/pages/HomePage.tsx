import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { logout } from "../services/authApi";
import type { Meeting } from "../services/meetingApi";
import { createMeeting, getMeetings } from "../services/meetingApi";
import { InviteModal } from "../components/InviteModal";

// function createRoomId() {
//   return crypto.randomUUID().slice(0, 8);
// }

export function HomePage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");

  // const [isE2eeEnabled, setIsE2eeEnabled] = useState(false);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [meetingTitle, setMeetingTitle] = useState("");

  // const [passcode, setPasscode] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState("");

  const [selectedInviteMeeting, setSelectedInviteMeeting] =
    useState<Meeting | null>(null);

  async function handleLogout() {
    await logout();
    setUser(null);
    navigate("/login");
  }

  async function createNewRoom() {
    try {
      setMeetingError("");
      setIsCreatingMeeting(true);

      const result = await createMeeting({
        title: meetingTitle.trim() || "Untitled Meeting",
        // passcode,
        // isE2eeEnabled,
      });

      setMeetings((current) => [result.meeting, ...current]);
      navigate(`/room/${result.meeting.roomId}`);
    } catch (error) {
      setMeetingError(
        error instanceof Error ? error.message : "Could not create meeting",
      );
    } finally {
      setIsCreatingMeeting(false);
    }
  }

  function joinExistingRoom() {
    const trimmedRoomId = roomId.trim();

    if (!trimmedRoomId) return;

    navigate(`/room/${trimmedRoomId}`);
  }

  useEffect(() => {
    async function loadMeetings() {
      try {
        const result = await getMeetings();
        setMeetings(result.meetings);
      } catch (error) {
        console.error(error);
      }
    }

    loadMeetings();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-10">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
            Meetly
          </p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight">
            Simple video meetings for humans.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Create a room, share the link, and start a peer-to-peer video call.
          </p>
          {user ? (
            <div className="mt-4 flex items-center gap-3">
              <p className="text-slate-300">
                Logged in as{" "}
                <span className="font-semibold text-white">
                  {user.username}
                </span>
              </p>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          ) : null}
        </header>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") joinExistingRoom();
              }}
              placeholder="Enter room ID"
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
            />

            <button
              onClick={joinExistingRoom}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950"
            >
              Join room
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-sm text-slate-400">
            <div className="h-px flex-1 bg-slate-700" />
            or
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          {/* <button
            onClick={createNewRoom}
            className="w-full rounded-xl border border-slate-700 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Create new room
          </button> */}
          <input
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            placeholder="Meeting title, e.g. Design sync"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-300"
          />

          {/* <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            {/*  <input
              type="checkbox"
              checked={isE2eeEnabled}
              onChange={(event) => setIsE2eeEnabled(event.target.checked)}
              className="mt-1"
             /> 
              <span>
              <span className="block font-semibold text-white">
                Enable end-to-end encryption
              </span>
              <span className="mt-1 block text-slate-400">
                Encrypts meeting media in the browser. Server-side recording
                will be disabled.
              </span>
            </span>
          </label> */}

          <button
            onClick={createNewRoom}
            disabled={isCreatingMeeting}
            className="mt-3 w-full rounded-xl border border-slate-700 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {isCreatingMeeting ? "Creating..." : "Create new room"}
          </button>

          {meetingError && (
            <p className="mt-3 rounded-xl border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-200">
              {meetingError}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Your meetings</h2>
              <p className="text-sm text-slate-400">Recently created rooms</p>
            </div>
          </div>

          {meetings.length === 0 ? (
            <p className="text-sm text-slate-500">No meetings yet.</p>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => (
                // <button
                //   key={meeting.id}
                //   onClick={() => navigate(`/room/${meeting.roomId}`)}
                //   className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-cyan-400"
                // >
                //   <p className="font-semibold text-white">
                //     {meeting.title || "Untitled Meeting"}
                //   </p>
                //   <p className="mt-1 text-sm text-slate-400">
                //     Room ID: {meeting.roomId}
                //   </p>
                //   <p className="mt-1 text-sm text-slate-400">
                //     Passcode:{" "}
                //     <span className="font-semibold text-cyan-300">
                //       {meeting.passcode}
                //     </span>
                //   </p>
                //   <p className="mt-1 text-xs text-slate-500">
                //     Created: {new Date(meeting.createdAt).toLocaleString()}
                //   </p>
                // </button>
                <div
                  key={meeting.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <button
                      onClick={() => navigate(`/room/${meeting.roomId}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-semibold text-white">
                        {meeting.title || "Untitled Meeting"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Room ID: {meeting.roomId}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Passcode:{" "}
                        <span className="font-semibold text-cyan-300">
                          {meeting.passcode}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Created: {new Date(meeting.createdAt).toLocaleString()}
                      </p>
                      {meeting.isE2eeEnabled && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                          E2EE
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setSelectedInviteMeeting(meeting)}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Invite
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {selectedInviteMeeting && (
        <InviteModal
          meeting={selectedInviteMeeting}
          onClose={() => setSelectedInviteMeeting(null)}
        />
      )}
    </main>
  );
}
