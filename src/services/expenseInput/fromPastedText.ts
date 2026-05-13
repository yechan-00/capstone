import type { CategoryKey } from '@/lib/expenseOptions';
import type { ScanFormPatch } from '@/services/expenseInput/fromScanResult';

export function parsePastedExpenseText(raw: string): ScanFormPatch {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return {};

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const patch: ScanFormPatch = {};

  // 스킵 패턴: 카드사 헤더, 날짜/시간줄, 승인/잔액/한도 관련
  const SKIP = /^\[|일시불|할부|승인|잔액|잔고|한도|포인트|적립|Web발신/i;
  const CARD_ISSUER = /^(KB국민|신한|삼성|현대|롯데|우리|하나|농협|씨티|카카오|토스|케이뱅크|IBK|SC제일|국민|기업|산업|우체국|새마을|수협)카드?$/i;

  // ── 날짜/시간 먼저 추출 (MM/DD HH:mm 또는 YYYY-MM-DD HH:mm)
  const ymd = text.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2])-1, Number(ymd[3]), Number(ymd[4]), Number(ymd[5]));
    if (!isNaN(d.getTime())) patch.spentAt = d;
  }
  if (!patch.spentAt) {
    const mdhm = text.match(/(\d{1,2})[\/.](\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (mdhm) {
      const now = new Date();
      const d = new Date(now.getFullYear(), Number(mdhm[1])-1, Number(mdhm[2]), Number(mdhm[3]), Number(mdhm[4]));
      if (!isNaN(d.getTime())) patch.spentAt = d;
    }
  }

  // ── 가맹점 + 금액: 같은 줄에 있는 경우 ("배달의 민족  18,900")
  // 스킵 줄과 카드사명 줄 제외하고, 날짜줄도 제외
  const DATE_LINE = /^\d{1,2}[\/\.]\d{1,2}/;
  const merchantLine = lines.find(l =>
    !SKIP.test(l) &&
    !DATE_LINE.test(l) &&
    !CARD_ISSUER.test(l.replace(/\[|\]/g, '').trim())
  );

  if (merchantLine) {
    // 줄 끝 숫자 = 금액
    const amtMatch = merchantLine.match(/([\d,]+)\s*$/);
    if (amtMatch) {
      const n = Number(amtMatch[1].replace(/,/g, ''));
      if (!isNaN(n) && n > 0 && n < 100_000_000) patch.amountText = String(n);
    }
    // 줄에서 끝 숫자 제거 = 가맹점명
    const name = merchantLine.replace(/[\d,]+\s*$/, '').trim();
    if (name.length >= 2) patch.item = name.slice(0, 60);
    else if (merchantLine.trim().length >= 2) patch.item = merchantLine.trim().slice(0, 60);
  }

  // ── 금액이 별도 줄인 경우 fallback (숫자만 있는 줄)
  if (!patch.amountText) {
    for (const line of lines) {
      if (SKIP.test(line) || DATE_LINE.test(line)) continue;
      if (line === merchantLine) continue;
      const m = line.match(/^([\d,]+)$/);
      if (m) {
        const n = Number(m[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 0 && n < 100_000_000) {
          patch.amountText = String(n);
          break;
        }
      }
    }
  }

  // ── 카테고리
  const combined = `${text} ${patch.item ?? ''}`;
  if (/배달의민족|배달의 민족|요기요|쿠팡이츠|땡겨요|배민/i.test(combined)) {
    patch.category = 'delivery';
  } else if (/스타벅스|이디야|투썸|메가커피|빽다방|카페베네|할리스|커피빈|폴바셋|카페|커피/i.test(combined)) {
    patch.category = 'cafe';
  } else if (/포장|테이크아웃|매장|식당|치킨|피자|분식|편의점|GS25|CU|세븐일레븐/i.test(combined)) {
    patch.category = 'takeout';
  }

  // ── 메모: 원문
  const clip = lines.slice(0, 6).join('\n');
  if (clip.length > 0) patch.memo = clip.length > 400 ? clip.slice(0, 400) + '…' : clip;

  return patch;
}
