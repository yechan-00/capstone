// Account Types
export interface Account {
  id: string;
  userId: string; // Firebase Auth UID
  name: string;
  /** 앱에 표시할 사용자 닉네임 (가계부 이름 name과 별도) */
  nickname?: string;
  /** @deprecated 하위 호환용. 신규 필드 reviewReminderTime 우선 */
  notificationTime?: string; // "HH:mm"
  /** 리뷰 알림 시각 (HH:mm). 없으면 notificationTime 또는 19:00 */
  reviewReminderTime?: string;
  /** 리뷰 푸시 알림 사용 여부 (기본 true) */
  reviewReminderEnabled?: boolean;
  /** 후회 패턴(요일·시간) 예방 알림 (기본 true) */
  regretPatternAlertEnabled?: boolean;
  /** 서버·로컬 알림 스케줄용 계산된 슬롯 */
  regretPatternAlertSlots?: RegretPatternAlertSlot[];
  regretPatternAlertSyncedAt?: Date;
  /** Expo push (Cloud Functions 원격 알림용) */
  expoPushToken?: string | null;
  expoPushTokenUpdatedAt?: Date;
  /** 알림 시간대 (IANA, 예: Asia/Seoul) */
  notificationTimezone?: string;
  /**
   * 리뷰 알림 기준 일수(복수 선택).
   * 예: [1,3,7,30]. 비어있으면 기본 [3].
   * (이전 버전의 단일값(3|7|30)도 마이그레이션을 위해 허용)
   */
  reviewDelayDays?: (1 | 3 | 7 | 30)[] | 3 | 7 | 30;
  /** 사용자가 선택한 통화 기준 월 수입(정수). 인사이트에서는 toMonthlyIncomeKrw()로 원화 환산 */
  monthlyIncomeAmount?: number;
  monthlyIncomeCurrency?: 'KRW' | 'USD';
  exchangeRateUsdToKrw?: number;
  /** 식비(외식·배달·카페) 월 예산. 월 수입과 별도 설정 가능 */
  foodBudgetAmount?: number;
  foodBudgetCurrency?: 'KRW' | 'USD';
  /** 통계·예산 주기: calendar=달력 월, payday=월급날 기준 */
  budgetPeriodMode?: 'calendar' | 'payday';
  /** 매월 월급날(1~31). budgetPeriodMode=payday 일 때 사용 */
  paydayDayOfMonth?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountMember {
  id: string;
  accountId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: Date;
}

// Expense Types
export type ExpenseCategory =
  | 'takeout'
  | 'cafe'
  | 'delivery'
  /** @deprecated Firestore 레거시. 읽기 시 takeout으로 정규화 */
  | 'food';

export type ExpenseMood =
  | 'very good'
  | 'good'
  | 'normal'
  | 'bad'
  | 'too bad'
  /** @deprecated 레거시. normalizeExpenseMood로 정규화 */
  | 'happy'
  | 'neutral'
  | 'stressed'
  | 'excited'
  | 'tired';

export type ExpenseSourceType = 'manual' | 'card' | 'bank';

export interface Expense {
  id: string;
  accountId: string;
  userId: string;
  amount: number;
  /** 무엇을 샀는지 (표시·검색 우선) */
  item?: string;
  /** @deprecated item과 동일 의미로 유지. 구문서 호환 */
  content?: string;
  category: ExpenseCategory;
  reason: string;
  mood: ExpenseMood;
  tags: string[];
  /** 한줄평 (식후 기록용) */
  summaryLine?: string;
  summaryEmoji?: string;
  /** Firebase Storage URL */
  imageUrl?: string | null;
  spentAt: Date;
  sourceType: ExpenseSourceType;
  sourceRef?: string | null; // 카드명, 계좌명 등
  createdAt: Date;
  updatedAt: Date;
}

// Review Types
export type DecisionAgain = 'yes' | 'maybe' | 'no';

export type RegretReason =
  | 'taste'
  | 'price'
  | 'portion'
  | 'delivery_condition'
  | 'delivery_speed'
  | 'my_condition'
  | 'impulse'
  | 'health'
  | 'value_for_money'
  | 'reorder_intent'
  | 'vs_expectation'
  | 'replaceable'
  | 'other';

export type ReviewType = 'self' | 'shared'; // 개인/공유 리뷰

export interface Review {
  id: string;
  expenseId: string;
  scheduleId: string;
  accountId: string;
  userId: string;
  reviewerUserId: string;
  reviewType: ReviewType;
  decisionAgain: DecisionAgain;
  satisfaction: number; // 1 매우불만족 ~ 5 매우만족
  regretReasons: RegretReason[];
  otherReason?: string;
  notes?: string;
  reviewedAt: Date;
  createdAt: Date;
}

// Review Schedule Types
export type ScheduleStatus = 'pending' | 'done' | 'skipped' | 'expired';

/** 신규: d1=다음날 0시 오픈. 레거시 immediate·d3·d7·d30 호환 */
export type ScheduleType = 'immediate' | 'd1' | 'd7' | 'd3' | 'd30';

export interface ReviewSchedule {
  id: string;
  expenseId: string;
  accountId: string;
  userId: string;
  type: ScheduleType;
  /** 앱에서 평가 가능해지는 시각 (소비 다음날 00:00) */
  dueAt: Date;
  /** dueAt + 47시간 59분 */
  expiresAt?: Date;
  /** d1=1 (신규 고정). 레거시 3·7·30 */
  delayDays: number;
  status: ScheduleStatus;
  notificationId?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Insights Types
export interface CategoryInsight {
  category: ExpenseCategory;
  totalCount: number;
  regretCount: number;
  regretRate: number;
}

export interface MoodInsight {
  mood: ExpenseMood;
  totalCount: number;
  regretCount: number;
  regretRate: number;
}

export interface TimeOfDayInsight {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  totalCount: number;
  regretCount: number;
  regretRate: number;
}

/** spentAt 기준 요일(0=일 … 6=토)별 후회 집계 */
export interface WeekdayInsight {
  weekday: number;
  totalCount: number;
  regretCount: number;
  regretRate: number;
}

/** 후회 패턴 예방 알림 슬롯 (요일/시간) */
export type RegretPatternAlertSlot = {
  id: string;
  kind: 'weekday' | 'time';
  weekday?: number;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  hour: number;
  minute: number;
  label: string;
  regretRate: number;
  totalCount: number;
  regretCount: number;
  avgPurchaseHour?: number;
  avgPurchaseMinute?: number;
  leadMinutes?: number;
};

export type InsightsWindow =
  | { mode: 'month'; year: number; monthIndex: number }
  | { mode: 'year'; year: number };

/** 설정된 월 수입 대비 기간 소비 요약 (원화 기준) */
export interface IncomeInsight {
  monthlyIncomeKrw: number;
  /** month: 월 수입, year: 월 수입 × 12 */
  budgetKrw: number;
  totalSpendKrw: number;
  spendRatioPercent: number;
  remainingKrw: number;
  isOverBudget: boolean;
}

/** 설정된 식비 예산 대비 기간 소비 요약 */
export interface FoodBudgetInsight {
  budgetKrw: number;
  totalSpendKrw: number;
  spendRatioPercent: number;
  remainingKrw: number;
  isOverBudget: boolean;
  periodLabel: string;
  periodMode: 'calendar' | 'payday';
  /** 전체 사용자 비교 (추후 집계). 현재 null */
  savingsPercentile: number | null;
}

export interface Insights {
  period: {
    start: Date;
    end: Date;
  };
  periodMode: 'month' | 'year';
  categoryInsights: CategoryInsight[];
  moodInsights: MoodInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
  weekdayInsights: WeekdayInsight[];
  /** spentAt 기준 요일별 소비 건수. 인덱스 0=일 … 6=토 (Date.getDay) */
  weekdayExpenseCounts: number[];
  /** spentAt 기준 요일별 카테고리 건수 (delivery/cafe/takeout). 인덱스 0=일 … 6=토 */
  weekdayCategoryCounts: Array<Record<string, number>>;
  totalExpenses: number;
  totalSpendKrw: number;
  totalRegrets: number;
  overallRegretRate: number;
  /** 월 수입 미설정 시 null */
  incomeInsight: IncomeInsight | null;
  /** 식비 예산 미설정 시 null */
  foodBudgetInsight: FoodBudgetInsight | null;
  patterns: string[];
}

/** 소비 공유 링크 (게스트가 토큰으로 열람) */
export interface ExpenseShare {
  token: string;
  expenseId: string;
  accountId: string;
  createdByUserId: string;
  active: boolean;
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  imageUrl: string | null;
  spentAt: Date;
  createdAt: Date;
}

/** 공유 링크에 게스트가 남긴 코멘트 */
export interface GuestComment {
  id: string;
  guestName: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
}

/** 사용자에게 표시되는 알림 (공유 코멘트 등) */
export interface UserNotification {
  id: string;
  userId: string;
  type: 'share_comment';
  shareToken: string;
  expenseId: string | null;
  shareTitle?: string;
  shareSubtitle?: string;
  guestName: string;
  bodyPreview: string;
  read: boolean;
  createdAt: Date;
}
