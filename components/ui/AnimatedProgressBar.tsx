import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

type AnimatedProgressBarProps = {
  value: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
};

export function AnimatedProgressBar({ value, style, color = Colors.brand.blue }: AnimatedProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const progress = useDerivedValue(() => withTiming(Math.max(0, Math.min(100, value)), { duration: 260, reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.System }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }} style={[styles.track, style]}><Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} /></View>;
}

const styles = StyleSheet.create({
  track: { height: 6, overflow: 'hidden', borderRadius: Radius.full, backgroundColor: '#D9E6F5' },
  fill: { height: '100%', borderRadius: Radius.full },
});
