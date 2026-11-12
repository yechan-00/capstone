import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  LEAVE_SPACE_FN,
  REMOVE_SPACE_MEMBER_FN,
  SpaceMembershipError,
  parseLeaveSpaceResult,
  parseRemoveSpaceMemberResult,
  toSpaceMembershipError,
} from '@/lib/spaceMembershipClient';

type LeavePayload = {
  spaceId: string;
};

type RemovePayload = {
  spaceId: string;
  uid: string;
};

function usableId(value: string, code: 'invalid-argument', action: 'leave' | 'remove'): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('/')) {
    throw toSpaceMembershipError({ code, message: action === 'leave' ? '공간을 확인할 수 없어요.' : '멤버를 확인할 수 없어요.' }, action);
  }
  return trimmed;
}

export async function leaveSpace(spaceId: string): Promise<string> {
  try {
    const call = httpsCallable<LeavePayload, unknown>(functions, LEAVE_SPACE_FN);
    const result = await call({ spaceId: usableId(spaceId, 'invalid-argument', 'leave') });
    const parsed = parseLeaveSpaceResult(result.data);
    if (!parsed) {
      throw new SpaceMembershipError('internal', '공간을 나가지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceMembershipError(error, 'leave');
    if (__DEV__) console.error('[leaveSpace]', mapped.code);
    throw mapped;
  }
}

export async function removeSpaceMember(spaceId: string, uid: string): Promise<{ spaceId: string; uid: string }> {
  try {
    const call = httpsCallable<RemovePayload, unknown>(functions, REMOVE_SPACE_MEMBER_FN);
    const result = await call({
      spaceId: usableId(spaceId, 'invalid-argument', 'remove'),
      uid: usableId(uid, 'invalid-argument', 'remove'),
    });
    const parsed = parseRemoveSpaceMemberResult(result.data);
    if (!parsed) {
      throw new SpaceMembershipError('internal', '멤버를 내보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    return parsed;
  } catch (error) {
    const mapped = toSpaceMembershipError(error, 'remove');
    if (__DEV__) console.error('[removeSpaceMember]', mapped.code);
    throw mapped;
  }
}
