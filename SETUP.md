# RegretWallet 프로젝트 설정 가이드

## 1. 패키지 설치

```bash
npm install
```

## 2. Firebase 설정

### Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. Authentication 활성화 (이메일/비밀번호)
3. Firestore Database 생성 (테스트 모드로 시작)

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 Firebase 설정을 추가하세요:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

Firebase 설정 값은 Firebase Console > 프로젝트 설정 > 일반 > 앱에서 확인할 수 있습니다.

## 3. Firestore 보안 규칙 설정

Firestore Console에서 다음 규칙을 설정하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Accounts: 사용자 자신의 계정만 읽기/쓰기 가능
    match /accounts/{accountId} {
      allow read, write: if request.auth != null &&
        (resource == null || resource.data.userId == request.auth.uid);
    }

    // Expenses: 자신의 계정 소비만 읽기/쓰기 가능
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null &&
        (resource == null || resource.data.accountId == 'account_' + request.auth.uid);
    }

    // Reviews: 자신의 계정 리뷰만 읽기/쓰기 가능
    match /reviews/{reviewId} {
      allow read, write: if request.auth != null &&
        (resource == null || resource.data.accountId == 'account_' + request.auth.uid);
    }

    // Review Schedules: 자신의 계정 스케줄만 읽기/쓰기 가능
    match /review_schedules/{scheduleId} {
      allow read, write: if request.auth != null &&
        (resource == null || resource.data.accountId == 'account_' + request.auth.uid);
    }
  }
}
```

## 4. 앱 실행

### Expo Go로 실행 (권장)

```bash
npm start
```

QR 코드를 스캔하여 Expo Go 앱에서 실행하세요.

### iOS 시뮬레이터

```bash
npm run ios
```

### Android 에뮬레이터

```bash
npm run android
```

## 5. 알림 권한

앱 실행 시 알림 권한을 요청합니다. 허용해야 리뷰 알림을 받을 수 있습니다.

## 주요 파일 구조

### 핵심 파일

- `src/lib/types.ts`: 모든 타입 정의
- `src/lib/firebase.ts`: Firebase 초기화
- `src/services/`: 비즈니스 로직 서비스 레이어
- `src/hooks/`: Custom React hooks
- `app/`: Expo Router 화면들

### 주요 함수 시그니처

#### authService.ts

- `signUp(email, password)`: 회원가입 및 Account 자동 생성
- `signIn(email, password)`: 로그인
- `logout()`: 로그아웃
- `getUserAccount(userId)`: 사용자 Account 조회

#### expenseService.ts

- `create(expense)`: 소비 생성 및 스케줄 자동 생성
- `getById(expenseId)`: 소비 조회
- `getByAccountId(accountId)`: 계정별 소비 목록 조회
- `update(expenseId, updates)`: 소비 수정
- `delete(expenseId)`: 소비 삭제

#### scheduleService.ts

- `createSchedulesForExpense(expenseId, accountId, spentAt)`: 3/7/30일 스케줄 생성
- `getPendingSchedules(accountId)`: 대기 중인 스케줄 조회
- `markAsDone(scheduleId)`: 스케줄 완료 처리
- `scheduleNotification(expenseId, delayDays, dueAt)`: 알림 스케줄 등록

#### reviewService.ts

- `create(review)`: 리뷰 생성 및 스케줄 완료 처리
- `getByExpenseId(expenseId)`: 소비별 리뷰 조회
- `getByAccountId(accountId, limit?)`: 계정별 리뷰 조회

#### insightsService.ts

- `getInsights(accountId, days)`: 인사이트 데이터 집계
- `calculateCategoryInsights()`: 카테고리별 분석
- `calculateMoodInsights()`: 기분별 분석
- `calculateTimeOfDayInsights()`: 시간대별 분석
- `generatePatterns()`: 패턴 문장 생성

## 문제 해결

### Firebase 연결 오류

- `.env` 파일이 올바르게 설정되었는지 확인
- Firebase 프로젝트 설정에서 앱이 올바르게 등록되었는지 확인

### 알림이 작동하지 않음

- 디바이스 설정에서 알림 권한이 허용되었는지 확인
- Expo Go에서는 제한적일 수 있음 (EAS Build 권장)

### Firestore 쿼리 오류

- Firestore 인덱스가 필요할 수 있음 (콘솔에서 자동 생성 제안 확인)
- 보안 규칙이 올바르게 설정되었는지 확인
