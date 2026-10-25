import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Radius } from '@/constants/theme';

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return <MotiView from={{ opacity: 0.45 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 700, loop: true }} style={[styles.card, style]}><View style={styles.image} /><View style={styles.line} /><View style={[styles.line, styles.short]} /></MotiView>;
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: Radius.lg, backgroundColor: '#FFFFFF', gap: 10 },
  image: { height: 154, borderRadius: Radius.md, backgroundColor: '#E5EEF8' },
  line: { height: 12, width: '88%', borderRadius: Radius.full, backgroundColor: '#E5EEF8' },
  short: { width: '42%' },
});
