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
import { useAccessibility } from '../context/AccessibilityContext';

function planoTexto(style: TextProps['style']) {
  return (StyleSheet.flatten(style) || {}) as TextStyle;
}

function familiaPorPeso(style: TextProps['style'], boldText = false) {
  const plano = planoTexto(style);
  if (plano.fontFamily) return plano.fontFamily;
  const peso = Number(String(plano.fontWeight || '400').replace(/[^0-9]/g, '')) || 400;
  const pesoEfetivo = boldText ? Math.max(peso, 600) : peso;
  if (pesoEfetivo >= 700) return fonts.bold;
  if (pesoEfetivo >= 600) return fonts.semiBold;
  if (pesoEfetivo >= 500) return fonts.medium;
  return fonts.regular;
}

function escalaTipografica(style: TextProps['style'], scale: number) {
  const plano = planoTexto(style);
  const ajuste: TextStyle = {};
  if (typeof plano.fontSize === 'number') ajuste.fontSize = Math.round(plano.fontSize * scale * 10) / 10;
  if (typeof plano.lineHeight === 'number') ajuste.lineHeight = Math.round(plano.lineHeight * scale * 10) / 10;
  return ajuste;
}

function ajusteTipografico(style: TextProps['style'], scale = 1) {
  const plano = planoTexto(style);
  const fontSize = Number(plano.fontSize || 0) * scale;
  const peso = Number(String(plano.fontWeight || '400').replace(/[^0-9]/g, '')) || 400;
  const ehTitulo = fontSize >= 28 && peso >= 600;

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
  const { fontScale, boldText } = useAccessibility();
  const fontFamily = familiaPorPeso(style, boldText);
  const escala = escalaTipografica(style, fontScale);
  const ajuste = ajusteTipografico(style, fontScale);
  return <RNText {...props} style={[{ color: colors.text, fontFamily: fonts.regular }, style, escala, { fontFamily }, ajuste]} />;
}

export const AppTextInput = forwardRef<RNTextInput, TextInputProps>(function AppTextInput(
  { style, placeholderTextColor, ...props },
  ref
) {
  const { colors } = useTheme();
  const { fontScale, boldText } = useAccessibility();
  const plano = StyleSheet.flatten(style) || {};
  const baseSize = typeof plano.fontSize === 'number' ? plano.fontSize : 17;
  const baseLineHeight = typeof plano.lineHeight === 'number' ? plano.lineHeight : undefined;
  return (
    <RNTextInput
      ref={ref}
      {...props}
      allowFontScaling
      placeholderTextColor={placeholderTextColor || colors.muted}
      selectionColor={colors.accent}
      style={[
        { color: colors.text, fontFamily: boldText ? fonts.semiBold : fonts.regular, fontSize: 17 },
        style,
        {
          fontSize: Math.round(baseSize * fontScale * 10) / 10,
          ...(baseLineHeight ? { lineHeight: Math.round(baseLineHeight * fontScale * 10) / 10 } : null),
        },
      ]}
    />
  );
});
