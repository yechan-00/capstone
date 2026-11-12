import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  SpaceInviteError,
  isInviteCode,
  parseJoinSpaceResult,
  parseRevokeResult,
  parseSpaceInvitePreview,
  parseSpaceInviteResult,
  toSpaceInviteError,
  toSpaceJoinError,
  type SpaceInvitePreview,
  type SpaceInviteRecord,
} from '@/lib/spaceInviteClient';

type SpaceIdPayload = {
  spaceId: string;
};

function usableSpaceId(spaceId: string): string {
  const trimmed = spaceId.trim();
  if (!trimmed || trimmed.includes('/')) {
    throw new SpaceInviteError('invalid-argument');
  }
  return trimmed;
}

async function callInvite<T>(
  name: 'getSpaceInvite' | 'createSpaceInvite' | 'rotateSpaceInvite' | 'revokeSpaceInvite',
  spaceId: string,
): Promise<T> {
  const call = httpsCallable<SpaceIdPayload, unknown>(functions, name);
  const result = await call({ spaceId: usableSpaceId(spaceId) });
  return result.data as T;
}

export async function getSpaceInvite(spaceId: string): Promise<SpaceInviteRecord | null> {
  try {
    const data = await callInvite('getSpaceInvite', spaceId);
    const parsed = parseSpaceInviteResult(data);
    if (!parsed) {
      throw new SpaceInviteError('internal');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceInviteError(error);
    if (mapped.code === 'not-found') return null;
    if (__DEV__) console.error('[getSpaceInvite]', mapped.code);
    throw mapped;
  }
}

export async function createSpaceInvite(spaceId: string): Promise<SpaceInviteRecord> {
  try {
    const data = await callInvite('createSpaceInvite', spaceId);
    const parsed = parseSpaceInviteResult(data);
    if (!parsed) {
      throw new SpaceInviteError('internal');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceInviteError(error);
    if (__DEV__) console.error('[createSpaceInvite]', mapped.code);
    throw mapped;
  }
}

export async function rotateSpaceInvite(spaceId: string): Promise<SpaceInviteRecord> {
  try {
    const data = await callInvite('rotateSpaceInvite', spaceId);
    const parsed = parseSpaceInviteResult(data);
    if (!parsed) {
      throw new SpaceInviteError('internal');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceInviteError(error);
    if (__DEV__) console.error('[rotateSpaceInvite]', mapped.code);
    throw mapped;
  }
}

export async function revokeSpaceInvite(spaceId: string): Promise<void> {
  try {
    const data = await callInvite('revokeSpaceInvite', spaceId);
    if (!parseRevokeResult(data)) {
      throw new SpaceInviteError('internal');
    }
  } catch (error) {
    const mapped = toSpaceInviteError(error);
    if (__DEV__) console.error('[revokeSpaceInvite]', mapped.code);
    throw mapped;
  }
}

type InviteCodePayload = {
  code: string;
};

async function callInviteCode<T>(
  name: 'previewSpaceInvite' | 'joinSpaceByInvite',
  code: string,
): Promise<T> {
  if (!isInviteCode(code)) {
    throw new SpaceInviteError('invalid-argument', '초대 코드 형식을 다시 확인해 주세요.');
  }
  const call = httpsCallable<InviteCodePayload, unknown>(functions, name);
  const result = await call({ code });
  return result.data as T;
}

export async function previewSpaceInvite(code: string): Promise<SpaceInvitePreview> {
  try {
    const data = await callInviteCode('previewSpaceInvite', code);
    const parsed = parseSpaceInvitePreview(data);
    if (!parsed) {
      throw new SpaceInviteError('internal', '초대 코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceJoinError(error, 'preview');
    if (__DEV__) console.error('[previewSpaceInvite]', mapped.code);
    throw mapped;
  }
}

export async function joinSpaceByInvite(code: string): Promise<string> {
  try {
    const data = await callInviteCode('joinSpaceByInvite', code);
    const spaceId = parseJoinSpaceResult(data);
    if (!spaceId) {
      throw new SpaceInviteError('internal', '공간에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    return spaceId;
  } catch (error) {
    const mapped = toSpaceJoinError(error, 'join');
    if (__DEV__) console.error('[joinSpaceByInvite]', mapped.code);
    throw mapped;
  }
}
