import React, { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { ensureMaterialIcons } from '@/lib/ensureMaterialIcons';

export function useIconFontsReady(): boolean {
  const [ready, setReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let mounted = true;

    (async () => {
      try {
        await ensureMaterialIcons();
      } catch (err) {
        console.warn('[fonts] MaterialIcons preload failed', err);
      }
      if (mounted) setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}

export function IconFontGate({ children }: { children: ReactNode }) {
  const ready = useIconFontsReady();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2e4475" />
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
