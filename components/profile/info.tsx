import React from 'react';
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
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Personal Info</Text>

      <View style={styles.infoCard}>
        <InfoRow icon="person-outline" label={user?.full_name ?? '—'} />
        <InfoRow icon="mail-outline" label={user?.email ?? '—'} />
        <InfoRow
          icon="call-outline"
          label={user?.phone ? `+63 ${user.phone}` : '—'}
        />
        <InfoRow icon="location-outline" label="Manila" last />
      </View>

      <TouchableOpacity style={styles.editBtn}>
        <Text style={styles.editBtnText}>Edit</Text>
      </TouchableOpacity>

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