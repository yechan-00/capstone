import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HOME } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';

type Variant = 'delivery' | 'shopping' | 'procrastination';

export function PatternCardIllustration({ variant }: { variant: Variant }) {
  if (variant === 'delivery') return <DeliveryIllustration />;
  if (variant === 'shopping') return <ShoppingIllustration />;
  return <ProcrastinationIllustration />;
}

function DeliveryIllustration() {
  return (
    <View style={del.root}>
      <View style={del.window}>
        <Text style={del.moon}>🌙</Text>
        <View style={del.stars}>
          <View style={del.star} />
          <View style={[del.star, del.starSmall]} />
          <View style={[del.star, { marginLeft: 12 }]} />
        </View>
      </View>
      <View style={del.scene}>
        <View style={del.phone}>
          <View style={del.phoneScreen}>
            <HomeText style={del.phoneTitle}>배달 주문</HomeText>
            <View style={del.phoneItem} />
            <View style={del.phoneItemShort} />
            <View style={del.orderBtn}>
              <HomeText style={del.orderBtnText}>주문하기</HomeText>
            </View>
          </View>
        </View>
        <View style={del.bag}>
          <View style={del.bagTop} />
          <View style={del.bagBody} />
        </View>
      </View>
    </View>
  );
}

function ShoppingIllustration() {
  return (
    <View style={shop.root}>
      <View style={shop.bagsRow}>
        <View style={[shop.bag, shop.bagPink]}>
          <View style={shop.bagHandle} />
        </View>
        <View style={[shop.bag, shop.bagBlue, { marginTop: 8 }]}>
          <View style={shop.bagHandle} />
        </View>
        <View style={[shop.bag, shop.bagPinkLight, { marginTop: 4 }]}>
          <View style={shop.bagHandle} />
        </View>
      </View>
      <View style={shop.bottomRow}>
        <View style={shop.card}>
          <View style={shop.cardStripe} />
          <HomeText style={shop.cardNum}>•••• 4821</HomeText>
        </View>
        <View style={shop.receipt}>
          <View style={shop.receiptLine} />
          <View style={[shop.receiptLine, shop.receiptLineShort]} />
          <View style={shop.receiptLine} />
          <View style={[shop.receiptLine, shop.receiptLineShort]} />
        </View>
      </View>
    </View>
  );
}

function ProcrastinationIllustration() {
  return (
    <View style={pro.root}>
      <View style={pro.desk}>
        <View style={pro.laptop}>
          <View style={pro.laptopScreen} />
          <View style={pro.laptopBase}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={pro.key} />
            ))}
          </View>
        </View>
        <View style={pro.coffee}>
          <View style={pro.coffeeCup} />
          <View style={pro.coffeeHandle} />
        </View>
        <View style={pro.notepad}>
          {['☑', '☐', '☐'].map((mark, i) => (
            <View key={i} style={pro.checkRow}>
              <HomeText style={pro.checkMark}>{mark}</HomeText>
              <View style={pro.checkLine} />
            </View>
          ))}
        </View>
        <View style={pro.pen}>
          <View style={pro.penBody} />
          <MaterialIcons name="edit" size={10} color="#42A5F5" style={pro.penTip} />
        </View>
      </View>
    </View>
  );
}

const del = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A2332',
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 160,
  },
  window: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '55%',
    height: '45%',
    backgroundColor: '#243044',
    borderBottomLeftRadius: 40,
  },
  moon: { position: 'absolute', top: 14, right: 18, fontSize: 22 },
  stars: { position: 'absolute', top: 20, left: 16, flexDirection: 'row', gap: 6 },
  star: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  starSmall: { width: 2, height: 2, marginTop: 4 },
  scene: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 14,
  },
  phone: {
    width: 72,
    height: 110,
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    padding: 4,
    marginBottom: 4,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: HOME.white,
    borderRadius: 7,
    padding: 6,
    gap: 4,
  },
  phoneTitle: { fontSize: 7, fontWeight: '800', color: HOME.dark },
  phoneItem: { height: 6, borderRadius: 3, backgroundColor: '#E8ECE8' },
  phoneItemShort: { height: 6, width: '60%', borderRadius: 3, backgroundColor: '#E8ECE8' },
  orderBtn: {
    marginTop: 'auto',
    backgroundColor: HOME.green,
    borderRadius: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  orderBtnText: { fontSize: 6, fontWeight: '800', color: HOME.white },
  bag: { alignItems: 'center', marginBottom: 0 },
  bagTop: {
    width: 36,
    height: 8,
    backgroundColor: '#8D6E63',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  bagBody: {
    width: 52,
    height: 58,
    backgroundColor: '#A1887F',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
});

const shop = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F0EB',
    borderRadius: 14,
    padding: 16,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  bagsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 8,
  },
  bag: {
    width: 44,
    height: 52,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
  },
  bagPink: { backgroundColor: '#F8BBD0' },
  bagBlue: { backgroundColor: '#BBDEFB', height: 46, width: 40 },
  bagPinkLight: { backgroundColor: '#FCE4EC', height: 48, width: 38 },
  bagHandle: {
    width: 20,
    height: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.12)',
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    marginTop: -6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 72,
    height: 44,
    backgroundColor: '#42A5F5',
    borderRadius: 6,
    padding: 6,
    justifyContent: 'space-between',
  },
  cardStripe: { width: 16, height: 8, backgroundColor: '#FFD54F', borderRadius: 2 },
  cardNum: { fontSize: 7, fontWeight: '700', color: HOME.white, letterSpacing: 0.5 },
  receipt: {
    width: 36,
    height: 48,
    backgroundColor: HOME.white,
    borderRadius: 3,
    padding: 5,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  receiptLine: { height: 2, backgroundColor: '#E0E0E0', borderRadius: 1 },
  receiptLineShort: { width: '70%' },
});

const pro = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF1F0',
    borderRadius: 14,
    minHeight: 160,
    padding: 14,
  },
  desk: {
    flex: 1,
    position: 'relative',
  },
  laptop: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 90,
  },
  laptopScreen: {
    height: 52,
    backgroundColor: '#37474F',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 2,
    borderColor: '#455A64',
    borderBottomWidth: 0,
  },
  laptopBase: {
    height: 14,
    backgroundColor: '#CFD8DC',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
  },
  key: { flex: 1, height: 4, backgroundColor: '#B0BEC5', borderRadius: 1 },
  coffee: {
    position: 'absolute',
    top: 12,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coffeeCup: {
    width: 22,
    height: 26,
    backgroundColor: HOME.white,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  coffeeHandle: {
    width: 8,
    height: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    marginLeft: -2,
  },
  notepad: {
    position: 'absolute',
    bottom: 16,
    right: 12,
    width: 56,
    backgroundColor: HOME.white,
    borderRadius: 4,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkMark: { fontSize: 7, color: HOME.textSec },
  checkLine: { flex: 1, height: 2, backgroundColor: '#E8ECE8', borderRadius: 1 },
  pen: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    flexDirection: 'row',
    alignItems: 'center',
    transform: [{ rotate: '-30deg' }],
  },
  penBody: {
    width: 36,
    height: 5,
    backgroundColor: '#42A5F5',
    borderRadius: 2,
  },
  penTip: { marginLeft: -2 },
});
