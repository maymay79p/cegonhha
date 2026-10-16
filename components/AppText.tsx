import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
  TextStyle,
} from 'react-native';
import { fonts } from '../theme';
import { useTheme } from '../context/ThemeContext';

function planoTexto(style: TextProps['style']) {
  return (StyleSheet.flatten(style) || {}) as TextStyle;
}

function familiaPorPeso(style: TextProps['style']) {
  const plano = planoTexto(style);
  if (plano.fontFamily) return plano.fontFamily;
  const peso = Number(String(plano.fontWeight || '400').replace(/[^0-9]/g, '')) || 400;
  if (peso >= 700) return fonts.bold;
  if (peso >= 600) return fonts.semiBold;
  if (peso >= 500) return fonts.medium;
  return fonts.regular;
}

function ajusteTipografico(style: TextProps['style']) {
  const plano = planoTexto(style);
  const fontSize = Number(plano.fontSize || 0);
  const peso = Number(String(plano.fontWeight || '400').replace(/[^0-9]/g, '')) || 400;
  const ehTitulo = fontSize >= 28 && peso >= 600;

  // Cada peso da EB Garamond já é um arquivo de fonte próprio. Manter fontWeight
  // junto do fontFamily fazia alguns Androids aplicarem peso sintético e deixava
  // títulos com métricas/baseline diferentes. Neutralizamos o peso depois de
  // escolher a família correta e padronizamos os títulos grandes.
  return {
    fontWeight: 'normal' as const,
    ...(ehTitulo ? {
      fontStyle: 'normal' as const,
      includeFontPadding: false,
      lineHeight: Math.round(fontSize * 1.08),
    } : null),
  };
}

export function AppText({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  const fontFamily = familiaPorPeso(style);
  const ajuste = ajusteTipografico(style);
  return <RNText {...props} style={[{ color: colors.text, fontFamily: fonts.regular }, style, { fontFamily }, ajuste]} />;
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
