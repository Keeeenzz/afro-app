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
import * as Location from 'expo-location';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StepIndicator } from '@/components/auth/StepIndicator';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, Spacing } from '@/constants/theme';
import { apiGet } from '@/lib/api';

type AddressSuggestion = { label: string; houseNo: string; street: string; barangay: string; city: string; province: string; region: string; zip: string };

const FIELD_LIMITS = {
  region: { min: 0, max: 60, label: 'Region' },
  province: { min: 2, max: 60, label: 'Province' },
  city: { min: 2, max: 60, label: 'City' },
  barangay: { min: 2, max: 80, label: 'Barangay / municipality' },
  zip: { min: 4, max: 4, label: 'Zip code' },
  street: { min: 2, max: 80, label: 'Street name' },
  houseNo: { min: 1, max: 30, label: 'House number / unit' },
  landmark: { min: 0, max: 100, label: 'Landmark' },
};

export default function AddressPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [region, setRegion] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zip, setZip] = useState('');
  const [landmark, setLandmark] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLookupError('');
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    let timedOut = false;
    const requestTimeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      setSearching(false);
      setSuggestions([]);
      setLookupError('Address lookup timed out. Check your connection and try again.');
    }, 8_000);
    const timer = setTimeout(() => {
      setSearching(true);
      apiGet<{ suggestions: AddressSuggestion[] }>(`/auth/address-autocomplete?text=${encodeURIComponent(query)}`, undefined, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSuggestions(result.suggestions ?? []);
          setLookupError('');
        })
        .catch(() => {
          if (controller.signal.aborted && !timedOut) return;
          setSuggestions([]);
          if (!timedOut) setLookupError('Suggestions unavailable');
        })
        .finally(() => {
          clearTimeout(requestTimeout);
          setSearching(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [locationQuery]);

  const validate = () => {
    const e: Record<string, string> = {};
    const values = { region, province, city, barangay, zip, street, houseNo, landmark };

    Object.entries(FIELD_LIMITS).forEach(([field, rule]) => {
      const value = values[field as keyof typeof values].trim();
      if (field === 'province' && /national capital|\bncr\b/i.test(region)) return;
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
      region: setRegion,
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
    setDraft({ shipping_address: fullAddress, address_house_no: houseNo, address_street: street, address_barangay: barangay, address_city: city, address_province: province, address_region: region, address_zip: zip });
    router.push('/(auth)/email');
  };

  const applyAddress = (address: AddressSuggestion) => {
    setRegion(address.region || region);
    setHouseNo(address.houseNo || houseNo);
    setStreet(address.street || street);
    setBarangay(address.barangay || barangay);
    setCity(address.city || city);
    setProvince(address.province || province);
    setZip((address.zip || zip).replace(/\D/g, '').slice(0, 4));
  };

  const handleUseExactLocation = async () => {
    setLookupError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLookupError('Location permission is needed to use your exact location.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await apiGet<{ address: AddressSuggestion }>(
        `/auth/address-reverse-geocode?lat=${encodeURIComponent(String(current.coords.latitude))}&lon=${encodeURIComponent(String(current.coords.longitude))}`,
      );
      applyAddress(result.address);
      setLocationQuery(result.address.label || 'Current location');
      setSuggestions([]);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Your location is unavailable. Please enter your address manually.');
    } finally {
      setLocating(false);
    }
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
            label="Find your area"
            placeholder="Search region, province, city, or barangay"
            value={locationQuery}
            onChangeText={setLocationQuery}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleUseExactLocation}
            disabled={locating}
          >
            <Text style={styles.locationButtonText}>{locating ? 'Finding your location…' : 'Use Your Exact Location'}</Text>
          </TouchableOpacity>
          {searching ? <Text style={styles.suggestionHint}>Finding addresses…</Text> : null}
          {lookupError ? <Text style={styles.lookupError}>{lookupError}</Text> : null}
          {suggestions.length ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`${suggestion.label}-${index}`}
                  style={styles.suggestion}
                  onPress={() => {
                    applyAddress(suggestion); setLocationQuery(suggestion.label);
                    setSuggestions([]);
                  }}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Input
            label="Region"
            placeholder="e.g. NCR"
            value={region}
            onChangeText={(value) => updateField('region', value)}
            error={errors.region}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.region.max}
          />
          <Input
            label="Province"
            placeholder={/national capital|\bncr\b/i.test(region) ? 'Not applicable for NCR' : 'e.g. Cavite'}
            value={province}
            onChangeText={(value) => updateField('province', value)}
            error={errors.province}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.province.max}
          />
          <Input
            label="City"
            placeholder="e.g. Manila"
            value={city}
            onChangeText={(value) => updateField('city', value)}
            error={errors.city}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.city.max}
          />
          <Input
            label="Barangay / Municipality"
            placeholder="e.g. Barangay 197"
            value={barangay}
            onChangeText={(value) => updateField('barangay', value)}
            error={errors.barangay}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.barangay.max}
          />
          <Input
            label="Zip Code"
            placeholder="e.g. 1012"
            value={zip}
            onChangeText={(value) => updateField('zip', value)}
            error={errors.zip}
            keyboardType="number-pad"
            maxLength={FIELD_LIMITS.zip.max}
          />
          <Input
            label="Street Name"
            placeholder="e.g. Tabora Street"
            value={street}
            onChangeText={(value) => updateField('street', value)}
            error={errors.street}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.street.max}
          />
          <Input
            label="House Number / Unit"
            placeholder="e.g. Unit 2B or 1152"
            value={houseNo}
            onChangeText={(value) => updateField('houseNo', value)}
            error={errors.houseNo}
            autoCapitalize="words"
            maxLength={FIELD_LIMITS.houseNo.max}
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
  locationButton: { alignItems: 'center', borderColor: Colors.brand.blue, borderRadius: 10, borderWidth: 1, marginTop: -Spacing.xs, marginBottom: Spacing.md, padding: Spacing.sm },
  locationButtonText: { color: Colors.brand.blue, fontSize: 14, fontWeight: '600' },
  suggestionHint: { color: Colors.text.secondary, fontSize: 12, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  lookupError: { color: Colors.status.error, fontSize: 12, marginTop: -Spacing.sm, marginBottom: Spacing.sm },
  suggestions: { backgroundColor: Colors.bg.card, borderColor: Colors.border.default, borderWidth: 1, borderRadius: 10, marginTop: -Spacing.sm, marginBottom: Spacing.md, overflow: 'hidden' },
  suggestion: { borderBottomColor: Colors.border.default, borderBottomWidth: 1, padding: Spacing.sm },
  suggestionText: { color: Colors.text.primary, fontSize: 13 },
});
