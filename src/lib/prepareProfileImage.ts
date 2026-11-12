import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { ImageOptimizeError } from '@/lib/prepareExpenseImage';

const PROFILE_SIZE = 512;
const JPEG_QUALITY = 0.85;

export type PreparedProfileImage = {
  uri: string;
  contentType: 'image/jpeg';
};

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

function squareCrop(size: { width: number; height: number } | null): ImageManipulator.Action[] {
  const actions: ImageManipulator.Action[] = [];
  if (size && size.width !== size.height) {
    const side = Math.min(size.width, size.height);
    actions.push({
      crop: {
        originX: Math.floor((size.width - side) / 2),
        originY: Math.floor((size.height - side) / 2),
        width: side,
        height: side,
      },
    });
  }
  actions.push({ resize: { width: PROFILE_SIZE, height: PROFILE_SIZE } });
  return actions;
}

export async function prepareProfileImageForUpload(localUri: string): Promise<PreparedProfileImage> {
  if (!localUri || /^https?:\/\//i.test(localUri)) {
    throw new ImageOptimizeError();
  }
  const size = await readDimensions(localUri);
  try {
    const result = await ImageManipulator.manipulateAsync(localUri, squareCrop(size), {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    if (!result.uri) throw new ImageOptimizeError();
    return { uri: result.uri, contentType: 'image/jpeg' };
  } catch (error) {
    if (error instanceof ImageOptimizeError) throw error;
    throw new ImageOptimizeError();
  }
}
