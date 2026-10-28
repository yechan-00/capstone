import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '@/lib/firebase';
import { seedExpenseImageCache } from '@/lib/expenseImageCache';
import { parseExpenseImageUrlsField } from '@/utils/expenseImage';
import type { EditableExpensePhoto } from '@/utils/editedImagePersist';
import {
  assembleEditedImageUrls,
  buildEditedImagePersistFields,
  editablePhotosUnchanged,
  localEditablePhotos,
} from '@/utils/editedImagePersist';
import {
  ImageOptimizeError,
  prepareExpenseImageForUpload,
  type PreparedExpenseImage,
} from '@/lib/prepareExpenseImage';

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly stage: 'config' | 'auth' | 'read' | 'upload' | 'persist',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export function getR2ImageApiBaseUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_R2_IMAGE_API_URL?.trim().replace(/\/$/, '');
  return value || null;
}

export function isRemoteImageUrl(uri: string | null | undefined): boolean {
  return !!uri && /^https?:\/\//i.test(uri.trim());
}

function guessExtFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.webp')) return 'webp';
  if (lower.includes('.heic') || lower.includes('.heif')) return 'heic';
  return 'jpg';
}

function contentTypeFromUri(uri: string): string {
  const extension = guessExtFromUri(uri);
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function resolveImageContentType(headerType: string | null, fallbackUri: string): string {
  const type = headerType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.startsWith('image/')) return type;
  return contentTypeFromUri(fallbackUri);
}

async function readLocalImage(localUri: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  let response: Response;
  try {
    response = await fetch(localUri);
  } catch {
    throw new ImageUploadError('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.', 'read');
  }
  if (!response.ok) {
    throw new ImageUploadError('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.', 'read', response.status);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new ImageUploadError('빈 사진 파일이에요. 다른 사진을 선택해 주세요.', 'read');
  }
  return {
    bytes,
    contentType: resolveImageContentType(response.headers.get('Content-Type'), localUri),
  };
}

/**
 * 소비 기록용 이미지 업로드. 경로: users/{userId}/expenses/{expenseId}
 * 비밀키는 Worker/R2에만 있고, 앱은 Firebase ID 토큰으로 Worker에 요청합니다.
 */
export async function uploadExpenseImage(
  userId: string,
  expenseId: string,
  localUri: string,
): Promise<string> {
  const apiBase = getR2ImageApiBaseUrl();
  if (!apiBase) {
    throw new ImageUploadError(
      'R2 이미지 서버 주소가 설정되지 않았어요. EXPO_PUBLIC_R2_IMAGE_API_URL을 확인한 뒤 앱을 다시 시작해 주세요.',
      'config',
    );
  }

  if (isRemoteImageUrl(localUri)) {
    throw new ImageUploadError('이미 저장된 사진은 다시 올리지 않아요.', 'read');
  }

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new ImageUploadError('사진을 올리려면 다시 로그인해 주세요.', 'auth');
  }

  let prepared: PreparedExpenseImage;
  try {
    prepared = await prepareExpenseImageForUpload(localUri);
  } catch (error) {
    throw new ImageUploadError(
      error instanceof ImageOptimizeError
        ? error.message
        : '사진을 최적화하지 못했어요. 다른 사진을 선택해 주세요.',
      'read',
    );
  }
  const { bytes } = await readLocalImage(prepared.uri);
  const contentType = prepared.contentType;
  const uploadUri = prepared.uri;
  const idToken = await currentUser.getIdToken();
  let response: Response;
  try {
    response = await fetch(`${apiBase}/v1/expenses/${encodeURIComponent(expenseId)}/image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': contentType,
      },
      body: bytes,
    });
  } catch {
    throw new ImageUploadError('사진 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.', 'upload');
  }

  const payload = (await response.json().catch(() => null)) as
    | { imageUrl?: string; error?: string }
    | null;

  if (response.status === 401) {
    throw new ImageUploadError('로그인 정보가 만료됐어요. 다시 로그인한 뒤 시도해 주세요.', 'auth', 401);
  }
  if (response.status === 413 || payload?.error === 'image-too-large') {
    throw new ImageUploadError('사진이 너무 커요. 6MB 이하 사진을 선택해 주세요.', 'upload', 413);
  }
  if (response.status === 415 || payload?.error === 'image-required') {
    throw new ImageUploadError('지원하지 않는 사진 형식이에요. JPG, PNG 사진을 선택해 주세요.', 'upload', 415);
  }
  if (!response.ok || typeof payload?.imageUrl !== 'string' || !payload.imageUrl.startsWith('https://')) {
    throw new ImageUploadError('사진 서버에 업로드하지 못했어요. 잠시 후 다시 시도해 주세요.', 'upload', response.status);
  }

  seedExpenseImageCache(uploadUri, payload.imageUrl);
  return payload.imageUrl;
}

function parseUploadError(response: Response, payload: { imageUrl?: string; error?: string } | null): ImageUploadError {
  if (response.status === 401) {
    return new ImageUploadError('로그인 정보가 만료됐어요. 다시 로그인한 뒤 시도해 주세요.', 'auth', 401);
  }
  if (response.status === 413 || payload?.error === 'image-too-large') {
    return new ImageUploadError('사진이 너무 커요. 6MB 이하 사진을 선택해 주세요.', 'upload', 413);
  }
  if (response.status === 415 || payload?.error === 'image-required') {
    return new ImageUploadError('지원하지 않는 사진 형식이에요. JPG, PNG 사진을 선택해 주세요.', 'upload', 415);
  }
  if (response.status === 400 && payload?.error === 'invalid-slot') {
    return new ImageUploadError('사진 위치가 올바르지 않아요. 1~5번만 올릴 수 있어요.', 'upload', 400);
  }
  return new ImageUploadError(
    '사진 서버에 업로드하지 못했어요. 잠시 후 다시 시도해 주세요.',
    'upload',
    response.status,
  );
}

/**
 * 신규 슬롯 업로드.
 * 경로: POST /v1/expenses/{expenseId}/images/{slot}  slot=1..5
 * Worker가 고유 키로 PUT만 하므로, 실패해도 기존 R2 객체·Firestore 필드를 지우지 않는다.
 * 기존 uploadExpenseImage 및 단일 키 `{expenseId}.jpg`는 그대로 둔다.
 */
export async function uploadExpenseImageSlot(
  userId: string,
  expenseId: string,
  slot: number,
  localUri: string,
): Promise<string> {
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
    throw new ImageUploadError('사진 위치가 올바르지 않아요. 1~5번만 올릴 수 있어요.', 'upload');
  }

  const apiBase = getR2ImageApiBaseUrl();
  if (!apiBase) {
    throw new ImageUploadError(
      'R2 이미지 서버 주소가 설정되지 않았어요. EXPO_PUBLIC_R2_IMAGE_API_URL을 확인한 뒤 앱을 다시 시작해 주세요.',
      'config',
    );
  }

  if (isRemoteImageUrl(localUri)) {
    throw new ImageUploadError('이미 저장된 사진은 다시 올리지 않아요.', 'read');
  }

  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new ImageUploadError('사진을 올리려면 다시 로그인해 주세요.', 'auth');
  }

  let prepared: PreparedExpenseImage;
  try {
    prepared = await prepareExpenseImageForUpload(localUri);
  } catch (error) {
    throw new ImageUploadError(
      error instanceof ImageOptimizeError
        ? error.message
        : '사진을 최적화하지 못했어요. 다른 사진을 선택해 주세요.',
      'read',
    );
  }
  const { bytes } = await readLocalImage(prepared.uri);
  const contentType = prepared.contentType;
  const uploadUri = prepared.uri;
  const idToken = await currentUser.getIdToken();
  let response: Response;
  try {
    response = await fetch(
      `${apiBase}/v1/expenses/${encodeURIComponent(expenseId)}/images/${slot}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': contentType,
        },
        body: bytes,
      },
    );
  } catch {
    throw new ImageUploadError('사진 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.', 'upload');
  }

  const payload = (await response.json().catch(() => null)) as
    | { imageUrl?: string; error?: string }
    | null;

  if (!response.ok || typeof payload?.imageUrl !== 'string' || !payload.imageUrl.startsWith('https://')) {
    throw parseUploadError(response, payload);
  }

  seedExpenseImageCache(uploadUri, payload.imageUrl);
  return payload.imageUrl;
}

/** R2 업로드 후 Firestore imageUrl을 연결합니다. 업로드만 되고 문서 갱신이 실패하면 persist 오류를 던집니다. */
export async function attachUploadedExpenseImage(
  userId: string,
  expenseId: string,
  localUri: string,
  updateExpense: (expenseId: string, updates: { imageUrl: string }) => Promise<void>,
): Promise<void> {
  const imageUrl = await uploadExpenseImage(userId, expenseId, localUri);
  try {
    await updateExpense(expenseId, { imageUrl });
  } catch {
    throw new ImageUploadError(
      '사진은 올라갔지만 기록에 연결하지 못했어요. 수정 화면에서 사진을 다시 올려 주세요.',
      'persist',
    );
  }
}

export type ExpenseSlotAttachResult = {
  imageUrls: string[];
  imageUrl: string | null;
  failedCount: number;
  total: number;
  persisted: boolean;
};

function isStoredImageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

async function persistExpenseImageFields(
  expenseId: string,
  imageUrl: string | null,
  imageUrls: string[],
  updateExpense: (
    expenseId: string,
    updates: { imageUrl: string | null; imageUrls: string[] },
  ) => Promise<void>,
): Promise<boolean> {
  try {
    await updateExpense(expenseId, { imageUrl, imageUrls });
    return true;
  } catch {
    try {
      await updateExpense(expenseId, { imageUrl, imageUrls });
      return true;
    } catch {
      console.warn('[expense] image persist failed', { count: imageUrls.length });
      return false;
    }
  }
}

/**
 * 신규 소비 전용. 배열 순서대로 슬롯 1~5에 올리고, 성공한 URL만 Firestore에 저장한다.
 * 기존 단일 업로드 API는 호출하지 않는다. 업로드 실패해도 소비 문서는 유지한다.
 */
export async function attachUploadedExpenseImageSlots(
  userId: string,
  expenseId: string,
  localUris: string[],
  updateExpense: (
    expenseId: string,
    updates: { imageUrl: string | null; imageUrls: string[] },
  ) => Promise<void>,
): Promise<ExpenseSlotAttachResult> {
  const capped = localUris
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0 && !isRemoteImageUrl(uri))
    .slice(0, 5);

  const uploadedUrls: string[] = [];
  for (let index = 0; index < capped.length; index += 1) {
    try {
      const url = await uploadExpenseImageSlot(userId, expenseId, index + 1, capped[index]);
      if (isStoredImageUrl(url) && !uploadedUrls.includes(url)) {
        uploadedUrls.push(url);
      }
    } catch {
      console.warn('[expense] slot upload failed', index + 1);
    }
  }

  const imageUrls = parseExpenseImageUrlsField(uploadedUrls) ?? [];
  const imageUrl = imageUrls[0] ?? null;
  const persisted = await persistExpenseImageFields(
    expenseId,
    imageUrl,
    imageUrls,
    updateExpense,
  );

  return {
    imageUrls,
    imageUrl,
    failedCount: capped.length - imageUrls.length,
    total: capped.length,
    persisted,
  };
}

export type SaveEditedExpensePhotosResult =
  | { status: 'skipped' }
  | {
      status: 'saved';
      persisted: boolean;
      failedLocalCount: number;
      totalLocal: number;
      urlCount: number;
    }
  | { status: 'kept-original'; failedLocalCount: number; totalLocal: number };

/**
 * 소비 수정용. 원격 URL은 재사용하고 로컬 사진만 슬롯 API로 올린다.
 * 레거시 POST /image 는 호출하지 않는다. 전부 실패하면 Firestore 사진 필드를 건드리지 않는다.
 */
export async function saveEditedExpensePhotos(
  userId: string | null,
  expenseId: string,
  photos: EditableExpensePhoto[],
  originalPhotos: EditableExpensePhoto[],
  originallyHadImageUrlsField: boolean,
  updateExpense: (
    expenseId: string,
    updates: { imageUrl: string | null; imageUrls?: string[] },
  ) => Promise<void>,
): Promise<SaveEditedExpensePhotosResult> {
  if (editablePhotosUnchanged(originalPhotos, photos)) {
    return { status: 'skipped' };
  }

  const locals = localEditablePhotos(photos);
  const uploadedByLocalId: Record<string, string> = {};

  if (locals.length > 0) {
    if (!userId) {
      return { status: 'kept-original', failedLocalCount: locals.length, totalLocal: locals.length };
    }
    for (let index = 0; index < locals.length; index += 1) {
      try {
        const url = await uploadExpenseImageSlot(userId, expenseId, index + 1, locals[index].uri);
        if (isStoredImageUrl(url)) uploadedByLocalId[locals[index].id] = url;
      } catch {
        console.warn('[expense] edit slot upload failed', index + 1);
      }
    }
  }

  const assembled = assembleEditedImageUrls(photos, uploadedByLocalId);
  if (assembled.totalLocal > 0 && assembled.failedLocalCount === assembled.totalLocal) {
    return {
      status: 'kept-original',
      failedLocalCount: assembled.failedLocalCount,
      totalLocal: assembled.totalLocal,
    };
  }

  const urls = parseExpenseImageUrlsField(assembled.urls) ?? [];
  const fields = buildEditedImagePersistFields(urls, originallyHadImageUrlsField);
  const persisted = await persistOptionalImageFields(expenseId, fields, updateExpense);

  return {
    status: 'saved',
    persisted,
    failedLocalCount: assembled.failedLocalCount,
    totalLocal: assembled.totalLocal,
    urlCount: urls.length,
  };
}

async function persistOptionalImageFields(
  expenseId: string,
  fields: { imageUrl: string | null; imageUrls?: string[] },
  updateExpense: (
    expenseId: string,
    updates: { imageUrl: string | null; imageUrls?: string[] },
  ) => Promise<void>,
): Promise<boolean> {
  try {
    await updateExpense(expenseId, fields);
    return true;
  } catch {
    try {
      await updateExpense(expenseId, fields);
      return true;
    } catch {
      console.warn('[expense] image persist failed', { count: fields.imageUrls?.length ?? (fields.imageUrl ? 1 : 0) });
      return false;
    }
  }
}

/**
 * 게스트 코멘트용 이미지 업로드. 경로: shares/{token}/comments/{commentId}
 * (공유 페이지는 기존 Firebase Storage를 사용합니다.)
 */
export async function uploadGuestCommentImage(
  token: string,
  commentId: string,
  localUri: string,
): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = guessExtFromUri(localUri);
  const path = `shares/${token}/comments/${commentId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
}
