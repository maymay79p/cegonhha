import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from '../theme';
import { useAccessibility } from './AccessibilityContext';

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

const highContrastLight: ThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSoft: '#F2F2F2',
  text: '#000000',
  muted: '#3A3532',
  border: '#6C625C',
  accent: '#7C173C',
  accentSoft: '#F7DCE6',
  porter: '#241B20',
  porterSoft: '#E8E0E4',
  success: '#245D35',
  warning: '#784000',
  danger: '#8A1F1F',
  info: '#234E70',
};

const highContrastDark: ThemeColors = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceSoft: '#171717',
  text: '#FFFFFF',
  muted: '#D8D8D8',
  border: '#8A8A8A',
  accent: '#FF9BBD',
  accentSoft: '#4A182B',
  porter: '#E4B2C6',
  porterSoft: '#3B2931',
  success: '#9AD8B0',
  warning: '#FFC27A',
  danger: '#FF9898',
  info: '#ADD7FA',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { highContrast } = useAccessibility();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value === 'light' || value === 'dark' || value === 'system') setModeState(value);
    }).catch(() => {});
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const colors = highContrast
    ? (dark ? highContrastDark : highContrastLight)
    : (dark ? darkColors : lightColors);

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
