import { useEffect } from 'react';

export function useDebouncedEffect(effect: () => void, deps: any[], delayMs: number) {
  useEffect(() => {
    const id = setTimeout(() => effect(), delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);
}
