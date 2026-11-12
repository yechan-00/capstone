import type { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';

export const SPACE_NAME_MAX = 40;
export const SPACE_PREVIEW_FALLBACK_NAME = '내 새로운 공간';

export const SPACE_TYPE_IDS = ['couple', 'friends', 'family', 'travel'] as const;
export type SpaceTypeId = (typeof SPACE_TYPE_IDS)[number];

type IconName = ComponentProps<typeof MaterialIcons>['name'];

export type SpaceTypeOption = {
  id: SpaceTypeId;
  label: string;
  description: string;
  icon: IconName;
  accent: string;
};

export const SPACE_TYPE_OPTIONS: readonly SpaceTypeOption[] = [
  {
    id: 'couple',
    label: '연인',
    description: '둘만의 소중한 순간',
    icon: 'favorite-border',
    accent: '#C47A86',
  },
  {
    id: 'friends',
    label: '친구',
    description: '함께하는 즐거운 일상',
    icon: 'people-outline',
    accent: '#6E8CB4',
  },
  {
    id: 'family',
    label: '가족',
    description: '우리 가족의 이야기',
    icon: 'home',
    accent: '#C4A06A',
  },
  {
    id: 'travel',
    label: '여행',
    description: '여행에서 만난 순간',
    icon: 'flight',
    accent: '#5E9A94',
  },
];

export const SPACE_TYPE_BY_ID: Record<SpaceTypeId, SpaceTypeOption> = Object.fromEntries(
  SPACE_TYPE_OPTIONS.map((option) => [option.id, option]),
) as Record<SpaceTypeId, SpaceTypeOption>;

export function isSpaceTypeId(value: unknown): value is SpaceTypeId {
  return typeof value === 'string' && (SPACE_TYPE_IDS as readonly string[]).includes(value);
}

export function parseClientSpaceName(raw: string): string {
  return raw.trim();
}

export function isValidSpaceName(raw: string): boolean {
  const name = parseClientSpaceName(raw);
  return name.length > 0 && name.length <= SPACE_NAME_MAX;
}

export type SpaceListItem = {
  id: string;
  name: string;
  type?: SpaceTypeId;
  /** space_members.role. 문서에 있는 값만 사용 */
  role?: string;
  createdAt?: Date;
  /** 신뢰할 수 있는 값이 있을 때만 표시 */
  memberCount?: number;
};

export const SPACE_TYPE_HOME_COPY: Record<SpaceTypeId, string> = {
  couple: '함께하는 우리의 기록',
  friends: '친구들과 남기는 소중한 순간',
  family: '가족과 함께 쌓아가는 기록',
  travel: '여행의 순간을 하나의 공간에',
};

export function spaceRoleLabel(role: unknown): string | null {
  if (role === 'owner') return '소유자';
  if (role === 'member') return '멤버';
  return null;
}

export function spaceTypeSoftFill(accent: string, isDark: boolean): string {
  return isDark ? `${accent}33` : `${accent}1F`;
}

type Rgb = { r: number; g: number; b: number };

function parseHexColor(hex: string): Rgb | null {
  const raw = hex.trim().replace('#', '');
  if (raw.length !== 6) return null;
  const n = Number.parseInt(raw, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** 카드 틴트보다 조금 진한 파스텔. 브랜드 그린 대신 유형 accent에서 유도한다. */
export function spaceTypeButtonFill(accent: string, isDark: boolean, pressed = false): string {
  const rgb = parseHexColor(accent);
  if (!rgb) return spaceTypeSoftFill(accent, isDark);
  if (isDark) {
    return toHex(mixRgb(BLACK, rgb, pressed ? 0.52 : 0.4));
  }
  return toHex(mixRgb(WHITE, rgb, pressed ? 0.42 : 0.32));
}

/** 파스텔 버튼 위의 같은 계열 진한 글자·아이콘 */
export function spaceTypeButtonInk(accent: string, isDark: boolean): string {
  const rgb = parseHexColor(accent);
  if (!rgb) return accent;
  if (isDark) return toHex(mixRgb(rgb, WHITE, 0.42));
  return toHex(mixRgb(rgb, BLACK, 0.4));
}
