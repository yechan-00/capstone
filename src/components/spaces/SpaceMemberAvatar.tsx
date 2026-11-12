import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import type { SpaceMember } from '@/lib/spaceMembersClient';

type Props = {
  member: SpaceMember;
  accent: string;
  size?: number;
};

export function SpaceMemberAvatar({ member, accent, size = 36 }: Props) {
  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: member.role === 'owner' ? accent : 'transparent',
          borderWidth: member.role === 'owner' ? 2 : 0,
        },
      ]}
    >
      <ProfileAvatar
        uri={member.photoURL}
        name={member.displayName}
        size={member.role === 'owner' ? size - 4 : size}
        accent={accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
