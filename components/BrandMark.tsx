import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

export function BrandMark({ size = 112, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../assets/cegonha-mark.png')}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessibilityLabel="Logo do Cegonha"
    />
  );
}
