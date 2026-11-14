"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";

export const SOUND_NAMES = ["tap", "complete", "reopen", "save", "add", "delete", "drag-pickup", "drop"] as const;
export type SoundName = typeof SOUND_NAMES[number];

export type SoundPreferences = { enabled: boolean; volume: number };

const STORAGE_KEY = "yinxwrld-sound-preferences-v1";
const CHANGE_EVENT = "yinxwrld:sounds-changed";
const DEFAULT_PREFERENCES: SoundPreferences = { enabled: true, volume: 45 };
let cachedStorageValue: string | null | undefined;
let cachedPreferences = DEFAULT_PREFERENCES;
let sessionOnly = false;
const SOUND_PATHS: Record<SoundName, string> = {
  tap: "/sounds/tap.wav",
  complete: "/sounds/complete.wav",
  reopen: "/sounds/reopen.wav",
  save: "/sounds/save.wav",
  add: "/sounds/add.wav",
  delete: "/sounds/delete.wav",
  "drag-pickup": "/sounds/drag-pickup.wav",
  drop: "/sounds/drop.wav",
};

type SoundControls = {
  preferences: SoundPreferences;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  playSound: (sound: SoundName) => void;
};

const SoundContext = createContext<SoundControls | null>(null);

function parsePreferences(raw: string | null): SoundPreferences {
  try {
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("enabled" in parsed) || !("volume" in parsed) ||
      typeof parsed.enabled !== "boolean" || typeof parsed.volume !== "number" || !Number.isFinite(parsed.volume)) {
      return DEFAULT_PREFERENCES;
    }
    return { enabled: parsed.enabled, volume: Math.max(0, Math.min(100, Math.round(parsed.volume))) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getPreferencesSnapshot() {
  if (sessionOnly) return cachedPreferences;
  let raw: string | null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { sessionOnly = true; return cachedPreferences; }
  if (raw !== cachedStorageValue) {
    cachedStorageValue = raw;
    cachedPreferences = parsePreferences(raw);
  }
  return cachedPreferences;
}

function subscribePreferences(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

function savePreferences(preferences: SoundPreferences) {
  const raw = JSON.stringify(preferences);
  cachedStorageValue = raw;
  cachedPreferences = preferences;
  try { window.localStorage.setItem(STORAGE_KEY, raw); } catch { sessionOnly = true; /* Audio settings still apply in this tab. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(subscribePreferences, getPreferencesSnapshot, () => DEFAULT_PREFERENCES);
  const audioRef = useRef<Partial<Record<SoundName, HTMLAudioElement>>>({});

  useEffect(() => {
    for (const sound of SOUND_NAMES) {
      const audio = new Audio(SOUND_PATHS[sound]);
      audio.preload = "auto";
      audioRef.current[sound] = audio;
      audio.load();
    }
    return () => { audioRef.current = {}; };
  }, []);

  const playSound = useCallback((sound: SoundName) => {
    if (!preferences.enabled || preferences.volume <= 0) return;
    let source = audioRef.current[sound];
    if (!source) {
      source = new Audio(SOUND_PATHS[sound]);
      source.preload = "auto";
      audioRef.current[sound] = source;
    }
    const playback = source.cloneNode(true) as HTMLAudioElement;
    playback.volume = preferences.volume / 100;
    void playback.play().catch(() => undefined);
  }, [preferences.enabled, preferences.volume]);

  const setEnabled = useCallback((enabled: boolean) => {
    savePreferences({ ...getPreferencesSnapshot(), enabled });
  }, []);
  const setVolume = useCallback((volume: number) => {
    savePreferences({ ...getPreferencesSnapshot(), volume: Math.max(0, Math.min(100, Math.round(volume))) });
  }, []);

  const value = useMemo(() => ({ preferences, setEnabled, setVolume, playSound }), [preferences, setEnabled, setVolume, playSound]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSounds() {
  const sounds = useContext(SoundContext);
  if (!sounds) throw new Error("useSounds must be used inside SoundProvider.");
  return sounds;
}
