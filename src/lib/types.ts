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
  | 'good'
  | 'normal'
  | 'bad'
  | 'happy'
  | 'neutral'
  | 'stressed'
  | 'excited'
  | 'tired';

export type ExpenseSourceType = 'manual' | 'card' | 'bank';

export interface Expense {
  id: string;
  accountId: string;
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
export type ScheduleStatus = 'pending' | 'done' | 'skipped';

/** 신규 소비는 d3만 생성. 레거시 immediate·d1·d7·d30 문서는 조회·표시 호환용 */
export type ScheduleType = 'immediate' | 'd1' | 'd7' | 'd3' | 'd30';

export interface ReviewSchedule {
  id: string;
  expenseId: string;
  accountId: string;
  type: ScheduleType;
  dueAt: Date; // 리뷰 예정일
  /** d3=3, immediate=0, d1=1, d7=7, 레거시 d30 */
  delayDays: number;
  status: ScheduleStatus;
  notificationId?: string; // expo-notifications ID
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

export interface Insights {
  period: {
    start: Date;
    end: Date;
  };
  periodMode: 'month' | 'year';
  categoryInsights: CategoryInsight[];
  moodInsights: MoodInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
  /** spentAt 기준 요일별 소비 건수. 인덱스 0=일 … 6=토 (Date.getDay) */
  weekdayExpenseCounts: number[];
  totalExpenses: number;
  totalSpendKrw: number;
  totalRegrets: number;
  overallRegretRate: number;
  /** 월 수입 미설정 시 null */
  incomeInsight: IncomeInsight | null;
  patterns: string[];
}
