import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  GestureResponderEvent,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNav } from '@/context/NavContext';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { ReactNode } from 'react';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  qty: number;
  brand?: string | null;
  color?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  colorFamily?: string | null;
  colorFamilyId?: number | string | null;
  category: string;
  categoryId?: number | string | null;
  categorySlug?: string | null;
  genderId?: number | string | null;
  gender?: string | null;
  avgRating?: number | null;
  imageUrl?: string | null;
  size?: string | null;
  isActive: boolean;
};

type Lookup = {
  id: number | string;
  label?: string;
  name?: string;
  slug?: string;
};

type Lookups = {
  categories: Lookup[];
  sizes: Lookup[];
  genders: Lookup[];
  garmentTypes: Lookup[];
  colorFamilies?: Lookup[];
};

type SortOption = 'newest' | 'priceLow' | 'priceHigh';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  priceLow: 'Price: Low',
  priceHigh: 'Price: High',
};

function compactPeso(value: number) {
  return `₱ ${Number(value ?? 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

function lookupLabel(item: Lookup) {
  return item.name ?? item.label ?? String(item.id);
}

function tabLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === 'tops') return 'Top';
  if (normalized === 'bottoms') return 'Bottom';
  if (normalized === 'dresses') return 'Dress';
  return label;
}

function productSizeLabels(product: Product) {
  return (product.size ?? '')
    .split(',')
    .map((size) => size.trim())
    .filter(Boolean);
}

export default function CatalogScreen() {
  const { openNav } = useNav();
  const { user, token } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [lookups, setLookups] = useState<Lookups>({
    categories: [],
    sizes: [],
    genders: [],
    garmentTypes: [],
    colorFamilies: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | string | 'all'>('all');
  const [sizeLabel, setSizeLabel] = useState<string | 'all'>('all');
  const [genderId, setGenderId] = useState<number | string | 'all'>('all');
  const [colorFamilyId, setColorFamilyId] = useState<number | string | 'all'>('all');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState<SortOption>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadCatalog = useCallback(async () => {
    setError('');
    const [items, meta, saved] = await Promise.all([
      apiGet<Product[]>('/products'),
      apiGet<Lookups>('/products/meta/lookups'),
      user?.user_id ? apiGet<string[]>(`/saved/${user.user_id}/ids`, token) : Promise.resolve([]),
    ]);

    setProducts(items.filter((item) => item.isActive));
    setSavedIds(new Set(saved.map(String)));
    setLookups({
      categories: meta.categories ?? [],
      sizes: meta.sizes ?? [],
      genders: meta.genders ?? [],
      garmentTypes: meta.garmentTypes ?? [],
      colorFamilies: meta.colorFamilies ?? [],
    });
  }, [token, user?.user_id]);

  const toggleSaved = async (productId: string) => {
    if (!user?.user_id) return;

    const wasSaved = savedIds.has(productId);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(productId);
      else next.add(productId);
      return next;
    });

    try {
      const result = await apiPost<{ isSaved: boolean }>(
        '/saved/toggle',
        { userId: user.user_id, productId },
        token,
      );
      setSavedIds((current) => {
        const next = new Set(current);
        if (result.isSaved) next.add(productId);
        else next.delete(productId);
        return next;
      });
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(productId);
        else next.delete(productId);
        return next;
      });
    }
  };

  useEffect(() => {
    loadCatalog()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load products.'))
      .finally(() => setLoading(false));
  }, [loadCatalog]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadCatalog().catch((err) =>
          setError(err instanceof Error ? err.message : 'Could not refresh products.'),
        );
      }
    }, [loadCatalog, loading]),
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh products.');
    } finally {
      setRefreshing(false);
    }
  };

  const categoryTabs = useMemo(() => {
    const dbCategories = lookups.categories.map((category) => ({
      id: category.id,
      label: tabLabel(lookupLabel(category)),
    }));

    return [{ id: 'all' as const, label: 'All' }, ...dbCategories];
  }, [lookups.categories]);

  const activeFilterCount = [
    categoryId !== 'all',
    sizeLabel !== 'all',
    genderId !== 'all',
    colorFamilyId !== 'all',
    !inStockOnly,
    sort !== 'newest',
  ].filter(Boolean).length;

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const selectedSize = sizeLabel === 'all' ? null : sizeLabel.toLowerCase();

    const filtered = products.filter((product) => {
      const sizes = productSizeLabels(product).map((size) => size.toLowerCase());
      const text = [
        product.name,
        product.description,
        product.brand,
        product.color,
        product.colorName,
        product.colorFamily,
        product.category,
        product.gender,
        product.size,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (!term || text.includes(term)) &&
        (categoryId === 'all' || String(product.categoryId) === String(categoryId)) &&
        (!selectedSize || sizes.includes(selectedSize)) &&
        (genderId === 'all' || String(product.genderId) === String(genderId)) &&
        (colorFamilyId === 'all' || String(product.colorFamilyId) === String(colorFamilyId)) &&
        (!inStockOnly || product.qty > 0)
      );
    });

    return filtered.sort((a, b) => {
      if (sort === 'priceLow') return a.price - b.price;
      if (sort === 'priceHigh') return b.price - a.price;
      return 0;
    });
  }, [categoryId, colorFamilyId, genderId, inStockOnly, products, search, sizeLabel, sort]);

  const resetFilters = () => {
    setCategoryId('all');
    setSizeLabel('all');
    setGenderId('all');
    setColorFamilyId('all');
    setInStockOnly(true);
    setSort('newest');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandLockup}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoText}>A</Text>
                </View>
                <Text style={styles.brand}>A'FRO</Text>
              </View>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={openNav}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu-outline" size={30} color={Colors.brand.blueLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={17} color={Colors.text.secondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search thrift finds..."
                  placeholderTextColor={Colors.text.secondary}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')} style={styles.iconTap}>
                    <Ionicons name="close-circle" size={17} color={Colors.text.secondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
                onPress={() => setFiltersOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="options" size={21} color={Colors.text.primary} />
                {activeFilterCount > 0 ? <Text style={styles.filterBadge}>{activeFilterCount}</Text> : null}
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {categoryTabs.map((tab) => {
                const selected = categoryId === 'all' ? tab.id === 'all' : String(categoryId) === String(tab.id);
                return (
                  <TouchableOpacity
                    key={String(tab.id)}
                    style={[styles.tab, selected && styles.tabActive]}
                    onPress={() => setCategoryId(tab.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} available
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={34} color={Colors.text.secondary} />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyText}>Try another category, size, or search term.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            isSaved={savedIds.has(item.id)}
            onToggleSaved={() => toggleSaved(item.id)}
          />
        )}
      />

      <FilterModal
        visible={filtersOpen}
        lookups={lookups}
        sizeLabel={sizeLabel}
        genderId={genderId}
        colorFamilyId={colorFamilyId}
        inStockOnly={inStockOnly}
        sort={sort}
        onSizeChange={setSizeLabel}
        onGenderChange={setGenderId}
        onColorFamilyChange={setColorFamilyId}
        onStockChange={setInStockOnly}
        onSortChange={setSort}
        onReset={resetFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

function ProductCard({
  product,
  isSaved,
  onToggleSaved,
}: {
  product: Product;
  isSaved: boolean;
  onToggleSaved: () => void;
}) {
  const router = useRouter();
  const uri = imageUrl(product.imageUrl);
  const sizes = productSizeLabels(product);
  const primarySize = sizes[0];
  const soldOut = product.qty <= 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/product/${product.id}`)}
      activeOpacity={0.82}
    >
      <View style={styles.imageFrame}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={30} color={Colors.text.secondary} />
        )}
        <TouchableOpacity
          style={[styles.heartButton, isSaved && styles.heartButtonSaved]}
          activeOpacity={0.75}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onToggleSaved();
          }}
        >
          <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={21} color="#276296" />
        </TouchableOpacity>
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        {primarySize ? (
          <View style={styles.sizePill}>
            <Text style={styles.sizePillText}>{primarySize}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {[product.category, product.color, product.gender].filter(Boolean).join(' / ')}
      </Text>

      <View style={styles.footer}>
        <View>
          <Text style={styles.price}>{compactPeso(product.price)}</Text>
          <Text style={[styles.stock, soldOut && styles.stockOut]}>
            {soldOut ? 'Sold out' : `${product.qty} in stock`}
          </Text>
        </View>
        <TouchableOpacity style={[styles.tryOnButton, soldOut && styles.tryOnDisabled]} disabled={soldOut}>
          <Text style={styles.tryOnText}>TRY ON</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

type FilterModalProps = {
  visible: boolean;
  lookups: Lookups;
  sizeLabel: string | 'all';
  genderId: number | string | 'all';
  colorFamilyId: number | string | 'all';
  inStockOnly: boolean;
  sort: SortOption;
  onSizeChange: (value: string | 'all') => void;
  onGenderChange: (value: number | string | 'all') => void;
  onColorFamilyChange: (value: number | string | 'all') => void;
  onStockChange: (value: boolean) => void;
  onSortChange: (value: SortOption) => void;
  onReset: () => void;
  onClose: () => void;
};

function FilterModal({
  visible,
  lookups,
  sizeLabel,
  genderId,
  colorFamilyId,
  inStockOnly,
  sort,
  onSizeChange,
  onGenderChange,
  onColorFamilyChange,
  onStockChange,
  onSortChange,
  onReset,
  onClose,
}: FilterModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>More filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconTap}>
            <Ionicons name="close" size={23} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <FilterSection title="Size">
            <Chip label="All" selected={sizeLabel === 'all'} onPress={() => onSizeChange('all')} />
            {lookups.sizes.map((size) => {
              const label = lookupLabel(size);
              return (
                <Chip
                  key={size.id}
                  label={label}
                  selected={sizeLabel === label}
                  onPress={() => onSizeChange(label)}
                />
              );
            })}
          </FilterSection>

          <FilterSection title="Gender">
            <Chip label="All" selected={genderId === 'all'} onPress={() => onGenderChange('all')} />
            {lookups.genders.map((gender) => (
              <Chip
                key={gender.id}
                label={lookupLabel(gender)}
                selected={genderId !== 'all' && String(genderId) === String(gender.id)}
                onPress={() => onGenderChange(gender.id)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Color">
            <Chip label="All" selected={colorFamilyId === 'all'} onPress={() => onColorFamilyChange('all')} />
            {(lookups.colorFamilies ?? []).map((family) => (
              <Chip
                key={family.id}
                label={lookupLabel(family)}
                selected={colorFamilyId !== 'all' && String(colorFamilyId) === String(family.id)}
                onPress={() => onColorFamilyChange(family.id)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Availability">
            <Chip label="In stock" selected={inStockOnly} onPress={() => onStockChange(true)} />
            <Chip label="Show all" selected={!inStockOnly} onPress={() => onStockChange(false)} />
          </FilterSection>

          <FilterSection title="Sort by">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <Chip
                key={option}
                label={SORT_LABELS[option]}
                selected={sort === option}
                onPress={() => onSortChange(option)}
              />
            ))}
          </FilterSection>
        </ScrollView>

        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.resetButton} onPress={onReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={onClose}>
            <Text style={styles.applyText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.chipWrap}>{children}</View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  row: {
    gap: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: Colors.bg.primary,
    fontWeight: '900',
    fontSize: FontSize.base,
  },
  brand: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  menuButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(178, 220, 255, 0.28)',
    backgroundColor: 'rgba(8, 14, 27, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingVertical: 0,
  },
  iconTap: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(33, 47, 70, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(178, 220, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#126D84',
    borderColor: '#3CB8D1',
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C8EDFF',
    color: Colors.bg.primary,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  tabs: {
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  tab: {
    minWidth: 72,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabActive: {
    backgroundColor: '#0B809A',
    borderColor: '#30B9D3',
  },
  tabText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
  },
  tabTextActive: {
    color: Colors.white,
  },
  resultRow: {
    minHeight: 24,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  resultText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(79, 101, 130, 0.72)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(206, 232, 255, 0.14)',
    padding: 9,
    marginBottom: Spacing.md,
    maxWidth: '50%',
  },
  imageFrame: {
    aspectRatio: 1,
    borderRadius: Radius.sm,
    backgroundColor: '#A8DDFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: '#E8F4FF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(232, 244, 255, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButtonSaved: {
    backgroundColor: '#E8F4FF',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  sizePill: {
    minWidth: 22,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(215, 233, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  sizePillText: {
    color: '#D8EDFF',
    fontSize: 8,
    fontWeight: '900',
  },
  meta: {
    color: '#D6E7F6',
    fontSize: 10,
    marginTop: 2,
    minHeight: 14,
  },
  footer: {
    marginTop: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  price: {
    color: '#C8E7FF',
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  stock: {
    color: '#BDEAD5',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  stockOut: {
    color: '#FFC4C4',
  },
  tryOnButton: {
    height: 21,
    minWidth: 54,
    borderRadius: 7,
    backgroundColor: 'rgba(210, 224, 238, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tryOnDisabled: {
    opacity: 0.45,
  },
  tryOnText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.active,
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  filterTitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    minHeight: 34,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.input,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  chipActive: {
    backgroundColor: '#0B809A',
    borderColor: '#30B9D3',
  },
  chipText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  chipTextActive: {
    color: Colors.white,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  resetButton: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  resetText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  applyButton: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B809A',
  },
  applyText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
});
