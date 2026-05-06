# Firestore 데이터베이스 설계

## 컬렉션 구조

```
accounts/{accountId}
  ├── members/{userId}
  ├── expenses/{expenseId}
  │   └── reviews/{reviewId}
  └── review_schedules/{scheduleId}
```

### 문서 스키마

#### accounts/{accountId}
```typescript
{
  id: string;                    // accountId와 동일
  userId: string;                 // 소유자 Firebase Auth UID
  name: string;                   // 계정명 (예: "내 가계부")
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### accounts/{accountId}/members/{userId}
```typescript
{
  id: string;                     // userId와 동일
  accountId: string;              // 부모 accountId
  userId: string;                 // Firebase Auth UID
  role: 'owner' | 'member';
  joinedAt: Timestamp;
}
```

#### accounts/{accountId}/expenses/{expenseId}
```typescript
{
  id: string;                     // expenseId와 동일
  accountId: string;             // 부모 accountId
  amount: number;
  category: string;               // 'food' | 'transport' | ...
  reason: string;
  mood: string;                   // 'happy' | 'neutral' | ...
  tags: string[];
  spentAt: Timestamp;
  sourceType: string;             // 'manual' | 'card' | 'bank'
  sourceRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### accounts/{accountId}/expenses/{expenseId}/reviews/{reviewId}
```typescript
{
  id: string;                     // reviewId와 동일
  expenseId: string;              // 부모 expenseId
  scheduleId: string;             // 관련 review_schedule ID
  accountId: string;              // 상위 accountId
  reviewerUserId: string;          // Firebase Auth UID
  reviewType: string;              // 'self' | 'shared'
  decisionAgain: string;           // 'yes' | 'maybe' | 'no'
  satisfaction: number;            // 1-5
  regretReasons: string[];
  notes?: string;
  reviewedAt: Timestamp;
  createdAt: Timestamp;
}
```

#### accounts/{accountId}/review_schedules/{scheduleId}
```typescript
{
  id: string;                     // scheduleId와 동일
  expenseId: string;              // 관련 expense ID
  accountId: string;              // 부모 accountId
  dueAt: Timestamp;                // 리뷰 예정일
  delayDays: number;               // 3 | 7 | 30
  status: string;                  // 'pending' | 'done' | 'skipped'
  notificationId?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function: 계정 소유자 확인
    function isAccountOwner(accountId) {
      return request.auth != null && 
             get(/databases/$(database)/documents/accounts/$(accountId)).data.userId == request.auth.uid;
    }
    
    // Helper function: 계정 멤버 확인 (확장용)
    function isAccountMember(accountId) {
      return request.auth != null && (
        isAccountOwner(accountId) ||
        exists(/databases/$(database)/documents/accounts/$(accountId)/members/$(request.auth.uid))
      );
    }
    
    // Helper function: 문서 생성 시 userId 검증
    function isValidUserId(userId) {
      return request.auth != null && userId == request.auth.uid;
    }
    
    // Accounts 컬렉션
    match /accounts/{accountId} {
      // 읽기: 소유자 또는 멤버만
      allow read: if isAccountMember(accountId);
      
      // 생성: 본인 userId로만 생성 가능
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.id == accountId;
      
      // 수정: 소유자만
      allow update: if isAccountOwner(accountId) &&
                       request.resource.data.userId == resource.data.userId;
      
      // 삭제: 소유자만 (실제로는 거의 사용 안 함)
      allow delete: if isAccountOwner(accountId);
      
      // Members 서브컬렉션
      match /members/{userId} {
        allow read: if isAccountMember(accountId);
        allow create: if isAccountOwner(accountId) &&
                          request.resource.data.userId == userId &&
                          request.resource.data.accountId == accountId;
        allow update: if isAccountOwner(accountId);
        allow delete: if isAccountOwner(accountId);
      }
      
      // Expenses 서브컬렉션
      match /expenses/{expenseId} {
        allow read: if isAccountMember(accountId);
        
        allow create: if isAccountMember(accountId) &&
                         request.resource.data.accountId == accountId &&
                         request.resource.data.id == expenseId;
        
        allow update: if isAccountMember(accountId) &&
                         request.resource.data.accountId == resource.data.accountId;
        
        allow delete: if isAccountMember(accountId);
        
        // Reviews 서브컬렉션
        match /reviews/{reviewId} {
          allow read: if isAccountMember(accountId);
          
          allow create: if isAccountMember(accountId) &&
                           request.resource.data.accountId == accountId &&
                           request.resource.data.expenseId == expenseId &&
                           request.resource.data.reviewerUserId == request.auth.uid &&
                           request.resource.data.id == reviewId;
          
          allow update: if isAccountMember(accountId) &&
                           request.resource.data.reviewerUserId == resource.data.reviewerUserId;
          
          allow delete: if isAccountMember(accountId) &&
                           resource.data.reviewerUserId == request.auth.uid;
        }
      }
      
      // Review Schedules 서브컬렉션
      match /review_schedules/{scheduleId} {
        allow read: if isAccountMember(accountId);
        
        allow create: if isAccountMember(accountId) &&
                         request.resource.data.accountId == accountId &&
                         request.resource.data.id == scheduleId;
        
        allow update: if isAccountMember(accountId) &&
                         request.resource.data.accountId == resource.data.accountId;
        
        allow delete: if isAccountMember(accountId);
      }
    }
  }
}
```

## 필요한 인덱스

### 1. review_schedules 복합 쿼리 인덱스
**쿼리**: `dueAt <= now AND status == 'pending'`

**인덱스 정의**:
```
Collection: accounts/{accountId}/review_schedules
Fields:
  - accountId (Ascending)
  - status (Ascending)
  - dueAt (Ascending)
```

**firestore.indexes.json**:
```json
{
  "indexes": [
    {
      "collectionGroup": "review_schedules",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "accountId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "dueAt",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 2. expenses 정렬 쿼리 인덱스
**쿼리**: `spentAt desc limit 20`

**인덱스 정의**:
```
Collection: accounts/{accountId}/expenses
Fields:
  - accountId (Ascending)
  - spentAt (Descending)
```

**firestore.indexes.json**:
```json
{
  "indexes": [
    {
      "collectionGroup": "expenses",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "accountId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "spentAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 3. reviews 정렬 쿼리 인덱스
**쿼리**: `reviewedAt desc`

**인덱스 정의**:
```
Collection: accounts/{accountId}/expenses/{expenseId}/reviews
Fields:
  - expenseId (Ascending)
  - reviewedAt (Descending)
```

**참고**: 서브컬렉션은 부모 문서 경로가 쿼리에 포함되므로 별도 인덱스가 필요 없을 수 있지만, 명시적으로 정의하는 것이 안전합니다.

## 클라이언트 쿼리 예시 코드 (Firebase v9 모듈형)

### 1. 홈 화면: 대기 중인 리뷰 스케줄 조회

```typescript
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function getPendingSchedules(accountId: string) {
  const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
  
  const q = query(
    schedulesRef,
    where('accountId', '==', accountId),
    where('status', '==', 'pending'),
    where('dueAt', '<=', Timestamp.now()),
    orderBy('dueAt', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    dueAt: doc.data().dueAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  }));
}
```

### 2. 최근 소비 리스트 조회

```typescript
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';

async function getRecentExpenses(accountId: string, limitCount: number = 20) {
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  
  const q = query(
    expensesRef,
    where('accountId', '==', accountId),
    orderBy('spentAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    spentAt: doc.data().spentAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  }));
}
```

### 3. 인사이트: 최근 30일 소비 및 리뷰 조회

```typescript
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { subDays } from 'date-fns';

async function getInsightsData(accountId: string, days: number = 30) {
  const startDate = subDays(new Date(), days);
  const startTimestamp = Timestamp.fromDate(startDate);
  
  // 최근 30일 소비 조회
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  const expensesQuery = query(
    expensesRef,
    where('accountId', '==', accountId),
    where('spentAt', '>=', startTimestamp),
    orderBy('spentAt', 'desc')
  );
  
  const expensesSnapshot = await getDocs(expensesQuery);
  const expenses = expensesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    spentAt: doc.data().spentAt?.toDate(),
  }));
  
  // 모든 리뷰 조회 (클라이언트에서 필터링)
  // 또는 각 expense의 reviews 서브컬렉션을 순회
  const reviews: any[] = [];
  
  for (const expense of expenses) {
    const reviewsRef = collection(
      db, 
      `accounts/${accountId}/expenses/${expense.id}/reviews`
    );
    const reviewsQuery = query(
      reviewsRef,
      orderBy('reviewedAt', 'desc')
    );
    
    const reviewsSnapshot = await getDocs(reviewsQuery);
    const expenseReviews = reviewsSnapshot.docs.map(doc => ({
      id: doc.id,
      expenseId: expense.id,
      ...doc.data(),
      reviewedAt: doc.data().reviewedAt?.toDate(),
    }));
    
    reviews.push(...expenseReviews);
  }
  
  return { expenses, reviews };
}
```

**최적화 버전** (리뷰를 별도로 조회):

```typescript
async function getInsightsDataOptimized(accountId: string, days: number = 30) {
  const startDate = subDays(new Date(), days);
  const startTimestamp = Timestamp.fromDate(startDate);
  
  // 소비 조회
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  const expensesQuery = query(
    expensesRef,
    where('accountId', '==', accountId),
    where('spentAt', '>=', startTimestamp),
    orderBy('spentAt', 'desc')
  );
  
  const expensesSnapshot = await getDocs(expensesQuery);
  const expenses = expensesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    spentAt: doc.data().spentAt?.toDate(),
  }));
  
  // 리뷰는 클라이언트에서 집계 시 필요한 것만 조회
  // 또는 reviews 컬렉션에 accountId를 포함시켜 별도 쿼리 가능
  // (현재 구조에서는 expense별로 조회해야 함)
  
  return expenses;
}
```

### 4. 특정 소비의 리뷰 목록 조회

```typescript
async function getExpenseReviews(
  accountId: string, 
  expenseId: string
) {
  const reviewsRef = collection(
    db, 
    `accounts/${accountId}/expenses/${expenseId}/reviews`
  );
  
  const q = query(
    reviewsRef,
    orderBy('reviewedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    reviewedAt: doc.data().reviewedAt?.toDate(),
    createdAt: doc.data().createdAt?.toDate(),
  }));
}
```

### 5. 소비 생성 및 스케줄 자동 생성

```typescript
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { addDays } from 'date-fns';

async function createExpenseWithSchedules(
  accountId: string,
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
) {
  const expensesRef = collection(db, `accounts/${accountId}/expenses`);
  
  // 소비 생성
  const expenseRef = await addDoc(expensesRef, {
    ...expenseData,
    accountId,
    spentAt: Timestamp.fromDate(expenseData.spentAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  const expenseId = expenseRef.id;
  
  // 리뷰 스케줄 생성 (3, 7, 30일)
  const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
  const delayDays = [3, 7, 30];
  
  const schedulePromises = delayDays.map(delay => {
    const dueAt = addDays(expenseData.spentAt, delay);
    return addDoc(schedulesRef, {
      expenseId,
      accountId,
      dueAt: Timestamp.fromDate(dueAt),
      delayDays: delay,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  });
  
  await Promise.all(schedulePromises);
  
  return expenseId;
}
```

### 6. 리뷰 생성 및 스케줄 완료 처리

```typescript
async function createReview(
  accountId: string,
  expenseId: string,
  scheduleId: string,
  reviewData: Omit<Review, 'id' | 'createdAt'>
) {
  const reviewsRef = collection(
    db, 
    `accounts/${accountId}/expenses/${expenseId}/reviews`
  );
  
  // 리뷰 생성
  const reviewRef = await addDoc(reviewsRef, {
    ...reviewData,
    expenseId,
    scheduleId,
    accountId,
    reviewedAt: Timestamp.fromDate(reviewData.reviewedAt),
    createdAt: serverTimestamp(),
  });
  
  // 스케줄 상태 업데이트
  const scheduleRef = doc(
    db, 
    `accounts/${accountId}/review_schedules/${scheduleId}`
  );
  await updateDoc(scheduleRef, {
    status: 'done',
    completedAt: serverTimestamp(),
  });
  
  return reviewRef.id;
}
```

## 설계 상 주의점

### 1. 읽기 횟수 최적화

#### 문제점
- 인사이트 조회 시 각 expense의 reviews를 개별 조회하면 읽기 횟수가 급증
- 예: 100개 소비 × 각각 리뷰 조회 = 100+ 읽기

#### 해결 방안
**옵션 A: 클라이언트 집계 최적화**
- 소비만 먼저 조회하고, 리뷰가 있는 expense만 필터링
- 필요한 expense의 reviews만 선택적으로 조회
- 읽기 횟수: N(expenses) + M(reviews, M << N)

**옵션 B: 리뷰 컬렉션 평탄화 (확장 고려)**
- `accounts/{accountId}/reviews/{reviewId}` 구조 추가
- `expenseId` 필드로 연결
- 인사이트 쿼리 시 한 번에 조회 가능
- 읽기 횟수: N(expenses) + 1(reviews query)

**권장**: MVP는 옵션 A, 확장 시 옵션 B 고려

### 2. 쿼리 비용 최적화

#### 인덱스 활용
- 모든 복합 쿼리에 인덱스 필수
- 인덱스 없으면 쿼리 실패 또는 전체 스캔 발생

#### 쿼리 제한
- `limit()` 사용으로 불필요한 읽기 방지
- 페이지네이션 구현 권장 (홈 화면 등)

#### 실시간 리스너 vs 일회성 쿼리
- 홈 화면: 실시간 리스너 (`onSnapshot`) 사용 시 비용 증가
- 인사이트: 일회성 쿼리 (`getDocs`) 권장

### 3. Security Rules 성능

#### 문제점
- `isAccountMember()` 함수가 매번 `get()` 호출
- 서브컬렉션 접근 시 상위 account 문서 읽기 발생

#### 최적화 방안
- Account 문서를 클라이언트에서 캐싱
- Rules에서 `get()` 호출 최소화
- 가능하면 `request.auth.uid` 직접 비교 우선

### 4. 확장성 고려

#### 멤버 관리
- `members` 서브컬렉션으로 공유 계정 지원
- Rules에서 멤버 확인 로직 포함

#### 카드 연동
- `expenses`에 `sourceType`, `sourceRef` 필드 포함
- 별도 인덱스 불필요 (필터링만 사용)

#### 리뷰 공유
- `reviewType: 'shared'`로 공유 리뷰 구분
- 향후 멤버 간 리뷰 공유 기능 확장 가능

### 5. 데이터 일관성

#### 트랜잭션 사용
- 소비 생성 + 스케줄 생성: 트랜잭션 권장
- 리뷰 생성 + 스케줄 업데이트: 트랜잭션 권장

```typescript
import { runTransaction } from 'firebase/firestore';

async function createExpenseWithSchedulesTransaction(
  accountId: string,
  expenseData: ExpenseData
) {
  await runTransaction(db, async (transaction) => {
    const expensesRef = collection(db, `accounts/${accountId}/expenses`);
    const expenseRef = doc(expensesRef);
    
    transaction.set(expenseRef, {
      ...expenseData,
      accountId,
      spentAt: Timestamp.fromDate(expenseData.spentAt),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const schedulesRef = collection(db, `accounts/${accountId}/review_schedules`);
    [3, 7, 30].forEach(delay => {
      const scheduleRef = doc(schedulesRef);
      const dueAt = addDays(expenseData.spentAt, delay);
      transaction.set(scheduleRef, {
        expenseId: expenseRef.id,
        accountId,
        dueAt: Timestamp.fromDate(dueAt),
        delayDays: delay,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    });
  });
}
```

### 6. 읽기 비용 예상

#### 시나리오별 읽기 횟수

**홈 화면 로드**:
- 대기 스케줄: 1회 (쿼리)
- 최근 소비 20개: 1회 (쿼리)
- **총: 2회**

**인사이트 조회 (30일, 100개 소비, 30개 리뷰)**:
- 소비 조회: 1회
- 리뷰 조회: 30회 (각 expense별)
- **총: 31회**

**인사이트 최적화 후**:
- 소비 조회: 1회
- 리뷰 조회: 1회 (평탄화된 구조)
- **총: 2회**

### 7. 인덱스 관리

#### 자동 인덱스 생성
- Firestore Console에서 쿼리 실행 시 자동 제안
- `firestore.indexes.json` 파일로 관리 권장

#### 배포
```bash
firebase deploy --only firestore:indexes
```

## 마이그레이션 고려사항

현재 코드는 flat 구조를 사용하고 있으므로, subcollection 구조로 마이그레이션 시:

1. 기존 데이터 마이그레이션 스크립트 작성
2. 클라이언트 코드 업데이트 (서비스 레이어)
3. Security Rules 업데이트
4. 인덱스 재생성

## 결론

- **MVP**: 현재 설계로 충분 (개인용, 읽기 횟수 적절)
- **확장**: 리뷰 평탄화, 멤버 관리, 트랜잭션 활용 고려
- **비용**: 인사이트 조회 최적화 필수 (리뷰 평탄화 권장)
