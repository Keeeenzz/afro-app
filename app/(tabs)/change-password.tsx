import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OTPInput } from '@/components/ui/OTPInput';
import { SettingsHeader } from '@/components/ui/SettingsHeader';
import { useAuthStore } from '@/hooks/useAuthStore';
import { apiPost } from '@/lib/api';
import { Colors, FontSize, Spacing } from '@/constants/theme';

type ChangePasswordStep = 'init' | 'otp' | 'password';
const PASSWORD_HINT = 'Password must be 8 to 64 characters and include an uppercase letter and number.';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { token, logout } = useAuthStore();
  const [step, setStep] = useState<ChangePasswordStep>('init');
  const [code, setCode] = useState('');
  const [resetSessionId, setResetSessionId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (!resendSeconds) return;
    const timer = setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const post = <T,>(path: string, body?: unknown) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    return apiPost<T>(path, body, token, controller.signal).finally(() => clearTimeout(timeout));
  };

  const validPassword = password.length >= 8 && password.length <= 64 && /[A-Z]/.test(password) && /\d/.test(password);

  const requestOtp = async () => {
    setLoading(true); setError('');
    try {
      const result = await post<{ resendAfterSeconds?: number }>('/auth/app/password/change/send');
      setStep('otp'); setCode(''); setResendSeconds(Number(result.resendAfterSeconds ?? 60));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send OTP.'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) { setError('Enter the complete 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const result = await post<{ resetSessionId: string }>('/auth/app/password/change/verify', { code });
      setResetSessionId(result.resetSessionId); setStep('password');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The code could not be verified.'); }
    finally { setLoading(false); }
  };

  const changePassword = async () => {
    if (!validPassword) { setError(PASSWORD_HINT); return; }
    if (password !== confirmPassword) { setError('Password confirmation does not match.'); return; }
    setLoading(true); setError('');
    try {
      await post('/auth/app/password/change', { resetSessionId, password, confirmPassword });
      logout();
      Alert.alert('Password changed', 'Please sign in with your new password.', [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to change password.'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safe}>
        <SettingsHeader title="Change Password" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'init' && (
            <>
              <Text style={styles.copy}>For your security, we need to verify your identity before you can change your password. An OTP will be sent to your registered email address.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Request OTP" onPress={requestOtp} loading={loading} />
            </>
          )}
          {step === 'otp' && (
            <>
              <Text style={styles.label}>Reset code</Text>
              <OTPInput value={code} onChange={(value) => { setCode(value); setError(''); }} />
              <View style={styles.resend}>
                <TouchableOpacity disabled={loading || resendSeconds > 0} onPress={requestOtp}>
                  <Text style={styles.resendText}>{resendSeconds ? `Resend in ${resendSeconds}s` : 'Resend code'}</Text>
                </TouchableOpacity>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Verify code" onPress={verifyOtp} loading={loading} />
            </>
          )}
          {step === 'password' && (
            <>
              <Input label="New Password" value={password} onChangeText={setPassword} isPassword />
              <Input label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} isPassword error={error} />
              <Text style={styles.hint}>{PASSWORD_HINT}</Text>
              <Button label="Change Password" onPress={changePassword} loading={loading} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg.primary },
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: Spacing.lg },
  copy: { color: Colors.text.secondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },
  label: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.sm },
  error: { color: Colors.status.error, fontSize: FontSize.sm, marginVertical: Spacing.sm },
  hint: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: -Spacing.sm, marginBottom: Spacing.md },
  resend: { alignItems: 'flex-end', marginVertical: Spacing.md },
  resendText: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '600' }
});
