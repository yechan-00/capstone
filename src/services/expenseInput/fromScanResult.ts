import type { ScanResult } from '@/services/geminiService';
import type { CategoryKey } from '@/lib/expenseOptions';

/** OCR 스캔 결과 → 폼 상태 패치 (manual 경로와 분리) */
export type ScanFormPatch = {
  amountText?: string;
  category?: CategoryKey;
  item?: string;
  memo?: string;
  spentAt?: Date;
  tagsText?: string;
};

export function scanResultToFormPatch(result: ScanResult): ScanFormPatch {
  const patch: ScanFormPatch = {};
  if (result.amount != null) patch.amountText = String(result.amount);
  if (result.category) patch.category = result.category;
  if (result.content) patch.item = result.content;
  if (result.memo) patch.memo = result.memo;
  if (result.spentAt) patch.spentAt = result.spentAt;
  if (result.tags?.length) patch.tagsText = result.tags.join(', ');
  return patch;
}
