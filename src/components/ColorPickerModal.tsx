/**
 * ColorPickerModal.tsx
 * HSV 기반 풀스크린 컬러피커 모달
 * 의존성: react-native-svg (이미 설치됨), expo-linear-gradient (이미 설치됨)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW } = Dimensions.get('window');
const PICKER_W = SW - 48;
const PICKER_H = 220;
const HUE_H = 24;

// ── HSV ↔ HEX 변환 ──────────────────────────────────────
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
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

// ── 컴포넌트 ────────────────────────────────────────────
interface Props {
  visible: boolean;
  initialColor: string;
  onClose: () => void;
  onSelect: (hex: string) => void;
  isDark: boolean;
}

export function ColorPickerModal({ visible, initialColor, onClose, onSelect, isDark }: Props) {
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(initialColor));
  const [h, s, v] = hsv;

  // visible이 true로 바뀔 때 initialColor 동기화
  React.useEffect(() => {
    if (visible) {
      setHsv(hexToHsv(initialColor));
    }
  }, [visible, initialColor]);

  // 패널(sv) 드래그
  const panelRef = useRef<View>(null);
  const panelLayout = useRef({ x: 0, y: 0, w: PICKER_W, h: PICKER_H });

  const svPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateSV(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateSV(e.nativeEvent.locationX, e.nativeEvent.locationY),
    })
  ).current;

  const updateSV = useCallback(
    (lx: number, ly: number) => {
      const newS = Math.min(1, Math.max(0, lx / PICKER_W));
      const newV = Math.min(1, Math.max(0, 1 - ly / PICKER_H));
      setHsv(([hh]) => [hh, newS, newV]);
    },
    []
  );

  // 휴 바 드래그
  const huePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateH(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateH(e.nativeEvent.locationX),
    })
  ).current;

  const updateH = useCallback((lx: number) => {
    const newH = Math.min(360, Math.max(0, (lx / PICKER_W) * 360));
    setHsv(([, ss, vv]) => [newH, ss, vv]);
  }, []);

  const currentHex = hsvToHex(h, s, v);
  const pureHue = hsvToHex(h, 1, 1);

  const bg = isDark ? '#1A2332' : '#ffffff';
  const textColor = isDark ? '#E2E8F0' : '#1c2434';
  const borderColor = isDark ? '#2A3548' : '#e4e8f0';

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
      {/* 배경 딤 */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* 피커 시트 */}
      <View style={[styles.sheet, { backgroundColor: bg, borderColor }]}>
        <Text style={[styles.title, { color: textColor }]}>색상 선택</Text>

        {/* SV 패널 */}
        <View
          ref={panelRef}
          style={styles.panel}
          {...svPan.panHandlers}
        >
          {/* 흰색→순수 색상 그라디언트 */}
          <LinearGradient
            colors={['#ffffff', pureHue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          {/* 투명→검정 그라디언트 (위→아래) */}
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* 커서 */}
          <View
            style={[
              styles.cursor,
              {
                left: s * PICKER_W - 12,
                top: (1 - v) * PICKER_H - 12,
                borderColor: v > 0.5 ? '#000' : '#fff',
              },
            ]}
          />
        </View>

        {/* 색 미리보기 + 휴 바 */}
        <View style={styles.bottomRow}>
          {/* 미리보기 원 */}
          <View style={[styles.preview, { backgroundColor: currentHex }]} />

          {/* 휴 슬라이더 */}
          <View style={styles.hueWrap} {...huePan.panHandlers}>
            <LinearGradient
              colors={[
                '#ff0000','#ffff00','#00ff00',
                '#00ffff','#0000ff','#ff00ff','#ff0000',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.hueBar}
            />
            {/* 휴 커서 */}
            <View
              style={[
                styles.hueCursor,
                { left: (h / 360) * PICKER_W - 12 },
              ]}
            />
          </View>
        </View>

        {/* HEX 표시 */}
        <Text style={[styles.hexText, { color: textColor }]}>{currentHex.toUpperCase()}</Text>

        {/* 버튼 */}
        <View style={[styles.btnRow, { borderTopColor: borderColor }]}>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={[styles.btnText, { color: isDark ? '#94A3B8' : '#5c6578' }]}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnOk, { backgroundColor: currentHex }]}
            onPress={() => { onSelect(currentHex); onClose(); }}
          >
            <Text style={[styles.btnText, { color: '#fff', fontWeight: '900' }]}>적용</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  panel: {
    width: PICKER_W,
    height: PICKER_H,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cursor: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  hueWrap: {
    flex: 1,
    height: HUE_H + 12,
    justifyContent: 'center',
  },
  hueBar: {
    height: HUE_H,
    borderRadius: HUE_H / 2,
  },
  hueCursor: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    top: -2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hexText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnOk: {
    flex: 2,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
