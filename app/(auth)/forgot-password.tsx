import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OTPInput } from '@/components/ui/OTPInput';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { apiPost } from '@/lib/api';

type ResetStep = 'email' | 'otp' | 'password';
const PASSWORD_HINT = '8–64 characters with an uppercase letter and number.';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
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

  const post = <T,>(path: string, body: unknown) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    return apiPost<T>(path, body, undefined, controller.signal).finally(() => clearTimeout(timeout));
  };
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword = password.length >= 8 && password.length <= 64 && /[A-Z]/.test(password) && /\d/.test(password);

  const sendCode = async () => {
    if (!validEmail) { setError('Enter a valid registered email address.'); return; }
    setLoading(true); setError('');
    try {
      const result = await post<{ resendAfterSeconds?: number }>('/auth/app/password-reset/send', { email: email.trim() });
      setStep('otp'); setCode(''); setResendSeconds(Number(result.resendAfterSeconds ?? 60));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send a reset code.'); }
    finally { setLoading(false); }
  };

  const verifyCode = async () => {
    if (code.length !== 6) { setError('Enter the complete 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const result = await post<{ verificationId: string }>('/auth/app/password-reset/verify', { email: email.trim(), code });
      setVerificationId(result.verificationId); setStep('password');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The code could not be verified.'); }
    finally { setLoading(false); }
  };

  const resetPassword = async () => {
    if (!validPassword) { setError(PASSWORD_HINT); return; }
    if (password !== confirmPassword) { setError('Password confirmation does not match.'); return; }
    setLoading(true); setError('');
    try {
      await post('/auth/app/password-reset/complete', { email: email.trim(), verificationId, password, confirmPassword });
      router.replace('/(auth)/login');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Password reset could not be completed.'); }
    finally { setLoading(false); }
  };

  const title = step === 'email' ? 'Forgot password?' : step === 'otp' ? 'Check your email' : 'Create a new password';
  const subtitle = step === 'email' ? 'We will email a one-time reset code.' : step === 'otp' ? `Enter the code sent to ${email.trim()}.` : 'Choose a password you have not used before.';
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><ScreenHeader title={title} subtitle={subtitle} showBack />
    {step === 'email' && <><Input label="Email Address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={error} /><Button label="Send reset code" onPress={sendCode} loading={loading} /></>}
    {step === 'otp' && <><Text style={styles.label}>Reset code</Text><OTPInput value={code} onChange={(value) => { setCode(value); setError(''); }} /><View style={styles.resend}><TouchableOpacity disabled={loading || resendSeconds > 0} onPress={sendCode}><Text style={styles.resendText}>{resendSeconds ? `Resend in ${resendSeconds}s` : 'Resend code'}</Text></TouchableOpacity></View>{error ? <Text style={styles.error}>{error}</Text> : null}<Button label="Verify code" onPress={verifyCode} loading={loading} /></>}
    {step === 'password' && <><Input label="New Password" placeholder="••••••••" value={password} onChangeText={setPassword} isPassword /><Input label="Confirm New Password" placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} isPassword error={error} /><Text style={styles.hint}>{PASSWORD_HINT}</Text><Button label="Reset password" onPress={resetPassword} loading={loading} /></>}
  </ScrollView></SafeAreaView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ flex: { flex: 1, backgroundColor: Colors.bg.primary }, safe: { flex: 1 }, scroll: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xl }, label: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.sm }, error: { color: Colors.status.error, fontSize: FontSize.sm, marginVertical: Spacing.sm }, hint: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: -Spacing.sm, marginBottom: Spacing.md }, resend: { alignItems: 'flex-end', marginVertical: Spacing.md }, resendText: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '600' } });
