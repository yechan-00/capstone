import { auth } from '@/lib/firebase';
import { ImageOptimizeError, prepareExpenseImageForUpload } from '@/lib/prepareExpenseImage';
import { parseSpaceMemoryImageKey } from '@/lib/spaceMemory';
import { ImageUploadError, getR2ImageApiBaseUrl, isRemoteImageUrl } from '@/services/storageService';

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
  const headerType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  return {
    bytes,
    contentType: headerType.startsWith('image/') ? headerType : 'image/jpeg',
  };
}

function parseImageError(response: Response, payload: { error?: string } | null): ImageUploadError {
  if (response.status === 401) {
    return new ImageUploadError('로그인 정보가 만료됐어요. 다시 로그인한 뒤 시도해 주세요.', 'auth', 401);
  }
  if (response.status === 403 || payload?.error === 'not-author') {
    return new ImageUploadError('이 사진에 접근할 수 없어요.', 'auth', 403);
  }
  if (response.status === 413 || payload?.error === 'image-too-large') {
    return new ImageUploadError('사진이 너무 커요. 6MB 이하 사진을 선택해 주세요.', 'upload', 413);
  }
  if (response.status === 409 || payload?.error === 'too-many-images') {
    return new ImageUploadError('이 기록에 사진을 더 올릴 수 없어요. 잠시 후 다시 시도해 주세요.', 'upload', 409);
  }
  if (response.status === 415 || payload?.error === 'image-required') {
    return new ImageUploadError('지원하지 않는 사진 형식이에요. JPG, PNG 사진을 선택해 주세요.', 'upload', 415);
  }
  return new ImageUploadError('사진 서버에 업로드하지 못했어요. 잠시 후 다시 시도해 주세요.', 'upload', response.status);
}

export async function uploadSpaceMemoryImage(
  spaceId: string,
  memoryId: string,
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
  if (!currentUser) {
    throw new ImageUploadError('사진을 올리려면 다시 로그인해 주세요.', 'auth');
  }

  let prepared;
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
  const idToken = await currentUser.getIdToken();
  let response: Response;
  try {
    response = await fetch(
      `${apiBase}/v1/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}/images`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': prepared.contentType,
        },
        body: bytes,
      },
    );
  } catch {
    throw new ImageUploadError('사진 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.', 'upload');
  }

  const payload = (await response.json().catch(() => null)) as { imageKey?: string; error?: string } | null;
  const imageKey = parseSpaceMemoryImageKey(payload?.imageKey, { spaceId, memoryId });
  if (!response.ok || !imageKey) {
    throw parseImageError(response, payload);
  }
  return imageKey;
}

export async function deleteSpaceMemoryImageObject(
  spaceId: string,
  memoryId: string,
  imageKey: string,
): Promise<boolean> {
  const parsed = parseSpaceMemoryImageKey(imageKey, { spaceId, memoryId });
  if (!parsed) return false;
  const apiBase = getR2ImageApiBaseUrl();
  if (!apiBase) return false;
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(
      `${apiBase}/v1/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}/images`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageKey: parsed }),
      },
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export async function uploadSpaceMemoryPhotos(
  spaceId: string,
  memoryId: string,
  localUris: string[],
): Promise<{ keys: string[]; failedCount: number }> {
  const keys: string[] = [];
  let failedCount = 0;
  for (const uri of localUris.slice(0, 5)) {
    try {
      const key = await uploadSpaceMemoryImage(spaceId, memoryId, uri);
      if (!keys.includes(key)) keys.push(key);
    } catch {
      failedCount += 1;
    }
  }
  return { keys, failedCount };
}

export async function uploadSpaceMemoryPhotoMap(
  spaceId: string,
  memoryId: string,
  locals: { id: string; uri: string }[],
): Promise<{ keysById: Map<string, string>; failedCount: number }> {
  const keysById = new Map<string, string>();
  let failedCount = 0;
  for (const photo of locals) {
    try {
      const key = await uploadSpaceMemoryImage(spaceId, memoryId, photo.uri);
      keysById.set(photo.id, key);
    } catch {
      failedCount += 1;
    }
  }
  return { keysById, failedCount };
}

export async function rollbackSpaceMemoryImages(
  spaceId: string,
  memoryId: string,
  imageKeys: string[],
): Promise<void> {
  for (const key of imageKeys) {
    await deleteSpaceMemoryImageObject(spaceId, memoryId, key);
  }
}
