import * as Font from 'expo-font';

/** public/ · dist/ 루트에 복사된 MaterialIcons (Firebase node_modules 경로 배포 불가 대응) */
const MATERIAL_ICONS_URI = '/MaterialIcons.ttf';

/** 웹 전용 — MaterialIcons @font-face 주입 */
export async function ensureMaterialIcons(): Promise<void> {
  if (Font.isLoaded('material')) return;

  const ExpoFontLoader = require('expo-font/build/ExpoFontLoader').default;
  await ExpoFontLoader.loadAsync('material', { uri: MATERIAL_ICONS_URI, display: 'swap' });
}
