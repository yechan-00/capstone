const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBeZzyAeZ4R3mpw30LTGaA6D6guxAve4ko',
  authDomain: 'regret-wallet-3db60.firebaseapp.com',
  projectId: 'regret-wallet-3db60',
  storageBucket: 'regret-wallet-3db60.firebasestorage.app',
  messagingSenderId: '692126576936',
  appId: '1:692126576936:web:f6fb84c68d37e03b37601d',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSpentAt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatCommentDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function buildShareHtml({ token, webBase, shareInvite, share, comments, og }) {
  const hasImage = share.imageUrl && /^https:\/\//.test(share.imageUrl);
  const spentLabel = formatSpentAt(share.spentAt);

  const commentsHtml = comments
    .map((c) => {
      const img =
        c.imageUrl && /^https:\/\//.test(c.imageUrl)
          ? `<img class="comment-photo" src="${escapeHtml(c.imageUrl)}" alt="추억 사진" />`
          : '';
      const body = c.body ? `<div class="comment-body">${escapeHtml(c.body)}</div>` : '';
      return `
      <article class="comment">
        <div class="comment-name">${escapeHtml(c.guestName)}</div>
        ${body}
        ${img}
        <div class="comment-date">${escapeHtml(formatCommentDate(c.createdAt))}</div>
      </article>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(og.title)} · 후회가계부</title>
  <meta name="description" content="${escapeHtml(og.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:site_name" content="${escapeHtml(og.siteName)}" />
  <meta property="og:title" content="${escapeHtml(og.title)}" />
  <meta property="og:description" content="${escapeHtml(og.description)}" />
  <meta property="og:image" content="${escapeHtml(og.image)}" />
  <meta property="og:url" content="${escapeHtml(og.url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(og.title)}" />
  <meta name="twitter:description" content="${escapeHtml(og.description)}" />
  <meta name="twitter:image" content="${escapeHtml(og.image)}" />
  <link rel="icon" href="${webBase}/og-brand.png" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background: #f3f6fb;
      color: #0f172a;
      line-height: 1.5;
    }
    .wrap { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
    .brand { font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 0.04em; }
    h1 { margin: 6px 0 4px; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; }
    .subhead { color: #64748b; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
    .invite {
      background: linear-gradient(135deg, #2e4475, #1a2d4a);
      color: #fff;
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      font-size: 15px;
      margin-bottom: 16px;
      text-align: center;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 8px 24px rgba(26, 45, 74, 0.08);
      margin-bottom: 20px;
    }
    .hero { position: relative; height: 220px; background: #e8ecf4; }
    .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .badges {
      position: absolute; top: 10px; left: 10px; right: 10px;
      display: flex; justify-content: space-between; gap: 8px;
    }
    .badge {
      border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 800;
      max-width: 48%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .badge-cat { background: rgba(255,255,255,0.95); color: #0f172a; }
    .badge-price { background: #2e4475; color: #fff; margin-left: auto; }
    .meta-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #e2e8f0;
    }
    .body { padding: 14px 16px 16px; }
    .title { font-size: 18px; font-weight: 900; margin: 0; }
    .menu { color: #64748b; font-size: 14px; font-weight: 600; margin-top: 4px; }
    .section-title { font-size: 17px; font-weight: 900; margin: 0 0 8px; }
    .section-hint { color: #64748b; font-size: 13px; font-weight: 600; margin: 0 0 12px; line-height: 1.5; }
    .form { display: grid; gap: 10px; }
    input, textarea {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 12px 14px; font-size: 15px; font-weight: 600; font-family: inherit;
      background: #f8fafc;
    }
    textarea { min-height: 96px; resize: vertical; }
    button {
      border: 0; border-radius: 12px; padding: 14px;
      background: #2e4475; color: #fff; font-size: 15px; font-weight: 900; cursor: pointer;
    }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .comments { display: grid; gap: 10px; margin-top: 12px; }
    .comment {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px;
    }
    .comment-name { font-weight: 900; font-size: 14px; }
    .comment-body { margin-top: 6px; font-size: 14px; color: #334155; white-space: pre-wrap; }
    .comment-photo {
      width: 100%; max-height: 220px; object-fit: cover; border-radius: 10px;
      margin-top: 8px; background: #e8ecf4;
    }
    .comment-date { margin-top: 8px; font-size: 11px; color: #94a3b8; font-weight: 600; }
    .photo-field { margin-top: 4px; }
    .photo-field input[type=file] { font-size: 13px; width: 100%; }
    .photo-preview {
      width: 100%; max-height: 160px; object-fit: cover; border-radius: 10px;
      margin-top: 8px; display: none; background: #e8ecf4;
    }
    .toast {
      display: none; margin-top: 10px; padding: 10px 12px; border-radius: 10px;
      background: #ecfdf5; color: #047857; font-size: 13px; font-weight: 700;
    }
    .footer { text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">후회가계부</div>
    <h1>함께한 한 끼</h1>
    ${spentLabel ? `<div class="subhead">${escapeHtml(spentLabel)}</div>` : ''}
    <div class="invite">${escapeHtml(shareInvite)}</div>

    <div class="card">
      ${
        hasImage
          ? `<div class="hero">
        <img src="${escapeHtml(share.imageUrl)}" alt="${escapeHtml(share.subtitle || share.title)}" />
        <div class="badges">
          <span class="badge badge-cat">${escapeHtml(share.categoryLabel)}</span>
          <span class="badge badge-price">${escapeHtml(share.amountLabel)}</span>
        </div>
      </div>`
          : `<div class="meta-row">
        <span class="badge badge-cat">${escapeHtml(share.categoryLabel)}</span>
        <strong>${escapeHtml(share.amountLabel)}</strong>
      </div>`
      }
      <div class="body">
        <p class="title">${escapeHtml(share.title)}</p>
        ${share.subtitle ? `<p class="menu">${escapeHtml(share.subtitle)}</p>` : ''}
      </div>
    </div>

    <div>
      <h2 class="section-title">추억 · 의견 남기기</h2>
      <p class="section-hint">이름과 메시지·사진을 남기면 작성자에게 알림이 전달돼요.</p>
      <form class="form" id="comment-form">
        <input id="guest-name" maxlength="20" placeholder="이름 (예: 민수)" required />
        <textarea id="guest-body" maxlength="500" placeholder="오늘 이 메뉴 어땠는지, 추억을 적어 주세요 (사진만 남겨도 OK)"></textarea>
        <div class="photo-field">
          <input id="guest-photo" type="file" accept="image/*" />
          <img id="photo-preview" class="photo-preview" alt="미리보기" />
        </div>
        <button type="submit" id="submit-btn">남기기</button>
        <div class="toast" id="toast">추억이 남겨졌어요! 작성자에게 알림이 전달됩니다.</div>
      </form>
    </div>

    ${
      comments.length
        ? `<div style="margin-top:24px">
      <h2 class="section-title">남겨진 추억 (${comments.length})</h2>
      <div class="comments" id="comments">${commentsHtml}</div>
    </div>`
        : '<div class="comments" id="comments"></div>'
    }

    <div class="footer">RegretWallet · 후회가계부</div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/11.6.0/firebase-auth-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore-compat.js"><\/script>
  <script src="https://www.gstatic.com/firebasejs/11.6.0/firebase-storage-compat.js"><\/script>
  <script>
    const TOKEN = ${JSON.stringify(token)};
    firebase.initializeApp(${JSON.stringify(FIREBASE_CONFIG)});
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    async function ensureAuth() {
      if (!auth.currentUser) await auth.signInAnonymously();
    }

    const photoInput = document.getElementById('guest-photo');
    const photoPreview = document.getElementById('photo-preview');
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) {
        photoPreview.style.display = 'none';
        photoPreview.removeAttribute('src');
        return;
      }
      photoPreview.src = URL.createObjectURL(file);
      photoPreview.style.display = 'block';
    });

    async function uploadCommentPhoto(commentId, file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext.replace('jpeg', 'jpg') : 'jpg';
      const ref = storage.ref('share_comments/' + TOKEN + '/' + commentId + '.' + safeExt);
      await ref.put(file);
      return ref.getDownloadURL();
    }

    function prependComment(name, body, imageUrl) {
      const list = document.getElementById('comments');
      if (!list) return;
      const article = document.createElement('article');
      article.className = 'comment';
      const imgHtml = imageUrl
        ? '<img class="comment-photo" src="' + imageUrl.replace(/"/g, '&quot;') + '" alt="추억 사진" />'
        : '';
      const bodyHtml = body ? '<div class="comment-body"></div>' : '';
      article.innerHTML =
        '<div class="comment-name"></div>' + bodyHtml + imgHtml + '<div class="comment-date">방금</div>';
      article.querySelector('.comment-name').textContent = name;
      if (body && article.querySelector('.comment-body')) {
        article.querySelector('.comment-body').textContent = body;
      }
      list.prepend(article);
    }

    document.getElementById('comment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const toast = document.getElementById('toast');
      const name = document.getElementById('guest-name').value.trim();
      const body = document.getElementById('guest-body').value.trim();
      const file = photoInput.files && photoInput.files[0];
      if (!name) return;
      if (!body && !file) {
        alert('내용 또는 사진을 입력해 주세요.');
        return;
      }
      btn.disabled = true;
      try {
        await ensureAuth();
        const commentRef = db.collection('expense_shares').doc(TOKEN).collection('guest_comments').doc();
        let imageUrl = null;
        if (file) {
          imageUrl = await uploadCommentPhoto(commentRef.id, file);
        }
        await commentRef.set({
          guestName: name,
          body: body,
          imageUrl: imageUrl,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        prependComment(name, body, imageUrl);
        document.getElementById('guest-body').value = '';
        photoInput.value = '';
        photoPreview.style.display = 'none';
        toast.style.display = 'block';
      } catch (err) {
        alert('등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
        console.error(err);
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

module.exports = { buildShareHtml };
