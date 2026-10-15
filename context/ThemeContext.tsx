import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from '../theme';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  dark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const STORAGE_KEY = '@cegonha/theme-mode';
const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  dark: false,
  colors: lightColors,
  setMode: async () => {},
  toggle: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value === 'light' || value === 'dark' || value === 'system') setModeState(value);
    }).catch(() => {});
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = dark ? darkColors : lightColors;

  async function setMode(next: ThemeMode) {
    setModeState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }

  async function toggle() {
    await setMode(dark ? 'light' : 'dark');
  }

  const value = useMemo(() => ({ mode, dark, colors, setMode, toggle }), [mode, dark, colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
