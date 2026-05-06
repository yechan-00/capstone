import { format, addDays, getHours, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

export const formatDate = (date: Date, formatStr: string = 'yyyy-MM-dd'): string => {
  return format(date, formatStr, { locale: ko });
};

export const formatDateTime = (date: Date): string => {
  return format(date, 'yyyy-MM-dd HH:mm', { locale: ko });
};

export const getTimeOfDay = (date: Date): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = getHours(date);
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};

export const addDaysToDate = (date: Date, days: number): Date => {
  return addDays(date, days);
};

export const isDatePast = (date: Date): boolean => {
  return isBefore(date, new Date());
};

export const isDateToday = (date: Date): boolean => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  return today.getTime() === target.getTime();
};

export const getDaysUntil = (date: Date): number => {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
