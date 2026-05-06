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
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Account } from '@/lib/types';
import { DEFAULT_REVIEW_REMINDER_TIME } from '@/lib/accountSettings';
import { timestampToDate } from '@/utils/firestore';

export const signUp = async (email: string, password: string): Promise<UserCredential> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 회원가입 후 자동으로 Account 생성
    const accountId = `account_${user.uid}`;
    const account: Account = {
      id: accountId,
      userId: user.uid,
      name: '내 가계부',
      nickname: '',
      notificationTime: DEFAULT_REVIEW_REMINDER_TIME,
      reviewReminderTime: DEFAULT_REVIEW_REMINDER_TIME,
      reviewReminderEnabled: true,
      monthlyIncomeAmount: 0,
      monthlyIncomeCurrency: 'KRW',
      exchangeRateUsdToKrw: 1470.05,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'accounts', accountId), {
      ...account,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
    const accountId = `account_${userId}`;
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
      monthlyIncomeAmount: typeof data.monthlyIncomeAmount === 'number' ? data.monthlyIncomeAmount : 0,
      monthlyIncomeCurrency: data.monthlyIncomeCurrency === 'USD' ? 'USD' : 'KRW',
      exchangeRateUsdToKrw:
        typeof data.exchangeRateUsdToKrw === 'number' ? data.exchangeRateUsdToKrw : 1470.05,
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
