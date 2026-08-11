import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, useWindowDimensions, type View, type ViewStyle } from 'react-native';

type Options = {
  delay?: number;
  offsetY?: number;
  disabled?: boolean;
};

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** 웹: Intersection Observer / 네이티브: 마운트 fade-up */
export function useScrollReveal({ delay = 0, offsetY = 60, disabled = false }: Options = {}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const reduceMotion = disabled || (isMobile && Platform.OS !== 'web');

  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : offsetY)).current;
  const revealed = useRef(reduceMotion);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const reveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    observerRef.current?.disconnect();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, easing: EASE, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 700, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    if (reduceMotion) return;

    if (Platform.OS !== 'web') {
      const timer = setTimeout(reveal, delay);
      return () => clearTimeout(timer);
    }

    const fallback = setTimeout(reveal, delay + 1400);
    return () => {
      clearTimeout(fallback);
      observerRef.current?.disconnect();
    };
  }, [delay, reveal, reduceMotion]);

  const viewRef = useCallback(
    (node: View | null) => {
      if (reduceMotion || Platform.OS !== 'web' || !node || revealed.current) return;
      if (typeof IntersectionObserver === 'undefined') {
        setTimeout(reveal, delay);
        return;
      }

      observerRef.current?.disconnect();
      const el = node as unknown as HTMLElement;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setTimeout(reveal, delay);
          }
        },
        { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
      );
      observerRef.current.observe(el);
    },
    [delay, reveal, reduceMotion],
  );

  const animatedStyle: Animated.WithAnimatedObject<ViewStyle> = reduceMotion
    ? {}
    : { opacity, transform: [{ translateY }] };

  return { viewRef, animatedStyle, reduceMotion };
}
