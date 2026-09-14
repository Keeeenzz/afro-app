import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { SettingsHeader } from '@/components/ui/SettingsHeader';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';

const ToggleRow = ({ title, detail, value, onValueChange }: { title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) => <View style={styles.row}><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.brand.blue }} /></View>;
export default function PrivacyScreen() {
  const [recommendations, setRecommendations] = useState(true);
  const [activity, setActivity] = useState(false);
  const { t } = useTranslation();
  return <SafeAreaView style={styles.safe}><SettingsHeader title={t('Privacy Settings')} /><ScrollView><Text style={styles.heading}>{t('PERSONALIZATION')}</Text><ToggleRow title={t('Personalized recommendations')} detail={t('Use your size and style preferences')} value={recommendations} onValueChange={setRecommendations} /><ToggleRow title={t('Activity-based suggestions')} detail={t('Use items you view and save')} value={activity} onValueChange={setActivity} /></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.bg.primary }, heading: { backgroundColor: '#EAF4FF', color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm }, row: { alignItems: 'center', backgroundColor: Colors.bg.card, borderBottomColor: Colors.border.default, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 72, paddingHorizontal: Spacing.lg }, copy: { flex: 1, paddingRight: Spacing.md }, title: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '700' }, detail: { color: Colors.text.secondary, fontSize: FontSize.xs, lineHeight: 16, marginTop: 3 } });
