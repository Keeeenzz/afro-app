import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export function SettingsHeader({ title }: { title: string }) {
  const router = useRouter();
  return <View style={styles.header}><TouchableOpacity accessibilityLabel="Back to settings" style={styles.back} onPress={() => router.replace('/(tabs)/settings')}><Ionicons name="arrow-back" size={23} color={Colors.text.primary} /></TouchableOpacity><Text style={styles.title}>{title}</Text></View>;
}
const styles = StyleSheet.create({ header: { alignItems: 'center', flexDirection: 'row', minHeight: 58, paddingHorizontal: Spacing.md }, back: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 }, title: { color: Colors.text.primary, fontSize: FontSize.md, fontWeight: '900', marginLeft: Spacing.xs } });
