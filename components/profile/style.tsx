import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

const STYLE_OPTIONS = [
  'Streetwear', 'Vintage', 'Gothcore', 'Soft Girl',
  'Bohemian', 'Y2K', 'Minimalist', 'Pastel', 'Drip/Get', 'Chic',
];

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

export function StyleTab() {
  const { draft } = useAuthStore();
  const savedStyles = draft.fashion_style?.split(',').filter(Boolean) ?? [];

  const [selectedStyles, setSelectedStyles] = useState<string[]>(savedStyles);
  const [selectedSize, setSelectedSize] = useState<string>('M');

  const toggleStyle = (s: string) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Fashion Style</Text>
      <View style={styles.chipRow}>
        {STYLE_OPTIONS.map((s) => {
          const active = selectedStyles.includes(s);
          return (
            <TouchableOpacity
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleStyle(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Size</Text>
      <View style={styles.chipRow}>
        {SIZE_OPTIONS.map((s) => {
          const active = selectedSize === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.sizeChip, active && styles.chipActive]}
              onPress={() => setSelectedSize(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Save Changes</Text>
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
    fontWeight: '500',
  },
  chipTextActive: { color: Colors.brand.blue, fontWeight: '700' },
  saveBtn: {
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.base,
  },
});