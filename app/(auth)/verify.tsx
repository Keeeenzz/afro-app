import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { KeyboardNumpad } from '@/components/auth/KeyboardNumpad';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { apiPost } from '@/lib/api';

const OTP_EXPIRY = 5 * 60;

function secondsUntil(isoDate?: string) {
  if (!isoDate) return 0;
  return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 1000));
}

export default function VerifyPage() {
  const router = useRouter();
  const draft = useAuthStore((s) => s.draft);
  const setDraft = useAuthStore((s) => s.setDraft);
  const initialSecondsLeft = Number(draft.phone_otp_expires_in_seconds ?? 0) || secondsUntil(draft.phone_otp_expires_at);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => initialSecondsLeft || OTP_EXPIRY);
  const [expired, setExpired] = useState(() => !draft.phone_otp_expires_at || initialSecondsLeft === 0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(() => secondsUntil(draft.phone_otp_resend_at));

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) setExpired(true);
  }, [secondsLeft]);

  useEffect(() => {
    const timer = setInterval(() => setResendSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleKey = (key: string) => {
    if (otp.length >= 6 || expired) return;
    setOtp((o) => o + key);
    setError('');
  };

  const handleDelete = () => {
    setOtp((o) => o.slice(0, -1));
    setError('');
  };

  const handleVerify = async () => {
    if (expired) {
      setError('Code has expired. Please request a new one.');
      return;
    }
    if (otp.length < 6) {
      setError('Enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiPost<{ verificationId: string }>('/auth/sms-otp/verify', {
        verificationId: draft.phone_otp_verification_id,
        phone: draft.phone,
        code: otp,
      });
      setDraft({ phone_verification_id: result.verificationId });
      router.push('/(auth)/notifications');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || resendSecondsLeft > 0) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiPost<{
        verificationId: string;
        expiresAt: string;
        expiresInSeconds: number;
        resendAfterSeconds: number;
      }>('/auth/sms-otp/send', { phone: draft.phone });
      setDraft({
        phone_otp_verification_id: result.verificationId,
        phone_otp_expires_at: result.expiresAt,
        phone_otp_expires_in_seconds: String(result.expiresInSeconds),
        phone_otp_resend_at: new Date(Date.now() + Number(result.resendAfterSeconds ?? 60) * 1000).toISOString(),
      });
      setOtp('');
      setExpired(false);
      setSecondsLeft(Number(result.expiresInSeconds ?? OTP_EXPIRY));
      setResendSecondsLeft(Number(result.resendAfterSeconds ?? 60));
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <StepIndicator total={8} current={1} />

        <ScreenHeader
          title="6-digit code"
          subtitle={`Enter the code sent to +63 ${draft.phone ?? ''}`}
        />

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {Array.from({ length: 6 }).map((_, i) => {
            const digit = otp[i] ?? '';
            const isActive = otp.length === i && !expired;
            return (
              <View
                key={i}
                style={[
                  styles.otpBox,
                  isActive && styles.otpBoxActive,
                  digit && styles.otpBoxFilled,
                  expired && styles.otpBoxExpired,
                ]}
              >
                <Text style={styles.otpDigit}>{digit}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.codeMetaRow}>
          {!expired ? (
            <Text style={[styles.timer, secondsLeft <= 30 && styles.timerUrgent]}>
              {formatTime(secondsLeft)}
            </Text>
          ) : (
            <Text style={styles.expiredText}>Code expired</Text>
          )}
          <TouchableOpacity onPress={handleResend} disabled={loading || resendSecondsLeft > 0}>
            <Text style={styles.resendText}>
              Didn't get a code?{' '}
              <Text style={styles.resendLink}>{resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : 'Resend'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Continue"
          onPress={handleVerify}
          loading={loading}
          disabled={expired || otp.length < 6}
          style={styles.btn}
        />

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={styles.resendRow}
        >
          <Text style={styles.resendText}>
            Already have an account?{' '}
            <Text style={styles.resendLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>

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
  timer: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.brand.blue,
  },
  timerUrgent: {
    color: Colors.status.error,
  },
  expiredText: {
    fontSize: FontSize.sm,
    color: Colors.status.error,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  codeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.input,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  otpBoxFilled: {
    borderColor: Colors.brand.blueDark,
  },
  otpBoxExpired: {
    opacity: 0.4,
  },
  otpDigit: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  btn: { marginTop: Spacing.sm },
  resendRow: { marginTop: Spacing.md, alignItems: 'center' },
  resendText: { fontSize: FontSize.xs, color: Colors.text.secondary },
  resendLink: { color: Colors.brand.blue, fontWeight: '600' },
});
