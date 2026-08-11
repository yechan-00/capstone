import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

/** Chrome 자동 번역이 한국어 문구를 깨뜨리는 것 방지 */
export const WEB_NO_TRANSLATE =
  Platform.OS === 'web'
    ? ({ className: 'notranslate', translate: 'no', lang: 'ko' } as object)
    : {};

export const WEB_PRE_LINE =
  Platform.OS === 'web' ? ({ whiteSpace: 'pre-line' } as object) : {};

/** 한글 단어 중간 줄바꿈 방지 (바/꿉니다 같은 깨짐) */
export const WEB_KO_LINE =
  Platform.OS === 'web'
    ? ({
        wordBreak: 'keep-all',
        overflowWrap: 'normal',
        lineBreak: 'strict',
      } as object)
    : {};

/** 타이틀 한 줄 — 컨테이너 안에서 단어 중간 줄바꿈 금지 */
export const WEB_KO_TITLE_LINE =
  Platform.OS === 'web'
    ? ({
        ...WEB_KO_LINE,
        display: 'block',
        width: 'max-content',
        maxWidth: '100%',
      } as object)
    : {};

export const WEB_MIN_HEIGHT_FULL = IS_WEB ? ({ minHeight: '100%' } as object) : {};

/** iOS 잠금화면 시계 — SF Pro 계열 */
export const WEB_LOCK_TIME_FONT = IS_WEB
  ? ({
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    } as object)
  : {};

export const WEB_GLASS_BLUR_12 = IS_WEB
  ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
  : {};

export const WEB_GLASS_BLUR_20 = IS_WEB
  ? ({
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    } as object)
  : {};

export const WEB_GLASS_BLUR_10 = IS_WEB
  ? ({ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as object)
  : {};

export const WEB_LOCK_TIME_TABULAR = IS_WEB
  ? ({
      fontVariantNumeric: 'tabular-nums',
      fontFeatureSettings: '"tnum"',
    } as object)
  : ({ fontVariant: ['tabular-nums'] } as object);

export const WEB_LOCK_NOTIF_SHADOW = IS_WEB
  ? ({ boxShadow: '0 6px 24px rgba(0,0,0,0.16)' } as object)
  : {};

export const WEB_BELL_CIRCLE_SHADOW = IS_WEB
  ? ({ boxShadow: '0 4px 16px rgba(52,195,111,0.15)' } as object)
  : ({
      shadowColor: '#34C36F',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    } as object);

export const WEB_PHONE_BACKDROP_BG = IS_WEB
  ? ({
      backgroundImage:
        'repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 18px, rgba(52,195,111,0.03) 18px, rgba(52,195,111,0.03) 19px)',
    } as object)
  : {};
