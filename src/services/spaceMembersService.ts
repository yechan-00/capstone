import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  LIST_SPACE_MEMBERS_FN,
  SpaceMembersError,
  parseSpaceMembersResult,
  toSpaceMembersError,
  type SpaceMember,
} from '@/lib/spaceMembersClient';

type SpaceIdPayload = {
  spaceId: string;
};

function usableSpaceId(spaceId: string): string {
  const trimmed = spaceId.trim();
  if (!trimmed || trimmed.includes('/')) {
    throw new SpaceMembersError('invalid-argument');
  }
  return trimmed;
}

export async function listSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  try {
    const call = httpsCallable<SpaceIdPayload, unknown>(functions, LIST_SPACE_MEMBERS_FN);
    const result = await call({ spaceId: usableSpaceId(spaceId) });
    const parsed = parseSpaceMembersResult(result.data);
    if (!parsed) {
      throw new SpaceMembersError('internal');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceMembersError(error);
    if (__DEV__) console.error('[listSpaceMembers]', mapped.code);
    throw mapped;
  }
}
