import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedExpenseImage } from '@/components/CachedExpenseImage';

type Props = {
  visible: boolean;
  uri: string | null;
  accessibilityLabel?: string;
  onClose: () => void;
};

export function PhotoViewerModal({ visible, uri, accessibilityLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!visible || !uri) return undefined;
    setStatus('loading');
    const timer = setTimeout(() => {
      setStatus((s) => (s === 'error' ? s : 'ready'));
    }, 15_000);
    return () => clearTimeout(timer);
  }, [visible, uri]);

  const open = visible && !!uri;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="사진 닫기"
        />

        {uri ? (
          <CachedExpenseImage
            uri={uri}
            style={styles.image}
            accessibilityLabel={accessibilityLabel ?? '소비 사진'}
            onLoad={() => setStatus('ready')}
            onLoadEnd={() => setStatus((s) => (s === 'error' ? s : 'ready'))}
            onError={() => setStatus('error')}
          />
        ) : null}

        {status === 'loading' ? (
          <View style={styles.overlay} pointerEvents="none">
            <MaterialIcons name="image" size={28} color="#E8EEEA" />
          </View>
        ) : null}

        {status === 'error' ? (
          <View style={styles.overlay} pointerEvents="none">
            <MaterialIcons name="broken-image" size={28} color="#9AA39E" />
            <Text style={styles.errorText}>사진을 불러오지 못했어요</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onClose}
          style={[
            styles.closeHit,
            { top: Math.max(insets.top, 12) + 4, right: Math.max(insets.right, 16) },
          ]}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <MaterialIcons name="close" size={22} color="#F4F6F5" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0D0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C5CBC8',
  },
  closeHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
