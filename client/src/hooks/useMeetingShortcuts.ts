import { useEffect } from "react";
import type { MeetingLayoutMode } from "../types/layout";

type UseMeetingShortcutsInput = {
  enabled: boolean;
  layoutMode: MeetingLayoutMode;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleRecording: () => void;
  onToggleScreenShare: () => void;
  onToggleLayoutPanel: () => void;
  onToggleStatusPanel: () => void;
  onToggleChatPanel: () => void;
  onSetLayoutMode: (mode: MeetingLayoutMode) => void;
  onClosePanels: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function useMeetingShortcuts({
  enabled,
  layoutMode,
  onToggleMic,
  onToggleCamera,
  onToggleRecording,
  onToggleScreenShare,
  onToggleLayoutPanel,
  onToggleStatusPanel,
  onToggleChatPanel,
  onSetLayoutMode,
  onClosePanels,
}: UseMeetingShortcutsInput) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "escape") {
        event.preventDefault();

        if (layoutMode === "fullscreen" || layoutMode === "focus") {
          onSetLayoutMode("speaker");
          return;
        }

        onClosePanels();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (key === "m") {
        event.preventDefault();
        onToggleMic();
      }

      if (key === "v") {
        event.preventDefault();
        onToggleCamera();
      }

      if (key === "r") {
        event.preventDefault();
        onToggleRecording();
      }

      if (key === "s") {
        event.preventDefault();
        onToggleScreenShare();
      }

      if (key === "l") {
        event.preventDefault();
        onToggleLayoutPanel();
      }

      if (key === "p") {
        event.preventDefault();
        onToggleStatusPanel();
      }

      if (key === "c") {
        event.preventDefault();
        onToggleChatPanel();
      }

      if (key === "f") {
        event.preventDefault();
        onSetLayoutMode(layoutMode === "fullscreen" ? "speaker" : "fullscreen");
      }

      if (key === "x") {
        event.preventDefault();
        onSetLayoutMode(layoutMode === "focus" ? "speaker" : "focus");
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    layoutMode,
    onClosePanels,
    onSetLayoutMode,
    onToggleCamera,
    onToggleChatPanel,
    onToggleLayoutPanel,
    onToggleMic,
    onToggleRecording,
    onToggleScreenShare,
    onToggleStatusPanel,
  ]);
}
