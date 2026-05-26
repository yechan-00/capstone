/** Firebase Auth 오류 코드를 짧은 한국어 메시지로 매핑합니다. */

const BLOCKED_SIGN_IN_MESSAGE =
  'Firebase API 키 설정 문제로 로그인이 차단되어 있습니다.\n\n' +
  'Google Cloud Console → 사용자 인증 정보 → API 키에서 Identity Toolkit API가 허용되는지 확인하세요.\n' +
  '또는 Firebase Console → 프로젝트 설정 → 내 앱의 웹 API 키가 코드와 일치하는지 확인하세요.';

function isBlockedSignInError(code: string, message: string): boolean {
  const haystack = `${code} ${message}`.toLowerCase();
  return (
    haystack.includes('signinwithpassword-are-blocked') ||
    haystack.includes('identitytoolkit') && haystack.includes('blocked')
  );
}

export function mapFirebaseAuthError(err: unknown, fallback: string): string {
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
  const message = err instanceof Error ? err.message : '';
  if (isBlockedSignInError(code, message)) {
    return BLOCKED_SIGN_IN_MESSAGE;
  }
  switch (code) {
    case 'auth/operation-not-allowed':
      return BLOCKED_SIGN_IN_MESSAGE;
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
