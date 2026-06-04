/**
 * ColorPickerModal.tsx
 * HSV 기반 풀스크린 컬러피커 모달
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: SW } = Dimensions.get('window');
const PICKER_W = SW - 48;
const PICKER_H = 220;
const HUE_H = 24;
const PREVIEW_SIZE = 44;
const HUE_GAP = 12;
const HUE_W = PICKER_W - PREVIEW_SIZE - HUE_GAP;

function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

interface Props {
  visible: boolean;
  initialColor: string;
  onClose: () => void;
  onSelect: (hex: string) => void;
  isDark: boolean;
}

export function ColorPickerModal({ visible, initialColor, onClose, onSelect, isDark }: Props) {
  const { animationsEnabled } = useTheme();
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(initialColor));
  const [h, s, v] = hsv;
  const [render, setRender] = useState(visible);
  const sheetOpen = useSharedValue(visible ? 1 : 0);
  const backdropOpacity = useSharedValue(visible ? 1 : 0);

  // Grant 시점 스냅샷 — 일반 object ref라 항상 최신값
  const svSnap = useRef({ s: 0, v: 0 });
  const hSnap = useRef(0);

  useEffect(() => {
    if (visible) {
      setRender(true);
      const init = hexToHsv(initialColor);
      setHsv(init);
      if (!animationsEnabled) { sheetOpen.value = 1; backdropOpacity.value = 1; return; }
      sheetOpen.value = 0; backdropOpacity.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 220 });
      sheetOpen.value = withSpring(1, { damping: 18, stiffness: 200, mass: 0.75 });
    } else {
      if (!animationsEnabled) { setRender(false); return; }
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetOpen.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) },
        (finished) => { if (finished) runOnJS(setRender)(false); });
    }
  }, [visible, initialColor, animationsEnabled, sheetOpen, backdropOpacity]);

  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetAnim = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * sheetOpen.value,
    transform: [{ translateY: (1 - sheetOpen.value) * 36 }],
  }));

  // setHsv를 ref로 감싸서 PanResponder 클로저가 항상 최신 setter를 봄
  const setHsvRef = useRef(setHsv);
  setHsvRef.current = setHsv;

  // SV PanResponder — useMemo로 hsv 변경 시마다 재생성
  const svPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gs) => {
      // Grant 시점의 현재 s/v 스냅샷
      setHsvRef.current((cur) => {
        svSnap.current = { s: cur[1], v: cur[2] };
        return cur;
      });
    },
    onPanResponderMove: (_, gs) => {
      const newS = Math.min(1, Math.max(0, svSnap.current.s + gs.dx / PICKER_W));
      const newV = Math.min(1, Math.max(0, svSnap.current.v - gs.dy / PICKER_H));
      setHsvRef.current(([hh]) => [hh, newS, newV]);
    },
  }), []);

  // Hue PanResponder
  const huePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setHsvRef.current((cur) => {
        hSnap.current = cur[0];
        return cur;
      });
    },
    onPanResponderMove: (_, gs) => {
      const newH = Math.min(360, Math.max(0, hSnap.current + (gs.dx / HUE_W) * 360));
      setHsvRef.current(([, ss, vv]) => [newH, ss, vv]);
    },
  }), []);

  const currentHex = hsvToHex(h, s, v);
  const pureHue = hsvToHex(h, 1, 1);
  const bg = isDark ? '#1A2332' : '#ffffff';
  const textColor = isDark ? '#E2E8F0' : '#1c2434';
  const borderColor = isDark ? '#2A3548' : '#e4e8f0';

  if (!render) return null;

  return (
    <Modal visible={render} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <AnimatedPressable style={[styles.backdrop, backdropAnim]} onPress={onClose} accessibilityLabel="닫기" />

        <Animated.View style={[styles.sheet, { backgroundColor: bg, borderColor }, sheetAnim]}>
          <Text style={[styles.title, { color: textColor }]}>색상 선택</Text>

          {/* SV 패널 */}
          <View style={styles.panel} {...svPan.panHandlers}>
            <LinearGradient colors={['#ffffff', pureHue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[styles.cursor, { left: s * PICKER_W - 12, top: (1 - v) * PICKER_H - 12, borderColor: v > 0.5 ? '#000' : '#fff' }]} />
          </View>

          {/* 미리보기 + 휴 바 */}
          <View style={styles.bottomRow}>
            <View style={[styles.preview, { backgroundColor: currentHex }]} />
            <View style={styles.hueWrap} {...huePan.panHandlers}>
              <LinearGradient
                colors={['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#ff0000']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.hueBar}
              />
              <View pointerEvents="none" style={[styles.hueCursor, { left: (h / 360) * HUE_W - 14, backgroundColor: pureHue }]} />
            </View>
          </View>

          <Text style={[styles.hexText, { color: textColor }]}>{currentHex.toUpperCase()}</Text>

          <View style={[styles.btnRow, { borderTopColor: borderColor }]}>
            <Pressable style={styles.btn} onPress={onClose}>
              <Text style={[styles.btnText, { color: isDark ? '#94A3B8' : '#5c6578' }]}>취소</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnOk, { backgroundColor: currentHex }]} onPress={() => { onSelect(currentHex); onClose(); }}>
              <Text style={[styles.btnText, { color: '#fff', fontWeight: '900' }]}>적용</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1,
    padding: 24, paddingBottom: 36, gap: 16,
  },
  title: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  panel: { width: PICKER_W, height: PICKER_H, borderRadius: 12, overflow: 'hidden' },
  cursor: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: 'transparent' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: HUE_GAP },
  preview: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: PREVIEW_SIZE / 2 },
  hueWrap: { flex: 1, height: HUE_H + 12, justifyContent: 'center' },
  hueBar: { height: HUE_H, borderRadius: HUE_H / 2 },
  hueCursor: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderColor: '#fff', top: -2,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  hexText: { fontSize: 15, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  btnRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 16, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnOk: { flex: 2 },
  btnText: { fontSize: 15, fontWeight: '700' },
});
