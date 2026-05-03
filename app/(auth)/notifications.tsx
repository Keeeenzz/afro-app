import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function NotificationsPage() {
  const router = useRouter();

  const handleEnable = () => {
    // TODO: await Notifications.requestPermissionsAsync();
    router.push('/(auth)/name');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <StepIndicator total={8} current={2} />

        {/* Phone illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.phoneOuter}>
            <View style={styles.phoneInner}>
              <View style={styles.notifCard}>
                <View style={styles.notifIcon} />
                <View style={styles.notifTextBlock}>
                  <View style={styles.notifLine} />
                  <View style={[styles.notifLine, { width: '60%' }]} />
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.title}>Don't miss a beat</Text>
        <Text style={styles.subtitle}>
          Enable push notifications to get updates on your orders, messages,
          and drops you'll love.
        </Text>

        <View style={styles.actions}>
          <Button
            label="Enable Push Notification"
            onPress={handleEnable}
          />
          <Button
            label="Not now"
            onPress={() => router.push('/(auth)/name')}
            variant="ghost"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneOuter: {
    width: 140,
    height: 220,
    borderRadius: 28,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.border.active,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  phoneInner: {
    width: 110,
    alignItems: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    width: '100%',
  },
  notifIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.blue,
  },
  notifTextBlock: { flex: 1, gap: 5 },
  notifLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border.subtle,
    width: '100%',
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  actions: { gap: 10 },
});