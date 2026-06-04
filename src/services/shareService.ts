import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExpenseCategory, ExpenseShare, GuestComment } from '@/lib/types';
import { buildShareDeepLink, buildShareWebUrl } from '@/lib/shareLinks';
import { uploadGuestCommentImage } from '@/services/storageService';
import { resolveExpenseImageUrl } from '@/utils/expenseImage';
import { timestampToDate } from '@/utils/firestore';

const SHARES = 'expense_shares';
const COMMENTS = 'guest_comments';

function randomToken(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function toExpenseShare(token: string, data: Record<string, unknown>): ExpenseShare {
  return {
    token,
    expenseId: data.expenseId as string,
    accountId: data.accountId as string,
    createdByUserId: data.createdByUserId as string,
    active: data.active !== false,
    title: (data.title as string) ?? '',
    subtitle: (data.subtitle as string) ?? '',
    amount: typeof data.amount === 'number' ? data.amount : undefined,
    category: (data.category as ExpenseCategory) ?? 'takeout',
    imageUrl: resolveExpenseImageUrl(data),
    spentAt: timestampToDate(data.spentAt as Timestamp),
    createdAt: timestampToDate(data.createdAt as Timestamp),
  };
}

function toGuestComment(id: string, data: Record<string, unknown>): GuestComment {
  return {
    id,
    guestName: (data.guestName as string) ?? '게스트',
    body: (data.body as string) ?? '',
    imageUrl: resolveExpenseImageUrl(data),
    createdAt: timestampToDate(data.createdAt as Timestamp),
  };
}

export const shareService = {
  async getOrCreateExpenseShare(input: {
    expenseId: string;
    accountId: string;
    userId: string;
    title: string;
    subtitle: string;
    amount?: number;
    category: ExpenseCategory;
    imageUrl?: string | null;
    spentAt: Date;
  }): Promise<{ token: string; webUrl: string; deepLink: string; share: ExpenseShare }> {
    const existing = await getDocs(
      query(collection(db, SHARES), where('expenseId', '==', input.expenseId), limit(8)),
    );
    const matched = existing.docs.find((d) => {
      const data = d.data();
      return data.createdByUserId === input.userId && data.active !== false;
    });

    if (matched) {
      const share = toExpenseShare(matched.id, matched.data());
      return {
        token: share.token,
        webUrl: buildShareWebUrl(share.token),
        deepLink: buildShareDeepLink(share.token),
        share,
      };
    }

    const token = randomToken();
    const payload = {
      token,
      expenseId: input.expenseId,
      accountId: input.accountId,
      createdByUserId: input.userId,
      active: true,
      title: input.title,
      subtitle: input.subtitle,
      amount: input.amount ?? null,
      category: input.category,
      imageUrl: input.imageUrl ?? null,
      spentAt: Timestamp.fromDate(input.spentAt),
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, SHARES, token), payload);
    const share = toExpenseShare(token, {
      ...payload,
      createdAt: Timestamp.fromDate(new Date()),
    });
    return {
      token,
      webUrl: buildShareWebUrl(token),
      deepLink: buildShareDeepLink(token),
      share,
    };
  },

  async getShareByToken(token: string): Promise<ExpenseShare | null> {
    const snap = await getDoc(doc(db, SHARES, token));
    if (!snap.exists()) return null;
    const share = toExpenseShare(snap.id, snap.data());
    if (!share.active) return null;
    return share;
  },

  async listGuestComments(token: string): Promise<GuestComment[]> {
    const q = query(
      collection(db, SHARES, token, COMMENTS),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toGuestComment(d.id, d.data()));
  },

  async addGuestComment(
    token: string,
    guestName: string,
    body: string,
    localImageUri?: string | null,
  ): Promise<string> {
    const trimmedName = guestName.trim();
    const trimmedBody = body.trim();
    if (!trimmedName) throw new Error('이름을 입력해 주세요.');
    if (!trimmedBody && !localImageUri) {
      throw new Error('내용 또는 사진을 입력해 주세요.');
    }
    if (trimmedName.length > 20) throw new Error('이름은 20자 이내로 입력해 주세요.');
    if (trimmedBody.length > 500) throw new Error('내용은 500자 이내로 입력해 주세요.');

    const commentRef = doc(collection(db, SHARES, token, COMMENTS));
    let imageUrl: string | null = null;

    if (localImageUri) {
      imageUrl = await uploadGuestCommentImage(token, commentRef.id, localImageUri);
    }

    await setDoc(commentRef, {
      guestName: trimmedName,
      body: trimmedBody,
      imageUrl,
      createdAt: serverTimestamp(),
    });
    return commentRef.id;
  },
};
