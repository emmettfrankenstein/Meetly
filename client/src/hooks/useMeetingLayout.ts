import { useCallback, useEffect, useState } from "react";
import type {
  MeetingLayoutMode,
  MeetingLayoutPreferences,
  MeetingLayoutPreset,
  SelfViewSettings,
} from "../types/layout";
import {
  defaultLayoutPreferences,
  getStoredLayoutPreferences,
  saveLayoutPreferences,
} from "../utils/layoutPreferences";

export function useMeetingLayout() {
  const [preferences, setPreferences] = useState<MeetingLayoutPreferences>(() =>
    getStoredLayoutPreferences(),
  );

  useEffect(() => {
    saveLayoutPreferences(preferences);
  }, [preferences]);

  const setMode = useCallback((mode: MeetingLayoutMode) => {
    setPreferences((current) => ({
      ...current,
      mode,
    }));
  }, []);

  const setPreset = useCallback((preset: MeetingLayoutPreset) => {
    setPreferences((current) => ({
      ...current,
      preset,
    }));
  }, []);

  const updateSelfView = useCallback((settings: Partial<SelfViewSettings>) => {
    setPreferences((current) => ({
      ...current,
      selfView: {
        ...current.selfView,
        ...settings,
      },
    }));
  }, []);

  const resetSelfView = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      selfView: defaultLayoutPreferences.selfView,
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setPreferences(defaultLayoutPreferences);
  }, []);

  return {
    preferences,
    mode: preferences.mode,
    preset: preferences.preset,
    selfView: preferences.selfView,
    setMode,
    setPreset,
    updateSelfView,
    resetSelfView,
    resetLayout,
  };
}
