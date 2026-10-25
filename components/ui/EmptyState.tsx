import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';

type EmptyStateProps = { icon?: keyof typeof Ionicons.glyphMap; title: string; message: string; actionLabel?: string; onAction?: () => void };

export function EmptyState({ icon = 'cube-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  return <View style={styles.container}><View style={styles.icon}><Ionicons name={icon} size={30} color={Colors.brand.blue} /></View><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>{actionLabel && onAction ? <PressableScale style={styles.action} onPress={onAction}><Text style={styles.actionText}>{actionLabel}</Text></PressableScale> : null}</View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FC' },
  title: { color: Colors.text.primary, fontSize: FontSize.md, fontWeight: '800', textAlign: 'center' },
  message: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  action: { marginTop: Spacing.sm, borderRadius: 999, backgroundColor: Colors.brand.blue, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  actionText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '800' },
});
