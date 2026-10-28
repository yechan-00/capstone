import { format, getHours } from 'date-fns';
import { ko } from 'date-fns/locale';

export const formatDate = (date: Date, formatStr: string = 'yyyy-MM-dd'): string => {
  return format(date, formatStr, { locale: ko });
};

export const getTimeOfDay = (date: Date): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = getHours(date);
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};
