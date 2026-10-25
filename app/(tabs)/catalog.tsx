import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  GestureResponderEvent,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNav } from '@/context/NavContext';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { ReactNode } from 'react';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { PressableScale } from '@/components/ui/PressableScale';

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
  styleId?: number | string | null;
  fashionStyle?: string | null;
  category: string;
  categoryId?: number | string | null;
  categorySlug?: string | null;
  genderId?: number | string | null;
  gender?: string | null;
  audienceIds?: string | null;
  audienceTags?: string | null;
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
  fashionStyles?: Lookup[];
  styleAudiences?: Lookup[];
};

type SortOption = 'newest' | 'priceLow' | 'priceHigh';
type PriceRange = 'all' | 'under500' | '500to1000' | 'over1000';
type FilterValues = {
  categoryId: number | string | 'all';
  sizeLabel: string | 'all';
  genderId: number | string | 'all';
  audienceId: number | string | 'all';
  colorFamilyId: number | string | 'all';
  styleId: number | string | 'all';
  inStockOnly: boolean;
  priceRange: PriceRange;
  sort: SortOption;
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  priceLow: 'Price: Low',
  priceHigh: 'Price: High',
};
const PRODUCTS_PER_PAGE = 10;
const GRID_GAP = Spacing.md;
const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  all: 'Any price',
  under500: 'Under ₱500',
  '500to1000': '₱500–₱1,000',
  over1000: 'Over ₱1,000',
};
const NEUTRAL_BOTTOM_COLORS = ['black', 'white', 'gray', 'grey', 'beige', 'cream', 'brown', 'navy', 'denim', 'blue'];

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

function productNameSizeHint(product: Product) {
  const name = (product.name ?? '').toLowerCase().trim();

  if (/^(extra small|x-small|xs)\b/.test(name) || /\bsize\s*(extra small|x-small|xs)\b/.test(name)) return 'xs';
  if (/^(small|s)\b/.test(name) || /\bsize\s*(small|s)\b/.test(name)) return 's';
  if (/^(medium|m)\b/.test(name) || /\bsize\s*(medium|m)\b/.test(name)) return 'm';
  if (/^(large|l)\b/.test(name) || /\bsize\s*(large|l)\b/.test(name)) return 'l';
  if (/^(extra large|x-large|xl)\b/.test(name) || /\bsize\s*(extra large|x-large|xl)\b/.test(name)) return 'xl';
  if (/^(extra extra large|xxl|2xl)\b/.test(name) || /\bsize\s*(extra extra large|xxl|2xl)\b/.test(name)) return 'xxl';
  return '';
}

function normalizeColorName(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function productCategoryText(product: Product) {
  return `${product.categorySlug ?? ''} ${product.category ?? ''} ${product.name ?? ''}`.toLowerCase();
}

function isTopProduct(product: Product) {
  const text = productCategoryText(product);
  return text.includes('top') || text.includes('shirt') || text.includes('hoodie') || text.includes('jacket');
}

function isBottomProduct(product: Product) {
  const text = productCategoryText(product);
  return text.includes('bottom') || text.includes('pant') || text.includes('short') || text.includes('skirt');
}

function isDressProduct(product: Product) {
  const text = productCategoryText(product);
  return text.includes('dress') || text.includes('jumpsuit') || text.includes('one');
}

function productColorNames(product: Product) {
  return [product.colorName, product.color, product.colorFamily]
    .map(normalizeColorName)
    .filter(Boolean);
}

function colorNamesOverlap(sourceColors: string[], targetColors: string[]) {
  if (!sourceColors.length || !targetColors.length) return false;

  return sourceColors.some((sourceColor) =>
    targetColors.some(
      (targetColor) =>
        targetColor === sourceColor ||
        targetColor.includes(sourceColor) ||
        sourceColor.includes(targetColor),
    ),
  );
}

function bottomHarmonyColorsForTop(topColors: string[]) {
  const colors = new Set<string>();

  topColors.forEach((color) => {
    const isNeutral = ['black', 'white', 'gray', 'grey', 'beige', 'cream', 'brown', 'navy', 'denim'].some((neutral) =>
      color.includes(neutral),
    );

    if (isNeutral) {
      NEUTRAL_BOTTOM_COLORS.forEach((item) => colors.add(item));
      return;
    }

    ['black', 'white', 'gray', 'grey', 'beige', 'cream', 'navy', 'denim'].forEach((item) => colors.add(item));

    if (color.includes('red') || color.includes('pink') || color.includes('rose')) {
      ['blue', 'navy', 'denim', 'brown', 'cream', 'beige'].forEach((item) => colors.add(item));
    } else if (color.includes('orange') || color.includes('yellow') || color.includes('gold')) {
      ['blue', 'navy', 'denim', 'brown', 'olive'].forEach((item) => colors.add(item));
    } else if (color.includes('green') || color.includes('olive')) {
      ['brown', 'beige', 'cream', 'navy', 'denim'].forEach((item) => colors.add(item));
    } else if (color.includes('blue') || color.includes('teal') || color.includes('cyan')) {
      ['white', 'gray', 'grey', 'beige', 'cream', 'brown', 'denim'].forEach((item) => colors.add(item));
    } else if (color.includes('purple') || color.includes('violet') || color.includes('lavender')) {
      ['black', 'gray', 'grey', 'white', 'cream', 'beige', 'navy'].forEach((item) => colors.add(item));
    }
  });

  return Array.from(colors);
}

function pageItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | 'dots-start' | 'dots-end'> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('dots-start');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('dots-end');
  pages.push(totalPages);

  return pages;
}

export default function CatalogScreen() {
  const { openNav } = useNav();
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ toneColors?: string; toneLabel?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [lookups, setLookups] = useState<Lookups>({
    categories: [],
    sizes: [],
    genders: [],
    garmentTypes: [],
    colorFamilies: [],
    fashionStyles: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | string | 'all'>('all');
  const [sizeLabel, setSizeLabel] = useState<string | 'all'>('all');
  const [genderId, setGenderId] = useState<number | string | 'all'>('all');
  const [audienceId, setAudienceId] = useState<number | string | 'all'>('all');
  const [colorFamilyId, setColorFamilyId] = useState<number | string | 'all'>('all');
  const [styleId, setStyleId] = useState<number | string | 'all'>('all');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState<SortOption>('newest');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toneColorNames, setToneColorNames] = useState<string[]>([]);
  const [toneLabel, setToneLabel] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState('');

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
      fashionStyles: meta.fashionStyles ?? [],
      styleAudiences: meta.styleAudiences ?? [],
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

  useEffect(() => {
    const toneColors = Array.isArray(params.toneColors) ? params.toneColors[0] : params.toneColors;
    const nextToneLabel = Array.isArray(params.toneLabel) ? params.toneLabel[0] : params.toneLabel;

    if (!toneColors) return;

    setToneColorNames(
      toneColors
        .split('|')
        .map((name: string) => name.trim())
        .filter(Boolean),
    );
    setToneLabel(nextToneLabel ?? 'Skin Tone AI');
  }, [params.toneColors, params.toneLabel]);

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
    audienceId !== 'all',
    colorFamilyId !== 'all',
    styleId !== 'all',
    toneColorNames.length > 0,
    !inStockOnly,
    priceRange !== 'all',
    sort !== 'newest',
  ].filter(Boolean).length;

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const selectedToneColors = toneColorNames.map(normalizeColorName).filter(Boolean);
    const selectedSize = sizeLabel === 'all' ? null : normalizeSizeLabel(sizeLabel);
    const skinMatchedTopColors = products
      .filter((product) => isTopProduct(product) && colorNamesOverlap(selectedToneColors, productColorNames(product)))
      .flatMap(productColorNames);
    const bottomReferenceColors = skinMatchedTopColors.length
      ? bottomHarmonyColorsForTop(skinMatchedTopColors)
      : [];

    const filtered = products.filter((product) => {
      const sizes = productSizeLabels(product).map(normalizeSizeLabel).filter(Boolean);
      const explicitNameSize = productNameSizeHint(product);
      const text = [
        product.name,
        product.description,
        product.brand,
        product.color,
        product.colorName,
        product.colorFamily,
        product.category,
        product.gender,
        product.audienceTags,
        product.size,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const colors = productColorNames(product);
      const isSkinToneMatchedProduct = isTopProduct(product) || isDressProduct(product);
      const matchesSkinToneColors =
        !selectedToneColors.length ||
        (isSkinToneMatchedProduct && colorNamesOverlap(selectedToneColors, colors)) ||
        (isBottomProduct(product) && colorNamesOverlap(bottomReferenceColors, colors));
      const matchesSelectedSize =
        !selectedSize || (sizes.includes(selectedSize) && (!explicitNameSize || explicitNameSize === selectedSize));

      return (
        (!term || text.includes(term)) &&
        (categoryId === 'all' || String(product.categoryId) === String(categoryId)) &&
        matchesSelectedSize &&
        (genderId === 'all' || String(product.genderId) === String(genderId)) &&
        (audienceId === 'all' || String(product.audienceIds ?? '').split(',').includes(String(audienceId))) &&
        (colorFamilyId === 'all' || String(product.colorFamilyId) === String(colorFamilyId)) &&
        (styleId === 'all' || String(product.styleId) === String(styleId)) &&
        matchesSkinToneColors &&
        (priceRange === 'all' ||
          (priceRange === 'under500' && product.price < 500) ||
          (priceRange === '500to1000' && product.price >= 500 && product.price <= 1000) ||
          (priceRange === 'over1000' && product.price > 1000)) &&
        (!inStockOnly || product.qty > 0)
      );
    });

    return filtered.sort((a, b) => {
      // Keep explicit user choices first while preserving the selected sort
      // within each preference group. Untagged legacy products remain visible.
      const preferredAudiences = user?.audienceIds ?? [];
      const score = (product: Product) => {
        const productAudienceIds = String(product.audienceIds ?? '').split(',').map(Number);
        const audienceMatch = preferredAudiences.some((id) => productAudienceIds.includes(id)) ? 2 : 0;
        const sizeMatch = selectedSize && productSizeLabels(product).map(normalizeSizeLabel).includes(selectedSize) ? 1 : 0;
        return audienceMatch + sizeMatch;
      };
      const priority = score(b) - score(a);
      if (priority) return priority;
      if (sort === 'priceLow') return a.price - b.price;
      if (sort === 'priceHigh') return b.price - a.price;
      return 0;
    });
  }, [
    categoryId,
    colorFamilyId,
    styleId,
    genderId,
    audienceId,
    inStockOnly,
    products,
    user?.audienceIds,
    priceRange,
    search,
    sizeLabel,
    sort,
    toneColorNames,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageEndIndex = pageStartIndex + PRODUCTS_PER_PAGE;
  const visibleStart = filteredProducts.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageEndIndex, filteredProducts.length);

  useEffect(() => {
    setCurrentPage(1);
    setGoToPage('');
  }, [audienceId, categoryId, colorFamilyId, genderId, inStockOnly, priceRange, search, sizeLabel, sort, styleId, toneColorNames]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const moveToPage = (page: number) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
    setGoToPage('');
  };

  const submitGoToPage = () => {
    const page = Number.parseInt(goToPage, 10);
    if (Number.isNaN(page)) return;
    moveToPage(page);
  };

  const resetFilters = () => {
    setCategoryId('all');
    setSizeLabel('all');
    setGenderId('all');
    setAudienceId('all');
    setColorFamilyId('all');
    setStyleId('all');
    setToneColorNames([]);
    setToneLabel('');
    setInStockOnly(true);
    setPriceRange('all');
    setSort('newest');
  };
  // Use the actual available row width. A fixed minimum here would make two
  // columns overflow on compact Android devices.
  const cardWidth = Math.floor((screenWidth - Spacing.md * 2 - GRID_GAP) / 2);

  if (loading) {
    return (
      <View style={styles.skeletonScreen}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonBrand} />
          <View style={styles.skeletonSearch} />
          <View style={styles.skeletonBanner} />
          <View style={styles.skeletonTabs} />
        </View>
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} style={[styles.skeletonCard, { width: cardWidth }]} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredProducts.slice(pageStartIndex, pageEndIndex)}
        keyExtractor={(item) => item.id}
        extraData={`${currentPage}-${filteredProducts.length}-${search}-${categoryId}-${sizeLabel}-${genderId}-${audienceId}-${colorFamilyId}-${priceRange}-${sort}-${inStockOnly}-${cardWidth}`}
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
                  <Image source={require('../../assets/afro-logo-black.png')} style={styles.headerLogoImage} resizeMode="contain" />
                </View>
                <Text style={styles.brand}>A'FRO</Text>
              </View>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={openNav}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu-outline" size={28} color={Colors.brand.blue} />
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
                <Ionicons name="options" size={21} color= "#d2dcf5" />
                {activeFilterCount > 0 ? <Text style={styles.filterBadge}>{activeFilterCount}</Text> : null}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.toneCard}
              onPress={() => router.push('/(tabs)/skin-tone')}
              activeOpacity={0.82}
            >
              <View style={styles.toneGlow} />
              <View style={styles.toneOrbOne} />
              <View style={styles.toneOrbTwo} />
              <View style={styles.toneIcon}>
                <Ionicons name="color-palette-outline" size={22} color={Colors.white} />
              </View>
              <View style={styles.toneCopy}>
                <Text style={styles.bannerEyebrow}>PERSONALIZED PALETTE</Text>
                <Text style={styles.toneTitle}>
                  {toneColorNames.length ? `${toneLabel || 'Skin Tone AI'} matches` : 'Skin Tone AI'}
                </Text>
                <Text style={styles.toneText} numberOfLines={1}>
                  {toneColorNames.length
                    ? `${toneColorNames.slice(0, 4).join(', ')} / matched looks`
                    : 'Analyze a photo to filter catalog colors'}
                </Text>
              </View>
              {toneColorNames.length ? (
                <TouchableOpacity
                  style={styles.toneClearButton}
                  onPress={(event: GestureResponderEvent) => {
                    event.stopPropagation();
                    setToneColorNames([]);
                    setToneLabel('');
                  }}
                >
                  <Ionicons name="close" size={18} color={Colors.text.primary} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mixCard}
              onPress={() => router.push('/(tabs)/mix-match')}
              activeOpacity={0.82}
            >
              <View style={styles.mixGlow} />
              <View style={styles.mixGrid}>
                <View style={[styles.mixTile, { backgroundColor: '#BBD3EE' }]} />
                <View style={[styles.mixTile, { backgroundColor: '#6FA3DB' }]} />
                <View style={[styles.mixTile, { backgroundColor: '#1B6DBB' }]} />
                <View style={[styles.mixTile, { backgroundColor: Colors.brand.blue }]} />
              </View>
              <View style={styles.mixIcon}>
                <Ionicons name="swap-horizontal-outline" size={22} color={Colors.white} />
              </View>
              <View style={styles.mixCopy}>
                <Text style={styles.mixEyebrow}>BUILD YOUR LOOK</Text>
                <Text style={styles.mixTitle}>Mix & Match</Text>
                <Text style={styles.mixText} numberOfLines={2}>
                  Pair tops and bottoms, to Try On
                </Text>
              </View>
            </TouchableOpacity>

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
                    {selected ? <MotiView from={{ opacity: 0, scaleX: 0.35 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ type: 'timing', duration: 220 }} style={styles.tabIndicator} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {filteredProducts.length > PRODUCTS_PER_PAGE
                  ? `Showing ${visibleStart}-${visibleEnd} of ${filteredProducts.length} items`
                  : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'item' : 'items'} available`}
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
        ListFooterComponent={
          filteredProducts.length > PRODUCTS_PER_PAGE ? (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              goToPage={goToPage}
              onGoToPageChange={setGoToPage}
              onPageChange={moveToPage}
              onSubmitGoToPage={submitGoToPage}
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <ProductCard
            product={item}
            index={index}
            width={cardWidth}
            isSaved={savedIds.has(item.id)}
            onToggleSaved={() => toggleSaved(item.id)}
            onTryOn={() =>
              router.push({
                pathname: '/(tabs)/try-on',
                params: { productId: item.id },
              })
            }
          />
        )}
      />

      <FilterModal
        visible={filtersOpen}
        lookups={lookups}
        categoryId={categoryId}
        sizeLabel={sizeLabel}
        genderId={genderId}
        audienceId={audienceId}
        colorFamilyId={colorFamilyId}
        styleId={styleId}
        inStockOnly={inStockOnly}
        priceRange={priceRange}
        sort={sort}
        resultCount={filteredProducts.length}
        onCategoryChange={setCategoryId}
        onSizeChange={setSizeLabel}
        onGenderChange={setGenderId}
        onAudienceChange={setAudienceId}
        onColorFamilyChange={setColorFamilyId}
        onStyleChange={setStyleId}
        onStockChange={setInStockOnly}
        onPriceRangeChange={setPriceRange}
        onSortChange={setSort}
        onReset={resetFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  goToPage,
  onGoToPageChange,
  onPageChange,
  onSubmitGoToPage,
}: {
  currentPage: number;
  totalPages: number;
  goToPage: string;
  onGoToPageChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSubmitGoToPage: () => void;
}) {
  return (
    <View style={styles.paginationWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.paginationScroller}
      >
        <TouchableOpacity
          style={[styles.pageArrow, currentPage === 1 && styles.pageDisabled]}
          disabled={currentPage === 1}
          onPress={() => onPageChange(currentPage - 1)}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={styles.pageNumberGroup}>
          {pageItems(currentPage, totalPages).map((page) =>
            typeof page === 'number' ? (
              <TouchableOpacity
                key={page}
                style={[styles.pageNumber, page === currentPage && styles.pageNumberActive]}
                onPress={() => onPageChange(page)}
                activeOpacity={0.75}
              >
                <Text style={[styles.pageNumberText, page === currentPage && styles.pageNumberTextActive]}>
                  {page}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text key={page} style={styles.pageDots}>
                ...
              </Text>
            ),
          )}
        </View>

        <TouchableOpacity
          style={[styles.pageArrow, currentPage === totalPages && styles.pageDisabled]}
          disabled={currentPage === totalPages}
          onPress={() => onPageChange(currentPage + 1)}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-forward" size={24} color={Colors.white} />
        </TouchableOpacity>

        <Text style={styles.goLabel}>Go to page:</Text>
        <TextInput
          value={goToPage}
          onChangeText={(value) => onGoToPageChange(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder={String(currentPage)}
          placeholderTextColor={Colors.white}
          style={styles.goInput}
          returnKeyType="go"
          onSubmitEditing={onSubmitGoToPage}
        />
        <TouchableOpacity style={styles.goButton} onPress={onSubmitGoToPage} activeOpacity={0.75}>
          <Text style={styles.goButtonText}>GO</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ProductCard({
  product,
  index,
  width,
  isSaved,
  onToggleSaved,
  onTryOn,
}: {
  product: Product;
  index: number;
  width: number;
  isSaved: boolean;
  onToggleSaved: () => void;
  onTryOn: () => void;
}) {
  const router = useRouter();
  const uri = imageUrl(product.imageUrl);
  const sizes = productSizeLabels(product);
  const primarySize = sizes[0];
  const soldOut = product.qty <= 0;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320, delay: Math.min(index, 7) * 45 }}
      style={[styles.cardMotion, { width }]}
    >
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
        <PressableScale
          style={styles.heartButton}
          pressedScale={0.82}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onToggleSaved();
          }}
        >
          <MotiView animate={{ scale: isSaved ? 1.16 : 1, rotate: isSaved ? '0deg' : '-8deg' }} transition={{ type: 'spring', damping: 9 }}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={21} color={isSaved ? '#E05274' : '#276296'} />
          </MotiView>
        </PressableScale>
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {[product.category, product.color, product.audienceTags, primarySize].filter(Boolean).join(' / ')}
      </Text>

      <View style={styles.footer}>
        <View style={styles.priceBlock}>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>{compactPeso(product.price)}</Text>
          <Text style={[styles.stock, soldOut && styles.stockOut]} numberOfLines={1}>
            {soldOut ? 'Sold out' : `${product.qty} in stock`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.tryOnButton, soldOut && styles.tryOnDisabled]}
          disabled={soldOut}
          hitSlop={4}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onTryOn();
          }}
        >
          <Ionicons name="sparkles-outline" size={16} color="#0F4C8A" />
          <Text style={styles.tryOnText}>Try on</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    </MotiView>
  );
}

type FilterModalProps = {
  visible: boolean;
  lookups: Lookups;
  categoryId: number | string | 'all';
  sizeLabel: string | 'all';
  genderId: number | string | 'all';
  audienceId: number | string | 'all';
  colorFamilyId: number | string | 'all';
  styleId: number | string | 'all';
  inStockOnly: boolean;
  priceRange: PriceRange;
  sort: SortOption;
  resultCount: number;
  onCategoryChange: (value: number | string | 'all') => void;
  onSizeChange: (value: string | 'all') => void;
  onGenderChange: (value: number | string | 'all') => void;
  onAudienceChange: (value: number | string | 'all') => void;
  onColorFamilyChange: (value: number | string | 'all') => void;
  onStyleChange: (value: number | string | 'all') => void;
  onStockChange: (value: boolean) => void;
  onPriceRangeChange: (value: PriceRange) => void;
  onSortChange: (value: SortOption) => void;
  onReset: () => void;
  onClose: () => void;
};

function FilterModal({
  visible,
  lookups,
  categoryId,
  sizeLabel,
  genderId,
  audienceId,
  colorFamilyId,
  styleId,
  inStockOnly,
  priceRange,
  sort,
  resultCount,
  onCategoryChange,
  onSizeChange,
  onGenderChange,
  onAudienceChange,
  onColorFamilyChange,
  onStyleChange,
  onStockChange,
  onPriceRangeChange,
  onSortChange,
  onReset,
  onClose,
}: FilterModalProps) {
  const [draft, setDraft] = useState<FilterValues>({
    categoryId,
    sizeLabel,
    genderId,
    audienceId,
    colorFamilyId,
    styleId,
    inStockOnly,
    priceRange,
    sort,
  });

  useEffect(() => {
    if (!visible) return;
    setDraft({ categoryId, sizeLabel, genderId, audienceId, colorFamilyId, styleId, inStockOnly, priceRange, sort });
  }, [audienceId, categoryId, colorFamilyId, genderId, inStockOnly, priceRange, sizeLabel, sort, styleId, visible]);

  const applyFilters = () => {
    onCategoryChange(draft.categoryId);
    onSizeChange(draft.sizeLabel);
    onGenderChange(draft.genderId);
    onAudienceChange(draft.audienceId);
    onColorFamilyChange(draft.colorFamilyId);
    onStyleChange(draft.styleId);
    onStockChange(draft.inStockOnly);
    onPriceRangeChange(draft.priceRange);
    onSortChange(draft.sort);
    onClose();
  };

  const resetDraft = () => {
    const reset: FilterValues = {
      categoryId: 'all',
      sizeLabel: 'all',
      genderId: 'all',
      audienceId: 'all',
      colorFamilyId: 'all',
      styleId: 'all',
      inStockOnly: true,
      priceRange: 'all',
      sort: 'newest',
    };
    setDraft(reset);
    onReset();
  };
  const hasDraftChanges =
    draft.categoryId !== categoryId ||
    draft.sizeLabel !== sizeLabel ||
    draft.genderId !== genderId ||
    draft.audienceId !== audienceId ||
    draft.colorFamilyId !== colorFamilyId ||
    draft.styleId !== styleId ||
    draft.inStockOnly !== inStockOnly ||
    draft.priceRange !== priceRange ||
    draft.sort !== sort;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.filterModalOverlay}>
        <TouchableOpacity style={styles.filterModalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>More filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconTap}>
            <Ionicons name="close" size={23} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollContent} keyboardShouldPersistTaps="handled">
          <FilterSection title="Category">
            <Chip label="All" selected={draft.categoryId === 'all'} onPress={() => setDraft((current) => ({ ...current, categoryId: 'all' }))} />
            {lookups.categories.map((category) => (
              <Chip
                key={category.id}
                label={lookupLabel(category)}
                selected={draft.categoryId !== 'all' && String(draft.categoryId) === String(category.id)}
                onPress={() => setDraft((current) => ({ ...current, categoryId: category.id }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Size">
            <Chip label="All" selected={draft.sizeLabel === 'all'} onPress={() => setDraft((current) => ({ ...current, sizeLabel: 'all' }))} />
            {lookups.sizes.map((size) => {
              const label = lookupLabel(size);
              return (
                <Chip
                  key={size.id}
                  label={label}
                  selected={draft.sizeLabel === label}
                  onPress={() => setDraft((current) => ({ ...current, sizeLabel: label }))}
                />
              );
            })}
          </FilterSection>

          <FilterSection title="Gender">
            <Chip label="All" selected={draft.genderId === 'all'} onPress={() => setDraft((current) => ({ ...current, genderId: 'all' }))} />
            {lookups.genders.map((gender) => (
              <Chip
                key={gender.id}
                label={lookupLabel(gender)}
                selected={draft.genderId !== 'all' && String(draft.genderId) === String(gender.id)}
                onPress={() => setDraft((current) => ({ ...current, genderId: gender.id }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Audience">
            <Chip label="All" selected={draft.audienceId === 'all'} onPress={() => setDraft((current) => ({ ...current, audienceId: 'all' }))} />
            {(lookups.styleAudiences ?? []).map((audience) => <Chip key={audience.id} label={lookupLabel(audience)} selected={draft.audienceId !== 'all' && String(draft.audienceId) === String(audience.id)} onPress={() => setDraft((current) => ({ ...current, audienceId: audience.id }))} />)}
          </FilterSection>

          <FilterSection title="Color">
            <Chip label="All" selected={draft.colorFamilyId === 'all'} onPress={() => setDraft((current) => ({ ...current, colorFamilyId: 'all' }))} />
            {(lookups.colorFamilies ?? []).map((family) => (
              <Chip
                key={family.id}
                label={lookupLabel(family)}
                selected={draft.colorFamilyId !== 'all' && String(draft.colorFamilyId) === String(family.id)}
                onPress={() => setDraft((current) => ({ ...current, colorFamilyId: family.id }))}
              />
            ))}
          </FilterSection>
          <FilterSection title="Fashion Style">
            <Chip label="All" selected={draft.styleId === 'all'} onPress={() => setDraft((current) => ({ ...current, styleId: 'all' }))} />
            {(lookups.fashionStyles ?? []).map((style) => <Chip key={style.id} label={lookupLabel(style)} selected={draft.styleId !== 'all' && String(draft.styleId) === String(style.id)} onPress={() => setDraft((current) => ({ ...current, styleId: style.id }))} />)}
          </FilterSection>

          <FilterSection title="Availability">
            <Chip label="In stock" selected={draft.inStockOnly} onPress={() => setDraft((current) => ({ ...current, inStockOnly: true }))} />
            <Chip label="Show all" selected={!draft.inStockOnly} onPress={() => setDraft((current) => ({ ...current, inStockOnly: false }))} />
          </FilterSection>

          <FilterSection title="Price range">
            {(Object.keys(PRICE_RANGE_LABELS) as PriceRange[]).map((range) => (
              <Chip
                key={range}
                label={PRICE_RANGE_LABELS[range]}
                selected={draft.priceRange === range}
                onPress={() => setDraft((current) => ({ ...current, priceRange: range }))}
              />
            ))}
          </FilterSection>

          <FilterSection title="Sort by">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
              <Chip
                key={option}
                label={SORT_LABELS[option]}
                selected={draft.sort === option}
                onPress={() => setDraft((current) => ({ ...current, sort: option }))}
              />
            ))}
          </FilterSection>
        </ScrollView>

        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.resetButton} onPress={resetDraft}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
            <Text style={styles.applyText}>
              {hasDraftChanges ? 'Apply filters' : `Show ${resultCount} ${resultCount === 1 ? 'item' : 'items'}`}
            </Text>
          </TouchableOpacity>
        </View>
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
  skeletonScreen: { flex: 1, backgroundColor: Colors.bg.primary, paddingTop: 48 },
  skeletonHeader: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  skeletonBrand: { width: 110, height: 28, borderRadius: Radius.full, backgroundColor: '#E5EEF8' },
  skeletonSearch: { height: 44, borderRadius: Radius.md, backgroundColor: '#E5EEF8' },
  skeletonBanner: { height: 84, borderRadius: Radius.md, backgroundColor: '#DCEBFA' },
  skeletonTabs: { width: '72%', height: 34, borderRadius: Radius.full, backgroundColor: '#E5EEF8' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, padding: Spacing.md },
  skeletonCard: { flexGrow: 0 },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: 98,
  },
  row: {
    gap: Spacing.md,
    justifyContent: 'flex-start',
  },
  header: {
    marginBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
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
    overflow: 'hidden',
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
  menuButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationWrap: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  paginationScroller: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  pageArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0E4F8D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageDisabled: {
    opacity: 0.45,
  },
  pageNumberGroup: {
    minHeight: 48,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DCF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  pageNumber: {
    minWidth: 30,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberActive: {
    backgroundColor: '#EAF4FF',
  },
  pageNumberText: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  pageNumberTextActive: {
    color: Colors.text.primary,
  },
  pageDots: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    paddingHorizontal: Spacing.xs,
  },
  goLabel: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  goInput: {
    width: 58,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9DCF2',
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 0,
  },
  goButton: {
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: '#0E4F8D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  goButtonText: {
    color: Colors.white,
    fontSize: FontSize.base,
    fontWeight: '900',
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#A9CAF0',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#0E4F8D',
    borderWidth: 1,
    borderColor: '#0E4F8D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#073A70',
    borderColor: '#073A70',
  },
  filterBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    color: Colors.bg.primary,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  toneCard: {
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#0E4F8D',
    borderColor: '#0E4F8D',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    minHeight: 58,
    paddingHorizontal: Spacing.md,
  },
  toneGlow: { position: 'absolute', width: 148, height: 148, borderRadius: 74, right: -56, top: -58, backgroundColor: 'rgba(129,203,255,0.18)' },
  toneOrbOne: { position: 'absolute', width: 34, height: 34, borderRadius: 17, right: 28, bottom: -14, backgroundColor: 'rgba(247,202,150,0.40)' },
  toneOrbTwo: { position: 'absolute', width: 18, height: 18, borderRadius: 9, right: 9, top: 9, backgroundColor: 'rgba(255,255,255,0.34)' },
  toneIcon: {
    alignItems: 'center',
    backgroundColor: '#1A67AB',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  toneCopy: {
    flex: 1,
  },
  bannerEyebrow: { color: 'rgba(234,244,255,0.78)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  toneTitle: {
    color: "#EAF4FF",
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  toneText: {
    color: '#EAF4FF',
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  toneClearButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  mixCard: {
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#DCEBFA',
    borderColor: '#C9DCF2',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    minHeight: 58,
    paddingHorizontal: Spacing.md,
  },
  mixGlow: { position: 'absolute', right: -40, top: -64, height: 148, width: 148, borderRadius: 74, backgroundColor: 'rgba(255,255,255,0.55)' },
  mixGrid: { position: 'absolute', right: 12, top: 12, width: 38, height: 38, flexDirection: 'row', flexWrap: 'wrap', gap: 2, transform: [{ rotate: '12deg' }], opacity: 0.9 },
  mixTile: { width: 18, height: 18, borderRadius: 5 },
  mixIcon: {
    alignItems: 'center',
    backgroundColor: '#0E4F8D',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  mixCopy: {
    flex: 1,
  },
  mixEyebrow: { color: '#0F4C8A', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  mixTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  mixText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 15,
  },
  tabs: {
    flexGrow: 1,
    gap: Spacing.md,
    justifyContent: 'center',
    paddingBottom: Spacing.sm,
  },
  tab: {
    overflow: 'hidden',
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
  tabIndicator: { position: 'absolute', bottom: 0, height: 3, width: 26, borderRadius: Radius.full, backgroundColor: '#A9DBFF' },
  tabActive: {
    backgroundColor: '#0E4F8D',
    borderColor: '#0E4F8D',
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
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E1EAF5',
    padding: 9,
    marginBottom: Spacing.md,
    minHeight: 274,
  },
  cardMotion: { marginBottom: Spacing.md },
  imageFrame: {
    aspectRatio: 1,
    borderRadius: Radius.sm,
    backgroundColor: '#EDF4FD',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    borderWidth: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 17,
    minHeight: 34,
  },
  meta: {
    color: Colors.text.secondary,
    fontSize: 10,
    marginTop: 2,
    minHeight: 14,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  priceBlock: {
    flex: 1,
    minWidth: 0,
  },
  price: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  stock: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  stockOut: {
    color: '#B42318',
  },
  tryOnButton: {
    height: 36,
    flexShrink: 0,
    borderRadius: Radius.full,
    backgroundColor: '#E6F0FB',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  tryOnDisabled: {
    opacity: 0.45,
  },
  tryOnText: {
    color: '#0F4C8A',
    fontSize: 13,
    fontWeight: '700',
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
  filterModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7, 28, 52, 0.48)',
  },
  filterModalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sheetScrollContent: { paddingBottom: Spacing.md },
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
    paddingBottom: Spacing.xs,
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
