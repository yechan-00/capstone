import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { BrandAppIcon } from '@/components/BrandAppIcon';
import { HOME, HOME_COPY, HOME_CAROUSEL, HOME_FLOATING_CARDS, HOME_TITLE_LINES, RECORD_TAGS, STORY_CARDS, ANALYSIS_INSIGHTS } from '@/components/home/homeTheme';
import { HomeLinesText, HomeMultilineText, HomeText } from '@/components/home/HomeText';
import {
  WEB_LOCK_NOTIF_SHADOW,
  WEB_LOCK_TIME_FONT,
  WEB_LOCK_TIME_TABULAR,
  WEB_NO_TRANSLATE,
} from '@/components/home/homeWeb';

const NAVY = '#1a2d4a';
const HEADER_GRADIENT = ['#1a2d4a', '#24365f'] as const;

function AppStatusBar() {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusTime}>9:41</Text>
      <View style={styles.statusIcons}>
        <View style={styles.statusDot} />
        <View style={styles.statusDot} />
        <View style={[styles.statusDot, styles.statusDotWide]} />
      </View>
    </View>
  );
}

function AppHeader({ title, showBrandIcon = false }: { title: string; showBrandIcon?: boolean }) {
  return (
    <LinearGradient colors={HEADER_GRADIENT} style={styles.appHeader}>
      <View style={styles.appHeaderRow}>
        {showBrandIcon ? <BrandAppIcon size={22} /> : null}
        <HomeText style={styles.appHeaderTitle}>{title}</HomeText>
      </View>
    </LinearGradient>
  );
}

export function HomeScreenPreview() {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const dates = [10, 11, 12, 13, 14, 15, 16];

  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <AppHeader title={HOME_COPY.headerLogo} showBrandIcon />
      <View style={styles.body}>
        <View style={styles.summaryCard}>
          <HomeText style={styles.summaryLabel}>{HOME_FLOATING_CARDS[0].label}</HomeText>
          <HomeText style={styles.summaryAmount}>{HOME_FLOATING_CARDS[0].value}</HomeText>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '62%' }]} />
          </View>
          <HomeText style={styles.summaryHint}>{HOME_COPY.recordSub}</HomeText>
        </View>

        <View style={styles.reviewPendingCard}>
          <View style={[styles.pendingIcon, { backgroundColor: `${HOME.accentOrange}20` }]}>
            <Text style={styles.pendingIconText}>⏳</Text>
          </View>
          <View style={{ flex: 1 }}>
            <HomeText style={styles.pendingTitle}>3일 뒤</HomeText>
            <HomeText style={styles.pendingSub}>후회 리뷰</HomeText>
          </View>
          <HomeText style={styles.pendingBadge}>3일 후</HomeText>
        </View>

        <View style={styles.patternCard}>
          <HomeText style={styles.patternLabel}>{ANALYSIS_INSIGHTS[1].text}</HomeText>
          <HomeText style={styles.patternValue}>{ANALYSIS_INSIGHTS[0].text}</HomeText>
        </View>

        <View style={styles.calendarWrap}>
          <Text style={styles.calendarTitle}>3월</Text>
          <View style={styles.calendarHeader}>
            {days.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.calendarRow}>
            {dates.map((d, i) => (
              <View key={d} style={[styles.dateCell, i === 4 && styles.dateCellActive]}>
                <Text style={[styles.dateText, i === 4 && styles.dateTextActive]}>{d}</Text>
                {i === 1 || i === 4 ? (
                  <View style={[styles.expenseDot, i === 4 && styles.expenseDotActive]} />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.tabBar}>
        {HOME_CAROUSEL.map((card, i) => (
          <View key={card.key} style={styles.tabItem}>
            <View style={[styles.tabDot, i === 0 && styles.tabDotActive]} />
            <HomeText style={[styles.tabLabel, i === 0 && styles.tabLabelActive]}>{card.title}</HomeText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function InsightsScreenPreview() {
  const bars = [42, 68, 35, 82, 55, 48];
  const anim = useRef(bars.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anim.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 900,
        delay: i * 80,
        useNativeDriver: false,
      }),
    );
    Animated.stagger(60, animations).start();
  }, [anim]);

  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <AppHeader title={HOME_CAROUSEL[1].title} />
      <View style={styles.body}>
        <View style={styles.insightHero}>
          <HomeText style={styles.insightLabel}>{HOME_FLOATING_CARDS[0].label}</HomeText>
          <Text style={[styles.insightRate, { color: HOME.accentGreen }]}>13%</Text>
          <HomeText style={styles.insightDelta}>{HOME_FLOATING_CARDS[0].value}</HomeText>
        </View>

        <View style={styles.chartBox}>
          <HomeText style={styles.chartTitle}>{HOME_COPY.insightPanelLabel}</HomeText>
          <View style={styles.chartRow}>
            {bars.map((h, i) => (
              <View key={i} style={styles.chartCol}>
                <Animated.View
                  style={[
                    styles.chartBar,
                    {
                      height: anim[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, h],
                      }),
                      backgroundColor: i === 4 ? HOME.primary : `${HOME.primary}88`,
                    },
                  ]}
                />
                <Text style={styles.chartLabel}>{['월', '화', '수', '목', '금', '토'][i]}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: `${HOME.accentPurple}18` }]}>
            <HomeText style={[styles.tagText, { color: HOME.accentPurple }]}>{RECORD_TAGS[0]}</HomeText>
          </View>
          <View style={[styles.tag, { backgroundColor: `${HOME.accentCyan}18` }]}>
            <HomeText style={[styles.tagText, { color: '#0891b2' }]}>{HOME_FLOATING_CARDS[1].label}</HomeText>
          </View>
          <View style={[styles.tag, { backgroundColor: `${HOME.accentOrange}18` }]}>
            <HomeText style={[styles.tagText, { color: HOME.accentOrange }]}>{RECORD_TAGS[2]}</HomeText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function RegretAnalysisScreenPreview() {
  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
  const mayDates = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];
  const chartHeights = [28, 24, 20, 18, 16, 14, 12];

  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <AppHeader title="후회 분석" />
      <View style={styles.body}>
        <View style={styles.analysisStatCard}>
          <HomeText style={styles.analysisStatLabel}>이번 달 후회 감소율</HomeText>
          <View style={styles.analysisStatRow}>
            <View style={{ flex: 1 }}>
              <HomeText style={styles.analysisStatValue}>
                <HomeText style={styles.analysisStatNum}>13%</HomeText> 후회가 줄었어요
              </HomeText>
              <HomeText style={styles.analysisStatSub}>지난 달보다 2%p 개선됐어요</HomeText>
            </View>
            <View style={styles.analysisDeltaBadge}>
              <HomeText style={styles.analysisDeltaText}>▼ 2%p</HomeText>
            </View>
          </View>
          <View style={styles.sparkline}>
            {chartHeights.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.sparkBar,
                  { height: h, backgroundColor: i === chartHeights.length - 1 ? HOME.green : `${HOME.green}55` },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.calendarWrap}>
          <View style={styles.calendarHeaderRow}>
            <HomeText style={styles.calendarTitle}>후회 패턴 캘린더</HomeText>
            <HomeText style={styles.calendarMonth}>2024년 5월</HomeText>
          </View>
          <View style={styles.calendarHeader}>
            {weekdays.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>
          {mayDates.map((week, wi) => (
            <View key={wi} style={styles.calendarRow}>
              {week.map((d, di) => (
                <View
                  key={`${wi}-${di}`}
                  style={[styles.dateCell, d === 23 && styles.dateCellHighlight]}
                >
                  {d ? (
                    <>
                      <Text style={[styles.dateText, d === 23 && styles.dateTextHighlight]}>{d}</Text>
                      {d === 23 || d === 17 || d === 10 ? (
                        <View style={[styles.expenseDot, d === 23 && styles.expenseDotHighlight]} />
                      ) : null}
                    </>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.dailyCard}>
          <View style={styles.dailyHeader}>
            <HomeText style={styles.dailyDate}>5월 23일</HomeText>
            <HomeText style={styles.dailyTotal}>27,800원</HomeText>
          </View>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyIcon, { backgroundColor: `${HOME.green}18` }]}>
              <Text style={styles.dailyIconText}>🛵</Text>
            </View>
            <View style={{ flex: 1 }}>
              <HomeText style={styles.dailyTitle}>배달 음식</HomeText>
              <HomeText style={styles.dailyTag}>스트레스</HomeText>
            </View>
            <View style={styles.dailyMeta}>
              <HomeText style={styles.dailyAmount}>18,000원</HomeText>
              <HomeText style={styles.dailyTime}>오후 11:42</HomeText>
            </View>
          </View>
          <View style={styles.dailyItem}>
            <View style={[styles.dailyIcon, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.dailyIconText}>🛍️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <HomeText style={styles.dailyTitle}>온라인 쇼핑</HomeText>
              <HomeText style={styles.dailyTag}>보상</HomeText>
            </View>
            <View style={styles.dailyMeta}>
              <HomeText style={styles.dailyAmount}>9,800원</HomeText>
              <HomeText style={styles.dailyTime}>오후 9:15</HomeText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 섹션 3 — 지출 이유 기록 화면 */
export function RecordReasonScreenPreview() {
  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <View style={styles.recordHeader}>
        <MaterialIcons name="arrow-back-ios" size={14} color={NAVY} />
        <HomeText style={styles.recordHeaderTitle}>지출 분석</HomeText>
        <View style={{ width: 14 }} />
      </View>
      <View style={styles.body}>
        <View style={styles.recordExpenseCard}>
          <View style={[styles.dailyIcon, { backgroundColor: '#FFF3E0' }]}>
            <Text style={styles.dailyIconText}>☕</Text>
          </View>
          <View style={{ flex: 1 }}>
            <HomeText style={styles.recordExpenseTitle}>카페 라떼</HomeText>
            <HomeText style={styles.recordExpenseMeta}>2024. 05. 21 (화) 14:35 · 신용카드</HomeText>
          </View>
          <HomeText style={styles.recordExpenseAmount}>4,800원</HomeText>
        </View>

        <HomeText style={styles.recordSectionLabel}>이 지출의 이유</HomeText>
        <View style={styles.recordQuoteBox}>
          <HomeText style={styles.recordQuoteMark}>“</HomeText>
          <HomeText style={styles.recordQuoteText}>
            업무 스트레스로 잠시 휴식이 필요해서 나에게 작은 보상을 주고 싶었어요.
          </HomeText>
        </View>

        <HomeText style={styles.recordSectionLabel}>감정 태그</HomeText>
        <View style={styles.recordTagRow}>
          <View style={[styles.recordTag, { backgroundColor: '#FFEBEE' }]}>
            <Text style={styles.recordTagEmoji}>😫</Text>
            <HomeText style={[styles.recordTagText, { color: '#E53935' }]}>Stress</HomeText>
          </View>
          <View style={[styles.recordTag, { backgroundColor: '#FFF8E1' }]}>
            <Text style={styles.recordTagEmoji}>🎁</Text>
            <HomeText style={[styles.recordTagText, { color: '#F9A825' }]}>Reward</HomeText>
          </View>
          <View style={[styles.recordTag, { backgroundColor: HOME.gray }]}>
            <Text style={styles.recordTagEmoji}>🧘</Text>
            <HomeText style={[styles.recordTagText, { color: HOME.textSec }]}>휴식</HomeText>
          </View>
        </View>

        <View style={styles.recordInsightBox}>
          <View style={styles.recordInsightIcon}>
            <MaterialIcons name="show-chart" size={16} color={HOME.green} />
          </View>
          <HomeText style={styles.recordInsightText}>
            최근 비슷한 스트레스 상황에서 카페 지출이 늘고 있어요. 나만의 스트레스 해소 루틴을 만들어볼까요?
          </HomeText>
        </View>

        <View style={styles.recordPatternRow}>
          <View style={{ flex: 1 }}>
            <HomeText style={styles.recordPatternLabel}>유사 지출 패턴</HomeText>
            <HomeText style={styles.recordPatternStat}>최근 30일 · 스트레스 상황 6회 · 평균 4,500원</HomeText>
          </View>
          <View style={styles.recordMiniBars}>
            {[18, 28, 22, 34, 40].map((h, i) => (
              <View key={i} style={[styles.recordMiniBar, { height: h, opacity: i >= 3 ? 1 : 0.45 }]} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** 섹션 6 CTA — 오늘의 후회지수 대시보드 */
export function RegretIndexScreenPreview() {
  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <View style={styles.regretHeader}>
        <HomeText style={styles.regretHeaderTitle}>오늘의 후회지수</HomeText>
        <MaterialIcons name="info-outline" size={16} color={HOME.textMuted} />
      </View>
      <View style={styles.body}>
        <View style={styles.regretGaugeCard}>
          <View style={styles.regretGaugeArc}>
            <View style={styles.regretGaugeTrack} />
            <View style={styles.regretGaugeFill} />
            <View style={styles.regretGaugeCenter}>
              <Text style={styles.regretGaugeScore}>32</Text>
              <Text style={styles.regretGaugeMax}>/ 100</Text>
            </View>
          </View>
          <HomeText style={styles.regretGaugeDelta}>지난주보다 15% 좋아졌어요!</HomeText>
        </View>

        <View style={styles.regretStatCard}>
          <HomeText style={styles.regretStatLabel}>이번 달 후회 금액</HomeText>
          <HomeText style={styles.regretStatValue}>128,000원</HomeText>
          <HomeText style={styles.regretStatSub}>지난 달보다 32,000원 절약했어요 ↓</HomeText>
        </View>

        <View style={styles.regretStatCard}>
          <HomeText style={styles.regretStatLabel}>가장 후회된 소비</HomeText>
          <View style={styles.regretListItem}>
            <HomeText style={styles.regretListTitle}>"충동적으로 산 옷"</HomeText>
            <HomeText style={styles.regretListAmount}>43,000원</HomeText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ReviewScreenPreview() {
  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <AppHeader title={STORY_CARDS[2].title} />
      <View style={styles.body}>
        <View style={styles.reviewCard}>
          <LinearGradient colors={['#ffd8a8', '#f4a261']} style={styles.foodPhoto}>
            <Text style={styles.foodEmoji}>🍗</Text>
          </LinearGradient>
          <View style={styles.reviewBody}>
            <HomeText style={styles.reviewTitle}>{STORY_CARDS[1].title}</HomeText>
            <HomeText style={styles.reviewAmount}>{STORY_CARDS[0].title}</HomeText>
            <HomeLinesText
              lines={HOME_TITLE_LINES.record}
              style={styles.reviewQ}
            />
          </View>
        </View>

        <View style={styles.reasonCard}>
          <HomeMultilineText text={HOME_COPY.recordSub} style={styles.reasonQ} />
          <View style={styles.reasonTags}>
            {RECORD_TAGS.slice(0, 2).map((tag) => (
              <HomeText key={tag} style={styles.reasonTag}>
                {tag}
              </HomeText>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export function WeeklyRegretChartPreview() {
  const bars = [32, 28, 35, 40, 72, 38, 30];
  const days = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <View style={styles.weeklyRoot} {...WEB_NO_TRANSLATE}>
      <View style={styles.weeklyHeader}>
        <View style={styles.weeklyTitleRow}>
          <HomeText style={styles.weeklyTitle}>요일별 후회율</HomeText>
          <Text style={styles.weeklyInfo}>ⓘ</Text>
        </View>
        <View style={styles.weeklyFilter}>
          <HomeText style={styles.weeklyFilterText}>최근 4주</HomeText>
          <Text style={styles.weeklyFilterArrow}>▾</Text>
        </View>
      </View>

      <View style={styles.weeklyChart}>
        {bars.map((h, i) => (
          <View key={days[i]} style={styles.weeklyCol}>
            {i === 4 ? (
              <View style={styles.weeklyTooltip}>
                <HomeText style={styles.weeklyTooltipText}>72%</HomeText>
              </View>
            ) : (
              <View style={styles.weeklyTooltipSpacer} />
            )}
            <View
              style={[
                styles.weeklyBar,
                { height: h },
                i === 4 && styles.weeklyBarActive,
              ]}
            />
            <HomeText style={[styles.weeklyDay, i === 4 && styles.weeklyDayActive]}>
              {days[i]}
            </HomeText>
          </View>
        ))}
      </View>

      <View style={styles.weeklyInsight}>
        <MaterialIcons name="show-chart" size={16} color={HOME.neon} />
        <HomeText style={styles.weeklyInsightText}>금요일의 후회율이 가장 높아요</HomeText>
      </View>
    </View>
  );
}

export function NotificationScreenPreview() {
  return (
    <View style={styles.lockRoot} {...WEB_NO_TRANSLATE}>
      <LinearGradient
        colors={['#1d6b63', '#3a9e92', '#5ec9bc', '#3d8f84', '#1a5a54']}
        locations={[0, 0.28, 0.52, 0.76, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.lockWaveTop} pointerEvents="none" />
      <View style={styles.lockWaveMid} pointerEvents="none" />
      <View style={styles.lockWaveBottom} pointerEvents="none" />

      <View style={styles.lockContent}>
        <View style={styles.lockTop}>
          <MaterialIcons name="lock" size={13} color="rgba(255,255,255,0.88)" />
          <Text style={styles.lockDate}>5월 16일 금요일</Text>
          <View style={styles.lockClockWrap}>
            <Text style={styles.lockTime}>9:00</Text>
          </View>
        </View>

        <View style={styles.lockNotifCard}>
          <View style={styles.lockNotifHeader}>
            <BrandAppIcon size={36} />
            <Text style={styles.lockNotifApp} numberOfLines={1}>
              {HOME_COPY.preventionNotifTitle}
            </Text>
            <Text style={styles.lockNotifWhen}>지금</Text>
          </View>
          <Text style={styles.lockNotifBody}>{HOME_COPY.preventionNotif}</Text>
        </View>
      </View>
    </View>
  );
}

export function CommunityScreenPreview() {
  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <AppStatusBar />
      <AppHeader title={HOME_COPY.headerNavCommunity} />
      <View style={styles.body}>
        <View style={styles.communityCard}>
          <Text style={styles.communityEmoji}>💬</Text>
          <View style={{ flex: 1 }}>
            <HomeMultilineText text={HOME_COPY.communityTitle} style={styles.communityTitle} />
            <HomeMultilineText text={HOME_COPY.communityBody} style={styles.communityLikes} />
          </View>
        </View>
        <View style={styles.comingBadge}>
          <HomeText style={styles.comingText}>{HOME_COPY.communityBadge}</HomeText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f6f8' },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: NAVY,
  },
  statusTime: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusIcons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  statusDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  statusDotWide: { width: 12, height: 4, borderRadius: 2 },
  appHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  appHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  body: { padding: 12, gap: 10, flex: 1 },
  summaryCard: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: HOME.textSec },
  summaryAmount: { fontSize: 24, fontWeight: '900', color: NAVY, letterSpacing: -0.5 },
  progressTrack: {
    height: 6,
    backgroundColor: HOME.gray,
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: HOME.primary, borderRadius: 999 },
  summaryHint: { fontSize: 10, fontWeight: '600', color: HOME.textMuted, marginTop: 4 },
  reviewPendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
  },
  pendingIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconText: { fontSize: 14 },
  pendingTitle: { fontSize: 12, fontWeight: '800', color: NAVY },
  pendingSub: { fontSize: 10, fontWeight: '600', color: HOME.textMuted, marginTop: 2 },
  pendingBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: HOME.accentOrange,
    backgroundColor: `${HOME.accentOrange}18`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  patternCard: {
    backgroundColor: `${HOME.accentPurple}10`,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: `${HOME.accentPurple}22`,
  },
  patternLabel: { fontSize: 10, fontWeight: '700', color: HOME.textMuted },
  patternValue: { fontSize: 13, fontWeight: '800', color: HOME.accentPurple, marginTop: 4 },
  calendarWrap: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  calendarTitle: { fontSize: 13, fontWeight: '800', color: NAVY },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: HOME.textMuted },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  dateCellActive: { backgroundColor: `${HOME.primary}14` },
  dateText: { fontSize: 11, fontWeight: '700', color: HOME.textSec },
  dateTextActive: { color: HOME.primary },
  expenseDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: HOME.accentPurple },
  expenseDotActive: { backgroundColor: HOME.primary },
  insightHero: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  insightLabel: { fontSize: 11, fontWeight: '700', color: HOME.textSec },
  insightRate: { fontSize: 36, fontWeight: '900', marginTop: 4 },
  insightDelta: { fontSize: 10, fontWeight: '600', color: HOME.accentGreen, marginTop: 4 },
  chartBox: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 14,
    paddingBottom: 8,
  },
  chartTitle: { fontSize: 11, fontWeight: '800', color: NAVY, marginBottom: 10 },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    gap: 6,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chartBar: { width: '100%', borderRadius: 6, minHeight: 4 },
  chartLabel: { fontSize: 9, fontWeight: '700', color: HOME.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontSize: 10, fontWeight: '800' },
  reviewCard: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  foodPhoto: { height: 90, alignItems: 'center', justifyContent: 'center' },
  foodEmoji: { fontSize: 36 },
  reviewBody: { padding: 12, gap: 4 },
  reviewTitle: { fontSize: 14, fontWeight: '900', color: NAVY },
  reviewAmount: { fontSize: 12, fontWeight: '700', color: HOME.textSec },
  reviewQ: { fontSize: 15, fontWeight: '900', color: NAVY, marginTop: 10 },
  choiceRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  choiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: HOME.gray,
    alignItems: 'center',
  },
  choiceBtnActive: { backgroundColor: NAVY },
  choiceText: { fontSize: 11, fontWeight: '700', color: HOME.textSec },
  choiceTextActive: { fontSize: 11, fontWeight: '700', color: '#fff' },
  reasonCard: {
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  reasonQ: { fontSize: 11, fontWeight: '800', color: NAVY },
  reasonTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reasonTag: {
    fontSize: 10,
    fontWeight: '700',
    color: HOME.textSec,
    backgroundColor: HOME.gray,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  notifWallpaper: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-start',
    paddingTop: 48,
  },
  notifTime: {
    fontSize: 48,
    fontWeight: '200',
    color: NAVY,
    marginBottom: 24,
    letterSpacing: -2,
  },
  notifCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  notifApp: { fontSize: 12, fontWeight: '800', color: NAVY },
  notifWhen: { fontSize: 10, fontWeight: '600', color: HOME.textMuted },
  notifBody: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: HOME.text },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
  },
  communityEmoji: { fontSize: 24 },
  communityTitle: { fontSize: 12, fontWeight: '800', color: NAVY },
  communityLikes: { fontSize: 10, fontWeight: '600', color: HOME.textMuted, marginTop: 2 },
  comingBadge: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${HOME.accentPurple}18`,
  },
  comingText: { fontSize: 10, fontWeight: '800', color: HOME.accentPurple },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 10,
    backgroundColor: HOME.white,
    borderTopWidth: 1,
    borderTopColor: HOME.gray,
  },
  tabItem: { alignItems: 'center', gap: 3 },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: HOME.grayDark,
  },
  tabDotActive: { backgroundColor: HOME.primary },
  tabLabel: { fontSize: 8, fontWeight: '600', color: HOME.textMuted },
  tabLabelActive: { color: HOME.primary, fontWeight: '800' },
  analysisStatCard: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  analysisStatLabel: { fontSize: 11, fontWeight: '700', color: HOME.textSec },
  analysisStatRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  analysisStatValue: { fontSize: 13, fontWeight: '700', color: NAVY, lineHeight: 20 },
  analysisStatNum: { fontSize: 22, fontWeight: '900', color: HOME.green },
  analysisStatSub: { fontSize: 10, fontWeight: '600', color: HOME.textMuted, marginTop: 4 },
  analysisDeltaBadge: {
    backgroundColor: HOME.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  analysisDeltaText: { fontSize: 10, fontWeight: '800', color: HOME.green },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 32,
    marginTop: 4,
  },
  sparkBar: { flex: 1, borderRadius: 3, minHeight: 4 },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarMonth: { fontSize: 10, fontWeight: '700', color: HOME.textMuted },
  dateCellHighlight: { backgroundColor: HOME.green },
  dateTextHighlight: { color: HOME.white, fontWeight: '800' },
  expenseDotHighlight: { backgroundColor: HOME.white },
  dailyCard: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.gray,
  },
  dailyDate: { fontSize: 12, fontWeight: '800', color: NAVY },
  dailyTotal: { fontSize: 12, fontWeight: '800', color: HOME.green },
  dailyItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dailyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyIconText: { fontSize: 16 },
  dailyTitle: { fontSize: 12, fontWeight: '800', color: NAVY },
  dailyTag: { fontSize: 10, fontWeight: '600', color: HOME.green, marginTop: 2 },
  dailyMeta: { alignItems: 'flex-end' },
  dailyAmount: { fontSize: 11, fontWeight: '800', color: NAVY },
  dailyTime: { fontSize: 9, fontWeight: '600', color: HOME.textMuted, marginTop: 2 },
  weeklyRoot: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 14,
    gap: 16,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weeklyTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  weeklyInfo: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  weeklyFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  weeklyFilterText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  weeklyFilterArrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    gap: 6,
    paddingTop: 8,
  },
  weeklyCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  weeklyTooltip: {
    backgroundColor: HOME.neon,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  weeklyTooltipText: { fontSize: 10, fontWeight: '800', color: '#0A0A0A' },
  weeklyTooltipSpacer: { height: 22 },
  weeklyBar: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    minHeight: 8,
  },
  weeklyBarActive: { backgroundColor: HOME.neon },
  weeklyDay: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  weeklyDayActive: { color: HOME.neon, fontWeight: '800' },
  weeklyInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  weeklyInsightText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', flex: 1 },
  lockRoot: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1a5f58',
  },
  lockWaveTop: {
    position: 'absolute',
    top: '-8%',
    right: '-30%',
    width: '95%',
    height: '42%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ rotate: '-18deg' }],
  },
  lockWaveMid: {
    position: 'absolute',
    top: '32%',
    left: '-35%',
    width: '90%',
    height: '38%',
    borderRadius: 999,
    backgroundColor: 'rgba(77,181,168,0.22)',
    transform: [{ rotate: '12deg' }],
  },
  lockWaveBottom: {
    position: 'absolute',
    bottom: '-12%',
    right: '-20%',
    width: '85%',
    height: '45%',
    borderRadius: 999,
    backgroundColor: 'rgba(15,79,74,0.45)',
    transform: [{ rotate: '-8deg' }],
  },
  lockContent: {
    flex: 1,
    width: '100%',
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  lockTop: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  lockDate: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.94)',
    textAlign: 'center',
    includeFontPadding: false,
  },
  lockClockWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  lockTime: {
    fontSize: 64,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1.5,
    lineHeight: 68,
    includeFontPadding: false,
    ...WEB_LOCK_TIME_FONT,
    ...WEB_LOCK_TIME_TABULAR,
  },
  lockNotifCard: {
    width: '100%',
    marginTop: 26,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
    ...WEB_LOCK_NOTIF_SHADOW,
  },
  lockNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 7,
  },
  lockNotifApp: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: HOME.dark,
    textAlign: 'left',
    includeFontPadding: false,
  },
  lockNotifWhen: {
    fontSize: 12,
    fontWeight: '500',
    color: HOME.textMuted,
    textAlign: 'right',
    includeFontPadding: false,
  },
  lockNotifBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
    color: '#2D3748',
    textAlign: 'left',
    includeFontPadding: false,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: HOME.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.gray,
  },
  recordHeaderTitle: { fontSize: 15, fontWeight: '800', color: NAVY },
  recordExpenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
  },
  recordExpenseTitle: { fontSize: 14, fontWeight: '800', color: NAVY },
  recordExpenseMeta: { fontSize: 9, fontWeight: '600', color: HOME.textMuted, marginTop: 3 },
  recordExpenseAmount: { fontSize: 14, fontWeight: '900', color: NAVY },
  recordSectionLabel: { fontSize: 11, fontWeight: '800', color: NAVY, marginTop: 4 },
  recordQuoteBox: {
    backgroundColor: HOME.greenLight,
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: HOME.green,
    gap: 4,
  },
  recordQuoteMark: { fontSize: 22, fontWeight: '900', color: HOME.green, lineHeight: 22 },
  recordQuoteText: { fontSize: 11, lineHeight: 17, fontWeight: '600', color: NAVY },
  recordTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recordTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  recordTagEmoji: { fontSize: 11 },
  recordTagText: { fontSize: 10, fontWeight: '800' },
  recordInsightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: `${HOME.green}33`,
  },
  recordInsightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HOME.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInsightText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '600', color: HOME.textSec },
  recordPatternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
  },
  recordPatternLabel: { fontSize: 10, fontWeight: '800', color: NAVY },
  recordPatternStat: { fontSize: 9, fontWeight: '600', color: HOME.textMuted, marginTop: 4, lineHeight: 13 },
  recordMiniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 },
  recordMiniBar: { width: 6, borderRadius: 3, backgroundColor: HOME.green },
  regretHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: HOME.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HOME.gray,
  },
  regretHeaderTitle: { fontSize: 14, fontWeight: '800', color: NAVY },
  regretGaugeCard: {
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  regretGaugeArc: {
    width: 140,
    height: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  regretGaugeTrack: {
    position: 'absolute',
    bottom: 0,
    width: 140,
    height: 70,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    borderWidth: 10,
    borderBottomWidth: 0,
    borderColor: HOME.gray,
  },
  regretGaugeFill: {
    position: 'absolute',
    bottom: 0,
    width: 140,
    height: 70,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    borderWidth: 10,
    borderBottomWidth: 0,
    borderColor: HOME.green,
    borderRightColor: 'transparent',
    transform: [{ rotate: '-55deg' }],
  },
  regretGaugeCenter: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  regretGaugeScore: { fontSize: 28, fontWeight: '900', color: NAVY },
  regretGaugeMax: { fontSize: 12, fontWeight: '700', color: HOME.textMuted },
  regretGaugeDelta: { fontSize: 10, fontWeight: '700', color: HOME.green },
  regretStatCard: {
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  regretStatLabel: { fontSize: 10, fontWeight: '700', color: HOME.textMuted },
  regretStatValue: { fontSize: 18, fontWeight: '900', color: NAVY },
  regretStatSub: { fontSize: 9, fontWeight: '700', color: HOME.green, marginTop: 2 },
  regretListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  regretListTitle: { fontSize: 11, fontWeight: '700', color: NAVY, flex: 1 },
  regretListAmount: { fontSize: 11, fontWeight: '800', color: HOME.accentOrange },
});
