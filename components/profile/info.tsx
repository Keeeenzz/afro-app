import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiPatch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

function splitAddressParts(address?: string | null) {
  const parts = (address ?? '').split(',').map((part) => part.trim());
  return {
    houseNo: parts[0] ?? '',
    street: parts[1] ?? '',
    barangay: parts[2] ?? '',
    city: parts[3] ?? '',
    province: parts[4] ?? '',
    zip: parts[5] ?? '',
  };
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={19} color={Colors.brand.blue} /></View>
      <View style={styles.infoCopy}><Text style={styles.infoRowLabel}>{label}</Text><Text style={styles.infoRowValue}>{value ?? '-'}</Text></View>
    </View>
  );
}

export function InfoTab() {
  const { user, token, logout, setUser } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const fallbackAddress = splitAddressParts(user?.shipping_address);
  const [houseNo, setHouseNo] = useState(user?.address_house_no ?? fallbackAddress.houseNo);
  const [street, setStreet] = useState(user?.address_street ?? fallbackAddress.street);
  const [barangay, setBarangay] = useState(user?.address_barangay ?? fallbackAddress.barangay);
  const [city, setCity] = useState(user?.address_city ?? fallbackAddress.city);
  const [province, setProvince] = useState(user?.address_province ?? fallbackAddress.province);
  const [zip, setZip] = useState(user?.address_zip ?? fallbackAddress.zip);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setGender(user?.gender ?? '');
    const nextFallback = splitAddressParts(user?.shipping_address);
    setHouseNo(user?.address_house_no ?? nextFallback.houseNo);
    setStreet(user?.address_street ?? nextFallback.street);
    setBarangay(user?.address_barangay ?? nextFallback.barangay);
    setCity(user?.address_city ?? nextFallback.city);
    setProvince(user?.address_province ?? nextFallback.province);
    setZip(user?.address_zip ?? nextFallback.zip);
  }, [
    user?.address_barangay,
    user?.address_city,
    user?.address_house_no,
    user?.address_province,
    user?.address_street,
    user?.address_zip,
    user?.email,
    user?.full_name,
    user?.gender,
    user?.phone,
    user?.shipping_address,
  ]);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)');
  };

  const handleSave = async () => {
    if (!user?.user_id) return;

    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.');
      return;
    }

    setError('');
    setLoading(true);
    const shippingAddress = [houseNo, street, barangay, city, province, zip]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');

    const payload = {
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      gender,
      shipping_address: shippingAddress.trim() || null,
      address_house_no: houseNo.trim() || null,
      address_street: street.trim() || null,
      address_barangay: barangay.trim() || null,
      address_city: city.trim() || null,
      address_province: province.trim() || null,
      address_zip: zip.trim() || null,
    };

    if (!payload.gender) {
      setError('Choose a gender before saving.');
      setLoading(false);
      return;
    }

    if (__DEV__) console.info('[Profile] account update payload', { gender: payload.gender });

    try {
      const response = await apiPatch<{ user: any }>(
        `/auth/app/account/${user.user_id}`,
        payload,
        token,
      );
      if (String(response.user?.gender ?? '').trim().toLowerCase() !== payload.gender.toLowerCase()) {
        throw new Error('Your gender was not saved. Please try again after the server is updated.');
      }
      setUser(response.user, token ?? '');
      setIsEditing(false);
      showToast('Profile updated', 'success');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFullName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
    setPhone(user?.phone ?? '');
    setGender(user?.gender ?? '');
    const nextFallback = splitAddressParts(user?.shipping_address);
    setHouseNo(user?.address_house_no ?? nextFallback.houseNo);
    setStreet(user?.address_street ?? nextFallback.street);
    setBarangay(user?.address_barangay ?? nextFallback.barangay);
    setCity(user?.address_city ?? nextFallback.city);
    setProvince(user?.address_province ?? nextFallback.province);
    setZip(user?.address_zip ?? nextFallback.zip);
    setError('');
    setIsEditing(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Personal Info</Text>

      {isEditing ? (
        <View style={styles.editCard}>
          <Input
            label="Full Name"
            value={fullName}
            onChangeText={(value) => {
              setFullName(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError('');
            }}
            keyboardType="email-address"
          />
          <Input
            label="Phone"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setError('');
            }}
            keyboardType="phone-pad"
          />
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.genderOptions}>
            {GENDER_OPTIONS.map((option) => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ selected: gender === option }} style={[styles.genderOption, gender === option && styles.genderOptionSelected]} onPress={() => { setGender(option); setError(''); }}><Text style={[styles.genderOptionText, gender === option && styles.genderOptionTextSelected]}>{option}</Text></TouchableOpacity>)}
          </View>
          <Input label="Province" value={province} onChangeText={(value) => { setProvince(value); setError(''); }} autoCapitalize="words" />
          <Input label="City" value={city} onChangeText={(value) => { setCity(value); setError(''); }} autoCapitalize="words" />
          <Input label="Barangay / Municipality" value={barangay} onChangeText={(value) => { setBarangay(value); setError(''); }} autoCapitalize="words" />
          <Input label="Zip Code" value={zip} onChangeText={(value) => { setZip(value); setError(''); }} keyboardType="number-pad" />
          <Input label="Street Name" value={street} onChangeText={(value) => { setStreet(value); setError(''); }} autoCapitalize="words" />
          <Input label="House Number / Unit" value={houseNo} onChangeText={(value) => { setHouseNo(value); setError(''); }} autoCapitalize="words" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.editActions}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={handleCancel}
              style={styles.actionButton}
            />
            <Button
              label="Save"
              onPress={handleSave}
              loading={loading}
              style={styles.actionButton}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <InfoRow icon="person-outline" label="Full name" value={user?.full_name} />
            <InfoRow icon="mail-outline" label="Email" value={user?.email} />
            <InfoRow
              icon="call-outline"
              label="Phone"
              value={user?.phone ? `+63 ${user.phone}` : '-'}
            />
            <InfoRow icon="transgender-outline" label="Gender" value={user?.gender ?? undefined} />
            <InfoRow icon="location-outline" label="Delivery address" value={user?.shipping_address ?? undefined} last />
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={17} color={Colors.text.primary} /><Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={Colors.status.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  infoCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.white,
    overflow: 'hidden',
  },
  editCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  infoIcon: { alignItems: 'center', backgroundColor: '#E7EEF7', borderRadius: 16, height: 46, justifyContent: 'center', width: 46 },
  infoCopy: { flex: 1 },
  infoRowLabel: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '800' },
  infoRowValue: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '800', marginTop: 2 },
  fieldLabel: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '700', marginBottom: Spacing.xs },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  genderOption: { borderColor: Colors.border.default, borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 9 },
  genderOptionSelected: { backgroundColor: Colors.bg.inputFocused, borderColor: Colors.brand.blue },
  genderOptionText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '700' },
  genderOptionTextSelected: { color: Colors.brand.blue, fontWeight: '800' },
  editBtn: {
    marginTop: Spacing.md,
    alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#E7EEF7', borderRadius: Radius.full, flexDirection: 'row', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  editBtnText: {
    color: Colors.text.primary,
    fontWeight: '700',
    fontSize: FontSize.base,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: 12,
  },
  logoutText: {
    color: Colors.status.error,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
});
