import { Platform } from 'react-native';
import { HOME } from '@/components/home/homeTheme';

export const SECTION_PY = 88;
export const SECTION_PY_COMPACT = 72;

export const homeButtons = {
  primary: {
    flexDirection: 'row' as const,
    gap: 8,
    backgroundColor: HOME.green,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: HOME.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({ transition: 'transform 0.2s ease, box-shadow 0.2s ease' } as object)
      : {}),
  },
  primaryText: {
    color: HOME.white,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  secondary: {
    flexDirection: 'row' as const,
    gap: 8,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: HOME.white,
    borderWidth: 1.5,
    borderColor: HOME.green,
  },
  secondaryText: {
    color: HOME.green,
    fontSize: 15,
    fontWeight: '700' as const,
  },
};
