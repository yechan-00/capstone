import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { AUTH } from '@/components/auth/authTheme';
import { HOME } from '@/components/home/homeTheme';
import { BRAND_LOGO, BRAND_NAME } from '@/constants/brand';

type Props = {
  iconSize?: number;
  showLabel?: boolean;
  labelSize?: number;
  layout?: 'row' | 'column';
  tone?: 'home' | 'auth';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function BrandLogo({
  iconSize = 56,
  showLabel = true,
  labelSize = 23,
  layout = 'column',
  tone = 'home',
  style,
  labelStyle,
}: Props) {
  const textColor = tone === 'auth' ? AUTH.brand : HOME.brand;
  const isRow = layout === 'row';

  return (
    <View
      style={[
        isRow ? styles.row : styles.column,
        style,
      ]}
      accessibilityRole="header"
      accessibilityLabel={BRAND_NAME}
    >
      <Image
        source={BRAND_LOGO}
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: Math.round(iconSize * 0.22),
        }}
        resizeMode="cover"
      />
      {showLabel ? (
        <Text
          style={[
            styles.label,
            {
              fontSize: labelSize,
              color: textColor,
              marginTop: isRow ? 0 : 14,
              marginLeft: isRow ? 10 : 0,
            },
            labelStyle,
          ]}
        >
          {BRAND_NAME}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    alignItems: 'center',
  },
  label: {
    fontWeight: '900',
    letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : {}),
  },
});
