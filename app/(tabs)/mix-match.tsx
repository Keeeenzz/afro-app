import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNav } from '@/context/NavContext';
import { useAuthStore } from '@/hooks/useAuthStore';
import { apiGet, imageUrl } from '@/lib/api';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  qty?: number;
  brand?: string | null;
  color?: string | null;
  colorName?: string | null;
  category?: string | null;
  categorySlug?: string | null;
  gender?: string | null;
  imageUrl?: string | null;
  size?: string | null;
  isActive?: boolean;
};

type MixMode = 'top_bottom' | 'dress_top' | 'dress_bottom';
type DressTopStyle = 'over' | 'under';
type DressBottomStyle = 'under' | 'over';

const MIX_MODES: { value: MixMode; label: string }[] = [
  { value: 'top_bottom', label: 'Top + Bottom' },
  { value: 'dress_top', label: 'Dress + Top' },
  { value: 'dress_bottom', label: 'Dress + Bottom' },
];

const DRESS_TOP_STYLES: { value: DressTopStyle; label: string }[] = [
  { value: 'over', label: 'Over' },
  { value: 'under', label: 'Under' },
];
const DRESS_BOTTOM_STYLES: { value: DressBottomStyle; label: string }[] = [
  { value: 'under', label: 'Under' },
  { value: 'over', label: 'Over' },
];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function peso(value: number) {
  return `PHP ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function isTop(product: Product) {
  const text = `${product.name ?? ''} ${product.categorySlug ?? ''} ${product.category ?? ''}`.toLowerCase();
  return text.includes('top') || text.includes('shirt') || text.includes('hoodie') || text.includes('jacket');
}

function isBottom(product: Product) {
  const text = `${product.name ?? ''} ${product.categorySlug ?? ''} ${product.category ?? ''}`.toLowerCase();
  return text.includes('bottom') || text.includes('pant') || text.includes('short') || text.includes('skirt');
}

function isDress(product: Product) {
  const text = `${product.name ?? ''} ${product.categorySlug ?? ''} ${product.category ?? ''}`.toLowerCase();
  return text.includes('dress') || text.includes('jumpsuit') || text.includes('one');
}

function productSizeLabels(product: Product) {
  return (product.size ?? '')
    .split(',')
    .map((size) => size.trim())
    .filter(Boolean);
}

function normalizeSizeLabel(value?: string | null) {
  const normalized = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (['xs', 'extra small', 'x small'].includes(normalized)) return 'xs';
  if (['s', 'small'].includes(normalized)) return 's';
  if (['m', 'medium'].includes(normalized)) return 'm';
  if (['l', 'large'].includes(normalized)) return 'l';
  if (['xl', 'extra large', 'x large'].includes(normalized)) return 'xl';
  if (['xxl', '2xl', 'double xl', 'extra extra large'].includes(normalized)) return 'xxl';
  return normalized;
}

function productMatchesSize(product: Product, selectedSize: string) {
  const normalizedSelectedSize = normalizeSizeLabel(selectedSize);
  if (!normalizedSelectedSize) return true;

  return productSizeLabels(product)
    .map(normalizeSizeLabel)
    .some((size) => size === normalizedSelectedSize);
}

function hasTryOnStock(product: Product) {
  if (product.qty == null) return true;
  return Number(product.qty) > 0 || productSizeLabels(product).length > 0;
}

function wrapIndex(current: number, total: number, direction: -1 | 1) {
  if (!total) return 0;
  return (current + direction + total) % total;
}

export default function MixMatchScreen() {
  const router = useRouter();
  const { openNav } = useNav();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [mixMode, setMixMode] = useState<MixMode>('top_bottom');
  const [dressTopStyle, setDressTopStyle] = useState<DressTopStyle>('over');
  const [dressBottomStyle, setDressBottomStyle] = useState<DressBottomStyle>('under');
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [shirtIndex, setShirtIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [sessionChestCm, setSessionChestCm] = useState('');
  const [sessionWaistCm, setSessionWaistCm] = useState('');
  const [sessionHipCm, setSessionHipCm] = useState('');
  const [sessionHeightCm, setSessionHeightCm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<Product[]>('/products')
      .then((items) => setProducts(items.filter((item) => item.isActive !== false && hasTryOnStock(item))))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load Mix & Match products.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSelectedSize(user?.preferred_size ?? '');
    setSessionChestCm(String(user?.body_chest_cm ?? ''));
    setSessionWaistCm(String(user?.body_waist_cm ?? ''));
    setSessionHipCm(String(user?.body_hip_cm ?? ''));
    setSessionHeightCm(String(user?.body_height_cm ?? ''));
  }, [
    user?.body_chest_cm,
    user?.body_height_cm,
    user?.body_hip_cm,
    user?.body_waist_cm,
    user?.preferred_size,
  ]);

  const sizeFilteredProducts = useMemo(
    () => products.filter((product) => productMatchesSize(product, selectedSize)),
    [products, selectedSize],
  );
  const tops = useMemo(() => sizeFilteredProducts.filter(isTop), [sizeFilteredProducts]);
  const bottoms = useMemo(() => sizeFilteredProducts.filter(isBottom), [sizeFilteredProducts]);
  const dresses = useMemo(() => sizeFilteredProducts.filter(isDress), [sizeFilteredProducts]);
  const selectedTop = tops[topIndex] ?? null;
  const selectedBottom = bottoms[bottomIndex] ?? null;
  const selectedDress = dresses[dressIndex] ?? null;
  const selectedShirt = tops[shirtIndex] ?? null;
  const canTryOn =
    (mixMode === 'top_bottom' && !!selectedTop && !!selectedBottom) ||
    (mixMode === 'dress_top' && !!selectedDress && !!selectedShirt) ||
    (mixMode === 'dress_bottom' && !!selectedDress && !!selectedBottom);

  useEffect(() => {
    if (topIndex >= tops.length) setTopIndex(0);
  }, [topIndex, tops.length]);

  useEffect(() => {
    if (bottomIndex >= bottoms.length) setBottomIndex(0);
  }, [bottomIndex, bottoms.length]);

  useEffect(() => {
    if (dressIndex >= dresses.length) setDressIndex(0);
  }, [dressIndex, dresses.length]);

  useEffect(() => {
    if (shirtIndex >= tops.length) setShirtIndex(0);
  }, [shirtIndex, tops.length]);

  const goToTryOn = () => {
    const measurementParams = {
      bodyChestCm: sessionChestCm,
      bodyWaistCm: sessionWaistCm,
      bodyHipCm: sessionHipCm,
      bodyHeightCm: sessionHeightCm,
    };

    if (mixMode === 'top_bottom') {
      if (!selectedTop || !selectedBottom) return;

      router.push({
        pathname: '/(tabs)/try-on',
        params: {
          productIds: `${selectedTop.id},${selectedBottom.id}`,
          mixMatchMode: 'top_bottom',
          ...measurementParams,
        },
      });
      return;
    }

    if (mixMode === 'dress_top') {
      if (!selectedDress || !selectedShirt) return;

      const orderedIds = dressTopStyle === 'under'
        ? `${selectedShirt.id},${selectedDress.id}`
        : `${selectedDress.id},${selectedShirt.id}`;

      router.push({
        pathname: '/(tabs)/try-on',
        params: {
          productIds: orderedIds,
          mixMatchMode: 'dress_top',
          layeringStyle: dressTopStyle,
          ...measurementParams,
        },
      });
      return;
    }

    if (mixMode === 'dress_bottom') {
      if (!selectedDress || !selectedBottom) return;
      const orderedIds = dressBottomStyle === 'under'
        ? `${selectedDress.id},${selectedBottom.id}`
        : `${selectedBottom.id},${selectedDress.id}`;

      router.push({
        pathname: '/(tabs)/try-on',
        params: {
          productIds: orderedIds,
          mixMatchMode: 'dress_bottom',
          layeringStyle: dressBottomStyle,
          ...measurementParams,
        },
      });
      return;
    }

  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={26} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.brandLockup}>
          <View style={styles.logoMark}>
            <Image source={require('../../assets/afro-logo.png')} style={styles.headerLogoImage} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>A'FRO</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={openNav} activeOpacity={0.75}>
          <Ionicons name="menu-outline" size={30} color={Colors.brand.blueLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Mix & Match</Text>
        <Text style={styles.subtitle}>
          Build a layered look from live admin products, then send it to Try On.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.modeTabs}>
          {MIX_MODES.map((mode) => (
            <ModeButton
              key={mode.value}
              label={mode.label}
              selected={mixMode === mode.value}
              onPress={() => setMixMode(mode.value)}
            />
          ))}
        </View>

        {mixMode === 'dress_top' ? (
          <View style={styles.styleTabs}>
            {DRESS_TOP_STYLES.map((style) => (
              <ModeButton
                key={style.value}
                label={style.label}
                selected={dressTopStyle === style.value}
                onPress={() => setDressTopStyle(style.value)}
              />
            ))}
          </View>
        ) : null}

        {mixMode === 'dress_bottom' ? (
          <View style={styles.styleTabs}>
            {DRESS_BOTTOM_STYLES.map((style) => (
              <ModeButton
                key={style.value}
                label={style.label}
                selected={dressBottomStyle === style.value}
                onPress={() => setDressBottomStyle(style.value)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.measurementBox}>
          <View style={styles.measurementHeader}>
            <Text style={styles.boxTitle}>Mix & Match measurements</Text>
            <Text style={styles.measurementHint}>
              {selectedSize ? `Size ${selectedSize}` : 'All sizes'}
            </Text>
          </View>

          <View style={styles.sizeTabs}>
            <ModeButton label="All" selected={!selectedSize} onPress={() => setSelectedSize('')} />
            {SIZE_OPTIONS.map((size) => (
              <ModeButton key={size} label={size} selected={normalizeSizeLabel(selectedSize) === normalizeSizeLabel(size)} onPress={() => setSelectedSize(size)} />
            ))}
          </View>

          <View style={styles.measureGrid}>
            <MeasurementInput label="Chest" value={sessionChestCm} onChange={setSessionChestCm} />
            <MeasurementInput label="Waist" value={sessionWaistCm} onChange={setSessionWaistCm} />
          </View>
          <View style={styles.measureGrid}>
            <MeasurementInput label="Hip" value={sessionHipCm} onChange={setSessionHipCm} />
            <MeasurementInput label="Height" value={sessionHeightCm} onChange={setSessionHeightCm} />
          </View>
        </View>

        <View style={styles.stage}>
          {mixMode === 'top_bottom' ? (
            <>
              <CarouselSlot
                label="Top"
                product={selectedTop}
                currentIndex={topIndex}
                total={tops.length}
                emptyText="No active tops yet."
                onPrevious={() => setTopIndex((current) => wrapIndex(current, tops.length, -1))}
                onNext={() => setTopIndex((current) => wrapIndex(current, tops.length, 1))}
                disabled={tops.length <= 1}
              />

              <View style={styles.separator} />

              <CarouselSlot
                label="Bottom"
                product={selectedBottom}
                currentIndex={bottomIndex}
                total={bottoms.length}
                emptyText="No active bottoms yet."
                onPrevious={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, -1))}
                onNext={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, 1))}
                disabled={bottoms.length <= 1}
              />
            </>
          ) : null}

          {mixMode === 'dress_top' ? (
            <>
              <CarouselSlot
                label="Dress"
                product={selectedDress}
                currentIndex={dressIndex}
                total={dresses.length}
                emptyText="No active dresses yet."
                onPrevious={() => setDressIndex((current) => wrapIndex(current, dresses.length, -1))}
                onNext={() => setDressIndex((current) => wrapIndex(current, dresses.length, 1))}
                disabled={dresses.length <= 1}
              />

              <View style={styles.separator} />

              <CarouselSlot
                label="Top"
                product={selectedShirt}
                currentIndex={shirtIndex}
                total={tops.length}
                emptyText="No active tops yet."
                onPrevious={() => setShirtIndex((current) => wrapIndex(current, tops.length, -1))}
                onNext={() => setShirtIndex((current) => wrapIndex(current, tops.length, 1))}
                disabled={tops.length <= 1}
              />
            </>
          ) : null}

          {mixMode === 'dress_bottom' ? (
            <>
              <CarouselSlot
                label="Dress"
                product={selectedDress}
                currentIndex={dressIndex}
                total={dresses.length}
                emptyText="No active dresses yet."
                onPrevious={() => setDressIndex((current) => wrapIndex(current, dresses.length, -1))}
                onNext={() => setDressIndex((current) => wrapIndex(current, dresses.length, 1))}
                disabled={dresses.length <= 1}
              />

              <View style={styles.separator} />

              <CarouselSlot
                label="Bottom"
                product={selectedBottom}
                currentIndex={bottomIndex}
                total={bottoms.length}
                emptyText="No active bottoms yet."
                onPrevious={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, -1))}
                onNext={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, 1))}
                disabled={bottoms.length <= 1}
              />
            </>
          ) : null}

        </View>

        <Text style={styles.sectionTitle}>Selected items</Text>
        <View style={styles.selectedList}>
          {mixMode === 'top_bottom' ? (
            <>
              <SelectedRow label="Top" product={selectedTop} />
              <SelectedRow label="Bottom" product={selectedBottom} />
            </>
          ) : null}
          {mixMode === 'dress_top' ? (
            <>
              <SelectedRow label="Dress" product={selectedDress} />
              <SelectedRow label={`Top (${dressTopStyle})`} product={selectedShirt} />
            </>
          ) : null}
          {mixMode === 'dress_bottom' ? (
            <>
              <SelectedRow label="Dress" product={selectedDress} />
              <SelectedRow label={`Bottom (${dressBottomStyle})`} product={selectedBottom} />
            </>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.tryOnButton, !canTryOn && styles.tryOnButtonDisabled]}
          disabled={!canTryOn}
          onPress={goToTryOn}
          activeOpacity={0.82}
        >
          <Ionicons name="sparkles-outline" size={17} color={Colors.white} />
          <Text style={styles.tryOnText}>Try On This Look</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function CarouselSlot({
  label,
  product,
  currentIndex,
  total,
  emptyText,
  onPrevious,
  onNext,
  disabled,
}: {
  label: string;
  product: Product | null;
  currentIndex: number;
  total: number;
  emptyText: string;
  onPrevious: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const uri = imageUrl(product?.imageUrl);

  return (
    <View style={styles.slot}>
      <TouchableOpacity
        style={[styles.arrowButton, disabled && styles.arrowButtonDisabled]}
        disabled={disabled}
        onPress={onPrevious}
        activeOpacity={0.72}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.itemDisplay}>
        <Text style={styles.slotLabel}>
          {total > 0 ? `${label} ${currentIndex + 1}/${total}` : label}
        </Text>
        {product ? (
          <>
            <View style={styles.imagePanel}>
              {uri ? (
                <Image source={{ uri }} style={styles.itemImage} resizeMode="contain" />
              ) : (
                <Ionicons name="shirt-outline" size={44} color={Colors.text.secondary} />
              )}
            </View>
            <Text style={styles.itemName} numberOfLines={2}>
              {product.name}
            </Text>
          </>
        ) : (
          <View style={styles.emptyPanel}>
            <Ionicons name="shirt-outline" size={34} color={Colors.text.secondary} />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.arrowButton, disabled && styles.arrowButtonDisabled]}
        disabled={disabled}
        onPress={onNext}
        activeOpacity={0.72}
      >
        <Ionicons name="chevron-forward" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
}

function SelectedRow({ label, product }: { label: string; product: Product | null }) {
  const uri = imageUrl(product?.imageUrl);

  return (
    <View style={styles.selectedRow}>
      <View style={styles.selectedThumb}>
        {uri ? (
          <Image source={{ uri }} style={styles.selectedImage} resizeMode="contain" />
        ) : (
          <Ionicons name="shirt-outline" size={22} color={Colors.text.secondary} />
        )}
      </View>
      <View style={styles.selectedCopy}>
        <Text style={styles.selectedLabel}>{label}</Text>
        <Text style={styles.selectedName} numberOfLines={2}>
          {product?.name ?? `Select a ${label.toLowerCase()}`}
        </Text>
        {product ? (
          <Text style={styles.selectedMeta} numberOfLines={1}>
            {[product.colorName, product.size, peso(product.price)].filter(Boolean).join(' / ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.modeButton, selected && styles.modeButtonActive]}
      onPress={onPress}
      activeOpacity={0.76}
    >
      <Text style={[styles.modeButtonText, selected && styles.modeButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MeasurementInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.measureField}>
      <Text style={styles.measureLabel}>{label} (cm)</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.text.muted}
        keyboardType="decimal-pad"
        style={styles.measureInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: Colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
  headerLogoImage: {
    height: 27,
    width: 27,
  },
  brand: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  styleTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sizeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(206, 232, 255, 0.18)',
    borderRadius: Radius.full,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  modeButtonActive: {
    backgroundColor: '#0B809A',
    borderColor: '#9AE9F5',
  },
  modeButtonText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: Colors.white,
  },
  measurementBox: {
    backgroundColor: 'rgba(8, 14, 27, 0.78)',
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  measurementHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  measurementHint: {
    color: '#9AE9F5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  measureGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  measureField: {
    flex: 1,
  },
  measureLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  measureInput: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(206, 232, 255, 0.28)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    minHeight: 40,
    paddingHorizontal: Spacing.sm,
  },
  boxTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  stage: {
    backgroundColor: 'rgba(26, 34, 53, 0.92)',
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
  },
  slot: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 232,
    paddingHorizontal: Spacing.sm,
  },
  separator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(206, 232, 255, 0.16)',
    height: 1,
    width: '72%',
  },
  arrowButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(206, 232, 255, 0.2)',
    borderRadius: Radius.full,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  arrowButtonDisabled: {
    opacity: 0.35,
  },
  itemDisplay: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  slotLabel: {
    color: '#9AE9F5',
    fontSize: FontSize.xs,
    fontWeight: '900',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  imagePanel: {
    alignItems: 'center',
    backgroundColor: '#F7FBFF',
    borderColor: '#D8EDFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    height: 154,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  itemImage: {
    height: '92%',
    width: '92%',
  },
  itemName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: Spacing.sm,
    minHeight: 36,
    textAlign: 'center',
  },
  emptyPanel: {
    alignItems: 'center',
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 154,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    width: '100%',
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  selectedList: {
    gap: Spacing.sm,
  },
  selectedRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(96, 132, 166, 0.55)',
    borderColor: 'rgba(206, 232, 255, 0.2)',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    minHeight: 76,
    padding: Spacing.sm,
  },
  selectedThumb: {
    alignItems: 'center',
    backgroundColor: '#F7FBFF',
    borderRadius: Radius.sm,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  selectedImage: {
    height: '92%',
    width: '92%',
  },
  selectedCopy: {
    flex: 1,
  },
  selectedLabel: {
    color: '#9AE9F5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 2,
  },
  selectedMeta: {
    color: '#D6E7F6',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  tryOnButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: 50,
    paddingHorizontal: Spacing.xl,
    width: '82%',
  },
  tryOnButtonDisabled: {
    opacity: 0.45,
  },
  tryOnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
});
