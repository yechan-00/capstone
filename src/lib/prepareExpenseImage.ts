import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;
/** 이미 JPEG이고 긴 변·용량이 기준 이하면 재압축하지 않습니다. */
const SKIP_MAX_BYTES = 700_000;

export type PreparedExpenseImage = {
  uri: string;
  contentType: 'image/jpeg';
};

export class ImageOptimizeError extends Error {
  constructor(message = '사진을 최적화하지 못했어요. 다른 사진을 선택해 주세요.') {
    super(message);
    this.name = 'ImageOptimizeError';
  }
}

function formatLogValue(value: number | null): string {
  return value == null ? 'unknown' : String(value);
}

function isJpegUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('image/jpeg');
}

function readDimensions(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) resolve({ width, height });
        else resolve(null);
      },
      () => resolve(null),
    );
  });
}

async function readFileBytes(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) return null;
    const size = info.size;
    return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    return null;
  }
}

function resizeActions(size: { width: number; height: number } | null): ImageManipulator.Action[] {
  if (!size) return [];
  const longEdge = Math.max(size.width, size.height);
  if (longEdge <= MAX_LONG_EDGE) return [];
  if (size.width === size.height) {
    return [{ resize: { width: MAX_LONG_EDGE } }];
  }
  if (size.width > size.height) {
    return [{ resize: { width: MAX_LONG_EDGE } }];
  }
  return [{ resize: { height: MAX_LONG_EDGE } }];
}

function logOptimize(values: {
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number | null;
  optimizedWidth: number | null;
  optimizedHeight: number | null;
  optimizedBytes: number | null;
  processingMs: number;
}): void {
  if (!__DEV__) return;
  const ratio =
    values.originalBytes != null && values.optimizedBytes != null && values.originalBytes > 0
      ? (values.optimizedBytes / values.originalBytes).toFixed(2)
      : 'unknown';
  console.log(
    `[image-optimize] originalWidth=${formatLogValue(values.originalWidth)} originalHeight=${formatLogValue(values.originalHeight)} originalBytes=${formatLogValue(values.originalBytes)} optimizedWidth=${formatLogValue(values.optimizedWidth)} optimizedHeight=${formatLogValue(values.optimizedHeight)} optimizedBytes=${formatLogValue(values.optimizedBytes)} compressionRatio=${ratio} processingMs=${values.processingMs}`,
  );
}

/**
 * 업로드 직전에 한 번만 호출합니다. R2 URL·토큰·객체 키는 바꾸지 않습니다.
 * expo-image-manipulator가 디코드 시 EXIF 방향을 반영하고, JPEG로 저장해 방향을 고정합니다.
 */
export async function prepareExpenseImageForUpload(localUri: string): Promise<PreparedExpenseImage> {
  const started = Date.now();
  const [originalSize, originalBytes] = await Promise.all([readDimensions(localUri), readFileBytes(localUri)]);
  const longEdge = originalSize ? Math.max(originalSize.width, originalSize.height) : null;

  if (
    isJpegUri(localUri) &&
    longEdge != null &&
    longEdge <= MAX_LONG_EDGE &&
    originalBytes != null &&
    originalBytes <= SKIP_MAX_BYTES
  ) {
    logOptimize({
      originalWidth: originalSize?.width ?? null,
      originalHeight: originalSize?.height ?? null,
      originalBytes,
      optimizedWidth: originalSize?.width ?? null,
      optimizedHeight: originalSize?.height ?? null,
      optimizedBytes: originalBytes,
      processingMs: Date.now() - started,
    });
    return { uri: localUri, contentType: 'image/jpeg' };
  }

  try {
    const result = await ImageManipulator.manipulateAsync(localUri, resizeActions(originalSize), {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    if (!result.uri) {
      throw new ImageOptimizeError();
    }

    const optimizedBytes = await readFileBytes(result.uri);
    logOptimize({
      originalWidth: originalSize?.width ?? null,
      originalHeight: originalSize?.height ?? null,
      originalBytes,
      optimizedWidth: result.width > 0 ? result.width : null,
      optimizedHeight: result.height > 0 ? result.height : null,
      optimizedBytes,
      processingMs: Date.now() - started,
    });

    return { uri: result.uri, contentType: 'image/jpeg' };
  } catch (error) {
    if (error instanceof ImageOptimizeError) throw error;
    throw new ImageOptimizeError();
  }
}
