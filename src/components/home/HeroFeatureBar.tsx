import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { HOME, HOME_FEATURES } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { RevealSection } from '@/components/home/RevealSection';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

type Props = {
  embedded?: boolean;
};

const ICONS: IconName[] = ['bar-chart', 'track-changes', 'lightbulb-outline', 'shield'];

export function HeroFeatureBar({ embedded }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width < 1024;

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]} {...WEB_NO_TRANSLATE}>
      <RevealSection delay={280} style={styles.inner}>
        {HOME_FEATURES.map((item, index) => (
          <View
            key={item.key}
            style={[
              styles.item,
              isMobile && styles.itemMobile,
              isTablet && !isMobile && styles.itemTablet,
              index < HOME_FEATURES.length - 1 && !isMobile && styles.itemDivider,
            ]}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons name={ICONS[index]} size={22} color={HOME.green} />
            </View>
            <HomeText style={[styles.title, isMobile && styles.titleMobile]}>{item.title}</HomeText>
            <HomeText style={[styles.desc, isMobile && styles.descMobile]}>{item.desc}</HomeText>
          </View>
        ))}
      </RevealSection>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    marginTop: 8,
  },
  wrapEmbedded: {
    marginTop: 36,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
    maxWidth: HOME.maxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: HOME.white,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    shadowColor: HOME.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 40px rgba(15,23,42,0.06)' } as object)
      : {}),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  itemTablet: {
    paddingHorizontal: 8,
  },
  itemMobile: {
    flex: undefined,
    width: '50%',
    marginBottom: 20,
    flexBasis: '46%',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  itemDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: HOME.gray,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: HOME.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: HOME.dark,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  titleMobile: {
    textAlign: 'left',
  },
  desc: {
    fontSize: 12,
    lineHeight: 18,
    color: HOME.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  descMobile: {
    textAlign: 'left',
  },
});
