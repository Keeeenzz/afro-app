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
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Ionicons name={icon} size={18} color={Colors.brand.blue} />
      <Text style={styles.infoRowLabel}>{label}</Text>
    </View>
  );
}

export function InfoTab() {
  const { user, token, logout, setUser } = useAuthStore();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
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

    try {
      const response = await apiPatch<{ user: any }>(
        `/auth/app/account/${user.user_id}`,
        {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          shipping_address: shippingAddress.trim() || null,
          address_house_no: houseNo.trim() || null,
          address_street: street.trim() || null,
          address_barangay: barangay.trim() || null,
          address_city: city.trim() || null,
          address_province: province.trim() || null,
          address_zip: zip.trim() || null,
        },
        token,
      );
      setUser(response.user, token ?? '');
      setIsEditing(false);
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
          <Input
            label="House Number / Unit"
            value={houseNo}
            onChangeText={(value) => {
              setHouseNo(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="Street Name"
            value={street}
            onChangeText={(value) => {
              setStreet(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="Barangay / Municipality"
            value={barangay}
            onChangeText={(value) => {
              setBarangay(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="City"
            value={city}
            onChangeText={(value) => {
              setCity(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="Province"
            value={province}
            onChangeText={(value) => {
              setProvince(value);
              setError('');
            }}
            autoCapitalize="words"
          />
          <Input
            label="Zip Code"
            value={zip}
            onChangeText={(value) => {
              setZip(value);
              setError('');
            }}
            keyboardType="number-pad"
            autoCapitalize="words"
          />
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
            <InfoRow icon="person-outline" label={user?.full_name ?? '-'} />
            <InfoRow icon="mail-outline" label={user?.email ?? '-'} />
            <InfoRow
              icon="call-outline"
              label={user?.phone ? `+63 ${user.phone}` : '-'}
            />
            <InfoRow icon="location-outline" label={user?.shipping_address || '-'} last />
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Text style={styles.editBtnText}>Edit</Text>
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
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
  infoRowLabel: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    flex: 1,
  },
  editBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.brand.blue,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editBtnText: {
    color: Colors.brand.blue,
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
