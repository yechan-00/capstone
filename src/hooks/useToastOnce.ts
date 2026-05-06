import { useRef } from 'react';

export function useToastOnce() {
  const lastKeyRef = useRef<string | null>(null);
  const lastAtRef = useRef<number>(0);

  return (key: string, show: () => void, cooldownMs = 2500) => {
    const now = Date.now();
    const sameKey = lastKeyRef.current === key;
    const tooSoon = now - lastAtRef.current < cooldownMs;

    if (sameKey && tooSoon) return;

    lastKeyRef.current = key;
    lastAtRef.current = now;
    show();
  };
}
