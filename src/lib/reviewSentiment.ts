import { isRegretReview } from '@/lib/moodInsightDetail';
import type { Review } from '@/lib/types';
import { normalizeReviewSatisfaction } from '@/utils/reviewNormalize';

export type ReviewSentiment = 'positive' | 'negative' | 'neutral';

/**
 * 캘린더·모달 색. `reviewService`가 Firestore 값을 `normalizeReviewSatisfaction`으로 숫자화하므로
 * 기존 리뷰(문자열 satisfaction, Long 등)도 1~5면 그대로 4~5 초록·3 노랑·1~2 빨강.
 * satisfaction이 없거나 파싱 불가면 `decisionAgain`(yes/maybe/no)으로 동일 3단 톤 폴백.
 */
export function sentimentFromDecision(review: Review): ReviewSentiment {
  const s = normalizeReviewSatisfaction(review.satisfaction);
  if (Number.isFinite(s) && s >= 1 && s <= 5) {
    if (s >= 4) return 'positive';
    if (s === 3) return 'neutral';
    return 'negative';
  }
  switch (review.decisionAgain) {
    case 'yes':
      return 'positive';
    case 'no':
      return 'negative';
    case 'maybe':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function reviewSentimentLabel(review: Review): string {
  const tone = sentimentFromDecision(review);
  if (tone === 'positive') return '만족한 소비';
  if (tone === 'negative') return '후회한 소비';
  return '보통인 소비';
}

/** 모달·목록에서 감성 점(만족/보통/불만족) 표시용 — 캘린더 pill과 동일 기준 */
export function sentimentMarkerColor(review: Review, isDark: boolean): string {
  const tone = sentimentFromDecision(review);
  if (isDark) {
    if (tone === 'positive') return '#4ade80';
    if (tone === 'negative') return '#fb7185';
    return '#facc15';
  }
  if (tone === 'positive') return '#16a34a';
  if (tone === 'negative') return '#dc2626';
  return '#ca8a04';
}

const REVIEW_CALENDAR_TEXT_ON_DARK_PILL = '#f8fafc';

/** 리뷰 완료 항목: 긍정·부정·보통은 배경만 구분 (다크는 불투명 배경으로 빨강도 확실히) */
export function reviewSentimentColors(review: Review, isDark: boolean): { bg: string; text: string } {
  const tone = sentimentFromDecision(review);
  if (isDark) {
    switch (tone) {
      case 'positive':
        return { bg: '#14532d', text: REVIEW_CALENDAR_TEXT_ON_DARK_PILL };
      case 'negative':
        return { bg: '#9f1239', text: '#fecdd3' };
      case 'neutral':
      default:
        return { bg: '#713f12', text: '#fef9c3' };
    }
  }
  switch (tone) {
    case 'positive':
      return { bg: '#E3F4EA', text: '#166534' };
    case 'negative':
      return { bg: '#FDE8E8', text: '#b91c1c' };
    case 'neutral':
    default:
      return { bg: '#FEF6D8', text: '#92400e' };
  }
}

export function reviewSentimentSurface(review: Review, isDark: boolean): {
  bg: string;
  text: string;
  dot: string;
  border: string;
} {
  const base = reviewSentimentColors(review, isDark);
  const dot = sentimentMarkerColor(review, isDark);
  const border = isDark ? 'rgba(248, 250, 252, 0.22)' : 'rgba(15, 23, 42, 0.12)';
  return { bg: base.bg, text: base.text, dot, border };
}

export function satisfactionLevelFromReview(review: Review | undefined): number | null {
  if (!review) return null;
  const s = normalizeReviewSatisfaction(review.satisfaction);
  if (Number.isFinite(s) && s >= 1 && s <= 5) return s;
  switch (review.decisionAgain) {
    case 'yes':
      return 4;
    case 'maybe':
      return 3;
    case 'no':
      return 2;
    default:
      return null;
  }
}

export type CalendarReviewStatus = 'satisfied' | 'neutral' | 'regretted' | 'pending';

/**
 * 홈 캘린더 셀 전용 4단 상태. 후회 판정은 인사이트와 같은 `isRegretReview`를 먼저 적용하고,
 * 나머지는 만족도 4~5 만족 · 3 보통. 리뷰가 없거나 아직 로딩 전이면 pending.
 * 만족도·decisionAgain 모두 해석할 수 없는 리뷰는 시트·상세(`reviewSentimentLabel`)와 같이 보통으로 둡니다.
 */
export function calendarReviewStatus(review: Review | undefined): CalendarReviewStatus {
  if (!review) return 'pending';
  if (isRegretReview(review)) return 'regretted';
  const level = satisfactionLevelFromReview(review);
  if (level != null && level >= 4) return 'satisfied';
  if (level != null && level <= 2) return 'regretted';
  return 'neutral';
}

export type CalendarReviewStatusStyle = {
  bg: string;
  border: string;
  accent: string;
  text: string;
  badgeRing: string;
  a11yLabel: string;
};

const CALENDAR_STATUS_A11Y: Record<CalendarReviewStatus, string> = {
  satisfied: '평가 완료, 만족한 소비',
  neutral: '평가 완료, 보통인 소비',
  regretted: '평가 완료, 후회한 소비',
  pending: '평가 전 소비',
};

const CALENDAR_STATUS_LIGHT: Record<CalendarReviewStatus, Omit<CalendarReviewStatusStyle, 'a11yLabel'>> = {
  satisfied: { bg: '#EAF5EE', border: '#A8CEB7', accent: '#4D9270', text: '#2F6B50', badgeRing: '#FFFFFF' },
  neutral: { bg: '#FFF7E4', border: '#E8CF91', accent: '#C49A43', text: '#7A5F22', badgeRing: '#FFFFFF' },
  regretted: { bg: '#FCEDEC', border: '#E3B2AD', accent: '#C77D76', text: '#8A4B45', badgeRing: '#FFFFFF' },
  pending: { bg: '#F4F5F4', border: '#E3E7E4', accent: '#89948E', text: '#5F6B65', badgeRing: '#FFFFFF' },
};

const CALENDAR_STATUS_DARK: Record<CalendarReviewStatus, Omit<CalendarReviewStatusStyle, 'a11yLabel'>> = {
  satisfied: { bg: '#1C2A24', border: '#4A7A64', accent: '#4D9270', text: '#C9E0D4', badgeRing: '#121815' },
  neutral: { bg: '#2A261C', border: '#8A7A5A', accent: '#C49A43', text: '#E8DFC8', badgeRing: '#121815' },
  regretted: { bg: '#2C221E', border: '#A07868', accent: '#C77D76', text: '#F0D8CC', badgeRing: '#121815' },
  pending: { bg: '#1E2624', border: '#2A3430', accent: '#89948E', text: '#A8B5B0', badgeRing: '#121815' },
};

const REVIEW_STATUS_COPY: Record<CalendarReviewStatus, { title: string; hint: string }> = {
  satisfied: { title: '만족한 소비', hint: '다시 선택해도 좋을 소비예요.' },
  neutral: { title: '보통인 소비', hint: '나쁘지 않았지만 아쉬움도 있어요.' },
  regretted: { title: '후회한 소비', hint: '다음 선택에 참고할 기록이에요.' },
  pending: { title: '평가 전 소비', hint: '' },
};

export function reviewStatusCopy(status: CalendarReviewStatus): { title: string; hint: string } {
  return REVIEW_STATUS_COPY[status];
}

/** 저장된 만족도가 1~5 정수일 때만 별 개수. decisionAgain으로 추정하지 않습니다. */
export function reviewSatisfactionStars(review: Review): number | null {
  const s = normalizeReviewSatisfaction(review.satisfaction);
  return Number.isInteger(s) && s >= 1 && s <= 5 ? s : null;
}

export function calendarReviewStatusStyle(
  status: CalendarReviewStatus,
  isDark: boolean,
): CalendarReviewStatusStyle {
  const palette = isDark ? CALENDAR_STATUS_DARK : CALENDAR_STATUS_LIGHT;
  return { ...palette[status], a11yLabel: CALENDAR_STATUS_A11Y[status] };
}
