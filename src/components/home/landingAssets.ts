import type { ImageSourcePropType } from 'react-native';

export const LANDING_ASPECT = 1024 / 576;

/** BPL 목업 섹션 이미지 (1024×576) */
export const LANDING_IMAGES = {
  section2: require('../../../assets/landing/bpl-section2.png'),
  section3: require('../../../assets/landing/bpl-section3.png'),
  section4: require('../../../assets/landing/bpl-section4.png'),
  section5: require('../../../assets/landing/bpl-section5.png'),
  section6: require('../../../assets/landing/bpl-section6.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type LandingSectionKey = keyof typeof LANDING_IMAGES;
