import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const marcaCegonha = require('../assets/branding/cegonha-mark.png');

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ size = 96, style }: BrandLogoProps) {
  return (
    <Image
      source={marcaCegonha}
      resizeMode="contain"
      accessibilityLabel="Logo do Cegonha"
      accessibilityIgnoresInvertColors
      style={[{ width: size, height: size }, style]}
    />
  );
}
