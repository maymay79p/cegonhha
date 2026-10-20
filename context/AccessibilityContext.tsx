import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Vibration } from 'react-native';

export type FontScaleOption = 1 | 1.15 | 1.3;

export type AccessibilitySettings = {
  fontScale: FontScaleOption;
  highContrast: boolean;
  boldText: boolean;
  reduceMotion: boolean;
  spokenFeedback: boolean;
  vibrationFeedback: boolean;
  enhancedVisualFeedback: boolean;
};

type AccessibilityContextValue = AccessibilitySettings & {
  loaded: boolean;
  setFontScale: (value: FontScaleOption) => Promise<void>;
  setHighContrast: (value: boolean) => Promise<void>;
  setBoldText: (value: boolean) => Promise<void>;
  setReduceMotion: (value: boolean) => Promise<void>;
  setSpokenFeedback: (value: boolean) => Promise<void>;
  setVibrationFeedback: (value: boolean) => Promise<void>;
  setEnhancedVisualFeedback: (value: boolean) => Promise<void>;
  announce: (message: string) => void;
  vibrate: (kind?: 'success' | 'warning' | 'error') => void;
};

const STORAGE_KEY = '@cegonha/accessibility:v1';

const DEFAULTS: AccessibilitySettings = {
  fontScale: 1,
  highContrast: false,
  boldText: false,
  reduceMotion: false,
  spokenFeedback: true,
  vibrationFeedback: false,
  enhancedVisualFeedback: true,
};

const AccessibilityContext = createContext<AccessibilityContextValue>({
  ...DEFAULTS,
  loaded: false,
  setFontScale: async () => {},
  setHighContrast: async () => {},
  setBoldText: async () => {},
  setReduceMotion: async () => {},
  setSpokenFeedback: async () => {},
  setVibrationFeedback: async () => {},
  setEnhancedVisualFeedback: async () => {},
  announce: () => {},
  vibrate: () => {},
});

function isFontScale(value: unknown): value is FontScaleOption {
  return value === 1 || value === 1.15 || value === 1.3;
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
        setSettings({
          ...DEFAULTS,
          ...parsed,
          fontScale: isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULTS.fontScale,
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save(next: AccessibilitySettings) {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function setter<K extends keyof AccessibilitySettings>(key: K) {
    return async (value: AccessibilitySettings[K]) => {
      const next = { ...settings, [key]: value } as AccessibilitySettings;
      await save(next);
    };
  }

  function announce(message: string) {
    if (!settings.spokenFeedback || !message.trim()) return;
    AccessibilityInfo.announceForAccessibility(message);
  }

  function vibrate(kind: 'success' | 'warning' | 'error' = 'warning') {
    if (!settings.vibrationFeedback) return;
    if (kind === 'success') Vibration.vibrate(45);
    else if (kind === 'error') Vibration.vibrate([0, 70, 55, 70]);
    else Vibration.vibrate(70);
  }

  const value = useMemo<AccessibilityContextValue>(() => ({
    ...settings,
    loaded,
    setFontScale: setter('fontScale'),
    setHighContrast: setter('highContrast'),
    setBoldText: setter('boldText'),
    setReduceMotion: setter('reduceMotion'),
    setSpokenFeedback: setter('spokenFeedback'),
    setVibrationFeedback: setter('vibrationFeedback'),
    setEnhancedVisualFeedback: setter('enhancedVisualFeedback'),
    announce,
    vibrate,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, loaded]);

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
