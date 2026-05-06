import type { CategoryKey } from '@/lib/expenseOptions';
import type { ScanFormPatch } from '@/services/expenseInput/fromScanResult';

/**
 * 카드·은행 문자 등 붙여넣기 텍스트 → 폼 패치 (휴리스틱).
 * 정확도 한계가 있으므로 저장 전 사용자 확인 필수.
 * 향후 Gemini/서버 파서로 교체 시 이 함수 시그니처(ScanFormPatch 반환)만 유지하면 됨.
 */
export function parsePastedExpenseText(raw: string): ScanFormPatch {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return {};

  const patch: ScanFormPatch = {};

  const amount = extractLargestWonAmount(text);
  if (amount != null) patch.amountText = String(amount);

  const store = extractMerchantLine(text);
  if (store) patch.item = store;

  const category = inferCategoryFromText(text);
  if (category) patch.category = category;

  const spentAt = extractSpentAt(text);
  if (spentAt) patch.spentAt = spentAt;

  const remainder = buildMemoFromLeftovers(text, patch);
  if (remainder) patch.memo = remainder;

  return patch;
}

function extractLargestWonAmount(text: string): number | null {
  const patterns = [
    /(?:승인|결제|체크|이용|출금|금액|결제금액|누적)[^0-9₩]{0,12}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})\s*원/gi,
    /₩\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})/g,
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,})\s*원/g,
  ];

  let best = 0;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = Number(String(m[1]).replace(/,/g, ''));
      if (!Number.isNaN(n) && n > best && n < 1_000_000_000) best = n;
    }
  }
  return best > 0 ? best : null;
}

function extractMerchantLine(text: string): string | undefined {
  const linePatterns = [
    /(?:가맹점|사용처|상호|Merchant|가\s*맹\s*점)[:\s]*([^\n]+)/i,
    /\[([^\]]{2,40})\]/,
  ];
  for (const re of linePatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const s = m[1].replace(/^\[Web발신\]/i, '').trim();
      if (s.length >= 2) return s.slice(0, 120);
    }
  }
  const first = text.split('\n').map((l) => l.trim()).find((l) => l.length > 2 && !/^[\[\(]/.test(l));
  if (first && first.length <= 80) return first;
  return undefined;
}

function inferCategoryFromText(text: string): CategoryKey | undefined {
  if (/배달의민족|우아한|요기요|쿠팡이츠|땡겨요|배민|배달앱/i.test(text)) {
    return 'delivery';
  }
  if (/스타벅스|이디야|투썸|메가커피|빽다방|카페|커피|아메리카노/i.test(text)) {
    return 'cafe';
  }
  if (/포장|테이크아웃|매장|식당|치킨|피자|분식/i.test(text)) {
    return 'takeout';
  }
  return undefined;
}

function extractSpentAt(text: string): Date | undefined {
  const ymd = text.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (ymd) {
    const d = new Date(
      Number(ymd[1]),
      Number(ymd[2]) - 1,
      Number(ymd[3]),
      Number(ymd[4]),
      Number(ymd[5])
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  const mdhm = text.match(/(\d{1,2})[.\/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (mdhm) {
    const now = new Date();
    const d = new Date(
      now.getFullYear(),
      Number(mdhm[1]) - 1,
      Number(mdhm[2]),
      Number(mdhm[3]),
      Number(mdhm[4])
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** 금액·가맹점으로 쓴 줄 외 참고용 원문 일부 */
function buildMemoFromLeftovers(text: string, patch: ScanFormPatch): string | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1 && patch.item && patch.amountText) return undefined;
  const clip = lines.slice(0, 6).join('\n');
  if (clip.length > 400) return clip.slice(0, 400) + '…';
  return clip.length > 0 ? clip : undefined;
}
