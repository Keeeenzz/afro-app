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

export default function AddressPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zip, setZip] = useState('');
  const [landmark, setLandmark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!houseNo.trim()) e.houseNo = 'Required.';
    if (!street.trim()) e.street = 'Required.';
    if (!barangay.trim()) e.barangay = 'Required.';
    if (!city.trim()) e.city = 'Required.';
    if (!province.trim()) e.province = 'Required.';
    if (!zip.trim()) e.zip = 'Required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    const fullAddress = [houseNo, street, barangay, city, province, zip]
      .filter(Boolean)
      .join(', ');
    setDraft({ shipping_address: fullAddress });
    router.push('/(auth)/email');
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
          <StepIndicator total={8} current={4} />

          <ScreenHeader
            title="Home Address"
            subtitle="Please enter your home address exactly as it appears on your shipping details."
            icon="home-outline"
          />

          <Input
            label="House Number / Unit"
            placeholder="e.g. Unit 2B or 112"
            value={houseNo}
            onChangeText={setHouseNo}
            error={errors.houseNo}
          />
          <Input
            label="Street Name"
            placeholder="e.g. Mabini Street"
            value={street}
            onChangeText={setStreet}
            error={errors.street}
            autoCapitalize="words"
          />
          <Input
            label="Barangay / Municipality"
            placeholder="e.g. Barangay San Lorenzo"
            value={barangay}
            onChangeText={setBarangay}
            error={errors.barangay}
            autoCapitalize="words"
          />
          <Input
            label="City"
            placeholder="e.g. Makati"
            value={city}
            onChangeText={setCity}
            error={errors.city}
            autoCapitalize="words"
          />
          <Input
            label="Province"
            placeholder="e.g. Metro Manila"
            value={province}
            onChangeText={setProvince}
            error={errors.province}
            autoCapitalize="words"
          />
          <Input
            label="Zip Code"
            placeholder="e.g. 1215"
            value={zip}
            onChangeText={setZip}
            error={errors.zip}
            keyboardType="number-pad"
          />
          <Input
            label="Landmark (optional)"
            placeholder="e.g. near Ayala Triangle"
            value={landmark}
            onChangeText={setLandmark}
            autoCapitalize="sentences"
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