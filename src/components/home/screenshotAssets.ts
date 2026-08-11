import type { ImageSourcePropType } from 'react-native';

export type ScreenshotKey = 'home' | 'insights' | 'review';

export const APP_SCREENSHOTS: Partial<Record<ScreenshotKey, ImageSourcePropType>> = {};

export function getScreenshot(key: ScreenshotKey): ImageSourcePropType | undefined {
  return APP_SCREENSHOTS[key];
}

export const HAS_REAL_SCREENSHOTS = Object.keys(APP_SCREENSHOTS).length > 0;
