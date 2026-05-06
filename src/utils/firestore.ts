import { Timestamp } from 'firebase/firestore';

/**
 * Firestore Timestamp를 Date로 변환하는 헬퍼 함수
 */
export const timestampToDate = (timestamp: Timestamp | Date | undefined | null): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
};

/**
 * Firestore 문서 데이터를 타입으로 변환하는 제네릭 헬퍼
 */
export const mapDocToData = <T extends { id: string }>(
  doc: { id: string; data: () => any },
  dateFields: string[] = ['createdAt', 'updatedAt']
): T => {
  const data = doc.data();
  const mapped: any = {
    id: doc.id,
    ...data,
  };

  // 날짜 필드 변환
  dateFields.forEach((field) => {
    if (data[field]) {
      mapped[field] = timestampToDate(data[field]);
    }
  });

  return mapped as T;
};
