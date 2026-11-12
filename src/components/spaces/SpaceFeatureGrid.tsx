import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SpacePressable } from '@/components/spaces/SpacePressable';
import { useTheme } from '@/theme/ThemeContext';
import { spaceTypeSoftFill } from '@/lib/spaceTypes';

type FeatureId = 'memories' | 'spending' | 'settle' | 'members';

const FEATURES: {
  id: FeatureId;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  {
    id: 'memories',
    title: '추억 기록',
    description: '사진과 이야기를 남겨요',
    icon: 'photo-library',
  },
  {
    id: 'spending',
    title: '공유 소비',
    description: '함께한 지출을 모아요',
    icon: 'account-balance-wallet',
  },
  {
    id: 'settle',
    title: '정산',
    description: '함께 쓴 돈을 정리해요',
    icon: 'receipt-long',
  },
  {
    id: 'members',
    title: '멤버 관리',
    description: '함께하는 사람을 확인해요',
    icon: 'group',
  },
];

const FEATURE_MESSAGES: Record<FeatureId, string> = {
  memories: '추억 기록 기능을 준비하고 있어요.',
  spending: '공유 소비 기능을 준비하고 있어요.',
  settle: '정산 기능을 준비하고 있어요.',
  members: '멤버 관리 기능을 준비하고 있어요.',
};

type Props = {
  accent: string;
  onSelect: (message: string) => void;
  onMembers?: () => void;
  onMemories?: () => void;
  onSpending?: () => void;
  onSettle?: () => void;
};

export function SpaceFeatureGrid({ accent, onSelect, onMembers, onMemories, onSpending, onSettle }: Props) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - 40 - 10) / 2);

  return (
    <View style={styles.grid}>
      {FEATURES.map((feature) => (
        <SpacePressable
          key={feature.id}
          onPress={() => {
            if (feature.id === 'members' && onMembers) {
              onMembers();
              return;
            }
            if (feature.id === 'memories' && onMemories) {
              onMemories();
              return;
            }
            if (feature.id === 'spending' && onSpending) {
              onSpending();
              return;
            }
            if (feature.id === 'settle' && onSettle) {
              onSettle();
              return;
            }
            onSelect(FEATURE_MESSAGES[feature.id]);
          }}
          accessibilityLabel={`${feature.title}. ${feature.description}`}
          style={{ width: cardWidth }}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                minHeight: 118,
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: spaceTypeSoftFill(accent, isDark) }]}>
              <MaterialIcons name={feature.icon} size={20} color={accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{feature.title}</Text>
            <Text style={[styles.desc, { color: colors.textSec }]} numberOfLines={2}>
              {feature.description}
            </Text>
          </View>
        </SpacePressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  desc: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
