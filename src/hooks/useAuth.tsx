import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Account } from '@/lib/types';
import { DEFAULT_REVIEW_DELAY_DAYS, DEFAULT_REVIEW_REMINDER_TIME, resolveReviewDelayDays } from '@/lib/accountSettings';
import { toAccountId } from '@/lib/accountId';
import * as authService from '@/services/authService';
import { backfillUserIdForAccount } from '@/services/userDataMigration';

interface AuthContextType {
  user: User | null;
  account: Account | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateReviewReminderSettings: (enabled: boolean, reviewReminderTime: string) => Promise<void>;
  updateReviewDelayDays: (reviewDelayDays: (1 | 3 | 7 | 30)[]) => Promise<void>;
  updateMonthlyIncome: (
    amount: number,
    currency: 'KRW' | 'USD',
    exchangeRateUsdToKrw: number
  ) => Promise<void>;
  updateFoodBudget: (amount: number, currency: 'KRW' | 'USD') => Promise<void>;
  updateBudgetPeriodSettings: (
    mode: 'calendar' | 'payday',
    paydayDayOfMonth: number,
  ) => Promise<void>;
  changeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  changePassword: (newPassword: string, currentPassword: string) => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      try {
        if (user) {
          const userAccount = await authService.getUserAccount(user.uid);
          if (userAccount) {
            setAccount(userAccount);
          } else {
            setAccount({
              id: toAccountId(user.uid),
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
            });
          }
        } else {
          setAccount(null);
        }
      } catch (error) {
        console.error('Failed to load account:', error);
        if (user) {
          // 오프라인 등으로 계정 조회 실패 시 최소 정보로 진입 허용
          setAccount({
            id: toAccountId(user.uid),
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
          });
        } else {
          try {
            await signInAnonymously(auth);
          } catch {
            setAccount(null);
          }
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  /** 레거시 문서에 userId 필드 보충 (유저당 1회, 백그라운드) */
  useEffect(() => {
    if (!account?.id || !user?.uid) return;
    void backfillUserIdForAccount(account.id).catch((err) => {
      console.warn('[migration] userId backfill skipped', err);
    });
  }, [account?.id, user?.uid]);

  const signUp = useCallback(async (email: string, password: string) => {
    await authService.signUp(email, password);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await authService.signIn(email, password);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setAccount(null);
  }, []);

  const signInAsGuest = useCallback(async () => {
    try {
      await signInAnonymously(auth);
      // onAuthStateChanged가 자동으로 account를 설정해줌
    } catch (error: any) {
      console.error('Guest sign in failed:', error);
      throw new Error('게스트 로그인에 실패했습니다.');
    }
  }, []);

  // 현재 유저가 익명(게스트)인지 여부
  const isGuest = user?.isAnonymous ?? false;

  const updateReviewReminderSettings = useCallback(
    async (enabled: boolean, reviewReminderTime: string) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const accountId = toAccountId(uid);
      await authService.updateReviewReminderSettings(accountId, enabled, reviewReminderTime);
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              reviewReminderEnabled: enabled,
              reviewReminderTime,
              notificationTime: reviewReminderTime,
            }
          : null
      );
    },
    []
  );

  const updateMonthlyIncome = useCallback(
    async (amount: number, currency: 'KRW' | 'USD', exchangeRateUsdToKrw: number) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const accountId = toAccountId(uid);
      await authService.updateMonthlyIncome(accountId, amount, currency, exchangeRateUsdToKrw);
      setAccount((prev) =>
        prev
          ? {
              ...prev,
              monthlyIncomeAmount: amount,
              monthlyIncomeCurrency: currency,
              exchangeRateUsdToKrw,
            }
          : null
      );
    },
    []
  );

  const updateFoodBudget = useCallback(async (amount: number, currency: 'KRW' | 'USD') => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const accountId = toAccountId(uid);
    await authService.updateFoodBudget(accountId, amount, currency);
    setAccount((prev) =>
      prev ? { ...prev, foodBudgetAmount: amount, foodBudgetCurrency: currency } : null
    );
  }, []);

  const updateBudgetPeriodSettings = useCallback(
    async (mode: 'calendar' | 'payday', paydayDayOfMonth: number) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const accountId = toAccountId(uid);
      await authService.updateBudgetPeriodSettings(accountId, mode, paydayDayOfMonth);
      setAccount((prev) =>
        prev
          ? { ...prev, budgetPeriodMode: mode, paydayDayOfMonth: paydayDayOfMonth }
          : null
      );
    },
    []
  );

  const updateReviewDelayDays = useCallback(async (reviewDelayDays: (1 | 3 | 7 | 30)[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const accountId = toAccountId(uid);
    await authService.updateReviewDelayDays(accountId, reviewDelayDays);
    setAccount((prev) => (prev ? { ...prev, reviewDelayDays: resolveReviewDelayDays({ ...(prev as any), reviewDelayDays }) } : null));
  }, []);

  const changeEmail = useCallback(async (newEmail: string, currentPassword: string) => {
    await authService.changeAccountEmail(newEmail, currentPassword);
    setUser(auth.currentUser);
  }, []);

  const changePassword = useCallback(async (newPassword: string, currentPassword: string) => {
    await authService.changeAccountPassword(newPassword, currentPassword);
  }, []);

  const updateNickname = useCallback(async (nickname: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const accountId = toAccountId(uid);
    const saved = await authService.updateNickname(accountId, nickname);
    setAccount((prev) => (prev ? { ...prev, nickname: saved } : null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      loading,
      signUp,
      signIn,
      logout,
      updateReviewReminderSettings,
      updateReviewDelayDays,
      updateMonthlyIncome,
      updateFoodBudget,
      updateBudgetPeriodSettings,
      changeEmail,
      changePassword,
      updateNickname,
      signInAsGuest,
      isGuest,
    }),
    [
      user,
      account,
      loading,
      signUp,
      signIn,
      logout,
      updateReviewReminderSettings,
      updateReviewDelayDays,
      updateMonthlyIncome,
      updateFoodBudget,
      updateBudgetPeriodSettings,
      changeEmail,
      changePassword,
      updateNickname,
      signInAsGuest,
      isGuest,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
