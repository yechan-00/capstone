export const HOME = {
  green: '#34C36F',
  greenDark: '#2AAD5C',
  greenLight: '#E8F8EE',
  lime: '#E8F8EE',
  brand: '#34C36F',
  coral: '#E57373',
  body: '#64748B',
  dark: '#111827',
  darkAlt: '#1F2937',
  darkDeep: '#0A0A0A',
  neon: '#7DFF9A',
  bg: '#FFFFFF',
  bgSoft: '#F5F7F4',
  bgMuted: '#F3F6F4',
  white: '#FFFFFF',
  gray: '#E5E7EB',
  grayDark: '#D1D5DB',
  text: '#111827',
  textSec: '#64748B',
  textMuted: '#6B7280',
  /** @deprecated use brand */
  navy: '#111827',
  primary: '#34C36F',
  accentGreen: '#34C36F',
  accentOrange: '#E57373',
  accentPurple: '#E57373',
  accentCyan: '#E8F8EE',
  accentMint: '#E8F8EE',
  accentBlue: '#111827',
  maxWidth: 1180,
  headerHeight: 72,
  bezel: '#0B1220',
  island: '#05070A',
} as const;

export const HOME_GRADIENT = {
  hero: ['#FFFFFF', '#F5F7F4'] as const,
  limeBlob: 'rgba(52,195,111,0.12)',
  coralBlob: 'rgba(229,115,115,0.1)',
  accentText: ['#34C36F', '#2AAD5C', '#34C36F'] as const,
} as const;

export const HOME_FEATURES = [
  {
    key: 'analysis',
    title: '소비 패턴 분석',
    desc: '당신의 소비 습관을 한눈에',
  },
  {
    key: 'budget',
    title: '예산 & 목표 관리',
    desc: '목표를 설정하고 꾸준히 달성',
  },
  {
    key: 'regret',
    title: '후회 소비 줄이기',
    desc: '더 현명한 선택을 도와드려요',
  },
  {
    key: 'security',
    title: '데이터는 안전하게',
    desc: '보안은 기본, 안심하고 사용하세요',
  },
] as const;

export const HOME_COPY = {
  heroBadge: '후회는 줄이고, 자산은 키우는 현명한 습관',
  heroTitleLine1: '후회는 줄이고,',
  heroTitleLine2: '자산은 키우고',
  heroSub:
    '나의 소비 습관을 분석하고\n더 나은 선택을 돕는 스마트 가계부',
  heroTrustSafeTitle: '안전한 데이터 관리',
  heroTrustSafeDesc: '금융 보안 시스템 적용',
  heroTrustPrivacyTitle: '개인정보 보호',
  heroTrustPrivacyDesc: '내 정보는 내가 관리',
  heroTrustFreeTitle: '무료로 시작',
  heroTrustFreeDesc: '언제든지 부담 없이',
  heroSocialProof: '120만 명의 사용자와 함께 하고 있어요',
  heroUserCount: '+1,198,633',
  ctaPrimaryHero: '지금 무료로 시작하기',
  ctaBadge: '후회 없는 선택이 쌓여, 더 나은 삶이 됩니다',
  ctaTitle: '지금 바로 더 나은\n소비 습관을 시작하세요',
  ctaSub: '후회가계부와 함께 당신의 소비를 기록하고,\n더 나은 내일을 만들어보세요.',
  ctaProofTitle: '10만 명 이상의 사용자가\n함께하고 있어요',
  ctaProofDownloads: '누적 다운로드 10만+, 꾸준히 성장 중',
  ctaProofRating: '앱스토어 평점 4.8 / 5, 높은 만족도',
  ctaProofPrivacy: '개인정보 보호 최우선, 안심하고 사용',
  storySectionLabel: '반복 패턴 분석',
  storyTitleMain: '반복되는 후회를 발견합니다',
  storyLead: '가계부처럼 기록된 후회를 분석해\n나의 반복 패턴을 보여드려요.',
  storyTitle: '왜 같은 소비를\n반복하게 될까요?',
  storyTitleAccent: '반복하게',
  storyBodyLine1: '후회가계부는 소비의 순간을 기록하고,',
  storyBodyLine2: '그 이유와 감정을 함께 남겨요.',
  storyBodyLine3Prefix: '이 쌓이면, 패턴이 보이고',
  storyBodyLine3Suffix: '가 시작돼요.',
  storyBodyHighlight1: '기록',
  storyBodyHighlight2: '변화',
  recordTitle: '무엇을 샀는지보다\n왜 샀는지가 중요합니다.',
  recordTitleAccent: '왜',
  recordSectionIndex: '03',
  recordSub:
    '지출의 이유를 기록하고 분석하면 후회는 줄고, 선택은 더 나아집니다.',
  insightTitle: '내 소비에도\n패턴이 있습니다.',
  insightTitleAccent: '패턴',
  insightSectionIndex: '04',
  insightSectionLabel: '패턴 분석',
  insightSub: '반복되는 후회를 발견합니다.',
  insightBody:
    '요일, 시간, 감정 데이터를 바탕으로\n야식과 배달이 반복되는 순간을 찾아냅니다.',
  insightCtaBar: '당신의 소비 패턴이 보이면, 후회 없는 선택이 시작됩니다.',
  insightPanelLabel: '최근 한 달 분석',
  preventionSectionIndex: '05',
  preventionTitle: '후회하기 전에\n먼저 알려드립니다.',
  preventionBody:
    '반복되는 배달·야식 시간 전에 한 번 더 생각할 수 있도록 알려드려요.',
  preventionBodyExtended:
    '반복되는 순간을 미리 알려드려요.\n후회는 줄이고, 선택은 더 현명하게.',
  preventionNotif:
    '오늘 밤 9시, 야식 주문이 반복되던 시간이에요. 지금 한 번만 더 생각해볼까요?',
  preventionNotifTitle: '후회가계부',
  preventionHint: '오늘 21시,\n반복되는 야식 패턴이 있어요.',
  communityTitle: '혼자 기록하고,\n함께 공감하세요.',
  communityBody:
    '비슷한 배달, 야식, 카페 소비 경험을 공유하고\n다른 사람들의 이야기를 확인해보세요.',
  communityBadge: '곧 출시 예정',
  finalTitle: '오늘의 기록이\n내일의 선택을\n바꿉니다.',
  finalSub:
    '후회했던 소비를 다시 돌아보고,\n다음에는 조금 더 나은 선택을 해보세요.',
  carouselTitle: '익숙한 소비 습관을\n이해하는 네 가지 경험',
  ctaPrimary: '무료로 시작하기',
  ctaExplore: '사용 방법 보기',
  storeComingSoon: '곧 출시 예정',
  storeAppStore: '앱스토어',
  storeGooglePlay: '구글 플레이',
  storeQr: '모바일에서 바로 시작하기',
  footerTagline: '후회를 기록하면, 더 나은 선택이 쌓입니다.',
  footerNewsletterTitle: '후회 없는 소비 습관,\n뉴스레터로 받아보세요',
  footerNewsletterSub: '매주 실천 가능한 소비 습관 팁을 보내드려요.',
  footerCopyright: '© 2024 후회가계부. All rights reserved.',
  footer: '© 후회가계부',
  headerLogo: '후회가계부',
  headerNavFeatures: '기능',
  headerNavService: '소개',
  headerNavHowTo: '자주 묻는 질문',
  headerNavReviews: '사용 후기',
  headerNavCommunity: '커뮤니티',
  headerNavLogin: '로그인',
  headerDownload: '시작하기',
} as const;

export const PATTERN_CARDS = [
  {
    title: '늦은 밤 배달 주문',
    desc: '피곤하고 허기진 순간,\n매번 후회하는 야식 배달',
    icon: 'delivery-dining',
    illusBg: '#E8F4FD',
    illusColor: '#42A5F5',
    tags: [
      { label: '피곤함', emoji: '😪', bg: '#E3F2FD' },
      { label: '죄책감', emoji: '☹️', bg: '#E3F2FD' },
      { label: '야간', emoji: '🌙', bg: '#F5F5F5' },
    ],
  },
  {
    title: '충동적인 쇼핑',
    desc: '스트레스 받을 때마다\n나도 모르게 결제하는 소비',
    icon: 'shopping-bag',
    illusBg: '#FCE4EC',
    illusColor: '#EC407A',
    tags: [
      { label: '충동', emoji: '😳', bg: '#FFF3E0' },
      { label: '후회', emoji: '😣', bg: '#EDE7F6' },
      { label: '소비', emoji: '🛍️', bg: '#FFE0B2' },
    ],
  },
  {
    title: '미루고 후회하기',
    desc: '지금 할 걸 미루다가\n마감 직전에 후회하는 순간들',
    icon: 'laptop-mac',
    illusBg: '#E8F5E9',
    illusColor: '#66BB6A',
    tags: [
      { label: '불안', emoji: '😰', bg: '#E3F2FD' },
      { label: '스트레스', emoji: '😫', bg: '#FFF8E1' },
      { label: '시간 낭비', emoji: '⏰', bg: '#E8F5E9' },
    ],
  },
] as const;

export const RECORD_FEATURE_CHIPS = [
  {
    icon: 'edit-note',
    title: '이유 기록',
    desc: '소비 순간의 맥락을 기록해요',
    bg: HOME.greenLight,
    color: HOME.green,
  },
  {
    icon: 'bar-chart',
    title: '패턴 분석',
    desc: '나만의 인사이트를 발견해요',
    bg: '#E3F2FD',
    color: '#42A5F5',
  },
  {
    icon: 'trending-up',
    title: '후회 줄이기',
    desc: '더 나은 선택을 도와드려요',
    bg: '#FFF8E1',
    color: '#F9A825',
  },
] as const;

export const ANALYSIS_SUMMARY_CARDS = [
  { icon: 'calendar-today', label: '요일 분석', value: '금·토요일에 지출 집중' },
  { icon: 'schedule', label: '시간 분석', value: '오후 9시~12시 지출 많음' },
  { icon: 'mood', label: '감정 분석', value: '스트레스·외로움 연관' },
] as const;

export const STORY_CARDS = [
  {
    step: '01',
    icon: 'delivery-dining',
    title: '금요일 밤 10시 배달 주문',
    desc: '피곤한 금요일, 배달 앱을 열고 충동적으로 주문했어요.',
  },
  {
    step: '02',
    icon: 'mood-bad',
    title: '스트레스 야식 선택',
    desc: '스트레스와 피로를 풀고 싶어서 자극적인 음식을 선택했어요.',
  },
  {
    step: '03',
    icon: 'rate-review',
    title: '3일 뒤 후회 리뷰',
    desc: '속이 더부룩하고 후회되는 마음, 기록하며 다음엔 다르게 선택해요.',
  },
] as const;

/** 줄바꿈 위치가 고정된 타이틀 (단어 중간 분리 방지) */
export const HOME_TITLE_LINES = {
  hero: ['소비의 기록이', '당신의 일상을 바꿉니다.'] as const,
  story: ['왜 같은 소비를', '반복하게 될까요?'] as const,
  record: ['무엇을 샀는지보다', '왜 샀는지가 중요합니다.'] as const,
  insight: ['내 소비에도', '패턴이 있습니다.'] as const,
  prevention: ['후회하기 전에', '먼저 알려드립니다.'] as const,
  community: ['혼자 기록하고,', '함께 공감하세요.'] as const,
  final: ['오늘의 기록이', '내일의 선택을', '바꿉니다.'] as const,
  carousel: ['익숙한 소비 습관을', '이해하는 네 가지 경험'] as const,
} as const;

export const HOME_FLOATING_CARDS = [
  { label: '이번 달 후회율', value: '13% 감소', accent: HOME.brand },
  { label: '금요일 밤', value: '야식 패턴 발견', accent: HOME.coral },
  { label: '오늘 21시', value: '한 번 더 생각할 시간', accent: HOME.lime },
] as const;

export const RECORD_TAG_CHIPS = [
  { label: '스트레스', icon: 'park', bg: '#E8F8EE', color: '#34C36F' },
  { label: '보상', icon: 'card-giftcard', bg: '#E8F5E9', color: '#66BB6A' },
  { label: '야식', icon: 'nightlight-round', bg: '#E3F2FD', color: '#42A5F5' },
  { label: '데이트', icon: 'favorite', bg: '#F3E5F5', color: '#AB47BC' },
  { label: '입이 심심해서', icon: 'sentiment-satisfied-alt', bg: '#E0F2F1', color: '#26A69A' },
] as const;

export const RECORD_TAGS = RECORD_TAG_CHIPS.map((chip) => chip.label);

export const ANALYSIS_STAT_CARDS = [
  {
    icon: 'schedule',
    label: '가장 많이 후회한 시간',
    value: '금요일 밤 10시',
    highlight: '',
  },
  {
    icon: 'delivery-dining',
    label: '가장 많이 후회한 소비 유형',
    value: '배달 후회율 ',
    highlight: '높음',
  },
  {
    icon: 'psychology',
    label: '주요 감정 태그',
    value: '스트레스 태그 ',
    highlight: '72%',
  },
] as const;

export const ANALYSIS_INSIGHTS = [
  { text: '금요일 밤 10시', accent: HOME.neon },
  { text: '배달 후회율 높음', accent: HOME.neon },
  { text: '스트레스 태그 72%', accent: HOME.neon },
  { text: '야식 패턴 발견', accent: HOME.neon },
] as const;

export const HOME_CAROUSEL = [
  {
    key: 'record',
    title: '기록',
    subtitle: '이유와 감정을 함께 남겨요.',
    backgroundColor: HOME.lime,
    textColor: HOME.brand,
    screen: 'home' as const,
  },
  {
    key: 'analysis',
    title: '분석',
    subtitle: '반복되는 패턴을 발견해요.',
    backgroundColor: HOME.body,
    textColor: HOME.white,
    screen: 'insights' as const,
  },
  {
    key: 'prevention',
    title: '예방',
    subtitle: '후회하기 전에 알려드려요.',
    backgroundColor: HOME.coral,
    textColor: HOME.white,
    screen: 'notification' as const,
  },
  {
    key: 'community',
    title: '공감',
    subtitle: '비슷한 경험을 함께 나눠요.',
    backgroundColor: HOME.brand,
    textColor: HOME.lime,
    screen: 'community' as const,
  },
] as const;
