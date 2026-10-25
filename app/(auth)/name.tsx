import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useAuthStore } from '@/hooks/useAuthStore';
import { apiGet } from '@/lib/api';
import { Colors, Spacing } from '@/constants/theme';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 40;
const NAME_PATTERN = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
type Gender = { id: number | string; label?: string; name?: string };
type Audience = { id: number; label: string };

export default function NamePage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);
  const draft = useAuthStore((s) => s.draft);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [genders, setGenders] = useState<Gender[]>([]);
  const [gender, setGender] = useState(draft.gender ?? '');
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audienceIds, setAudienceIds] = useState<number[]>(draft.audienceIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<{ genders?: Gender[]; styleAudiences?: Audience[] }>('/products/meta/lookups')
      .then((result) => { setGenders(result.genders ?? []); setAudiences(result.styleAudiences ?? []); })
      .catch(() => setErrors((current) => ({ ...current, gender: 'Gender options could not load. Please try again.' })));
  }, []);

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
    if (!gender) e.gender = 'Select your gender.';
    if (!audienceIds.length) e.audience = 'Select at least one shopping preference.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateField = (field: 'firstName' | 'lastName', value: string) => {
    const nextValue = value.slice(0, NAME_MAX_LENGTH);
    if (field === 'firstName') setFirstName(nextValue);
    if (field === 'lastName') setLastName(nextValue);
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
      gender,
      audienceIds,
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

          <Text style={styles.genderLabel}>Gender</Text>
          <View style={styles.genderOptions}>
            {genders.map((item) => {
              const label = item.label ?? item.name ?? String(item.id);
              const selected = gender === label;
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={[styles.genderOption, selected && styles.genderOptionSelected]}
                  onPress={() => {
                    setGender(label);
                    setErrors((current) => ({ ...current, gender: '' }));
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.genderOptionText, selected && styles.genderOptionTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.gender ? <Text style={styles.genderError}>{errors.gender}</Text> : null}

          <Text style={styles.genderLabel}>Shopping preferences</Text>
          <Text style={styles.preferenceHint}>Choose one or more. We’ll prioritize these products in your catalog.</Text>
          <View style={styles.genderOptions}>
            {audiences.map((item) => {
              const selected = audienceIds.includes(item.id);
              return <TouchableOpacity key={item.id} style={[styles.genderOption, selected && styles.genderOptionSelected]} onPress={() => { setAudienceIds((current) => selected ? current.filter((id) => id !== item.id) : [...current, item.id]); setErrors((current) => ({ ...current, audience: '' })); }} activeOpacity={0.75}><Text style={[styles.genderOptionText, selected && styles.genderOptionTextSelected]}>{item.label}</Text></TouchableOpacity>;
            })}
          </View>
          {errors.audience ? <Text style={styles.genderError}>{errors.audience}</Text> : null}

          <Input
            label="Last Name"
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={(value) => updateField('lastName', value)}
            error={errors.lastName}
            autoCapitalize="words"
            maxLength={NAME_MAX_LENGTH}
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
  genderLabel: { color: Colors.text.primary, fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  genderOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: 22, borderWidth: 1, borderColor: Colors.border.default, backgroundColor: Colors.bg.input },
  genderOptionSelected: { backgroundColor: Colors.brand.blue, borderColor: Colors.brand.blue },
  genderOptionText: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
  genderOptionTextSelected: { color: Colors.white },
  genderError: { color: Colors.status.error, fontSize: 12, marginBottom: Spacing.sm },
  preferenceHint: { color: Colors.text.secondary, fontSize: 12, marginTop: -Spacing.xs, marginBottom: Spacing.sm },
});
