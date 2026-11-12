import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import {
  SpaceInviteError,
  formatInviteCountdown,
  isInviteExpired,
  isSpaceOwner,
  toSpaceInviteError,
  type SpaceInviteRecord,
} from '@/lib/spaceInviteClient';
import {
  createSpaceInvite,
  getSpaceInvite,
  revokeSpaceInvite,
  rotateSpaceInvite,
} from '@/services/spaceInviteService';

export type SpaceInviteStatus = 'loading' | 'ready' | 'error';
export type InviteAction = 'idle' | 'create' | 'rotate' | 'revoke';

export type UseSpaceInviteResult = {
  space: ReturnType<typeof useSpaceDetail>['space'];
  myRole: string | undefined;
  isOwner: boolean;
  invite: SpaceInviteRecord | null;
  expired: boolean;
  countdown: string;
  status: SpaceInviteStatus;
  action: InviteAction;
  busy: boolean;
  errorKind: ReturnType<typeof useSpaceDetail>['errorKind'];
  errorMessage: string | null;
  retry: () => void;
  create: () => Promise<boolean>;
  rotate: () => Promise<boolean>;
  revoke: () => Promise<boolean>;
};

export function useSpaceInvite(spaceId: string | undefined): UseSpaceInviteResult {
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const {
    space,
    myRole,
    status: detailStatus,
    errorKind,
    errorMessage: detailError,
    retry: retryDetail,
  } = useSpaceDetail(spaceId);
  const owner = isSpaceOwner(myRole, space?.ownerUid, uid);
  const [invite, setInvite] = useState<SpaceInviteRecord | null>(null);
  const [inviteStatus, setInviteStatus] = useState<SpaceInviteStatus>('loading');
  const [action, setAction] = useState<InviteAction>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const busyRef = useRef(false);

  const retry = useCallback(() => {
    retryDetail();
    setReloadToken((token) => token + 1);
  }, [retryDetail]);

  useEffect(() => {
    if (detailStatus === 'loading') {
      setInviteStatus('loading');
      setInvite(null);
      setActionError(null);
      return;
    }
    if (detailStatus === 'error' || !space?.id) {
      setInviteStatus('error');
      setInvite(null);
      return;
    }
    if (!owner) {
      setInviteStatus('error');
      setInvite(null);
      return;
    }
    if (!spaceId) {
      setInviteStatus('error');
      setInvite(null);
      return;
    }

    let cancelled = false;
    setInviteStatus('loading');
    setActionError(null);

    getSpaceInvite(spaceId)
      .then((record) => {
        if (cancelled) return;
        setInvite(record);
        setInviteStatus('ready');
        setNow(Date.now());
      })
      .catch((error) => {
        if (cancelled) return;
        const mapped = toSpaceInviteError(error);
        setInvite(null);
        setInviteStatus('error');
        setActionError(mapped.userMessage);
      });

    return () => {
      cancelled = true;
    };
  }, [detailStatus, owner, reloadToken, space?.id, space?.ownerUid, space?.status, spaceId]);

  useEffect(() => {
    if (!invite) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [invite]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') setNow(Date.now());
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const run = useCallback(
    async (next: InviteAction, work: () => Promise<void>): Promise<boolean> => {
      if (busyRef.current || !spaceId || !owner) return false;
      busyRef.current = true;
      setAction(next);
      setActionError(null);
      const previous = invite;
      try {
        await work();
        busyRef.current = false;
        setAction('idle');
        return true;
      } catch (error) {
        const mapped = toSpaceInviteError(error);
        setInvite(previous);
        setActionError(mapped.userMessage);
        busyRef.current = false;
        setAction('idle');
        return false;
      }
    },
    [invite, owner, spaceId],
  );

  const create = useCallback(async () => {
    if (!spaceId) return false;
    return run('create', async () => {
      const record = await createSpaceInvite(spaceId);
      setInvite(record);
      setNow(Date.now());
    });
  }, [run, spaceId]);

  const rotate = useCallback(async () => {
    if (!spaceId) return false;
    return run('rotate', async () => {
      const record = await rotateSpaceInvite(spaceId);
      setInvite(record);
      setNow(Date.now());
    });
  }, [run, spaceId]);

  const revoke = useCallback(async () => {
    if (!spaceId) return false;
    return run('revoke', async () => {
      await revokeSpaceInvite(spaceId);
      setInvite(null);
    });
  }, [run, spaceId]);

  const expired = invite ? isInviteExpired(invite.expiresAt, now) : false;
  const countdown = invite ? formatInviteCountdown(invite.expiresAt, now) : '00:00:00';
  const busy = action !== 'idle';
  const status: SpaceInviteStatus =
    detailStatus === 'loading' || (owner && inviteStatus === 'loading')
      ? 'loading'
      : detailStatus === 'error' || !owner || inviteStatus === 'error'
        ? 'error'
        : 'ready';

  let errorMessage: string | null = null;
  if (detailStatus === 'error') {
    errorMessage = detailError;
  } else if (!owner && detailStatus === 'ready') {
    errorMessage = new SpaceInviteError('permission-denied').userMessage;
  } else if (inviteStatus === 'error') {
    errorMessage = actionError ?? new SpaceInviteError('internal').userMessage;
  } else {
    errorMessage = actionError;
  }

  return {
    space,
    myRole,
    isOwner: owner,
    invite,
    expired,
    countdown,
    status,
    action,
    busy,
    errorKind,
    errorMessage,
    retry,
    create,
    rotate,
    revoke,
  };
}
