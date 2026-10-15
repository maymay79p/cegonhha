export const lightColors = {
  background: '#F8F5F0',
  surface: '#FFFFFF',
  surfaceSoft: '#F1ECE6',
  text: '#171513',
  muted: '#736E69',
  border: '#E6DED6',
  accent: '#A74364',
  accentSoft: '#F5E6EC',
  porter: '#44383E',
  porterSoft: '#EEE8EA',
  success: '#4D765D',
  warning: '#9A643F',
  danger: '#A34747',
  info: '#4B647B',
};

export const darkColors: typeof lightColors = {
  background: '#12100F',
  surface: '#1B1817',
  surfaceSoft: '#25201E',
  text: '#F5F0EB',
  muted: '#B7AEA7',
  border: '#3A312D',
  accent: '#E58CAA',
  accentSoft: '#3A2029',
  porter: '#9D6F82',
  porterSoft: '#32262B',
  success: '#82B596',
  warning: '#D8A16F',
  danger: '#E68484',
  info: '#87A9C7',
};

export type ThemeColors = typeof lightColors;

// Mantido para compatibilidade com telas ainda não migradas para o contexto de tema.
export const colors = lightColors;

export const fonts = {
  brand: 'EBGaramond_700Bold',
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
};

export const radius = {
  small: 14,
  medium: 20,
  large: 28,
  pill: 999,
};

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.07,
  shadowRadius: 18,
  elevation: 4,
};
