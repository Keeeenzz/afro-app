import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { apiPatch } from '@/lib/api';

const ID_TYPES = [
  { label: 'Philippine National ID', value: 'national_id' },
  { label: 'Driver License', value: 'drivers_license' },
  { label: 'Passport', value: 'passport' },
  { label: 'SSS ID', value: 'sss' },
  { label: 'UMID', value: 'umid' },
  { label: 'Voter ID', value: 'voters_id' },
];

type Step = 'select' | 'upload';

export default function UploadIdPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const isLoggedIn = !!user?.user_id;

  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectError, setSelectError] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      side === 'front' ? setFrontUri(uri) : setBackUri(uri);
    }
  };

  const handleSelectContinue = () => {
    if (!selected) {
      setSelectError('Please select an ID type.');
      return;
    }
    setSelectError('');
    setDraft({ id_type: selected });
    setStep('upload');
  };

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Missing ID Type', 'Please select an ID type.');
      return;
    }

    if (!idNumber.trim()) {
      Alert.alert('Missing ID Number', 'Please enter your ID number.');
      return;
    }

    if (!frontUri || !backUri) {
      Alert.alert('Missing Photos', 'Please upload both front and back of your ID.');
      return;
    }
    setLoading(true);
    try {
      const verificationData = {
        id_type: selected,
        id_number: idNumber.trim(),
        front_id_url: frontUri,
        back_id_url: backUri,
      };

      if (isLoggedIn && user?.user_id) {
        const response = await apiPatch<{ user: any }>(
          `/auth/app/verify-id/${user.user_id}`,
          verificationData,
          token,
        );
        setUser(response.user, token ?? '');
        router.replace('/(tabs)/profile');
        return;
      }

      setDraft(verificationData);
      router.replace('/(auth)/customize-feed');
    } catch (submitError) {
      Alert.alert(
        'Error',
        submitError instanceof Error ? submitError.message : 'Failed to submit. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Select ID type ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <StepIndicator total={8} current={7} />
          <ScreenHeader
            title="Upload ID"
            subtitle="We need a valid document to confirm that you reside in Philippines."
            icon="card-outline"
          />

          <Text style={styles.sectionLabel}>Select ID Type</Text>
          <View style={styles.idList}>
            {ID_TYPES.map((id) => {
              const isSelected = selected === id.value;
              return (
                <TouchableOpacity
                  key={id.value}
                  style={[styles.idRow, isSelected && styles.idRowSelected]}
                  onPress={() => { setSelected(id.value); setSelectError(''); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.idLabel, isSelected && styles.idLabelSelected]}>
                    {id.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectError ? <Text style={styles.error}>{selectError}</Text> : null}

          <TouchableOpacity
            onPress={() => {
              if (isLoggedIn) {
                router.back();
                return;
              }
              router.push('/(auth)/customize-feed');
            }}
            style={styles.skipRow}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

          <Button label="Continue" onPress={handleSelectContinue} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 2: Upload front & back ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StepIndicator total={8} current={7} />
        <ScreenHeader
          title="Upload ID"
          subtitle="We need a valid document to confirm that you reside in Philippines and verify who you are. Data is processed securely."
          icon="shield-checkmark-outline"
        />

        <Text style={styles.termsNote}>
          By submitting your ID, you agree to our{' '}
          <Text style={styles.termsLink}>Terms</Text>.
        </Text>

        <Input
          label="ID Number"
          placeholder="Enter the number shown on your ID"
          value={idNumber}
          onChangeText={setIdNumber}
          autoCapitalize="characters"
        />

        {/* Front View */}
        <TouchableOpacity
          style={[styles.imageBox, frontUri && styles.imageBoxFilled]}
          onPress={() => pickImage('front')}
          activeOpacity={0.7}
        >
          {frontUri ? (
            <Image source={{ uri: frontUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={32} color={Colors.text.muted} />
              <Text style={styles.placeholderLabel}>Front View</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Back View */}
        <TouchableOpacity
          style={[styles.imageBox, backUri && styles.imageBoxFilled]}
          onPress={() => pickImage('back')}
          activeOpacity={0.7}
        >
          {backUri ? (
            <Image source={{ uri: backUri }} style={styles.preview} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={32} color={Colors.text.muted} />
              <Text style={styles.placeholderLabel}>Back View</Text>
            </View>
          )}
        </TouchableOpacity>

        <Button
          label="Submit"
          onPress={handleSubmit}
          loading={loading}
          disabled={!idNumber.trim() || !frontUri || !backUri}
          style={styles.btn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  idList: { gap: 10, marginBottom: Spacing.md },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  idRowSelected: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.brand.blue },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand.blue,
  },
  idLabel: { fontSize: FontSize.base, color: Colors.text.secondary },
  idLabelSelected: { color: Colors.text.primary, fontWeight: '600' },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  skipRow: { alignItems: 'center', marginBottom: Spacing.md },
  skipText: { fontSize: FontSize.sm, color: Colors.text.muted },
  // Upload step
  termsNote: {
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  termsLink: { color: Colors.text.link },
  imageBox: {
    height: 160,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border.default,
    borderStyle: 'dashed',
    backgroundColor: Colors.bg.card,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBoxFilled: {
    borderStyle: 'solid',
    borderColor: Colors.brand.blue,
  },
  placeholder: { alignItems: 'center', gap: 8 },
  placeholderLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  preview: { width: '100%', height: '100%' },
  btn: { marginTop: Spacing.sm },
});
