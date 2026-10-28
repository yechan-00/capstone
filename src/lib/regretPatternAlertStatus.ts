import type { NotificationPermissionKind } from '@/services/notificationService';

export type PatternAlertBadgeId =
  | 'off'
  | 'on'
  | 'permission'
  | 'waiting'
  | 'checking'
  | 'unknown'
  | 'error';

export type PatternAlertBadgeTone = 'off' | 'on' | 'wait' | 'warn' | 'error';

export type PatternAlertBadge = {
  id: PatternAlertBadgeId;
  label: string;
  tone: PatternAlertBadgeTone;
};

export type PatternAlertGuide = {
  title: string;
  body: string;
  tone: PatternAlertBadgeTone;
};

type Params = {
  patternStatus: 'loading' | 'error' | 'ready';
  permission: NotificationPermissionKind | 'loading';
  enabled: boolean;
  hasSlots: boolean;
};

/**
 * '사용 중'은 설정 ON(+권한·패턴)을 뜻합니다. OS 예약 성공을 보장하지 않습니다.
 */
export function resolvePatternAlertBadge(params: Params): PatternAlertBadge {
  if (params.patternStatus === 'loading' || params.permission === 'loading') {
    return { id: 'checking', label: '확인 중', tone: 'wait' };
  }
  if (!params.enabled) {
    return { id: 'off', label: '알림 꺼짐', tone: 'off' };
  }
  if (params.permission === 'denied' || params.permission === 'undetermined') {
    return { id: 'permission', label: '권한 필요', tone: 'warn' };
  }
  if (!params.hasSlots) {
    return { id: 'waiting', label: '분석 대기', tone: 'wait' };
  }
  if (params.permission === 'unknown') {
    return { id: 'unknown', label: '확인 불가', tone: 'wait' };
  }
  return { id: 'on', label: '사용 중', tone: 'on' };
}

export function sheetStatusGuide(params: {
  dirty: boolean;
  draftEnabled: boolean;
  badge: PatternAlertBadge;
}): PatternAlertGuide {
  if (params.dirty) {
    if (params.draftEnabled) {
      return {
        title: '저장하면 예방 알림을 사용해요.',
        body: '',
        tone: 'on',
      };
    }
    return {
      title: '저장하면 예방 알림이 꺼져요.',
      body: '',
      tone: 'off',
    };
  }

  switch (params.badge.id) {
    case 'on':
      return {
        title: '자동 예방 알림 사용 중',
        body: '소비 패턴에 맞춰 알림 시간을 자동으로 설정해요.',
        tone: 'on',
      };
    case 'off':
      return {
        title: '예방 알림 꺼짐',
        body: '알림을 켜면 후회 패턴에 맞춰 소비 전에 알려드려요.',
        tone: 'off',
      };
    case 'permission':
      return {
        title: '알림 권한이 필요해요',
        body: '예방 알림을 받으려면 기기 알림 권한을 허용해주세요.',
        tone: 'warn',
      };
    case 'waiting':
      return {
        title: '후회 패턴을 분석하고 있어요',
        body: '소비와 리뷰가 쌓이면 알림 시간을 자동으로 찾아드려요.',
        tone: 'wait',
      };
    case 'checking':
      return {
        title: '확인 중',
        body: '알림 상태를 확인하고 있어요.',
        tone: 'wait',
      };
    case 'unknown':
      return {
        title: '알림 상태를 확인할 수 없어요',
        body: '이 환경에서는 알림 권한을 확인하지 못해요.',
        tone: 'wait',
      };
    default:
      return {
        title: params.badge.label,
        body: '',
        tone: params.badge.tone,
      };
  }
}
