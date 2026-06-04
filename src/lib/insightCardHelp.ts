/** 인사이트 카드 ? 설명 — 카드별로 섹션을 추가하면 모달에 자동 반영 */

export type InsightHelpSection = {
  title: string;
  body: string;
};

export type InsightHelpContent = {
  id: string;
  cardTitle: string;
  sections: InsightHelpSection[];
};

export const INSIGHT_CARD_HELP = {
  overallRegret: {
    id: 'overallRegret',
    cardTitle: '총 후회율',
    sections: [
      {
        title: '무엇을 보여주나요?',
        body: '선택한 기간 동안 기록한 소비 중, 리뷰에서 후회했다고 표시된 비율이에요.',
      },
      {
        title: '후회 기준',
        body: '다시 선택하지 않겠다고 답했거나, 만족도가 낮게 평가된 리뷰를 후회로 집계해요.',
      },
      {
        title: '숫자 읽는 법',
        body: '큰 숫자는 후회율(%)이고, 아래에는 후회 건수와 전체 기록 건수를 함께 보여줘요.',
      },
    ],
  },
  moodRegret: {
    id: 'moodRegret',
    cardTitle: '어떤 기분일 때 후회가 많았나요?',
    sections: [
      {
        title: '무엇을 보여주나요?',
        body: '소비를 기록할 때 선택한 기분별로, 나중에 리뷰에서 후회한 비율을 비교해요. 같은 기분일 때 소비 패턴을 돌아볼 수 있어요.',
      },
      {
        title: '기분 구분',
        body: '좋음에는 아주 좋음·좋음, 보통은 그대로, 나쁨에는 안좋음·매우 안좋음이 함께 집계돼요.',
      },
      {
        title: '막대와 숫자',
        body: '막대 길이는 후회율(%)이에요. 오른쪽 숫자는 기록 건수와 후회율을 함께 보여줘요.',
      },
      {
        title: '상세 보기',
        body: '「기분별 분석 보기」에서 각 기분의 요일·시간대·카테고리 패턴과 소비·후회 목록을 볼 수 있어요.',
      },
    ],
  },
  timeWeekdayRegret: {
    id: 'timeWeekdayRegret',
    cardTitle: '요일·시간대 후회 패턴',
    sections: [
      {
        title: '무엇을 보여주나요?',
        body: '소비를 기록한 요일과 시간대별로, 나중에 리뷰에서 후회한 비율을 비교해요. 언제 후회 소비가 자주 일어나는지 파악할 수 있어요.',
      },
      {
        title: '시간대 구분',
        body: '아침(6~12시), 낮(12~18시), 저녁(18~22시), 밤(22~6시) 네 구간으로 나눠요. 소비 기록 시각(spentAt) 기준이에요.',
      },
      {
        title: '알림 목표',
        body: '후회가 많은 요일·시간대를 찾아, 그 시간에 「한번 참아볼까요?」 알림을 보내요. 설정에서 켜고 끌 수 있어요.',
      },
      {
        title: '막대와 숫자',
        body: '막대 길이는 후회율(%)이에요. 기록이 없는 요일·시간은 0%로 항상 표시돼요.',
      },
    ],
  },
} as const satisfies Record<string, InsightHelpContent>;

export type InsightHelpId = keyof typeof INSIGHT_CARD_HELP;

export function getInsightHelpContent(id: InsightHelpId): InsightHelpContent {
  return INSIGHT_CARD_HELP[id];
}
