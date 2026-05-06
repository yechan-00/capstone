export function makePatternCopy(params: { total: number; regretCount: number }) {
  const { total, regretCount } = params;

  if (total < 5) {
    return `현재 데이터(${total}건) 기준으로는 큰 경향이 아직 뚜렷하지 않아요. 조금만 더 기록하면 패턴이 더 정확해져요.`;
  }

  const rate = regretCount / total;

  if (rate >= 0.5) {
    return `최근 소비에서 후회 비율이 높은 편이에요. 특히 반복되는 패턴이 있는지 확인해보세요.`;
  }
  if (rate >= 0.25) {
    return `후회 소비가 일부 보여요. 특정 카테고리/기분/시간대에서 늘어나는지 확인해보세요.`;
  }
  return `현재까지는 후회 비율이 낮은 편이에요. 계속 기록하면 ‘후회가 생기는 조건’이 더 선명해져요.`;
}
