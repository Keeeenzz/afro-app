import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useNav } from '@/context/NavContext';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { ReactNode } from 'react';

type ProductImage = {
  id: string;
  imageUrl: string;
  isPrimary?: boolean;
  displayOrder?: number;
};

type SizeStock = {
  sizeId: number | string;
  label: string;
  stockQty: number;
};

type Measurement = {
  sizeId?: number | string;
  sizeLabel?: string;
  garmentType?: string;
  measurementName: string;
  valueCm: number;
};

type ProductDetail = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  qty: number;
  brand?: string | null;
  color?: string | null;
  colorHex?: string | null;
  avgRating?: number | null;
  isActive: boolean;
  category?: string | null;
  categorySlug?: string | null;
  gender?: string | null;
  sizeId?: number | string | null;
  size?: string | null;
  sizes?: string | null;
  sizeQty?: number | null;
  imageUrl?: string | null;
  images?: ProductImage[];
  sizeStock?: SizeStock[];
  measurements?: Measurement[];
};

function peso(value: number) {
  return `PHP ${Number(value ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortPeso(value: number) {
  return `₱ ${Number(value ?? 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0,
  })}`;
}

export default function ProductOverviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { openNav } = useNav();
  const { user, token } = useAuthStore();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inquiring, setInquiring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState<number | string | null>(null);

  const loadProduct = async () => {
    if (!id) return;
    setError('');
    const [item, savedIds] = await Promise.all([
      apiGet<ProductDetail>(`/products/${id}`),
      user?.user_id ? apiGet<string[]>(`/saved/${user.user_id}/ids`, token) : Promise.resolve([]),
    ]);
    if (!item) {
      setProduct(null);
      setError('Product was not found.');
      return;
    }

    setProduct(item);
    setIsSaved(savedIds.map(String).includes(String(item.id)));
    const primaryImage = item.images?.[0]?.imageUrl ?? item.imageUrl ?? '';
    setSelectedImage(primaryImage);
    const firstAvailableSize = item.sizeStock?.find((size) => Number(size.stockQty) > 0);
    setSelectedSizeId((current) => current ?? firstAvailableSize?.sizeId ?? item.sizeId ?? null);
  };

  useEffect(() => {
    loadProduct()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load product.'))
      .finally(() => setLoading(false));
  }, [id, token, user?.user_id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh product.');
    } finally {
      setRefreshing(false);
    }
  };

  const imageItems = useMemo(() => {
    const urls = [
      ...(product?.images?.map((image) => image.imageUrl) ?? []),
      product?.imageUrl,
    ].filter(Boolean) as string[];

    return Array.from(new Set(urls));
  }, [product]);

  const selectedSize = product?.sizeStock?.find(
    (size) => String(size.sizeId) === String(selectedSizeId),
  );
  const selectedSizeLabel = selectedSize?.label ?? product?.size ?? null;
  const isSoldOut = !product || Number(product.qty ?? 0) <= 0;
  const canAddToCart = !!product && !!user?.user_id && !!selectedSizeId && !isSoldOut && !adding;

  const handleToggleSaved = async () => {
    if (!product || !user?.user_id || saving) return;

    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    setSaving(true);
    try {
      const result = await apiPost<{ isSaved: boolean }>(
        '/saved/toggle',
        { userId: user.user_id, productId: product.id },
        token,
      );
      setIsSaved(result.isSaved);
    } catch (err) {
      setIsSaved(wasSaved);
      Alert.alert('Could not update saved', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product || !user?.user_id) {
      Alert.alert('Login required', 'Please login before adding products to your cart.');
      return;
    }

    if (!selectedSizeId) {
      Alert.alert('Choose a size', 'Select an available size first.');
      return;
    }

    setAdding(true);
    try {
      await apiPost(
        '/cart/items',
        {
          userId: user.user_id,
          productId: product.id,
          sizeId: selectedSizeId,
          quantity: 1,
        },
        token,
      );
      Alert.alert('Added to cart', `${product.name}${selectedSizeLabel ? ` - ${selectedSizeLabel}` : ''} is in your cart.`);
    } catch (err) {
      Alert.alert('Could not add item', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleStartInquiry = async () => {
    if (!product || !user?.user_id) {
      Alert.alert('Login required', 'Please login before sending a product inquiry.');
      return;
    }

    setInquiring(true);
    try {
      const conversation = await apiPost<{ id: string }>(
        '/chat/conversations',
        { userId: user.user_id, productId: product.id },
        token,
      );
      router.push({ pathname: '/(tabs)/messages', params: { conversationId: conversation.id } });
    } catch (err) {
      Alert.alert('Could not start chat', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setInquiring(false);
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => router.back()}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={27} color={Colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.brandLockup}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.brand}>A'FRO</Text>
        </View>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={openNav}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu-outline" size={30} color={Colors.brand.blueLight} />
        </TouchableOpacity>
      </View>

      {!product ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={34} color={Colors.text.secondary} />
          <Text style={styles.emptyTitle}>Product unavailable</Text>
          <Text style={styles.emptyText}>{error || 'This product could not be loaded.'}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
        >
          <View style={styles.heroImage}>
            {selectedImage ? (
              <Image source={{ uri: imageUrl(selectedImage) ?? selectedImage }} style={styles.image} resizeMode="cover" />
            ) : (
              <Ionicons name="image-outline" size={42} color={Colors.text.secondary} />
            )}
          </View>

          {imageItems.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
              {imageItems.map((image) => {
                const selected = selectedImage === image;
                return (
                  <TouchableOpacity
                    key={image}
                    style={[styles.thumbnail, selected && styles.thumbnailActive]}
                    onPress={() => setSelectedImage(image)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: imageUrl(image) ?? image }} style={styles.thumbnailImage} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text style={styles.category} numberOfLines={1}>
                  {[product.category, product.gender].filter(Boolean).join(' / ') || 'A\'FRO'}
                </Text>
                <Text style={styles.name}>{product.name}</Text>
              </View>
              <TouchableOpacity
                style={[styles.favoriteButton, isSaved && styles.favoriteButtonSaved]}
                activeOpacity={0.75}
                onPress={handleToggleSaved}
              >
                <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={23} color="#276296" />
              </TouchableOpacity>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{shortPeso(product.price)}</Text>
              <Text style={[styles.stock, isSoldOut && styles.stockOut]}>
                {isSoldOut ? 'Sold out' : `${product.qty} in stock`}
              </Text>
            </View>
          </View>

          <DetailSection title="Product Details">
            <DetailRow label="Full price" value={peso(product.price)} />
            <DetailRow label="Brand" value={product.brand || "A'FRO"} />
            <DetailRow label="Garment type" value={product.category || 'Not set'} />
            <DetailRow label="Gender" value={product.gender || 'Not set'} />
            <DetailRow label="Color" value={product.color || 'Not set'} swatch={product.colorHex} />
            <DetailRow label="Rating" value={`${Number(product.avgRating ?? 0).toFixed(1)} / 5`} />
          </DetailSection>

          <DetailSection title="Description">
            <Text style={styles.description}>
              {product.description?.trim() || 'No product description has been added yet.'}
            </Text>
          </DetailSection>

          <DetailSection title="Available Sizes">
            {product.sizeStock?.length ? (
              <View style={styles.sizeGrid}>
                {product.sizeStock.map((size) => {
                  const selected = String(size.sizeId) === String(selectedSizeId);
                  const unavailable = Number(size.stockQty) <= 0;
                  return (
                    <TouchableOpacity
                      key={String(size.sizeId)}
                      style={[
                        styles.sizeChip,
                        selected && styles.sizeChipActive,
                        unavailable && styles.sizeChipDisabled,
                      ]}
                      onPress={() => !unavailable && setSelectedSizeId(size.sizeId)}
                      disabled={unavailable}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.sizeLabel, selected && styles.sizeLabelActive]}>{size.label}</Text>
                      <Text style={styles.sizeQty}>{unavailable ? 'Out' : `${size.stockQty} left`}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.description}>{product.sizes || product.size || 'No size stock has been set.'}</Text>
            )}
          </DetailSection>

          {product.measurements?.length ? (
            <DetailSection title="Measurements">
              <View style={styles.measureGrid}>
                {product.measurements.map((measurement) => (
                  <View
                    key={`${measurement.sizeId}-${measurement.garmentType}-${measurement.measurementName}`}
                    style={styles.measureCard}
                  >
                    <Text style={styles.measureName}>{measurement.measurementName}</Text>
                    <Text style={styles.measureValue}>{measurement.valueCm} cm</Text>
                    <Text style={styles.measureMeta} numberOfLines={1}>
                      {[measurement.sizeLabel, measurement.garmentType].filter(Boolean).join(' / ')}
                    </Text>
                  </View>
                ))}
              </View>
            </DetailSection>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}

      {product ? (
        <View style={styles.actionBar}>
          <TouchableOpacity style={[styles.tryOnButton, isSoldOut && styles.disabledButton]} disabled={isSoldOut}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.text.primary} />
            <Text style={styles.tryOnText}>Try On</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inquiryButton, inquiring && styles.disabledButton]}
            onPress={handleStartInquiry}
            disabled={inquiring}
          >
            {inquiring ? (
              <ActivityIndicator color={Colors.text.primary} size="small" />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.text.primary} />
                <Text style={styles.tryOnText}>Inquire</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cartButton, !canAddToCart && styles.disabledButton]}
            onPress={handleAddToCart}
            disabled={!canAddToCart}
          >
            {adding ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="cart-outline" size={19} color={Colors.white} />
                <Text style={styles.cartText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value, swatch }: { label: string; value: string; swatch?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
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
  header: {
    height: 76,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.bg.primary,
  },
  headerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    padding: Spacing.md,
    paddingBottom: 120,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#A8DDFF',
    borderWidth: 2,
    borderColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  thumbnailRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
  },
  thumbnailActive: {
    borderColor: Colors.brand.blueLight,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  titleText: {
    flex: 1,
  },
  category: {
    color: Colors.brand.blueLight,
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  name: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: '900',
    lineHeight: 30,
  },
  favoriteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(232, 244, 255, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonSaved: {
    backgroundColor: '#E8F4FF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  price: {
    color: '#C8E7FF',
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  stock: {
    color: Colors.status.success,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  stockOut: {
    color: Colors.status.error,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  detailRow: {
    minHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  detailLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  detailValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  detailValue: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    textAlign: 'right',
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  description: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sizeChip: {
    minWidth: 72,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  sizeChipActive: {
    backgroundColor: '#0B809A',
    borderColor: '#30B9D3',
  },
  sizeChipDisabled: {
    opacity: 0.42,
  },
  sizeLabel: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  sizeLabelActive: {
    color: Colors.white,
  },
  sizeQty: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  measureCard: {
    width: '48%',
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: Spacing.sm,
  },
  measureName: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  measureValue: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
    marginTop: 2,
  },
  measureMeta: {
    color: Colors.text.muted,
    fontSize: 10,
    marginTop: 2,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: 'rgba(10, 14, 26, 0.96)',
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  tryOnButton: {
    flex: 0.72,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.active,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  inquiryButton: {
    flex: 0.9,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.active,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  tryOnText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  cartButton: {
    flex: 1,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: '#0B809A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  cartText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginTop: Spacing.sm,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
