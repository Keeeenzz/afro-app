import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

function formatCm(value?: number | null) {
  return value === undefined || value === null ? '-' : `${value} cm`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function StyleTab() {
  const { user, draft } = useAuthStore();
  const router = useRouter();
  const savedStyles = user?.fashion_style
    ? [user.fashion_style]
    : draft.fashion_style?.split(',').filter(Boolean) ?? [];
  const preferredSize = user?.preferred_size ?? draft.preferred_size ?? '-';
  const skinHex = user?.skin_hex ?? draft.skin_hex ?? null;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.editButton}
        activeOpacity={0.75}
        onPress={() => router.push('/(auth)/customize-feed')}
      >
        <Ionicons name="create-outline" size={18} color={Colors.brand.blue} />
        <Text style={styles.editButtonText}>Edit Style Profile</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Fashion Style</Text>
      <View style={styles.chipRow}>
        {savedStyles.length ? (
          savedStyles.map((style) => (
            <View key={style} style={[styles.chip, styles.chipActive]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{style}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No style selected.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Preferred Size</Text>
      <View style={styles.chipRow}>
        <View style={[styles.sizeChip, preferredSize !== '-' && styles.chipActive]}>
          <Text style={[styles.chipText, preferredSize !== '-' && styles.chipTextActive]}>
            {preferredSize}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Body Measurements</Text>
      <View style={styles.metricGrid}>
        <MetricCard label="Chest" value={formatCm(user?.body_chest_cm ?? draft.body_chest_cm)} />
        <MetricCard label="Waist" value={formatCm(user?.body_waist_cm ?? draft.body_waist_cm)} />
        <MetricCard label="Hip" value={formatCm(user?.body_hip_cm ?? draft.body_hip_cm)} />
        <MetricCard label="Height" value={formatCm(user?.body_height_cm ?? draft.body_height_cm)} />
      </View>

      <Text style={styles.sectionTitle}>Skin Tone</Text>
      <View style={styles.skinCard}>
        <View
          style={[
            styles.skinSwatch,
            skinHex ? { backgroundColor: skinHex } : undefined,
          ]}
        />
        <View style={styles.skinTextWrap}>
          <Text style={styles.skinLabel}>
            {skinHex ? 'Selected tone' : 'No skin tone selected'}
          </Text>
          <Text style={styles.skinValue}>{skinHex ?? '-'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.brand.blue,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  editButtonText: {
    color: Colors.brand.blue,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  chipActive: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  chipTextActive: { color: Colors.brand.blue, fontWeight: '800' },
  emptyText: {
    color: Colors.text.muted,
    fontSize: FontSize.sm,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.md,
  },
  metricLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginTop: 4,
  },
  skinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  skinSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bg.input,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  skinTextWrap: { flex: 1 },
  skinLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  skinValue: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '800',
    marginTop: 2,
  },
});
