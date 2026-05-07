import React, { useState } from 'react';
import {
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
import { Colors, Spacing } from '@/constants/theme';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;
const ALIAS_MAX_LENGTH = 40;
const NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

export default function NamePage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [alias, setAlias] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateName = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) return `${label} is required.`;
    if (trimmed.length < NAME_MIN_LENGTH) return `${label} must be at least ${NAME_MIN_LENGTH} characters.`;
    if (trimmed.length > NAME_MAX_LENGTH) return `${label} must be ${NAME_MAX_LENGTH} characters or less.`;
    if (!NAME_PATTERN.test(trimmed)) return `${label} can only contain letters.`;
    return '';
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const firstNameError = validateName(firstName, 'First name');
    const lastNameError = validateName(lastName, 'Last name');
    if (firstNameError) e.firstName = firstNameError;
    if (lastNameError) e.lastName = lastNameError;
    if (alias.trim().length > ALIAS_MAX_LENGTH) e.alias = `Alias must be ${ALIAS_MAX_LENGTH} characters or less.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateField = (field: 'firstName' | 'lastName' | 'alias', value: string) => {
    const nextValue = field === 'alias' ? value.slice(0, ALIAS_MAX_LENGTH) : value.slice(0, NAME_MAX_LENGTH);
    if (field === 'firstName') setFirstName(nextValue);
    if (field === 'lastName') setLastName(nextValue);
    if (field === 'alias') setAlias(nextValue);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleContinue = () => {
    if (!validate()) return;
    setDraft({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      alias: alias.trim(),
    });
    router.push('/(auth)/address');
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
          <StepIndicator total={8} current={3} />

          <ScreenHeader
            title="Name as in ID"
            subtitle="Name as in your official documents."
            icon="card-outline"
          />

          <Input
            label="First Name"
            placeholder="Enter your first name"
            value={firstName}
            onChangeText={(value) => updateField('firstName', value)}
            error={errors.firstName}
            autoCapitalize="words"
            maxLength={NAME_MAX_LENGTH}
          />

          <Input
            label="Last Name"
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={(value) => updateField('lastName', value)}
            error={errors.lastName}
            autoCapitalize="words"
            maxLength={NAME_MAX_LENGTH}
          />

          <Input
            label="Alias (optional)"
            placeholder="Nickname or preferred name"
            value={alias}
            onChangeText={(value) => updateField('alias', value)}
            error={errors.alias}
            autoCapitalize="words"
            maxLength={ALIAS_MAX_LENGTH}
          />

          <Button
            label="Continue"
            onPress={handleContinue}
            style={styles.btn}
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
  btn: { marginTop: Spacing.sm },
});
