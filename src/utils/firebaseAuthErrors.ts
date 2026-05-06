/** Firebase Auth 오류 코드를 짧은 한국어 메시지로 매핑합니다. */

export function mapFirebaseAuthError(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '현재 비밀번호가 올바르지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/invalid-email':
      return '이메일 형식을 확인해주세요.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인한 뒤 시도해주세요.';
    case 'auth/weak-password':
      return '비밀번호가 너무 약합니다. 더 길게 설정해주세요.';
    default:
      return err instanceof Error ? err.message : fallback;
  }
}
