import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { requireUserIdFromAccountId } from '@/lib/accountId';

const BACKFILL_KEY_PREFIX = '@user_id_backfill_v1:';

type BackfillCollection = 'expenses' | 'reviews' | 'review_schedules';

const COLLECTIONS: BackfillCollection[] = ['expenses', 'reviews', 'review_schedules'];

/** Firestore writeBatch 최대 500 — 여유 두고 400 */
const BATCH_SIZE = 400;

async function backfillCollection(
  collectionName: BackfillCollection,
  accountId: string,
  userId: string,
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, collectionName), where('accountId', '==', accountId)),
  );

  let updated = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (typeof data.userId === 'string' && data.userId.length > 0) continue;

    batch.update(doc(db, collectionName, docSnap.id), { userId });
    updated += 1;
    batchCount += 1;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return updated;
}

/**
 * 레거시 문서에 userId 필드를 채웁니다. 유저당 1회만 실행됩니다.
 * (콘솔에서 userId 없이 accountId만 있는 문서 정리용)
 */
export async function backfillUserIdForAccount(accountId: string): Promise<number> {
  const userId = requireUserIdFromAccountId(accountId);
  const storageKey = `${BACKFILL_KEY_PREFIX}${userId}`;

  const done = await AsyncStorage.getItem(storageKey);
  if (done === '1') return 0;

  let total = 0;
  for (const coll of COLLECTIONS) {
    total += await backfillCollection(coll, accountId, userId);
  }

  await AsyncStorage.setItem(storageKey, '1');
  if (total > 0) {
    console.info(`[migration] userId backfill: ${total} docs updated for ${userId}`);
  }
  return total;
}
