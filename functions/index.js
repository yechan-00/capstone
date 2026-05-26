const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { buildShareHtml } = require('./sharePageHtml');

setGlobalOptions({ region: 'asia-northeast3', maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
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
