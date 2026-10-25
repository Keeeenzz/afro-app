import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  Image,
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
import { apiGet, apiPatch, apiPost } from '@/lib/api';

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

const FALLBACK_SIZE_STANDARDS: Record<string, Required<Pick<SizeStandard, 'chestCmMin' | 'chestCmMax' | 'waistCmMin' | 'waistCmMax' | 'hipCmMin' | 'hipCmMax' | 'heightCmMin' | 'heightCmMax'>>> = {
  XS: { chestCmMin: 76, chestCmMax: 81, waistCmMin: 61, waistCmMax: 66, hipCmMin: 84, hipCmMax: 89, heightCmMin: 150, heightCmMax: 160 },
  S: { chestCmMin: 82, chestCmMax: 87, waistCmMin: 67, waistCmMax: 72, hipCmMin: 90, hipCmMax: 95, heightCmMin: 155, heightCmMax: 165 },
  M: { chestCmMin: 88, chestCmMax: 94, waistCmMin: 73, waistCmMax: 79, hipCmMin: 96, hipCmMax: 102, heightCmMin: 160, heightCmMax: 170 },
  L: { chestCmMin: 95, chestCmMax: 101, waistCmMin: 80, waistCmMax: 86, hipCmMin: 103, hipCmMax: 109, heightCmMin: 165, heightCmMax: 175 },
  XL: { chestCmMin: 102, chestCmMax: 109, waistCmMin: 87, waistCmMax: 94, hipCmMin: 110, hipCmMax: 117, heightCmMin: 170, heightCmMax: 180 },
  XXL: { chestCmMin: 110, chestCmMax: 117, waistCmMin: 95, waistCmMax: 102, hipCmMin: 118, hipCmMax: 125, heightCmMin: 170, heightCmMax: 185 },
  '2XL': { chestCmMin: 110, chestCmMax: 117, waistCmMin: 95, waistCmMax: 102, hipCmMin: 118, hipCmMax: 125, heightCmMin: 170, heightCmMax: 185 },
  '3XL': { chestCmMin: 118, chestCmMax: 125, waistCmMin: 103, waistCmMax: 110, hipCmMin: 126, hipCmMax: 133, heightCmMin: 170, heightCmMax: 190 },
};

type SizeStandard = {
  label: string;
  chestCmMin?: number | null; chestCmMax?: number | null;
  waistCmMin?: number | null; waistCmMax?: number | null;
  hipCmMin?: number | null; hipCmMax?: number | null;
  heightCmMin?: number | null; heightCmMax?: number | null;
};
type Audience = { id: number; label: string };

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

function midpoint(min?: number | null, max?: number | null) {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return '';
  const value = Number.isFinite(min) && Number.isFinite(max) ? (Number(min) + Number(max)) / 2 : Number(min ?? max);
  return String(Math.round(value * 10) / 10);
}

function standardForSize(size: string, standards: SizeStandard[]) {
  const normalized = size.trim().toUpperCase();
  const aliases: Record<string, string> = { EXTRA_SMALL: 'XS', SMALL: 'S', MEDIUM: 'M', LARGE: 'L', EXTRA_LARGE: 'XL' };
  const key = aliases[normalized.replace(/[\s-]+/g, '_')] ?? normalized;
  return standards.find((item) => item.label.trim().toUpperCase() === normalized) ?? FALLBACK_SIZE_STANDARDS[key];
}

export default function CustomizeFeedPage() {
  const router = useRouter();
  const draft = useAuthStore((s) => s.draft);
  const setDraft = useAuthStore((s) => s.setDraft);
  const clearDraft = useAuthStore((s) => s.clearDraft);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const isEditMode = !!user?.user_id;

  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<number[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [skinHex, setSkinHex] = useState('');
  const [chestCm, setChestCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [sizeStandards, setSizeStandards] = useState<SizeStandard[]>([]);
  const [error, setError] = useState('');
  const [existingAccountConflict, setExistingAccountConflict] = useState(false);
  const [loading, setLoading] = useState(false);
  const profileName = useMemo(() => user?.full_name ?? draft.full_name ?? 'New Member', [
    draft.full_name,
    user?.full_name,
  ]);

  useEffect(() => {
    const savedStyles = draft.fashion_style
      ? draft.fashion_style.split(',').filter(Boolean)
      : user?.fashion_style
        ? [user.fashion_style]
        : [];

    setSelectedStyles(savedStyles);
    setSelectedAudienceIds(draft.audienceIds ?? user?.audienceIds ?? []);
    setSelectedSize(draft.preferred_size ?? user?.preferred_size ?? null);
    setSkinHex(draft.skin_hex ?? user?.skin_hex ?? '');
    setChestCm(String(draft.body_chest_cm ?? user?.body_chest_cm ?? ''));
    setWaistCm(String(draft.body_waist_cm ?? user?.body_waist_cm ?? ''));
    setHipCm(String(draft.body_hip_cm ?? user?.body_hip_cm ?? ''));
    setHeightCm(String(draft.body_height_cm ?? user?.body_height_cm ?? ''));
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
    user?.audienceIds,
    user?.preferred_size,
    user?.skin_hex,
  ]);

  useEffect(() => {
    apiGet<{ sizes?: SizeStandard[]; styleAudiences?: Audience[] }>('/products/meta/lookups')
      .then((result) => { setSizeStandards(result.sizes ?? []); setAudiences(result.styleAudiences ?? []); })
      .catch(() => setSizeStandards([]));
  }, []);

  const toggleStyle = (label: string) => {
    setError('');
    setExistingAccountConflict(false);
    setSelectedStyles((prev) =>
      prev.includes(label)
        ? prev.filter((style) => style !== label)
        : [...prev, label],
    );
  };

  const selectSize = (size: string) => {
    setSelectedSize(size);
    const standard = standardForSize(size, sizeStandards);
    if (!standard) return;

    // Apply the selected standard immediately and retain it in the shared
    // draft so Profile > Style reflects the same values before Save is tapped.
    const chest = midpoint(standard.chestCmMin, standard.chestCmMax);
    const waist = midpoint(standard.waistCmMin, standard.waistCmMax);
    const hip = midpoint(standard.hipCmMin, standard.hipCmMax);
    const height = midpoint(standard.heightCmMin, standard.heightCmMax);
    setChestCm(chest);
    setWaistCm(waist);
    setHipCm(hip);
    setHeightCm(height);
    setDraft({
      preferred_size: size,
      body_chest_cm: toNullableNumber(chest),
      body_waist_cm: toNullableNumber(waist),
      body_hip_cm: toNullableNumber(hip),
      body_height_cm: toNullableNumber(height),
    });
    setError('');
  };

  const validate = () => {
    if (selectedStyles.length === 0) {
      setError('Please pick at least one style.');
      return false;
    }
    if (!selectedAudienceIds.length) { setError('Please select at least one shopping preference.'); return false; }

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
      audienceIds: selectedAudienceIds,
      preferred_size: preferredSize,
      skin_hex: skinHex.trim() || null,
      body_chest_cm: toNullableNumber(chestCm),
      body_waist_cm: toNullableNumber(waistCm),
      body_hip_cm: toNullableNumber(hipCm),
      body_height_cm: toNullableNumber(heightCm),
    };

    setDraft(profileData);
    setExistingAccountConflict(false);
    setLoading(true);

    try {
      if (isEditMode && user?.user_id) {
        const response = await apiPatch<{ user: any }>(
          `/auth/app/profile/${user.user_id}`,
          profileData,
          token,
        );
        setUser(response.user, token ?? '');
        clearDraft();
        router.back();
        return;
      }

      const session = await apiPost<{ user: any; token: string }>('/auth/app/register', {
        ...draft,
        ...profileData,
      });
      setUser(session.user, session.token);
      clearDraft();
      router.replace('/(tabs)');
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : '';

      if (message === 'Email is already registered' && draft.email && draft.password) {
        let session: { user: any; token: string };
        try {
          session = await apiPost<{ user: any; token: string }>('/auth/app/login', {
            email: draft.email,
            password: draft.password,
          });
        } catch {
          setExistingAccountConflict(true);
          setError('This email is already registered. Log in to continue with that account.');
          return;
        }

        try {
          const response = await apiPatch<{ user: any }>(
            `/auth/app/profile/${session.user.user_id}`,
            profileData,
            session.token,
          );
          setUser(response.user, session.token);
          clearDraft();
          router.replace('/(tabs)');
          return;
        } catch {
          setError('Your account was found, but we could not save your profile. Please try again.');
          return;
        }
      }

      setError(message || 'Could not save your changes. Please try again.');
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
            <Image source={require('@/assets/afro-logo-black.png')} style={styles.avatarLogo} resizeMode="contain" />
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
          {(sizeStandards.length ? sizeStandards.map((size) => size.label) : SIZES).map((size) => {
            const selected = selectedSize === size;
            return (
              <TouchableOpacity
                key={size}
                style={[styles.sizeChip, selected && styles.sizeChipSelected]}
                onPress={() => selectSize(size)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>
                  {size}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Shopping Preferences</Text>
        <Text style={styles.preferenceHint}>Choose all product audiences you want to see first.</Text>
        <View style={styles.chipGrid}>{audiences.map((audience) => { const selected = selectedAudienceIds.includes(audience.id); return <TouchableOpacity key={audience.id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { setSelectedAudienceIds((current) => selected ? current.filter((id) => id !== audience.id) : [...current, audience.id]); setError(''); }}><Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{audience.label}</Text></TouchableOpacity>; })}</View>

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
        {existingAccountConflict ? (
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={styles.loginRecovery}
            activeOpacity={0.75}
          >
            <Text style={styles.loginRecoveryText}>Log in instead</Text>
          </TouchableOpacity>
        ) : null}

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
  avatarLogo: { width: 58, height: 58 },
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
  preferenceHint: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: -Spacing.xs, marginBottom: Spacing.sm },
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
  loginRecovery: {
    alignSelf: 'center',
    marginBottom: Spacing.sm,
    padding: Spacing.xs,
  },
  loginRecoveryText: {
    color: Colors.brand.blue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  btn: { marginTop: Spacing.sm },
});
