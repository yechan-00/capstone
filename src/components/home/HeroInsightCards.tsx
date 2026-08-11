import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { IS_WEB } from '@/components/home/homeWeb';

const CARD_SHADOW = IS_WEB
  ? ({ boxShadow: '0 8px 32px rgba(15,23,42,0.08)' } as object)
  : {
      shadowColor: '#111827',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 4,
    };

export function HeroInsightCards() {
  return (
    <View style={styles.col}>
      <View style={[styles.card, CARD_SHADOW]}>
        <View style={styles.cardHeader}>
          <HomeText style={styles.cardTitle}>{HOME_COPY.heroCardTrendTitle}</HomeText>
          <View style={styles.deltaBadge}>
            <MaterialIcons name="south-east" size={12} color={HOME.green} />
            <HomeText style={styles.deltaText}>18%</HomeText>
          </View>
        </View>
        <View style={styles.sparkline}>
          {[40, 55, 48, 62, 52, 45, 38].map((h, i) => (
            <View key={i} style={[styles.sparkBar, { height: h, opacity: i >= 5 ? 1 : 0.35 }]} />
          ))}
        </View>
        <HomeText style={styles.cardCaption}>{HOME_COPY.heroCardTrendCaption}</HomeText>
      </View>

      <View style={[styles.card, CARD_SHADOW]}>
        <HomeText style={styles.cardTitle}>{HOME_COPY.heroCardHeatmapTitle}</HomeText>
        <View style={styles.heatmap}>
          {Array.from({ length: 28 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.heatCell,
                { opacity: 0.15 + (i % 7) * 0.08 + (i > 14 ? 0.2 : 0) },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={[styles.card, styles.quoteCard, CARD_SHADOW]}>
        <MaterialIcons name="format-quote" size={22} color={HOME.green} />
        <HomeText style={styles.quoteText}>{HOME_COPY.heroCardQuote}</HomeText>
        <HomeText style={styles.quoteTakeaway}>{HOME_COPY.heroCardTakeaway}</HomeText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    gap: 14,
    width: 240,
    paddingTop: 24,
  },
  card: {
    backgroundColor: HOME.white,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HOME.gray,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -0.2,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: HOME.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '800',
    color: HOME.green,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 64,
    paddingTop: 8,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: HOME.green,
    minHeight: 8,
  },
  cardCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: HOME.textMuted,
  },
  heatmap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: HOME.green,
  },
  quoteCard: {
    gap: 8,
  },
  quoteText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: HOME.textSec,
    fontStyle: Platform.OS === 'web' ? ('italic' as const) : undefined,
  },
  quoteTakeaway: {
    fontSize: 11,
    fontWeight: '800',
    color: HOME.greenDark,
  },
});
