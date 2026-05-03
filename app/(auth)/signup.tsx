import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { KeyboardNumpad } from '@/components/auth/KeyboardNumpad';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

export default function SignupPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleKey = (key: string) => {
    if (phone.length >= 11) return;
    setPhone((p) => p + key);
    setError('');
  };

  const handleDelete = () => {
    setPhone((p) => p.slice(0, -1));
    setError('');
  };

  const formatDisplay = (raw: string) => {
    // Format: +63 9XX XXX XXXX
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  const validate = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid mobile number.');
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validate()) return;
    setDraft({ phone: phone.replace(/\D/g, '') });
    router.push('/(auth)/verify');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <StepIndicator total={8} current={0} />

        <ScreenHeader
          title="Let's get started!"
          subtitle="Enter your phone number. We'll send you a confirmation code."
          showBack={true}
        />

        {/* Phone input display */}
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.flag}>🇵🇭</Text>
            <Text style={styles.code}>+63</Text>
          </View>
          <View style={styles.phoneDisplay}>
            <Text style={[styles.phoneText, !phone && styles.phonePlaceholder]}>
              {phone ? formatDisplay(phone) : '9XX XXX XXXX'}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Continue"
          onPress={handleContinue}
          style={styles.btn}
        />

        <TouchableOpacity
          onPress={() => router.push('/(auth)/verify')}
          style={styles.loginLink}
        >
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={styles.loginHighlight}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom numpad pinned to bottom */}
      <KeyboardNumpad onPress={handleKey} onDelete={handleDelete} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  flag: { fontSize: 18 },
  code: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  phoneDisplay: {
    flex: 1,
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border.active,
    paddingHorizontal: Spacing.md,
    height: 52,
    justifyContent: 'center',
  },
  phoneText: {
    fontSize: FontSize.md,
    color: Colors.text.primary,
    fontWeight: '600',
    letterSpacing: 1,
  },
  phonePlaceholder: {
    color: Colors.text.placeholder,
    fontWeight: '400',
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  btn: { marginTop: Spacing.sm },
  loginLink: { marginTop: Spacing.lg, alignItems: 'center' },
  loginText: { fontSize: FontSize.sm, color: Colors.text.secondary },
  loginHighlight: { color: Colors.brand.blue, fontWeight: '600' },
});