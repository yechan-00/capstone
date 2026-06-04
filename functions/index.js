const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const { buildShareHtml } = require('./sharePageHtml');

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const expo = new Expo();
const WEB_BASE = 'https://regret-wallet-3db60.web.app';
const SHARE_INVITE = '놀러오셔서 추억을 기록해봐요!';

function extractToken(path) {
  const parts = String(path || '')
    .split('/')
    .filter(Boolean);
  const shareIdx = parts.indexOf('share');
  if (shareIdx >= 0 && parts[shareIdx + 1]) return parts[shareIdx + 1];
  return parts[parts.length - 1] || '';
}

function categoryLabel(category) {
  switch (category) {
    case 'delivery':
      return '외식(배달)';
    case 'cafe':
      return '외식(카페)';
    default:
      return '외식(포장)';
  }
}

function formatAmount(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '금액 없음';
  return `${amount.toLocaleString('ko-KR')}원`;
}

function pickOgImage(share) {
  const url = share.imageUrl;
  if (typeof url === 'string' && /^https:\/\//.test(url.trim())) return url.trim();
  return `${WEB_BASE}/og-brand.png`;
}

/** 카카오톡·SNS 크롤러 + 게스트용 공유 페이지 (OG 태그 포함) */
exports.sharePage = onRequest({ cors: false, invoker: 'public' }, async (req, res) => {
  const token = extractToken(req.path);
  if (!token) {
    res.status(404).send('링크를 찾을 수 없어요.');
    return;
  }

  try {
    const snap = await db.collection('expense_shares').doc(token).get();
    if (!snap.exists || snap.data()?.active === false) {
      res.status(404).send('만료되었거나 존재하지 않는 공유 링크예요.');
      return;
    }

    const share = snap.data();
    const commentsSnap = await db
      .collection('expense_shares')
      .doc(token)
      .collection('guest_comments')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();

    const comments = commentsSnap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        guestName: c.guestName || '게스트',
        body: c.body || '',
        imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : null,
        createdAt: c.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    const ogTitle = [share.subtitle, formatAmount(share.amount)].filter(Boolean).join(' · ') || share.title || '후회가계부';
    const ogImage = pickOgImage(share);
    const canonicalUrl = `${WEB_BASE}/share/${token}`;

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).send(
      buildShareHtml({
        token,
        webBase: WEB_BASE,
        shareInvite: SHARE_INVITE,
        share: {
          title: share.title || '',
          subtitle: share.subtitle || '',
          amountLabel: formatAmount(share.amount),
          categoryLabel: categoryLabel(share.category),
          imageUrl: typeof share.imageUrl === 'string' ? share.imageUrl : '',
          spentAt: share.spentAt?.toDate?.()?.toISOString?.() || null,
        },
        comments,
        og: {
          title: ogTitle,
          description: SHARE_INVITE,
          image: ogImage,
          url: canonicalUrl,
          siteName: '후회가계부',
        },
      }),
    );
  } catch (err) {
    console.error('[sharePage]', err);
    res.status(500).send('페이지를 불러오지 못했어요.');
  }
});

/** 게스트 댓글 등록 시 소유자 알림 */
exports.onGuestCommentCreated = onDocumentCreated(
  'expense_shares/{token}/guest_comments/{commentId}',
  async (event) => {
    const token = event.params.token;
    const comment = event.data?.data();
    if (!comment) return;

    const shareSnap = await db.collection('expense_shares').doc(token).get();
    if (!shareSnap.exists) return;

    const share = shareSnap.data();
    const ownerId = share.createdByUserId;
    if (!ownerId) return;

    const bodyPreview = String(comment.body || '').slice(0, 120)
      || (comment.imageUrl ? '(사진)' : '');
    await db.collection('user_notifications').add({
      userId: ownerId,
      type: 'share_comment',
      shareToken: token,
      expenseId: share.expenseId || null,
      shareTitle: share.title || '',
      shareSubtitle: share.subtitle || '',
      guestName: comment.guestName || '게스트',
      bodyPreview,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);

function getKstParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[weekday] ?? 0,
    hour,
    minute,
  };
}

function slotMatchesNow(slot, kst) {
  if (kst.hour !== slot.hour) return false;
  if (Math.abs(kst.minute - (slot.minute ?? 0)) > 0) return false;
  if (slot.kind === 'weekday') {
    return slot.weekday === kst.weekday;
  }
  return slot.kind === 'time';
}

function buildRemoteAlertBody(slot) {
  const lead = slot.leadMinutes ?? 10;
  if (slot.kind === 'weekday') {
    return `${slot.label || '오늘'}에는 후회 소비가 ${Math.round(slot.regretRate || 0)}%였어요. 평소 구매 시각보다 ${lead}분 일찍, 지금 한번 멈춰볼까요?`;
  }
  return `${slot.label || '이 시간'} 시간대에 후회가 잦았어요. 평소 구매 시각보다 ${lead}분 일찍, 충동구매 전에 잠깐 멈춰볼까요?`;
}

function dedupeKey(slot, kst) {
  const dayKey = new Date().toISOString().slice(0, 10);
  return `${slot.id}:${dayKey}:${kst.hour}`;
}

/** 매시 정각(KST) — 후회 패턴 알림 (Expo Push) */
exports.sendRegretPatternAlerts = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'Asia/Seoul',
  },
  async () => {
    const now = new Date();
    const kst = getKstParts(now);
    const snap = await db.collection('accounts').where('regretPatternAlertEnabled', '==', true).get();

    const messages = [];
    const updates = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const token = data.expoPushToken;
      if (!token || !Expo.isExpoPushToken(token)) continue;

      const slots = Array.isArray(data.regretPatternAlertSlots) ? data.regretPatternAlertSlots : [];
      if (slots.length === 0) continue;

      const lastFired = data.regretPatternAlertLastFired || {};

      for (const slot of slots) {
        if (!slotMatchesNow(slot, kst)) continue;
        const key = dedupeKey(slot, kst);
        if (lastFired[key]) continue;

        messages.push({
          to: token,
          sound: 'default',
          title: '한번 참아볼까요?',
          body: buildRemoteAlertBody(slot),
          data: { kind: 'regret_pattern_alert', slotId: slot.id },
        });
        updates.push({ ref: docSnap.ref, key });
      }
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error('[sendRegretPatternAlerts] push failed', err);
      }
    }

    await Promise.all(
      updates.map(({ ref, key }) =>
        ref.set(
          {
            [`regretPatternAlertLastFired.${key.replace(/\./g, '_')}`]: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );
  },
);
