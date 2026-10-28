import { EXPENSE_DETAIL } from '@/theme/expenseDetailTheme';

type TagStyle = { bg: string; text: string };

const TAG_STYLE_MAP: Record<string, TagStyle> = {
  데이트: { bg: '#F8E7EC', text: '#B36778' },
  저녁: { bg: '#E4F3EA', text: '#4D8768' },
  아침: { bg: '#E4F3EA', text: '#4D8768' },
  점심: { bg: '#E4F3EA', text: '#4D8768' },
  야식: { bg: '#EEE8F6', text: '#78658E' },
  보상: { bg: '#FAEFD7', text: '#9D7734' },
  '기분 전환·보상': { bg: '#FAEFD7', text: '#9D7734' },
  기분전환: { bg: '#DFF3E8', text: '#3F8864' },
  '사람들과': { bg: '#E6F0F6', text: '#637F94' },
  스트레스: { bg: '#F9E5E3', text: '#B35F5A' },
  '스트레스·피로': { bg: '#EFEAF4', text: '#756887' },
  피로: { bg: '#EFEAF4', text: '#756887' },
  충동: { bg: '#F9E5E3', text: '#B35F5A' },
  '충동·습관': { bg: '#F9E5E3', text: '#B35F5A' },
  배고파서: { bg: '#FAEFD7', text: '#9D7734' },
  '시간 없음·귀찮음': { bg: '#E6F0F6', text: '#637F94' },
  '할인·혜택': { bg: '#DFF3E8', text: '#3F8864' },
  기타: { bg: '#EEF8F2', text: '#4D8768' },
  시발비용: { bg: '#F9E5E3', text: '#B35F5A' },
};

const DEFAULT_TAG: TagStyle = { bg: EXPENSE_DETAIL.lightMint, text: EXPENSE_DETAIL.categoryPillText };

export function expenseTagStyle(label: string): TagStyle {
  const key = label.trim();
  if (TAG_STYLE_MAP[key]) return TAG_STYLE_MAP[key];
  for (const [pattern, style] of Object.entries(TAG_STYLE_MAP)) {
    if (key.includes(pattern)) return style;
  }
  return DEFAULT_TAG;
}

/** UI 표시용 중복 태그 제거 (데이터는 변경하지 않음) */
export function dedupeDisplayLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
