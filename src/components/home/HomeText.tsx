import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { WEB_KO_LINE, WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE, WEB_PRE_LINE } from '@/components/home/homeWeb';

type Props = TextProps & {
  preLine?: boolean;
};

export function HomeText({ style, preLine = false, children, ...rest }: Props) {
  return (
    <Text
      {...rest}
      {...WEB_NO_TRANSLATE}
      style={[WEB_KO_LINE, preLine && WEB_PRE_LINE, style]}
    >
      {children}
    </Text>
  );
}

/** 줄 단위로 블록 렌더 — 한글 단어 중간 줄바꿈 방지 */
export function HomeMultilineText({
  text,
  style,
  lineStyle,
  align,
  titleLine,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  lineStyle?: TextStyle;
  align?: 'left' | 'center' | 'right';
  /** 타이틀 등 — 한 줄이 단어 중간에서 끊기지 않게 */
  titleLine?: boolean;
}) {
  const lines = text.split('\n');
  const flat = StyleSheet.flatten(style) ?? {};
  const textAlign = align ?? (flat.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'left';

  const containerStyle: ViewStyle =
    textAlign === 'center'
      ? { alignItems: 'center' }
      : textAlign === 'right'
        ? { alignItems: 'flex-end' }
        : { alignItems: 'flex-start' };

  const lineStyles: TextStyle = {
    ...flat,
    textAlign,
  };

  return (
    <View style={containerStyle} {...WEB_NO_TRANSLATE}>
      {lines.map((line, index) => (
        <HomeText
          key={`${index}-${line}`}
          style={[lineStyles, titleLine && WEB_KO_TITLE_LINE, lineStyle]}
        >
          {line}
        </HomeText>
      ))}
    </View>
  );
}

/** 명시적 줄 배열 — 타이틀 등 정확한 줄바꿈 */
export function HomeLinesText({
  lines,
  style,
  align,
}: {
  lines: readonly string[];
  style?: StyleProp<TextStyle>;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <HomeMultilineText text={lines.join('\n')} style={style} align={align} titleLine />
  );
}
