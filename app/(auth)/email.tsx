import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OTPInput } from '@/components/ui/OTPInput';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Spacing } from '@/constants/theme';

export default function EmailPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendOTP = async () => {
    if (!validateEmail()) return;
    setLoading(true);
    try {
      // TODO: await api.post('/auth/send-email-otp', { email });
      await new Promise((r) => setTimeout(r, 800));
      setOtpSent(true);
    } catch {
      setEmailError('Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      setOtpError('Enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      // TODO: await api.post('/auth/verify-email-otp', { email, otp });
      await new Promise((r) => setTimeout(r, 800));
      setVerified(true);
      setDraft({ email });
    } catch {
      setOtpError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepIndicator total={8} current={5} />

          <ScreenHeader
            title="Email"
            subtitle={
              !otpSent
                ? 'Enter your email address.'
                : verified
                ? 'Email verified! ✓'
                : 'Enter the verification code sent to your email.'
            }
            icon="mail-outline"
          />

          {/* Email input — locked after OTP sent */}
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            keyboardType="email-address"
            editable={!otpSent}
            rightIcon={verified ? 'checkmark-circle' : undefined}
            autoCapitalize="none"
          />

          {/* Step 1: send OTP */}
          {!otpSent && (
            <Button
              label="Continue"
              onPress={handleSendOTP}
              loading={loading}
              style={styles.btn}
            />
          )}

          {/* Step 2: enter OTP */}
          {otpSent && !verified && (
            <>
              <Text style={styles.otpLabel}>Enter verification code</Text>
              <OTPInput length={6} value={otp} onChange={setOtp} />
              {otpError ? (
                <Text style={styles.error}>{otpError}</Text>
              ) : null}
              <Button
                label="Verify Email"
                onPress={handleVerifyOTP}
                loading={loading}
                style={styles.btn}
              />
            </>
          )}

          {/* Step 3: verified — proceed */}
          {verified && (
            <Button
              label="Continue"
              onPress={() => router.push('/(auth)/password')}
              style={styles.btn}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg.primary },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  otpLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  btn: { marginTop: Spacing.md },
});