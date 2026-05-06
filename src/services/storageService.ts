import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * 소비 기록용 이미지 업로드. 경로: users/{userId}/expenses/{expenseId}
 * (향후 users/{userId}/consumptions/{id} 구조로 옮길 때 경로만 변경하면 됨)
 */
export async function uploadExpenseImage(
  userId: string,
  expenseId: string,
  localUri: string
): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = guessExtFromUri(localUri);
  const path = `users/${userId}/expenses/${expenseId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}

function guessExtFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  return 'jpg';
}
