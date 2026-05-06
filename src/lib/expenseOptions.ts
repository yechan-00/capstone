export type CategoryKey = 'takeout' | 'cafe' | 'delivery';

export const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'takeout', label: '외식(포장)', emoji: '🥡' },
  { key: 'cafe', label: '카페', emoji: '☕️' },
  { key: 'delivery', label: '배달', emoji: '🛵' },
];

/** 지출 추가 등 선택 UI에만 노출. 키만 추가하면 확장 가능. */
export const CATEGORY_KEYS_SHOWN_IN_PICKER: readonly CategoryKey[] = [
  'takeout',
  'cafe',
  'delivery',
] as const;

const pickerKeySet = new Set<CategoryKey>(CATEGORY_KEYS_SHOWN_IN_PICKER);

export const CATEGORIES_FOR_PICKER = CATEGORIES.filter((c) => pickerKeySet.has(c.key));

export const REASON_GROUPS = [
  {
    title: '🔥 감정 기반',
    items: [
      '스트레스 받아서',
      '기분이 좋아서',
      '우울해서',
      '보상 심리',
      '외로워서',
      '충동적으로',
    ] as const,
  },
  {
    title: '🍔 상황 기반',
    items: [
      '배고파서',
      '시간이 없어서',
      '귀찮아서',
      '약속/모임 때문에',
      '늦은 시간이라서',
      '집에 음식이 없어서',
    ] as const,
  },
  {
    title: '🧠 합리화',
    items: [
      '이 정도는 괜찮지',
      '할인해서',
      '배송비 아까워서 더 삼',
      '어차피 살 거였음',
      '오늘만 특별히',
      '스트레스 해소 필요',
    ] as const,
  },
  {
    title: '🧲 외부 유혹',
    items: [
      '광고 보고',
      '추천/알고리즘 때문에',
      'SNS 보고',
      '친구/지인 영향',
      '리뷰 보고',
    ] as const,
  },
  {
    title: '📦 습관성 소비',
    items: [
      '습관적으로',
      '그냥 항상 하던 거라',
      '생각 없이',
      '자동 결제',
    ] as const,
  },
  {
    title: '💥 기타',
    items: [
      '지금 안 사면 불안해서',
      '무료배송 맞추려고',
      '소량보다 더 싸서',
      '이미 돈 쓴 김에',
      '할인 끝날까봐',
      '기타',
    ] as const,
  },
] as const;

export type Reason = (typeof REASON_GROUPS)[number]['items'][number];
export const REASONS: readonly Reason[] = REASON_GROUPS.flatMap((group) => [...group.items]) as readonly Reason[];

export const MOODS = [
  { key: 'very good', label: '아주 좋음', emoji: '😊' },
  { key: 'good', label: '좋음', emoji: '🙂' },
  { key: 'normal', label: '보통', emoji: '😑' },
  { key: 'bad', label: '안좋음', emoji: '😕' },
  { key: 'too bad', label: '매우 안좋음', emoji: '😠' },
] as const;

export const QUICK_AMOUNTS = [1000, 5000, 10000, 20000, 50000];
