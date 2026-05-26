/** Firebase Storage 오류 → 사용자 안내 문구 */
export function formatStorageError(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  const message = err instanceof Error ? err.message : String(err ?? '');

  if (code === 'storage/unauthorized' || message.includes('unauthorized')) {
    return 'Storage 권한이 없어요. Firebase Console → Storage → Rules에 프로젝트의 storage.rules 내용을 붙여넣고「게시」해 주세요.';
  }
  if (code === 'storage/unauthenticated' || message.includes('unauthenticated')) {
    return '로그인이 만료됐을 수 있어요. 다시 로그인한 뒤 시도해 주세요.';
  }
  if (
    code === 'storage/bucket-not-found' ||
    code === 'storage/object-not-found' ||
    message.includes('bucket')
  ) {
    return 'Firebase Storage가 아직 켜지지 않았을 수 있어요. Firebase Console → Storage →「시작하기」를 눌러 Storage를 활성화해 주세요.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Storage 용량 한도에 도달했어요.';
  }
  if (message.includes('Failed to read') || message.includes('읽지 못했')) {
    return message;
  }
  return `사진 업로드 실패: ${message || code || '알 수 없는 오류'}`;
}
