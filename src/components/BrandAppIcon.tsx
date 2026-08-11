import React from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_LOGO } from '@/constants/brand';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** 알림·목업 등 작은 앱 아이콘 */
export function BrandAppIcon({ size = 32, style }: Props) {
  const radius = Math.round(size * 0.22);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Image
        source={BRAND_LOGO}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
        accessibilityLabel="후회가계부"
      />
    </View>
  );
}
