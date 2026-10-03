import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { DeactivateAccountModal } from '@/components/ui/DeactivateAccountModal';
import { useTranslation } from '@/lib/i18n';
import { useNav } from '@/context/NavContext';
import { apiGet, apiPatch } from '@/lib/api';
import { getNotificationsModule, isExpoGoRuntime } from '@/lib/notificationRuntime';

const Notifications = getNotificationsModule();

function SettingsRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={21} color={Colors.text.muted} />
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { openNav } = useNav();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const unavailable = (feature: string) => Alert.alert('Coming soon', `${feature} is not available yet.`);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const language = useAuthStore((state) => state.language);
  const { user, token } = useAuthStore();
  const { t } = useTranslation();
  useEffect(() => {
    if (!Notifications) return;
    void Notifications.getPermissionsAsync().then(({ status }) => setPushEnabled(status === 'granted'));
  }, []);
  useEffect(() => {
    if (!user?.user_id) return;
    apiGet<{ emailNotificationsEnabled: boolean; smsNotificationsEnabled: boolean }>(`/notifications/users/${user.user_id}/preferences`, token)
      .then((preferences) => { setEmailNotificationsEnabled(preferences.emailNotificationsEnabled); setSmsNotificationsEnabled(preferences.smsNotificationsEnabled); })
      .catch(() => undefined);
  }, [token, user?.user_id]);
  const setOrderConfirmationChannel = async (channel: 'email' | 'sms') => {
    if (!user?.user_id) return;
    if (channel === 'sms' && !/^9\d{9}$/.test((user.phone ?? '').trim())) {
      Alert.alert('Mobile number required', 'Add a valid Philippine mobile number in your profile before choosing SMS.');
      return;
    }
    const previous = { emailNotificationsEnabled, smsNotificationsEnabled };
    setEmailNotificationsEnabled(channel === 'email');
    setSmsNotificationsEnabled(channel === 'sms');
    try {
      const preferences = await apiPatch<{ emailNotificationsEnabled: boolean; smsNotificationsEnabled: boolean }>(`/notifications/users/${user.user_id}/preferences`, { emailNotificationsEnabled: channel === 'email', smsNotificationsEnabled: channel === 'sms' }, token);
      setEmailNotificationsEnabled(preferences.emailNotificationsEnabled); setSmsNotificationsEnabled(preferences.smsNotificationsEnabled);
    } catch (error) {
      setEmailNotificationsEnabled(previous.emailNotificationsEnabled); setSmsNotificationsEnabled(previous.smsNotificationsEnabled);
      Alert.alert('Could not save preference', error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const setPushNotifications = async (enabled: boolean) => {
    if (!enabled) { setPushEnabled(false); Alert.alert('Push notifications paused', 'You can turn them back on from this setting or your device settings.'); return; }
    if (!Notifications) {
      Alert.alert(
        'Development build required',
        isExpoGoRuntime()
          ? 'Push notifications are unavailable in Expo Go. Use a development or production build to enable them.'
          : 'Push notifications are unavailable on this device right now. Please try again later.',
      );
      return;
    }
    const permission = await Notifications.requestPermissionsAsync();
    setPushEnabled(permission.status === 'granted');
    if (permission.status !== 'granted') Alert.alert('Permission needed', 'Enable notifications in device settings to receive order and support updates.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><TouchableOpacity style={styles.brandLockup} onPress={() => router.replace('/(tabs)/catalog')} accessibilityRole="button" accessibilityLabel="Go to catalog"><Image source={require('@/assets/afro-logo-black.png')} style={styles.logo} resizeMode="contain" /><Text style={styles.brand}>A'FRO</Text></TouchableOpacity><TouchableOpacity style={styles.menuButton} onPress={openNav}><Ionicons name="menu-outline" size={28} color={Colors.brand.blue} /></TouchableOpacity></View>
      <Text style={styles.pageTitle}>{t('Settings')}</Text>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title={t('My Account')}>
          <SettingsRow label={t('Account & Security')} detail={t('Update your email, phone, and profile details')} onPress={() => router.push({ pathname: '/(tabs)/profile', params: { fromSettings: 'account' } })} />
          <SettingsRow label={t('My Addresses')} detail={t('Manage your saved delivery address')} onPress={() => router.push({ pathname: '/(tabs)/profile', params: { fromSettings: 'addresses' } })} />
        </Section>
        <Section title={t('Settings')}>
          <View style={[styles.row, styles.switchRow]}><View style={styles.rowCopy}><Text style={styles.rowLabel}>{t('Push Notifications')}</Text><Text style={styles.rowDetail}>{t('Order and support updates')}</Text></View><Switch style={styles.switch} value={pushEnabled} onValueChange={setPushNotifications} trackColor={{ true: Colors.brand.blue }} /></View>
          <SettingsRow label={t('Privacy Settings')} onPress={() => router.push('/(tabs)/privacy')} />
          <SettingsRow label={t('Language')} detail={language} onPress={() => router.push('/(tabs)/language')} />
        </Section>
        <Section title="Notifications">
          <Text style={styles.preferenceTitle}>Order Confirmation</Text>
          <TouchableOpacity style={[styles.row, styles.channelRow]} onPress={() => void setOrderConfirmationChannel('email')}><View style={styles.rowCopy}><Text style={styles.rowLabel}>Email</Text><Text style={styles.rowDetail}>Send the payment confirmation to your email</Text></View><Ionicons name={emailNotificationsEnabled ? 'radio-button-on' : 'radio-button-off'} size={22} color={Colors.brand.blue} /></TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.channelRow]} onPress={() => void setOrderConfirmationChannel('sms')}><View style={styles.rowCopy}><Text style={styles.rowLabel}>SMS</Text><Text style={styles.rowDetail}>Requires a valid Philippine mobile number</Text></View><Ionicons name={smsNotificationsEnabled ? 'radio-button-on' : 'radio-button-off'} size={22} color={Colors.brand.blue} /></TouchableOpacity>
        </Section>
        <Section title={t('Support')}>
          <SettingsRow label={t('Help & Support')} onPress={() => router.push('/(tabs)/help')} />
          <SettingsRow label="Terms and Conditions" onPress={() => router.push('/(auth)/terms')} />
          <SettingsRow label={t('About')} detail={`A'FRO version ${version}`} onPress={() => router.push('/(tabs)/about')} />
          <SettingsRow label={t('Request Account Deletion')} detail={t('Deactivate now; permanent removal after 30 days')} onPress={() => setDeletionOpen(true)} />
        </Section>
      </ScrollView>
      <DeactivateAccountModal visible={deletionOpen} onClose={() => setDeletionOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  header: { alignItems: 'center', flexDirection: 'row', height: 70, justifyContent: 'space-between', paddingHorizontal: Spacing.md },
  brandLockup: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm }, logo: { height: 28, width: 28 }, brand: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' }, menuButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 }, pageTitle: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  content: { paddingVertical: Spacing.md, paddingBottom: Spacing['2xl'] },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '700', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  sectionCard: { backgroundColor: Colors.bg.card, borderBottomWidth: 1, borderTopWidth: 1, borderColor: Colors.border.default },
  preferenceTitle: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '700', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  row: { alignItems: 'center', borderBottomColor: Colors.border.default, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 62, paddingHorizontal: Spacing.lg },
  switchRow: { paddingRight: Spacing.md },
  channelRow: { paddingRight: Spacing.lg },
  switch: { alignSelf: 'center', marginVertical: 0 },
  rowCopy: { flex: 1, paddingVertical: Spacing.sm },
  rowLabel: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '600' },
  rowDetail: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 3 },
});
