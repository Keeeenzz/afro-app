import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { MotiView } from 'moti';

interface StepIndicatorProps {
  total: number;
  current: number;
}

export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <MotiView key={i} animate={{ width: i === current ? 28 : 8, opacity: i <= current ? 1 : 0.42 }} transition={{ type: 'spring', damping: 15 }} style={[styles.dot, i < current && styles.dotComplete, i === current && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.border.default },
  dotActive: { width: 24, backgroundColor: Colors.brand.blue },
  dotComplete: { backgroundColor: Colors.brand.blueDark },
});
