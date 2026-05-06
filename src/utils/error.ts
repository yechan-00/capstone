export function toUserMessage(
  err: unknown,
  fallback = '불러오지 못했어요. 다시 시도해 주세요.'
) {
  const msg = err instanceof Error ? err.message : String(err ?? '');

  if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
    return '접근 권한이 없어요. 다시 로그인해 주세요.';
  }
  if (msg.includes('network') || msg.includes('NETWORK') || msg.includes('offline')) {
    return '네트워크가 불안정해요. 연결을 확인해 주세요.';
  }
  if (msg.includes('timeout')) {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.';
  }
  return fallback;
}
