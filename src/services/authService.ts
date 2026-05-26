import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  reload,
  linkWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toAccountId } from '@/lib/accountId';
import { Account } from '@/lib/types';
import { DEFAULT_REVIEW_DELAY_DAYS, DEFAULT_REVIEW_REMINDER_TIME } from '@/lib/accountSettings';
import { timestampToDate } from '@/utils/firestore';

export const signUp = async (email: string, password: string): Promise<UserCredential> => {
  try {
    const current = auth.currentUser;
    const trimmedEmail = email.trim();

    // 익명(게스트) 사용 중이면 "새 계정 생성"이 아니라 현재 계정에 이메일/비번을 연결(link)
    const userCredential = current?.isAnonymous
      ? await (async () => {
          const cred = EmailAuthProvider.credential(trimmedEmail, password);
          const linked = await linkWithCredential(current, cred);
          return linked;
        })()
      : await createUserWithEmailAndPassword(auth, trimmedEmail, password);

    const user = userCredential.user;

    // 회원가입 후 자동으로 Account 생성
    const accountId = toAccountId(user.uid);
    const account: Account = {
      id: accountId,
      userId: user.uid,
      name: '내 가계부',
      nickname: '',
      notificationTime: DEFAULT_REVIEW_REMINDER_TIME,
      reviewReminderTime: DEFAULT_REVIEW_REMINDER_TIME,
      reviewReminderEnabled: true,
      reviewDelayDays: [...DEFAULT_REVIEW_DELAY_DAYS],
      monthlyIncomeAmount: 0,
      monthlyIncomeCurrency: 'KRW',
      exchangeRateUsdToKrw: 1470.05,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 기존 게스트가 이미 계정 문서를 가지고 있을 수 있으므로 merge로 안전하게 갱신
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        ...account,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return userCredential;
  } catch (error: any) {
    console.error('Failed to sign up:', error);
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.error('Failed to sign in:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    return await signOut(auth);
  } catch (error) {
    console.error('Failed to logout:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const getUserAccount = async (userId: string): Promise<Account | null> => {
  try {
    const accountId = toAccountId(userId);
    const accountPromise = getDoc(doc(db, 'accounts', accountId));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('account-timeout')), 3000)
    );
    const accountDoc = await Promise.race([accountPromise, timeoutPromise]);
    
    if (!accountDoc.exists()) {
      return null;
    }

    const data = accountDoc.data();
    const reviewReminderTime =
      typeof data.reviewReminderTime === 'string'
        ? data.reviewReminderTime
        : typeof data.notificationTime === 'string'
          ? data.notificationTime
          : undefined;

    return {
      id: accountDoc.id,
      userId: data.userId,
      name: data.name,
      nickname: typeof data.nickname === 'string' ? data.nickname : '',
      notificationTime: typeof data.notificationTime === 'string' ? data.notificationTime : undefined,
      reviewReminderTime,
      reviewReminderEnabled: data.reviewReminderEnabled !== false,
      reviewDelayDays:
        Array.isArray(data.reviewDelayDays)
          ? data.reviewDelayDays
              .filter((d: unknown) => d === 1 || d === 3 || d === 7 || d === 30)
              .slice(0, 8)
          : data.reviewDelayDays === 7 || data.reviewDelayDays === 30
            ? [data.reviewDelayDays]
            : [3],
      monthlyIncomeAmount: typeof data.monthlyIncomeAmount === 'number' ? data.monthlyIncomeAmount : 0,
      monthlyIncomeCurrency: data.monthlyIncomeCurrency === 'USD' ? 'USD' : 'KRW',
      exchangeRateUsdToKrw:
        typeof data.exchangeRateUsdToKrw === 'number' ? data.exchangeRateUsdToKrw : 1470.05,
      foodBudgetAmount: typeof data.foodBudgetAmount === 'number' ? data.foodBudgetAmount : 0,
      foodBudgetCurrency: data.foodBudgetCurrency === 'USD' ? 'USD' : 'KRW',
      budgetPeriodMode: data.budgetPeriodMode === 'payday' ? 'payday' : 'calendar',
      paydayDayOfMonth:
        typeof data.paydayDayOfMonth === 'number' && data.paydayDayOfMonth >= 1 && data.paydayDayOfMonth <= 31
          ? Math.floor(data.paydayDayOfMonth)
          : undefined,
      createdAt: timestampToDate(data.createdAt),
      updatedAt: timestampToDate(data.updatedAt),
    };
  } catch (error: any) {
    const message = String(error?.message || '');
    const code = String(error?.code || '');
    const isOffline =
      message.toLowerCase().includes('offline') ||
      code === 'unavailable' ||
      code === 'deadline-exceeded' ||
      message === 'account-timeout';

    if (isOffline) {
      console.warn('Account fetch skipped (offline):', error);
      return null;
    }

    console.error('Failed to get user account:', error);
    throw new Error('계정 정보를 조회하는데 실패했습니다.');
  }
};

export const updateReviewReminderSettings = async (
  accountId: string,
  reviewReminderEnabled: boolean,
  reviewReminderTime: string
): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        reviewReminderEnabled,
        reviewReminderTime,
        notificationTime: reviewReminderTime,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Failed to update review reminder:', error);
    throw new Error('리뷰 알림 설정을 저장하는데 실패했습니다.');
  }
};

export const updateReviewDelayDays = async (
  accountId: string,
  reviewDelayDays: (1 | 3 | 7 | 30)[]
): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        reviewDelayDays,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Failed to update review delay days:', error);
    throw new Error('리뷰 주기를 저장하는데 실패했습니다.');
  }
};

const NICKNAME_MAX = 24;

export const updateNickname = async (accountId: string, nickname: string): Promise<string> => {
  const trimmed = nickname.trim().slice(0, NICKNAME_MAX);
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        nickname: trimmed,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return trimmed;
  } catch (error) {
    console.error('Failed to update nickname:', error);
    throw new Error('닉네임을 저장하는데 실패했습니다.');
  }
};

export const updateMonthlyIncome = async (
  accountId: string,
  monthlyIncomeAmount: number,
  monthlyIncomeCurrency: 'KRW' | 'USD',
  exchangeRateUsdToKrw: number
): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        monthlyIncomeAmount,
        monthlyIncomeCurrency,
        exchangeRateUsdToKrw,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Failed to update monthly income:', error);
    throw new Error('월 수입을 저장하는데 실패했습니다.');
  }
};

export const updateFoodBudget = async (
  accountId: string,
  foodBudgetAmount: number,
  foodBudgetCurrency: 'KRW' | 'USD',
): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        foodBudgetAmount,
        foodBudgetCurrency,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('Failed to update food budget:', error);
    throw new Error('식비 예산을 저장하는데 실패했습니다.');
  }
};

export const updateBudgetPeriodSettings = async (
  accountId: string,
  budgetPeriodMode: 'calendar' | 'payday',
  paydayDayOfMonth: number,
): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'accounts', accountId),
      {
        budgetPeriodMode,
        paydayDayOfMonth: Math.min(31, Math.max(1, Math.floor(paydayDayOfMonth))),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('Failed to update budget period settings:', error);
    throw new Error('통계 기준을 저장하는데 실패했습니다.');
  }
};

export const reauthenticateWithPassword = async (currentPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('로그인 정보가 없습니다.');
  }
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
};

export const changeAccountEmail = async (
  newEmail: string,
  currentPassword: string
): Promise<void> => {
  const trimmed = newEmail.trim();
  if (!trimmed) {
    throw new Error('이메일을 입력해주세요.');
  }
  await reauthenticateWithPassword(currentPassword);
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인 정보가 없습니다.');
  }
  await updateEmail(user, trimmed);
  await reload(user);
};

export const changeAccountPassword = async (
  newPassword: string,
  currentPassword: string
): Promise<void> => {
  if (newPassword.length < 6) {
    throw new Error('비밀번호는 6자 이상이어야 합니다.');
  }
  await reauthenticateWithPassword(currentPassword);
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인 정보가 없습니다.');
  }
  await updatePassword(user, newPassword);
};
