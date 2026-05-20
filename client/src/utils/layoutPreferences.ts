import type {
  MeetingLayoutMode,
  MeetingLayoutPreferences,
  MeetingLayoutPreset,
} from "../types/layout";

const STORAGE_KEY = "meetly:layout-preferences:v1";

export const defaultLayoutPreferences: MeetingLayoutPreferences = {
  mode: "speaker",
  preset: "balanced",
  selfView: {
    x: 760,
    y: 380,
    width: 360,
    height: 220,
    opacity: 0.92,
    isHidden: false,
    isLocked: false,
    backgroundEffect: "none",
  },
};

export function getStoredLayoutPreferences(): MeetingLayoutPreferences {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return defaultLayoutPreferences;
    }

    const parsed = JSON.parse(rawValue) as Partial<MeetingLayoutPreferences>;

    return {
      ...defaultLayoutPreferences,
      ...parsed,
      selfView: {
        ...defaultLayoutPreferences.selfView,
        ...(parsed.selfView || {}),
      },
    };
  } catch {
    return defaultLayoutPreferences;
  }
}

export function saveLayoutPreferences(preferences: MeetingLayoutPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function isMeetingLayoutMode(value: string): value is MeetingLayoutMode {
  return ["speaker", "grid", "fullscreen", "focus"].includes(value);
}

export function isMeetingLayoutPreset(
  value: string,
): value is MeetingLayoutPreset {
  return ["compact", "balanced", "presentation"].includes(value);
}
