import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { useAuth } from '@/hooks/useAuth';
import { getR2ImageApiBaseUrl } from '@/services/storageService';
import { ownProfileImageUri } from '@/lib/profileImage';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  onPress: () => void;
};

export function ProfileSettingsRow({ onPress }: Props) {
  const { colors } = useTheme();
  const { user, account } = useAuth();
  const nickname = (account?.nickname ?? '').trim() || '미설정';
  const [token, setToken] = useState<string | null>(null);
  const uid = user?.uid;
  const uri = uid ? ownProfileImageUri(getR2ImageApiBaseUrl(), uid, account?.profileImageKey) : null;

  useEffect(() => {
    let cancelled = false;
    if (!user || !uri) {
      setToken(null);
      return;
    }
    user
      .getIdToken()
      .then((value) => {
        if (!cancelled) setToken(value);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri, user]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="프로필 편집"
    >
      <ProfileAvatar
        uri={uri}
        headers={token ? { Authorization: `Bearer ${token}` } : undefined}
        name={nickname}
        size={48}
      />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {nickname}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>프로필 사진 · 닉네임</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
});
