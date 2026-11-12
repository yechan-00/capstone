import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme, BRAND_GREEN } from '@/theme/ThemeContext';
import { DEFAULT_SPACE_MEMBER_DISPLAY_NAME, memberInitial } from '@/lib/spaceMembersClient';

type Props = {
  uri?: string | null;
  headers?: Record<string, string>;
  name?: string;
  size?: number;
  accent?: string;
};

export function ProfileAvatar({ uri, headers, name, size = 40, accent }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const ring = accent ?? BRAND_GREEN;
  const showImage = Boolean(uri) && !failed;
  const label = (name ?? '').trim() || DEFAULT_SPACE_MEMBER_DISPLAY_NAME;
  const initial = memberInitial(label === DEFAULT_SPACE_MEMBER_DISPLAY_NAME ? DEFAULT_SPACE_MEMBER_DISPLAY_NAME : label);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
    >
      {showImage && uri ? (
        <Image
          source={headers ? { uri, headers } : { uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, { color: ring, fontSize: Math.round(size * 0.38) }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  initial: {
    fontWeight: '800',
  },
});
