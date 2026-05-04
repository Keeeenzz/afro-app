import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { apiPatch, apiPost } from '@/lib/api';

const STYLES = [
  'Streetwear',
  'Minimalist',
  'Casual',
  'Formal',
  'Bohemian',
  'Sporty',
  'Preppy',
  'Y2K',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'];

const SKIN_TONES = [
  { label: 'Fair', hex: '#F6D7C3' },
  { label: 'Light', hex: '#E8B98F' },
  { label: 'Medium', hex: '#C68642' },
  { label: 'Tan', hex: '#A6653A' },
  { label: 'Deep', hex: '#7A3F25' },
  { label: 'Rich', hex: '#4B2418' },
];

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function CustomizeFeedPage() {
  const router = useRouter();
  const draft = useAuthStore((s) => s.draft);
  const setDraft = useAuthStore((s) => s.setDraft);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const isEditMode = !!user?.user_id;

  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [skinHex, setSkinHex] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const profileName = useMemo(() => user?.full_name ?? draft.full_name ?? 'New Member', [
    draft.full_name,
    user?.full_name,
  ]);

  useEffect(() => {
    const savedStyles = user?.fashion_style
      ? [user.fashion_style]
      : draft.fashion_style?.split(',').filter(Boolean) ?? [];

    setSelectedStyles(savedStyles);
    setSelectedSize(user?.preferred_size ?? draft.preferred_size ?? null);
    setSkinHex(user?.skin_hex ?? draft.skin_hex ?? '');
    setChestCm(String(user?.body_chest_cm ?? draft.body_chest_cm ?? ''));
    setWaistCm(String(user?.body_waist_cm ?? draft.body_waist_cm ?? ''));
    setHipCm(String(user?.body_hip_cm ?? draft.body_hip_cm ?? ''));
    setHeightCm(String(user?.body_height_cm ?? draft.body_height_cm ?? ''));
  }, [
    draft.body_chest_cm,
    draft.body_height_cm,
    draft.body_hip_cm,
    draft.body_waist_cm,
    draft.fashion_style,
    draft.preferred_size,
    draft.skin_hex,
    user?.body_chest_cm,
    user?.body_height_cm,
    user?.body_hip_cm,
    user?.body_waist_cm,
    user?.fashion_style,
    user?.preferred_size,
    user?.skin_hex,
  ]);

  const toggleStyle = (label: string) => {
    setError('');
    setSelectedStyles((prev) =>
      prev.includes(label)
        ? prev.filter((style) => style !== label)
        : [...prev, label],
    );
  };

  const validate = () => {
    if (selectedStyles.length === 0) {
      setError('Please pick at least one style.');
      return false;
    }

    if (!isEditMode && !selectedSize) {
      setError('Please select your preferred size.');
      return false;
    }

    if (!toNullableNumber(chestCm) || !toNullableNumber(waistCm) || !toNullableNumber(hipCm)) {
      setError('Please enter chest, waist, and hip measurements in cm.');
      return false;
    }

    if (skinHex.trim() && !/^#[0-9A-Fa-f]{6}$/.test(skinHex.trim())) {
      setError('Skin hex must look like #C68642.');
      return false;
    }

    return true;
  };

  const handleFinish = async () => {
    if (!validate()) return;

    const preferredSize = selectedSize ?? '';
    const profileData = {
      fashion_style: selectedStyles.join(','),
      preferred_size: preferredSize,
      skin_hex: skinHex.trim() || null,
      body_chest_cm: toNullableNumber(chestCm),
      body_waist_cm: toNullableNumber(waistCm),
      body_hip_cm: toNullableNumber(hipCm),
      body_height_cm: toNullableNumber(heightCm),
    };

    setDraft(profileData);
    setLoading(true);

    try {
      if (isEditMode && user?.user_id) {
        const response = await apiPatch<{ user: any }>(
          `/auth/app/profile/${user.user_id}`,
          profileData,
          token,
        );
        setUser(response.user, token ?? '');
        router.back();
        return;
      }

      const session = await apiPost<{ user: any; token: string }>('/auth/app/register', {
        ...draft,
        ...profileData,
      });
      setUser(session.user, session.token);
      router.replace('/(tabs)');
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Could not save your changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>A</Text>
          </View>
          <Text style={styles.name}>{profileName}</Text>
        </View>

        <Text style={styles.title}>{isEditMode ? 'Edit Your Fit' : 'Customize Your Fit'}</Text>
        <Text style={styles.subtitle}>
          {isEditMode
            ? 'Update your style profile whenever your taste, body measurements, or color profile changes.'
            : 'These details save to your SWAG profile and help match products to your body and color profile.'}
        </Text>

        <Text style={styles.sectionTitle}>Fashion Style</Text>
        <View style={styles.chipGrid}>
          {STYLES.map((style) => {
            const selected = selectedStyles.includes(style);
            return (
              <TouchableOpacity
                key={style}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleStyle(style)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {style}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Preferred Size</Text>
        <View style={styles.sizeRow}>
          {SIZES.map((size) => {
            const selected = selectedSize === size;
            return (
              <TouchableOpacity
                key={size}
                style={[styles.sizeChip, selected && styles.sizeChipSelected]}
                onPress={() => {
                  setSelectedSize(size);
                  setError('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>
                  {size}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Body Measurements</Text>
        <View style={styles.measureGrid}>
          <View style={styles.measureField}>
            <Input
              label="Chest (cm)"
              placeholder="91"
              value={chestCm}
              onChangeText={(value) => {
                setChestCm(value);
                setError('');
              }}
              keyboardType="decimal-pad"
              style={styles.measureInput}
            />
          </View>
          <View style={styles.measureField}>
            <Input
              label="Waist (cm)"
              placeholder="71"
              value={waistCm}
              onChangeText={(value) => {
                setWaistCm(value);
                setError('');
              }}
              keyboardType="decimal-pad"
              style={styles.measureInput}
            />
          </View>
        </View>

        <View style={styles.measureGrid}>
          <View style={styles.measureField}>
            <Input
              label="Hip (cm)"
              placeholder="96"
              value={hipCm}
              onChangeText={(value) => {
                setHipCm(value);
                setError('');
              }}
              keyboardType="decimal-pad"
              style={styles.measureInput}
            />
          </View>
          <View style={styles.measureField}>
            <Input
              label="Height (cm)"
              placeholder="160"
              value={heightCm}
              onChangeText={(value) => {
                setHeightCm(value);
                setError('');
              }}
              keyboardType="decimal-pad"
              style={styles.measureInput}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Skin Tone</Text>
        <View style={styles.toneGrid}>
          {SKIN_TONES.map((tone) => {
            const selected = skinHex === tone.hex;

            return (
              <TouchableOpacity
                key={tone.hex}
                style={[styles.toneChip, selected && styles.toneChipSelected]}
                onPress={() => {
                  setSkinHex(tone.hex);
                  setError('');
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.toneSwatch, { backgroundColor: tone.hex }]} />
                <Text style={[styles.toneLabel, selected && styles.toneLabelSelected]}>
                  {tone.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={isEditMode ? 'Save Changes' : 'Finish Setup'}
          onPress={handleFinish}
          loading={loading}
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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
    paddingVertical: 6,
    paddingRight: Spacing.sm,
  },
  backText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
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
  avatarInitial: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
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
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  chip: {
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
  chipLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: Colors.brand.blue,
    fontWeight: '800',
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
  sizeLabelSelected: { color: Colors.brand.blue },
  measureGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  measureField: { flex: 1 },
  measureInput: { textAlign: 'center' },
  toneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  toneChip: {
    width: '30%',
    minWidth: 92,
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  toneChipSelected: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.bg.inputFocused,
  },
  toneSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  toneLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  toneLabelSelected: {
    color: Colors.brand.blueLight,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  btn: { marginTop: Spacing.sm },
});
