import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
} from 'react-native';
import { fonts } from '../theme';
import { useTheme } from '../context/ThemeContext';

function familiaPorPeso(style: TextProps['style']) {
  const plano: any = StyleSheet.flatten(style) || {};
  if (plano.fontFamily) return plano.fontFamily;
  const peso = Number(String(plano.fontWeight || '400').replace(/[^0-9]/g, '')) || 400;
  if (peso >= 700) return fonts.bold;
  if (peso >= 600) return fonts.semiBold;
  if (peso >= 500) return fonts.medium;
  return fonts.regular;
}

export function AppText({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  const fontFamily = familiaPorPeso(style);
  return <RNText {...props} style={[{ color: colors.text, fontFamily: fonts.regular }, style, { fontFamily }]} />;
}

export const AppTextInput = forwardRef<RNTextInput, TextInputProps>(function AppTextInput(
  { style, placeholderTextColor, ...props },
  ref
) {
  const { colors } = useTheme();
  return (
    <RNTextInput
      ref={ref}
      {...props}
      placeholderTextColor={placeholderTextColor || colors.muted}
      selectionColor={colors.accent}
      style={[{ color: colors.text, fontFamily: fonts.regular, fontSize: 17 }, style]}
    />
  );
});
