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
import { Colors, Spacing } from '@/constants/theme';
import { apiGet } from '@/lib/api';

type AddressSuggestion = { label: string; houseNo: string; street: string; barangay: string; city: string; province: string; zip: string };

const FIELD_LIMITS = {
  houseNo: { min: 1, max: 30, label: 'House number / unit' },
  street: { min: 2, max: 80, label: 'Street name' },
  barangay: { min: 2, max: 80, label: 'Barangay / municipality' },
  city: { min: 2, max: 60, label: 'City' },
  province: { min: 2, max: 60, label: 'Province' },
  zip: { min: 4, max: 4, label: 'Zip code' },
  landmark: { min: 0, max: 100, label: 'Landmark' },
};

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
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const query = street.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLookupError('');
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiGet<{ suggestions: AddressSuggestion[] }>(`/auth/address-autocomplete?text=${encodeURIComponent(query)}`)
        .then((result) => {
          setSuggestions(result.suggestions ?? []);
          setLookupError('');
        })
        .catch((error: unknown) => {
          setSuggestions([]);
          setLookupError(error instanceof Error ? error.message : 'Address suggestions are unavailable right now.');
        })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [street]);

  const validate = () => {
    const e: Record<string, string> = {};
    const values = { houseNo, street, barangay, city, province, zip, landmark };

    Object.entries(FIELD_LIMITS).forEach(([field, rule]) => {
      const value = values[field as keyof typeof values].trim();
      if (rule.min > 0 && !value) {
        e[field] = 'Required.';
      } else if (value && value.length < rule.min) {
        e[field] = `${rule.label} must be at least ${rule.min} characters.`;
      } else if (value.length > rule.max) {
        e[field] = `${rule.label} must be ${rule.max} characters or less.`;
      }
    });

    if (zip.trim() && !/^\d{4}$/.test(zip.trim())) e.zip = 'Enter a valid 4-digit zip code.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateField = (field: keyof typeof FIELD_LIMITS, value: string) => {
    const nextValue = field === 'zip'
      ? value.replace(/\D/g, '').slice(0, FIELD_LIMITS.zip.max)
      : value.slice(0, FIELD_LIMITS[field].max);

    const setters = {
      houseNo: setHouseNo,
      street: setStreet,
      barangay: setBarangay,
      city: setCity,
      province: setProvince,
      zip: setZip,
      landmark: setLandmark,
    };

    setters[field](nextValue);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleContinue = () => {
    if (!validate()) return;
    const fullAddress = [houseNo, street, barangay, city, province, zip]
      .filter(Boolean)
      .join(', ');
    setDraft({ shipping_address: fullAddress, address_house_no: houseNo, address_street: street, address_barangay: barangay, address_city: city, address_province: province, address_zip: zip });
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
            onChangeText={(value) => updateField('houseNo', value)}
            error={errors.houseNo}
            maxLength={FIELD_LIMITS.houseNo.max}
          />
          <Input
            label="Street Name"
            placeholder="e.g. Mabini Street"
            value={street}
            onChangeText={(value) => updateField('street', value)}
            error={errors.street}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.street.max}
          />
          {searching ? <Text style={styles.suggestionHint}>Finding addresses…</Text> : null}
          {lookupError ? <Text style={styles.lookupError}>{lookupError}</Text> : null}
          {suggestions.length ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`${suggestion.label}-${index}`}
                  style={styles.suggestion}
                  onPress={() => {
                    setHouseNo(suggestion.houseNo || houseNo); setStreet(suggestion.street || street);
                    setBarangay(suggestion.barangay || barangay); setCity(suggestion.city || city);
                    setProvince(suggestion.province || province); setZip((suggestion.zip || zip).slice(0, 4));
                    setSuggestions([]);
                  }}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Input
            label="Barangay / Municipality"
            placeholder="e.g. Barangay San Lorenzo"
            value={barangay}
            onChangeText={(value) => updateField('barangay', value)}
            error={errors.barangay}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.barangay.max}
          />
          <Input
            label="City"
            placeholder="e.g. Makati"
            value={city}
            onChangeText={(value) => updateField('city', value)}
            error={errors.city}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.city.max}
          />
          <Input
            label="Province"
            placeholder="e.g. Metro Manila"
            value={province}
            onChangeText={(value) => updateField('province', value)}
            error={errors.province}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.province.max}
          />
          <Input
            label="Zip Code"
            placeholder="e.g. 1215"
            value={zip}
            onChangeText={(value) => updateField('zip', value)}
            error={errors.zip}
            keyboardType="number-pad"
            maxLength={FIELD_LIMITS.zip.max}
          />
          <Input
            label="Landmark (optional)"
            placeholder="e.g. near Ayala Triangle"
            value={landmark}
            onChangeText={(value) => updateField('landmark', value)}
            autoCapitalize="sentences"
            maxLength={FIELD_LIMITS.landmark.max}
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
  suggestionHint: { color: Colors.text.secondary, fontSize: 12, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  lookupError: { color: Colors.status.error, fontSize: 12, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  suggestions: { backgroundColor: Colors.bg.card, borderColor: Colors.border.default, borderWidth: 1, borderRadius: 10, marginTop: -Spacing.sm, marginBottom: Spacing.md, overflow: 'hidden' },
  suggestion: { borderBottomColor: Colors.border.default, borderBottomWidth: 1, padding: Spacing.sm },
  suggestionText: { color: Colors.text.primary, fontSize: 13 },
});
