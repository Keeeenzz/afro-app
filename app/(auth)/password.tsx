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
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Spacing } from '@/constants/theme';

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
];

export default function PasswordPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!rules.every((r) => r.test(password)))
      e.password = 'Password does not meet all requirements.';
    if (password !== confirm) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    setDraft({ password });
    router.push('/(auth)/upload-id');
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
          <StepIndicator total={8} current={6} />

          <ScreenHeader
            title="Password"
            subtitle="Enter your preferred password."
            icon="lock-closed-outline"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            isPassword
          />

          <Input
            label="Confirm Password"
            placeholder="••••••••"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            isPassword
          />

          {/* Password strength hints */}
          <View style={styles.rulesContainer}>
            {rules.map((rule, i) => {
              const passed = rule.test(password);
              return (
                <View key={i} style={styles.rule}>
                  <View style={[styles.ruleDot, passed && styles.ruleDotPass]} />
                  <Text style={[styles.ruleText, passed && styles.ruleTextPass]}>
                    {rule.label}
                  </Text>
                </View>
              );
            })}
          </View>

          <Button
            label="Continue"
            onPress={handleContinue}
          />
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
  rulesContainer: {
    gap: 8,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.text.muted,
  },
  ruleDotPass: { backgroundColor: Colors.status.success },
  ruleText: { fontSize: FontSize.sm, color: Colors.text.muted },
  ruleTextPass: { color: Colors.status.success },
});