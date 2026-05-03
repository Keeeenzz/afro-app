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

const OTP_EXPIRY = 4 * 60 + 14; // 4:14 in seconds

export default function VerifyPage() {
  const router = useRouter();
  const draft = useAuthStore((s) => s.draft);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY);
  const [expired, setExpired] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      setExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

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
      // Simulated verification — accepts any 6-digit code
      await new Promise((r) => setTimeout(r, 800));
      router.push('/(auth)/notifications');
    } catch {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setOtp('');
    setError('');
    setExpired(false);
    setSecondsLeft(OTP_EXPIRY);
    // TODO: call API to resend OTP
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <StepIndicator total={8} current={1} />

        <ScreenHeader
          title="6-digit code"
          subtitle={`Enter the code sent to +63 ${draft.phone ?? ''}${expired ? '' : `. This expires in`}`}
        />

        {/* Timer */}
        {!expired ? (
          <Text style={[styles.timer, secondsLeft <= 30 && styles.timerUrgent]}>
            {formatTime(secondsLeft)}
          </Text>
        ) : (
          <Text style={styles.expiredText}>Code expired</Text>
        )}

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Continue"
          onPress={handleVerify}
          loading={loading}
          disabled={expired || otp.length < 6}
          style={styles.btn}
        />

        {/* Resend */}
        <TouchableOpacity onPress={handleResend} style={styles.resendRow}>
          <Text style={styles.resendText}>
            Didn't get a code?{' '}
            <Text style={styles.resendLink}>Resend</Text>
          </Text>
        </TouchableOpacity>

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
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.brand.blue,
    marginBottom: Spacing.md,
  },
  timerUrgent: {
    color: Colors.status.error,
  },
  expiredText: {
    fontSize: FontSize.sm,
    color: Colors.status.error,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
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
  resendText: { fontSize: FontSize.sm, color: Colors.text.secondary },
  resendLink: { color: Colors.brand.blue, fontWeight: '600' },
});