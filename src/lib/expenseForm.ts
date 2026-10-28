import { QUICK_AMOUNTS, REASONS } from '@/lib/expenseOptions';

export const MEAL_TAG_PRESETS = ['아침', '점심', '저녁'] as const;
export const TAG_PRESETS = ['야식', '데이트', '시발비용', '보상', '스트레스'] as const;

export const ADD_STEPS = ['금액·유형', '시간·사진', '이유', '확인'] as const;
/** 상단 스텝 바: 한 줄용 짧은 라벨 */
export const ADD_STEP_BAR_LABELS = ['금액', '시간·사진', '이유', '확인'] as const;
export const LAST_STEP = ADD_STEPS.length - 1;
/** +2만(20000) 칩은 한 줄에 초기화까지 넣기 위해 제외 */
export const QUICK_AMOUNTS_STEP = QUICK_AMOUNTS.filter((v) => v !== 20000);
export const PHOTO_PREVIEW_MAX_HEIGHT = 320;
export const REASON_CHIP_ROWS = [REASONS.slice(0, 4), REASONS.slice(4)] as const;

/** 원본 비율 유지하며 박스 안에 전체가 들어가도록 크기 계산 */
export function fitImageInBox(srcW: number, srcH: number, maxW: number, maxH: number) {
  if (srcW <= 0 || srcH <= 0) return { width: maxW, height: Math.min(maxH, maxW * 0.75) };
  let width = maxW;
  let height = (srcH / srcW) * width;
  if (height > maxH) {
    height = maxH;
    width = (srcW / srcH) * height;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

export function parseAmount(raw: string) {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  return Number(cleaned);
}

export function unformat(s: string) {
  return s.replace(/[^\d]/g, '');
}

export function formatAmountInput(s: string) {
  const n = parseAmount(s);
  if (!s) return '';
  return n.toLocaleString();
}

export function toKoreanMoney(v: number) {
  if (v >= 10000) return `${v / 10000}만`;
  return `${v.toLocaleString()}`;
}

export function formatExpenseFormDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
