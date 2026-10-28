/** 상황 태그 행 분할 — UI 표시용 */
const SHORT_LABEL_MAX = 5;

function isShortLabel(label: string): boolean {
  return label.trim().length <= SHORT_LABEL_MAX;
}

export function chunkSituationTagsIntoRows(labels: string[]): string[][] {
  if (labels.length === 0) return [];
  if (labels.length <= 3) return [labels];

  const rows: string[][] = [];
  let i = 0;

  while (i < labels.length) {
    const rest = labels.length - i;

    if (rest === 1) {
      rows.push([labels[i]!]);
      i += 1;
      continue;
    }

    if (rest === 2) {
      rows.push([labels[i]!, labels[i + 1]!]);
      i += 2;
      continue;
    }

    if (rest === 3) {
      rows.push([labels[i]!, labels[i + 1]!, labels[i + 2]!]);
      i += 3;
      continue;
    }

    const quad = labels.slice(i, i + 4);
    if (quad.length === 4 && quad.every(isShortLabel)) {
      rows.push(quad);
      i += 4;
      continue;
    }

    rows.push(labels.slice(i, i + 3));
    i += 3;
  }

  return rows;
}
