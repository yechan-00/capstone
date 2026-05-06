# RegretWallet

소비 후회도를 시간 지연(3/7/30일)으로 평가하고 인사이트를 제공하는 모바일 앱입니다.

## 기술 스택

- **Expo SDK**: ~51.0.0 (TypeScript)
- **expo-router**: 탭 기반 네비게이션
- **Firebase**: Auth + Firestore (웹 SDK v9 모듈형)
- **expo-notifications**: 로컬 알림 스케줄링
- **date-fns**: 날짜 처리
- **react-hook-form**: 폼 관리 (선택적)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Firebase 설정

`.env` 파일을 생성하고 Firebase 설정을 추가하세요:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. 앱 실행

```bash
# Expo Go로 실행
npm start

# iOS 시뮬레이터
npm run ios

# Android 에뮬레이터
npm run android
```

## 프로젝트 구조

```
/src
  /app (expo-router)
    /(auth)          # 로그인/회원가입
    /(tabs)          # 홈, 인사이트, 설정
    expense/[id].tsx # 소비 상세 + 리뷰 작성
    add-expense.tsx  # 소비 추가
  /lib
    firebase.ts      # Firebase 초기화
    types.ts         # 타입 정의
    constants.ts     # 상수 (카테고리, 기분 등)
  /services
    authService.ts      # 인증 서비스
    expenseService.ts   # 소비 CRUD
    reviewService.ts    # 리뷰 서비스
    scheduleService.ts  # 리뷰 스케줄 관리
    insightsService.ts  # 인사이트 집계
  /hooks
    useAuth.ts       # 인증 훅
    useExpenses.ts   # 소비 훅
    useInsights.ts   # 인사이트 훅
  /components
    ExpenseCard.tsx
    ReviewPromptBanner.tsx
    InsightChartPlaceholder.tsx
  /utils
    time.ts          # 날짜 유틸리티
    validation.ts    # 검증 유틸리티
```

## 주요 기능

### 1. 인증

- 이메일/비밀번호 회원가입 및 로그인
- 회원가입 시 자동으로 Account 생성

### 2. 소비 기록

- 금액, 카테고리, 사유, 기분, 태그 입력
- 소비 저장 시 3/7/30일 후 리뷰 스케줄 자동 생성
- 로컬 알림 스케줄 등록

### 3. 리뷰 작성

- 소비 후 일정 시간 경과 후 후회도 평가
- 다시 할 것인지 여부, 만족도(1-5), 후회 이유, 메모 입력
- 리뷰 완료 시 스케줄 상태 업데이트

### 4. 인사이트

- 최근 30일 기준 분석
- 카테고리별/기분별/시간대별 후회율
- 패턴 분석 템플릿 문장 제공

## 확장 가능성

타입 정의에 다음 확장을 고려하여 포함했습니다:

- **커플/가족 공유**: `AccountMember`, `Review.reviewType`, `Review.reviewerUserId`
- **카드 내역 연동**: `Expense.sourceType`, `Expense.sourceRef`

현재 MVP는 개인용으로만 구현되어 있으며, 향후 확장 가능합니다.

## 주의사항

- Firebase 설정이 필요합니다
- 알림 권한이 필요합니다 (expo-notifications)
- Expo Go 앱에서 테스트 가능합니다
