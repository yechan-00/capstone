import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserNotification } from '@/lib/types';
import { timestampToDate } from '@/utils/firestore';

const COLLECTION = 'user_notifications';

function toNotification(id: string, data: Record<string, unknown>): UserNotification {
  return {
    id,
    userId: data.userId as string,
    type: 'share_comment',
    shareToken: data.shareToken as string,
    expenseId: (data.expenseId as string | null | undefined) ?? null,
    shareTitle: data.shareTitle as string | undefined,
    shareSubtitle: data.shareSubtitle as string | undefined,
    guestName: (data.guestName as string) ?? '게스트',
    bodyPreview: (data.bodyPreview as string) ?? '',
    read: data.read === true,
    createdAt: timestampToDate(data.createdAt as any),
  };
}

export const userNotificationService = {
  async listForUser(userId: string, max = 40): Promise<UserNotification[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(max),
      ),
    );
    return snap.docs.map((d) => toNotification(d.id, d.data()));
  },

  async countUnread(userId: string): Promise<number> {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('userId', '==', userId), where('read', '==', false), limit(50)),
    );
    return snap.size;
  },

  async markRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
  },

  async markAllRead(userId: string): Promise<void> {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('userId', '==', userId), where('read', '==', false), limit(50)),
    );
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  },
};
