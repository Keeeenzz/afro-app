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
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNav } from '@/context/NavContext';
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

function peso(value: number) {
  return `PHP ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function isTop(product: Product) {
  return (product.categorySlug ?? product.category ?? '').toLowerCase().includes('top');
}

function isBottom(product: Product) {
  return (product.categorySlug ?? product.category ?? '').toLowerCase().includes('bottom');
}

function wrapIndex(current: number, total: number, direction: -1 | 1) {
  if (!total) return 0;
  return (current + direction + total) % total;
}

export default function MixMatchScreen() {
  const router = useRouter();
  const { openNav } = useNav();
  const [products, setProducts] = useState<Product[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<Product[]>('/products')
      .then((items) => setProducts(items.filter((item) => item.isActive !== false && Number(item.qty ?? 1) > 0)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load Mix & Match products.'))
      .finally(() => setLoading(false));
  }, []);

  const tops = useMemo(() => products.filter(isTop), [products]);
  const bottoms = useMemo(() => products.filter(isBottom), [products]);
  const selectedTop = tops[topIndex] ?? null;
  const selectedBottom = bottoms[bottomIndex] ?? null;
  const canTryOn = !!selectedTop && !!selectedBottom;

  useEffect(() => {
    if (topIndex >= tops.length) setTopIndex(0);
  }, [topIndex, tops.length]);

  useEffect(() => {
    if (bottomIndex >= bottoms.length) setBottomIndex(0);
  }, [bottomIndex, bottoms.length]);

  const goToTryOn = () => {
    if (!selectedTop || !selectedBottom) return;

    router.push({
      pathname: '/(tabs)/try-on',
      params: {
        productIds: `${selectedTop.id},${selectedBottom.id}`,
      },
    });
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
          Build a two-piece look from live admin products. Dresses stay in Try On because they already cover the whole outfit.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.stage}>
          <CarouselSlot
            label="Top"
            product={selectedTop}
            emptyText="No active tops yet."
            onPrevious={() => setTopIndex((current) => wrapIndex(current, tops.length, -1))}
            onNext={() => setTopIndex((current) => wrapIndex(current, tops.length, 1))}
            disabled={tops.length <= 1}
          />

          <View style={styles.separator} />

          <CarouselSlot
            label="Bottom"
            product={selectedBottom}
            emptyText="No active bottoms yet."
            onPrevious={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, -1))}
            onNext={() => setBottomIndex((current) => wrapIndex(current, bottoms.length, 1))}
            disabled={bottoms.length <= 1}
          />
        </View>

        <Text style={styles.sectionTitle}>Selected items</Text>
        <View style={styles.selectedList}>
          <SelectedRow label="Top" product={selectedTop} />
          <SelectedRow label="Bottom" product={selectedBottom} />
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
  emptyText,
  onPrevious,
  onNext,
  disabled,
}: {
  label: string;
  product: Product | null;
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
        <Text style={styles.slotLabel}>{label}</Text>
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
