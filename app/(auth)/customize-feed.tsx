import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

const STYLES = [
  { label: 'Streetwear', emoji: '🧢' },
  { label: 'Vintage', emoji: '🕶️' },
  { label: 'Gothcore', emoji: '🖤' },
  { label: 'Soft Girl', emoji: '🎀' },
  { label: 'Bohemian', emoji: '🌿' },
  { label: 'Y2K', emoji: '💿' },
  { label: 'Minimalist', emoji: '⬜' },
  { label: 'Pastel', emoji: '🌸' },
  { label: 'Drip/Get', emoji: '💧' },
  { label: 'Chic', emoji: '👜' },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

export default function CustomizeFeedPage() {
  const router = useRouter();
  const setDraft = useAuthStore((s) => s.setDraft);

  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [error, setError] = useState('');

  const toggleStyle = (label: string) => {
    setError('');
    setSelectedStyles((prev) =>
      prev.includes(label)
        ? prev.filter((s) => s !== label)
        : [...prev, label]
    );
  };

  const handleFinish = () => {
    if (selectedStyles.length === 0) {
      setError('Please pick at least one style.');
      return;
    }
    if (!selectedSize) {
      setError('Please select your preferred size.');
      return;
    }
    setDraft({
      fashion_style: selectedStyles.join(','),
    });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>👤</Text>
          </View>
          <Text style={styles.name}>New Member</Text>
        </View>

        <Text style={styles.title}>Pick Your Style</Text>
        <Text style={styles.subtitle}>
          We'll personalize your thrift feed based on your picks.
        </Text>

        {/* Style chips */}
        <View style={styles.chipGrid}>
          {STYLES.map((s) => {
            const selected = selectedStyles.includes(s.label);
            return (
              <TouchableOpacity
                key={s.label}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleStyle(s.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>{s.emoji}</Text>
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Size picker */}
        <Text style={styles.sectionTitle}>Preferred Size</Text>
        <View style={styles.sizeRow}>
          {SIZES.map((size) => {
            const selected = selectedSize === size;
            return (
              <TouchableOpacity
                key={size}
                style={[styles.sizeChip, selected && styles.sizeChipSelected]}
                onPress={() => { setSelectedSize(size); setError(''); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>
                  {size}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Finish Setup"
          onPress={handleFinish}
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
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bg.card,
    borderWidth: 2,
    borderColor: Colors.border.active,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarInitial: { fontSize: 32 },
  name: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  chipSelected: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  chipEmoji: { fontSize: 14 },
  chipLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  sizeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  sizeChipSelected: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  sizeLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  sizeLabelSelected: {
    color: Colors.brand.blue,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  btn: { marginTop: Spacing.sm },
});