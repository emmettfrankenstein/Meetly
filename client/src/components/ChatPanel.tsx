import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../hooks/useSocketRoom";

type ChatPanelProps = {
  messages: ChatMessage[];
  currentUserId?: string;
  currentSocketId?: string;
  error?: string;
  onSendMessage: (message: string) => void | Promise<void>;
  isE2eeEnabled?: boolean;
  isChatReady?: boolean;
  disabled: boolean;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isOwnMessage(
  message: ChatMessage,
  currentUserId?: string,
  currentSocketId?: string,
) {
  if (message.type !== "user") return false;

  if (currentUserId && message.userId === currentUserId) {
    return true;
  }

  if (currentSocketId && message.socketId === currentSocketId) {
    return true;
  }

  return false;
}

export function ChatPanel({
  messages,
  currentUserId,
  currentSocketId,
  error,
  onSendMessage,
  disabled,
  isE2eeEnabled = false,
  isChatReady = true,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const remainingCharacters = 1000 - draft.length;
  const isTooLong = draft.length > 1000;

  function sendMessage() {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || isTooLong) return;

    onSendMessage(trimmedDraft);
    setDraft("");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <aside className="flex h-[min(520px,calc(100vh-260px))] min-h-[320px] flex-col rounded-2xl bg-slate-900 shadow-xl">
      <header className="border-b border-slate-800 px-4 py-3">
        <p className="font-semibold text-white">Chat</p>
        <p className="text-sm text-slate-400">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </p>
      </header>

      {isE2eeEnabled && (
        <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
          Chat is end-to-end encrypted. Meetly stores only encrypted text.
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-center">
            <p className="text-sm font-medium text-slate-300">
              No messages yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Say hello. Or say nothing and preserve the mystery.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const ownMessage = isOwnMessage(
              message,
              currentUserId,
              currentSocketId,
            );

            if (message.type === "system") {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="max-w-[90%] rounded-full bg-slate-800 px-3 py-1 text-center text-xs text-slate-400">
                    {message.message}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex ${
                  ownMessage ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    ownMessage
                      ? "bg-cyan-400 text-slate-950"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p
                      className={`text-xs font-semibold ${
                        ownMessage ? "text-slate-800" : "text-cyan-300"
                      }`}
                    >
                      {ownMessage ? "You" : message.username}
                    </p>

                    <p
                      className={`text-[10px] ${
                        ownMessage ? "text-slate-700" : "text-slate-500"
                      }`}
                    >
                      {formatTime(message.createdAt)}
                    </p>
                  </div>

                  <p className="whitespace-pre-wrap break-words text-sm">
                    {message.message}
                  </p>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-slate-800 p-3">
        {error && (
          <p className="mb-2 rounded-xl border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <textarea
            value={draft}
            disabled={disabled || !isChatReady}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={disabled ? "Join the room to chat" : "Type a message"}
            rows={1}
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-300 disabled:cursor-not-allowed disabled:text-slate-500"
          />

          <button
            onClick={sendMessage}
            disabled={disabled || !draft.trim() || isTooLong || !isChatReady}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            Send
          </button>
        </div>

        <div className="mt-1 flex justify-between text-xs">
          <p className="text-slate-500">
            Enter to send · Shift+Enter for line break
          </p>
          <p className={isTooLong ? "text-rose-300" : "text-slate-500"}>
            {remainingCharacters}
          </p>
        </div>
      </footer>
    </aside>
  );
}
