export type MeetingLayoutMode = "speaker" | "grid" | "fullscreen" | "focus";

export type SelfViewBackgroundEffect = "none" | "blur" | "remove";

export type MeetingLayoutPreset = "compact" | "balanced" | "presentation";

export type SelfViewSettings = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  isHidden: boolean;
  isLocked: boolean;
  backgroundEffect: SelfViewBackgroundEffect;
};

export type MeetingLayoutPreferences = {
  mode: MeetingLayoutMode;
  preset: MeetingLayoutPreset;
  selfView: SelfViewSettings;
};
