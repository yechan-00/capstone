import React from 'react';
import { Pressable, Text, View } from 'react-native';

export function StarRating({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={10}>
          <Text style={{ fontSize: size, opacity: i <= value ? 1 : 0.25 }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}
