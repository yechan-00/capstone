/** 로그인 화면 전용 세이지/민트 팔레트. 앱 전역 BRAND_GREEN(#34785F)과 분리 */

export const LOGIN_UI = {
  /** 로그인 버튼. #6D9F8A는 흰 글자 대비 3.01:1이라 AA 미달 → 동일 휴의 더 짙은 세이지 */
  buttonBg: '#4E7B69',
  /** 참고값 — Pressable opacity 0.88과 비슷한 눌림 톤 */
  buttonPressed: '#436858',
  buttonText: '#FFFFFF',
  /** 앱 이름 */
  brandTitle: '#355F50',
  /** 입력 포커스 테두리 */
  inputFocus: '#77A996',
  /** 회원가입 링크. 추천 #548A75는 배경 대비 미달 */
  signupLink: '#457466',
  guestText: '#4F806D',
  guestBorder: '#DDEBE4',
  guestHoverBg: '#EAF3EE',

  radius: 16,
  inputHeight: 56,
  buttonHeight: 56,
  guestHeight: 56,
  formWidth: 400,
  horizontalPad: 24,
} as const;
