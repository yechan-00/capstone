/**
 * Firestore 쿼리 예시 코드 (Subcollection 구조)
 * 
 * 이 파일은 참고용이며, 실제 서비스 파일들은 flat 구조를 사용합니다.
 * Subcollection 구조로 마이그레이션 시 이 코드를 참고하세요.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Expense, Review, ReviewSchedule } from '@/lib/types';
import { addDays, subDays } from 'date-fns';

// ============================================
// 1. 홈 화면: 대기 중인 리뷰 스케줄 조회
// ============================================
export async function getPendingSchedules(accountId: string): Promise<ReviewSchedule[]> {
  const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
  
  const q = query(
    schedulesRef,
    where('accountId', '==', accountId),
    where('status', '==', 'pending'),
    where('dueAt', '<=', Timestamp.now()),
    orderBy('dueAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    dueAt: doc.data().dueAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  })) as ReviewSchedule[];
}

// ============================================
// 2. 최근 소비 리스트 조회
// ============================================
export async function getRecentExpenses(
  accountId: string, 
  limitCount: number = 20
): Promise<Expense[]> {
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  
  const q = query(
    expensesRef,
    where('accountId', '==', accountId),
    orderBy('spentAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    spentAt: doc.data().spentAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Expense[];
}

// ============================================
// 3. 인사이트: 최근 30일 소비 및 리뷰 조회 (최적화 버전)
// ============================================
export async function getInsightsData(accountId: string, days: number = 30) {
  const startDate = subDays(new Date(), days);
  const startTimestamp = Timestamp.fromDate(startDate);
  
  // 소비 조회
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  const expensesQuery = query(
    expensesRef,
    where('accountId', '==', accountId),
    where('spentAt', '>=', startTimestamp),
    orderBy('spentAt', 'desc')
  );
  
  const expensesSnapshot = await getDocs(expensesQuery);
  const expenses = expensesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    spentAt: doc.data().spentAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Expense[];
  
  // 리뷰는 필요한 expense만 선택적으로 조회 (최적화)
  // 또는 평탄화된 구조 사용 시 별도 쿼리 가능
  const expenseIds = expenses.map(e => e.id);
  const reviews: Review[] = [];
  
  // 병렬로 리뷰 조회 (최대 10개씩 배치 처리)
  const batchSize = 10;
  for (let i = 0; i < expenseIds.length; i += batchSize) {
    const batch = expenseIds.slice(i, i + batchSize);
    const reviewPromises = batch.map(async (expenseId) => {
      const reviewsRef = collection(
        db,
        `accounts/${accountId}/expenses/${expenseId}/reviews`
      );
      const reviewsQuery = query(reviewsRef, orderBy('reviewedAt', 'desc'));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      return reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        expenseId,
        ...doc.data(),
        reviewedAt: doc.data().reviewedAt?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Review[];
    });
    
    const batchReviews = await Promise.all(reviewPromises);
    reviews.push(...batchReviews.flat());
  }
  
  return { expenses, reviews };
}

// ============================================
// 4. 특정 소비의 리뷰 목록 조회
// ============================================
export async function getExpenseReviews(
  accountId: string,
  expenseId: string
): Promise<Review[]> {
  const reviewsRef = collection(
    db,
    `accounts/${accountId}/expenses/${expenseId}/reviews`
  );
  
  const q = query(reviewsRef, orderBy('reviewedAt', 'desc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    expenseId,
    ...doc.data(),
    reviewedAt: doc.data().reviewedAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
  })) as Review[];
}

// ============================================
// 5. 소비 생성 및 스케줄 자동 생성 (트랜잭션)
// ============================================
export async function createExpenseWithSchedules(
  accountId: string,
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    const expensesRef = collection(db, `accounts/${accountId}/expenses`);
    const expenseRef = doc(expensesRef);
    
    // 소비 생성
    transaction.set(expenseRef, {
      ...expenseData,
      accountId,
      spentAt: Timestamp.fromDate(expenseData.spentAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const expenseId = expenseRef.id;
    
    // 리뷰 스케줄 생성 (3, 7, 30일)
    const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
    const delayDays = [3, 7, 30];
    
    delayDays.forEach(delay => {
      const scheduleRef = doc(schedulesRef);
      const dueAt = addDays(expenseData.spentAt, delay);
      transaction.set(scheduleRef, {
        expenseId,
        accountId,
        dueAt: Timestamp.fromDate(dueAt),
        delayDays: delay,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    });
    
    return expenseId;
  });
}

// ============================================
// 6. 리뷰 생성 및 스케줄 완료 처리 (트랜잭션)
// ============================================
export async function createReview(
  accountId: string,
  expenseId: string,
  scheduleId: string,
  reviewData: Omit<Review, 'id' | 'createdAt'>
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    // 리뷰 생성
    const reviewsRef = collection(
      db,
      `accounts/${accountId}/expenses/${expenseId}/reviews`
    );
    const reviewRef = doc(reviewsRef);
    
    transaction.set(reviewRef, {
      ...reviewData,
      expenseId,
      scheduleId,
      accountId,
      reviewedAt: Timestamp.fromDate(reviewData.reviewedAt),
      createdAt: serverTimestamp(),
    });
    
    // 스케줄 상태 업데이트
    const scheduleRef = doc(
      db,
      `accounts/${accountId}/review_schedules/${scheduleId}`
    );
    transaction.update(scheduleRef, {
      status: 'done',
      completedAt: serverTimestamp(),
    });
    
    return reviewRef.id;
  });
}

// ============================================
// 7. 소비 조회 (단일)
// ============================================
export async function getExpenseById(
  accountId: string,
  expenseId: string
): Promise<Expense | null> {
  const expenseRef = doc(db, `accounts/${accountId}/expenses/${expenseId}`);
  const expenseDoc = await getDoc(expenseRef);
  
  if (!expenseDoc.exists()) {
    return null;
  }
  
  const data = expenseDoc.data();
  return {
    id: expenseDoc.id,
    ...data,
    spentAt: data.spentAt?.toDate(),
    createdAt: data.createdAt?.toDate(),
    updatedAt: data.updatedAt?.toDate(),
  } as Expense;
}

// ============================================
// 8. 소비 수정
// ============================================
export async function updateExpense(
  accountId: string,
  expenseId: string,
  updates: Partial<Expense>
): Promise<void> {
  const expenseRef = doc(db, `accounts/${accountId}/expenses/${expenseId}`);
  const updateData: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  
  if (updates.spentAt) {
    updateData.spentAt = Timestamp.fromDate(updates.spentAt);
  }
  
  await updateDoc(expenseRef, updateData);
}

// ============================================
// 9. 소비 삭제 (관련 스케줄도 삭제)
// ============================================
export async function deleteExpense(
  accountId: string,
  expenseId: string
): Promise<void> {
  return runTransaction(db, async (transaction) => {
    // 소비 삭제
    const expenseRef = doc(db, `accounts/${accountId}/expenses/${expenseId}`);
    transaction.delete(expenseRef);
    
    // 관련 스케줄 조회 및 삭제
    const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
    const schedulesQuery = query(
      schedulesRef,
      where('expenseId', '==', expenseId)
    );
    const schedulesSnapshot = await getDocs(schedulesQuery);
    
    schedulesSnapshot.docs.forEach(scheduleDoc => {
      transaction.delete(scheduleDoc.ref);
    });
  });
}

// ============================================
// 10. 스케줄 조회 (expenseId 기준)
// ============================================
export async function getSchedulesByExpenseId(
  accountId: string,
  expenseId: string
): Promise<ReviewSchedule[]> {
  const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
  const q = query(
    schedulesRef,
    where('expenseId', '==', expenseId),
    orderBy('delayDays', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    dueAt: doc.data().dueAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  })) as ReviewSchedule[];
}
