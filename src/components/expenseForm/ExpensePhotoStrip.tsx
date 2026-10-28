import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MAX_EXPENSE_PHOTOS } from '@/utils/pendingExpensePhotos';

export type ExpensePhotoStripItem = {
  id: string;
  uri: string;
};

export type ExpensePhotoStripColors = {
  border: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  onAccent: string;
  danger: string;
};

type Props = {
  photos: ExpensePhotoStripItem[];
  saving?: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  colors: ExpensePhotoStripColors;
};

export function ExpensePhotoStrip({
  photos,
  saving = false,
  onAdd,
  onRemove,
  onSetCover,
  colors,
}: Props) {
  const canAdd = photos.length < MAX_EXPENSE_PHOTOS && !saving;
  const [stripWidth, setStripWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const showSwipeHint = stripWidth > 0 && contentWidth > stripWidth + 1;

  return (
    <View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        bounces
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          setStripWidth((current) => (current === next ? current : next));
        }}
        onContentSizeChange={(width) => {
          setContentWidth((current) => (current === width ? current : width));
        }}
      >
        {photos.map((photo, index) => {
          const isCover = index === 0;
          return (
            <View key={photo.id} style={styles.card}>
              <View
                style={[
                  styles.thumb,
                  { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={styles.imageClip}>
                  <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
                </View>
                <Pressable
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    {
                      backgroundColor: colors.surface,
                      opacity: saving ? 0.5 : pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={() => onRemove(photo.id)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="사진 삭제"
                >
                  <MaterialIcons name="close" size={14} color={colors.danger} />
                </Pressable>
              </View>
              {isCover ? (
                <View
                  style={[
                    styles.footer,
                    {
                      borderColor: colors.accent,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                  accessibilityRole="text"
                  accessibilityLabel="대표 사진"
                >
                  <Text numberOfLines={1} style={[styles.footerText, { color: colors.accentText }]}>
                    대표 사진
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.footer,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      opacity: saving ? 0.5 : pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={() => onSetCover(photo.id)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="대표로 설정"
                >
                  <Text numberOfLines={1} style={[styles.footerText, { color: colors.accentText }]}>
                    대표로 설정
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [
              styles.thumb,
              styles.addThumb,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                opacity: canAdd ? (pressed ? 0.92 : 1) : 0.42,
              },
            ]}
            onPress={onAdd}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAdd }}
            accessibilityLabel="사진 추가"
          >
            <MaterialIcons name="add" size={22} color={colors.textMuted} />
            <Text style={[styles.addText, { color: colors.textSecondary }]}>+ 사진 추가</Text>
          </Pressable>
          <View style={styles.footerSpacer} />
        </View>
      </ScrollView>
      {showSwipeHint ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          좌우로 밀어 사진을 확인하세요.
        </Text>
      ) : null}
    </View>
  );
}

const THUMB = 88;
const FOOTER = 30;

const styles = StyleSheet.create({
  strip: {
    marginTop: 6,
  },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 28,
    paddingVertical: 2,
  },
  card: {
    width: THUMB,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  imageClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 6,
    height: FOOTER,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  footerSpacer: {
    marginTop: 6,
    height: FOOTER,
  },
  addThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
});
