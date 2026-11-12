import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toSpaceListErrorMessage } from '@/lib/spaceList';
import type { SpaceListItem } from '@/lib/spaceTypes';
import {
  loadSpacesForMemberships,
  subscribeMySpaceMemberships,
} from '@/services/spaceService';

export type SpaceListStatus = 'loading' | 'empty' | 'error' | 'ready';

export type UseMySpacesResult = {
  status: SpaceListStatus;
  spaces: SpaceListItem[];
  errorMessage: string | null;
  retry: () => void;
};

export function useMySpaces(): UseMySpacesResult {
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceListStatus>('loading');
  const [spaces, setSpaces] = useState<SpaceListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setSpaces([]);
      setErrorMessage(null);
      return;
    }

    if (!uid) {
      setStatus('empty');
      setSpaces([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    let fetchGen = 0;
    setStatus('loading');
    setSpaces([]);
    setErrorMessage(null);

    const unsubscribe = subscribeMySpaceMemberships(
      uid,
      (rows) => {
        const gen = ++fetchGen;
        void (async () => {
          try {
            const result = await loadSpacesForMemberships(rows);
            if (cancelled || gen !== fetchGen) return;
            if (result.status === 'error') {
              if (__DEV__) console.error('[useMySpaces]', result.error);
              setSpaces([]);
              setErrorMessage(toSpaceListErrorMessage(result.error));
              setStatus('error');
              return;
            }
            setErrorMessage(null);
            setSpaces(result.spaces);
            setStatus(result.spaces.length === 0 ? 'empty' : 'ready');
          } catch (error) {
            if (cancelled || gen !== fetchGen) return;
            if (__DEV__) console.error('[useMySpaces]', error);
            setSpaces([]);
            setErrorMessage(toSpaceListErrorMessage(error));
            setStatus('error');
          }
        })();
      },
      (error) => {
        if (cancelled) return;
        fetchGen += 1;
        if (__DEV__) console.error('[useMySpaces] memberships', error);
        setSpaces([]);
        setErrorMessage(toSpaceListErrorMessage(error));
        setStatus('error');
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authLoading, retryToken, uid]);

  return { status, spaces, errorMessage, retry };
}
