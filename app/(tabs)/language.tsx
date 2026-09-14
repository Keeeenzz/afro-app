import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';
import { SettingsHeader } from '@/components/ui/SettingsHeader';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';

const languages = [{ name: 'English', native: 'English' }, { name: 'Filipino', native: 'Tagalog' }, { name: 'Spanish', native: 'Español' }, { name: 'Japanese', native: '日本語' }, { name: 'Korean', native: '한국어' }, { name: 'Chinese (Simplified)', native: '简体中文' }];
export default function LanguageScreen() {
  const selected = useAuthStore((state) => state.language); const setSelected = useAuthStore((state) => state.setLanguage); const [query, setQuery] = useState('');
  const visible = useMemo(() => languages.filter((item) => `${item.name} ${item.native}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <SafeAreaView style={styles.safe}><SettingsHeader title="Language" /><TextInput style={styles.search} placeholder="Search language" placeholderTextColor={Colors.text.placeholder} value={query} onChangeText={setQuery} /><ScrollView>{visible.map((language) => <TouchableOpacity key={language.name} style={styles.row} onPress={() => { if (language.name === 'English' || language.name === 'Filipino') setSelected(language.name); }}><View><Text style={styles.name}>{language.name}</Text><Text style={styles.native}>{language.native}</Text></View><Ionicons name={selected === language.name ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={Colors.brand.blue} /></TouchableOpacity>)}</ScrollView><Text style={styles.note}>English and Filipino are available throughout the app. Other languages are listed for future support.</Text></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.bg.primary }, search: { backgroundColor: Colors.bg.card, borderColor: Colors.border.default, borderRadius: Radius.md, borderWidth: 1, color: Colors.text.primary, fontSize: FontSize.sm, margin: Spacing.md, paddingHorizontal: Spacing.md, height: 44 }, row: { alignItems: 'center', backgroundColor: Colors.bg.card, borderBottomColor: Colors.border.default, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: Spacing.lg }, name: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '700' }, native: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 3 }, note: { color: Colors.text.secondary, fontSize: FontSize.xs, lineHeight: 17, padding: Spacing.lg, textAlign: 'center' } });
