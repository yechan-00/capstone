import { Timestamp } from 'firebase/firestore';
import { ReviewSchedule } from '@/lib/types';
import { resolveDocumentUserId } from '@/lib/accountId';
import { normalizeReviewSatisfaction } from '@/utils/reviewNormalize';

/**
 * Firestore Timestamp를 Date로 변환하는 헬퍼 함수
 */
export const timestampToDate = (timestamp: Timestamp | Date | undefined | null): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
};

export function mapScheduleDoc(docSnap: { id: string; data: () => Record<string, unknown> }): ReviewSchedule {
  const data = docSnap.data();
  const userId = resolveDocumentUserId(data as { accountId?: string; userId?: string }) ?? '';
  return {
    id: docSnap.id,
    ...data,
    userId,
    dueAt: timestampToDate(data.dueAt as Timestamp | Date | undefined),
    expiresAt: data.expiresAt
      ? timestampToDate(data.expiresAt as Timestamp | Date | undefined)
      : undefined,
    createdAt: timestampToDate(data.createdAt as Timestamp | Date | undefined),
    completedAt: timestampToDate(data.completedAt as Timestamp | Date | undefined),
  } as ReviewSchedule;
}

export function mapReviewDoc<
  T extends { id: string; reviewedAt: Date; createdAt: Date; satisfaction: number; userId: string },
>(docSnap: { id: string; data: () => Record<string, unknown> }): T {
  const data = docSnap.data();
  const userId =
    resolveDocumentUserId(data as { accountId?: string; userId?: string }) ??
    (typeof data.reviewerUserId === 'string' ? data.reviewerUserId : '');
  return {
    id: docSnap.id,
    ...data,
    userId,
    reviewedAt: timestampToDate(data.reviewedAt as Timestamp | Date | undefined),
    createdAt: timestampToDate(data.createdAt as Timestamp | Date | undefined),
    satisfaction: normalizeReviewSatisfaction(data.satisfaction),
  } as T;
}
