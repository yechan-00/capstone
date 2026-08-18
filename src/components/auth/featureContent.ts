import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';

export type FeatureItem = {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description: string;
};

export const LOGIN_FEATURES: FeatureItem[] = [
  {
    icon: 'edit-note',
    title: '왜 샀는지 기록',
    description: '금액뿐 아니라 그 순간의 이유와 기분까지 함께 남겨요.',
  },
  {
    icon: 'insights',
    title: '나만의 소비 습관 발견',
    description: '요일, 시간, 감정 데이터를 통해 반복되는 소비 패턴을 확인해요.',
  },
  {
    icon: 'notifications-active',
    title: '필요한 순간 미리 알림',
    description: '반복되는 소비 시간 전에 한 번 더 생각할 기회를 제공해요.',
  },
];

export const LOGIN_HEADLINE = '오늘의 소비를 기록하고,\n내일의 선택을 바꿔보세요.';

export const LOGIN_SUBCOPY =
  '소비 이유와 감정을 함께 기록하면\n나만의 소비 패턴을 찾아드립니다.';

export const LOGIN_TAGLINE = '감정을 기록하는\n새로운 소비 관리 서비스';

export const LOGIN_MOTTO = '기록하고, 돌아보고, 다음 선택을 바꿔보세요.';
