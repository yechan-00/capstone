import type { Expense, ExpenseCategory, ExpenseMood, ExpenseSourceType } from '@/lib/types';

export type ManualExpenseFormInput = {
  amount: number;
  category: ExpenseCategory;
  item: string;
  reason: string;
  mood: ExpenseMood;
  tags: string[];
  spentAt: Date;
  sourceType: ExpenseSourceType;
  sourceRef?: string | null;
  summaryLine?: string;
  summaryEmoji?: string;
  imageUrl?: string | null;
};

/**
 * 수동 입력 폼 → Firestore 저장용 payload (id/타임스탬프 제외)
 * OCR·붙여넣기 등 자동 입력은 별도 빌더로 조합한 뒤 동일 형태로 넘기면 됨.
 */
export function buildManualExpensePayload(input: ManualExpenseFormInput): Omit<
  Expense,
  'id' | 'accountId' | 'createdAt' | 'updatedAt'
> {
  const item = input.item.trim();
  return {
    amount: input.amount,
    category: input.category,
    item: item || undefined,
    content: item || undefined,
    reason: input.reason,
    mood: input.mood,
    tags: input.tags,
    spentAt: input.spentAt,
    sourceType: input.sourceType,
    sourceRef: input.sourceRef ?? null,
    summaryLine: input.summaryLine?.trim() || undefined,
    summaryEmoji: input.summaryEmoji?.trim() || undefined,
    imageUrl: input.imageUrl ?? null,
  };
}
