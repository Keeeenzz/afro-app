import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';
import { useTranslation } from '@/lib/i18n';

type OrderItem = {
  orderId: string;
  placedAt: string;
  updatedAt?: string | null;
  totalAmount: number;
  shippingFee?: number;
  paymentMethod?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  expectedDeliveryAt?: string | null;
  status: string;
  orderItemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  size: string;
  imageUrl?: string | null;
  reviewed?: boolean | number;
  shippingAddress?: string | null;
};

type Filter = 'All' | 'Active' | 'Delivered' | 'Cancelled';

const FILTERS: Filter[] = ['All', 'Active', 'Delivered', 'Cancelled'];

function peso(value: number) {
  return `₱ ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(value));
}

function normalizeStatus(status: string): Filter {
  const lower = status.toLowerCase();
  if (lower.includes('cancel')) return 'Cancelled';
  if (lower.includes('deliver') || lower.includes('complete')) return 'Delivered';
  return 'Active';
}

function timelineStatus(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes('out for delivery')) return 6;
  if (lower.includes('deliver') || lower.includes('complete')) return 7;
  if (lower.includes('transit')) return 5;
  if (lower.includes('ship') || lower.includes('ready')) return 4;
  if (lower.includes('process')) return 3;
  if (lower.includes('confirm')) return 2;
  return 1;
}

function canReviewOrder(status: string) {
  const normalized = normalizeStatus(status);
  return normalized === 'Delivered' || normalized === 'Cancelled';
}

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const targetOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { openNav } = useNav();
  const { user, token } = useAuthStore();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageBusyId, setMessageBusyId] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user?.user_id) {
      setOrders([]);
      return;
    }

    setError('');
    const nextOrders = await apiGet<OrderItem[]>(`/profile/${user.user_id}/orders`, token);
    setOrders(nextOrders);
  }, [token, user?.user_id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders()
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load orders.'))
        .finally(() => setLoading(false));
    }, [loadOrders]),
  );

  const groupedOrders = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    orders.forEach((order) => {
      map.set(order.orderId, [...(map.get(order.orderId) ?? []), order]);
    });
    return Array.from(map.values()).map((items) => items[0]);
  }, [orders]);

  const filteredOrders = useMemo(
    () => groupedOrders.filter((order) => filter === 'All' || normalizeStatus(order.status) === filter),
    [filter, groupedOrders],
  );

  const selectedOrder = selectedOrderId
    ? orders.filter((order) => order.orderId === selectedOrderId)
    : [];
  const selectedHead = selectedOrder[0];
  const selectedItem = selectedOrder.find((order) => order.orderItemId === selectedOrderItemId) ?? selectedHead;

  useEffect(() => {
    if (targetOrderId && orders.some((order) => order.orderId === targetOrderId)) {
      setSelectedOrderId(targetOrderId);
    }
  }, [orders, targetOrderId]);

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderItemId(null);
      setItemPickerOpen(false);
      return;
    }

    if (selectedOrder.length && !selectedOrder.some((order) => order.orderItemId === selectedOrderItemId)) {
      setSelectedOrderItemId(selectedOrder[0].orderItemId);
    }
  }, [selectedOrder, selectedOrderId, selectedOrderItemId]);

  const openOrder = (order: OrderItem) => {
    setSelectedOrderId(order.orderId);
    setSelectedOrderItemId(order.orderItemId);
  };

  const openProductOverview = (order: OrderItem) => {
    router.push({ pathname: '/(tabs)/product/[id]', params: { id: order.productId, from: 'orders', orderId: order.orderId } });
  };

  const startMessage = async (order: OrderItem) => {
    if (!user?.user_id || messageBusyId) return;

    setMessageBusyId(order.productId);
    try {
      const conversation = await apiPost<{ id: string }>(
        '/chat/conversations',
        { userId: user.user_id, productId: order.productId },
        token,
      );
      router.push({ pathname: '/(tabs)/messages', params: { conversationId: conversation.id } });
    } catch (err) {
      Alert.alert('Could not start chat', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setMessageBusyId('');
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh orders.');
    } finally {
      setRefreshing(false);
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
    <ImageBackground source={require('@/assets/afro-logo-black.png')} style={styles.screen} imageStyle={styles.bgImage}>
      <View style={styles.overlay}>
        <Header onMenu={openNav} onHome={() => router.replace('/(tabs)/catalog')} />

        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => (selectedOrderId ? setSelectedOrderId(null) : router.back())}>
            <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.titleText}>{t(selectedOrderId ? 'Track Order' : 'My Orders')}</Text>
          <View style={{ width: 25 }} />
        </View>

        {!selectedOrderId ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
          >
            <View style={styles.filterRow}>
              {FILTERS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterButton, filter === item && styles.filterButtonActive]}
                  onPress={() => setFilter(item)}
                >
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{t(item)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!filteredOrders.length ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={42} color={Colors.text.secondary} />
                <Text style={styles.emptyTitle}>{t('No orders found')}</Text>
                <Text style={styles.emptyText}>{t('Your checkout orders will appear here.')}</Text>
              </View>
            ) : (
              filteredOrders.map((order) => {
                const status = normalizeStatus(order.status);
                const orderItems = orders.filter((item) => item.orderId === order.orderId);
                const reviewed = orderItems.every((item) => Boolean(item.reviewed));
                const previewItems = orderItems.slice(0, 3);
                return (
                  <TouchableOpacity
                    key={order.orderId}
                    activeOpacity={0.84}
                    style={styles.orderCard}
                    onPress={() => openOrder(order)}
                    disabled={status !== 'Active' && reviewed}
                  >
                    <View style={[styles.orderImage, orderItems.length > 1 && styles.orderImageGrid]}>
                      {orderItems.length === 1 ? (order.imageUrl ? <Image source={{ uri: imageUrl(order.imageUrl) ?? order.imageUrl }} style={styles.singleOrderImage} /> : <Ionicons name="shirt-outline" size={28} color={Colors.text.muted} />) : previewItems.map((item) => item.imageUrl ? <Image key={item.orderItemId} source={{ uri: imageUrl(item.imageUrl) ?? item.imageUrl }} style={[styles.orderImageTile, orderItems.length === 2 && styles.orderImageTileTwo]} /> : <View key={item.orderItemId} style={[styles.orderImageTile, styles.orderImagePlaceholder, orderItems.length === 2 && styles.orderImageTileTwo]}><Ionicons name="shirt-outline" size={16} color={Colors.text.muted} /></View>)}
                      {orderItems.length > 3 ? <View style={styles.moreItems}><Text style={styles.moreItemsText}>+{orderItems.length - 3}</Text></View> : null}
                    </View>
                    <View style={styles.orderInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.orderName} numberOfLines={1}>{orderItems.length > 1 ? `${orderItems.length} items in this order` : order.productName}</Text>
                        {orderItems.length > 1 ? <Ionicons name="chevron-down" size={15} color={Colors.text.secondary} /> : null}
                        <Text style={styles.sizeBadge}>{order.size}</Text>
                      </View>
                      <Text style={styles.orderMeta} numberOfLines={1}>{orderItems.length > 1 ? 'Tap Track to view the item list' : `Qty ${order.quantity}`} • {order.status}</Text>
                      <Text style={styles.orderPrice}>{peso(Number(order.unitPrice) * Number(order.quantity))}</Text>
                      <Text style={[styles.orderStatusLine, status === 'Cancelled' && styles.cancelledText]}>
                        {status === 'Active'
                          ? `Expected delivery: ${formatDate(order.expectedDeliveryAt)}`
                          : `${status}: ${formatDate(order.updatedAt || order.placedAt)}`}
                      </Text>
                    </View>
                    <View style={styles.orderActionWrap}>
                      {status === 'Active' ? (
                        <TouchableOpacity style={styles.miniButton} onPress={() => openOrder(order)}>
                        <Text style={styles.miniButtonText}>{t('Track')}</Text>
                        </TouchableOpacity>
                      ) : canReviewOrder(order.status) ? (
                        <TouchableOpacity
                          style={[styles.miniButton, reviewed && styles.miniButtonMuted]}
                          onPress={() => !reviewed && setSelectedOrderId(order.orderId)}
                          disabled={reviewed}
                        >
                          <Text style={styles.miniButtonText}>{reviewed ? 'Reviewed' : 'To Review'}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        ) : selectedHead ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
          >
            {selectedOrder.length > 1 ? (
              <View style={styles.itemPickerCard}>
                <Text style={styles.pickerLabel}>Product in this order</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setItemPickerOpen((open) => !open)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.pickerButtonText} numberOfLines={1}>
                    {selectedItem?.productName ?? 'Choose a product'}
                  </Text>
                  <Ionicons name={itemPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.text.primary} />
                </TouchableOpacity>
                {itemPickerOpen ? (
                  <View style={styles.pickerMenu}>
                    {selectedOrder.map((item) => {
                      const selected = item.orderItemId === selectedItem?.orderItemId;
                      return (
                        <TouchableOpacity
                          key={item.orderItemId}
                          style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                          onPress={() => {
                            setSelectedOrderItemId(item.orderItemId);
                            setItemPickerOpen(false);
                          }}
                          activeOpacity={0.82}
                        >
                          <Text style={styles.pickerOptionTitle} numberOfLines={1}>{item.productName}</Text>
                          <Text style={styles.pickerOptionMeta}>Qty {item.quantity} - {item.size}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.trackProductCard}>
              {selectedItem?.imageUrl ? <Image source={{ uri: imageUrl(selectedItem.imageUrl) ?? selectedItem.imageUrl }} style={styles.trackImage} /> : <View style={styles.trackImage} />}
              <View style={styles.trackProductInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.orderName} numberOfLines={1}>{selectedItem?.productName}</Text>
                  <Text style={styles.sizeBadge}>{selectedItem?.size}</Text>
                </View>
                <Text style={styles.orderMeta}>Order has {selectedOrder.length} item{selectedOrder.length === 1 ? '' : 's'}</Text>
                <Text style={styles.trackPrice}>{peso(Number(selectedItem?.unitPrice ?? 0) * Number(selectedItem?.quantity ?? 1))}</Text>
              </View>
              {selectedItem ? (
                <TouchableOpacity style={styles.viewProductButton} onPress={() => openProductOverview(selectedItem)} activeOpacity={0.82}>
                  <Ionicons name="eye-outline" size={15} color= '#FFF' />
                </TouchableOpacity>
              ) : null}
            </View>

            {canReviewOrder(selectedHead.status) && selectedItem ? (
              <TouchableOpacity
                style={[styles.miniButton, Boolean(selectedItem.reviewed) && styles.miniButtonMuted]}
                onPress={() => !selectedItem.reviewed && router.push({ pathname: '/(tabs)/reviews', params: { productId: selectedItem.productId, orderId: selectedItem.orderId } })}
                disabled={Boolean(selectedItem.reviewed)}
              >
                <Text style={styles.miniButtonText}>{selectedItem.reviewed ? 'Reviewed' : 'To Review'}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>{t('Order Details')}</Text>
              <View style={styles.detailGrid}>
                {[
                  { icon: 'calendar-outline' as const, label: 'Delivery', value: formatDate(selectedHead.expectedDeliveryAt) },
                  { icon: 'git-branch-outline' as const, label: 'Tracking ID', value: selectedHead.trackingNumber || 'Not available yet' },
                  { icon: 'card-outline' as const, label: 'Payment', value: selectedHead.paymentMethod || 'GCash' },
                  { icon: 'location-outline' as const, label: 'Ship To', value: selectedHead.shippingAddress || 'Saved customer address' },
                ].map((detail) => (
                  <View key={detail.label} style={styles.detailCell}>
                    <View style={styles.detailIcon}><Ionicons name={detail.icon} size={16} color={Colors.brand.blue} /></View>
                    <View style={styles.detailCopy}>
                      <Text style={styles.detailLabel}>{detail.label}</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>{detail.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {selectedHead.trackingNumber || selectedHead.trackingUrl ? <View style={styles.trackingCard}><Text style={styles.sectionTitle}>Tracking</Text><Text style={styles.trackingText}>Tracking ID: {selectedHead.trackingNumber || 'Not available yet'}</Text>{selectedHead.trackingUrl ? <TouchableOpacity onPress={() => Linking.openURL(selectedHead.trackingUrl!)}><Text style={styles.trackingLink}>Open tracking link</Text></TouchableOpacity> : null}</View> : null}

            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>{t('Order Status')}</Text>
              {normalizeStatus(selectedHead.status) === 'Cancelled' ? (
                <View style={styles.cancelledStatusCard}>
                  <Ionicons name="close-circle" size={20} color={Colors.status.error} />
                  <View>
                    <Text style={styles.cancelledStatusTitle}>Order Cancelled</Text>
                    <Text style={styles.cancelledStatusText}>This order was cancelled on {formatDate(selectedHead.updatedAt || selectedHead.placedAt)}.</Text>
                  </View>
                </View>
              ) : [
                ['Order Placed', selectedHead.placedAt],
                ['Order Confirmed', selectedHead.updatedAt],
                ['Order Processed', selectedHead.updatedAt],
                ['Ready to Ship', selectedHead.expectedDeliveryAt],
                ['In Transit', selectedHead.updatedAt],
                ['Out for Delivery', selectedHead.updatedAt],
                ['Delivered', selectedHead.expectedDeliveryAt],
              ].map(([label, date], index) => {
                const complete = timelineStatus(selectedHead.status) >= index + 1;
                const current = timelineStatus(selectedHead.status) === index + 1;
                return (
                  <View key={label} style={styles.timelineRow}>
                    <MotiView animate={current ? { scale: [1, 1.23, 1] } : { scale: 1 }} transition={current ? { type: 'timing', duration: 1150, loop: true } : { type: 'timing', duration: 1 }} style={[styles.timelineDot, complete && styles.timelineDotComplete, current && styles.timelineDotCurrent]}>
                      <Ionicons name="checkmark" size={13} color={complete ? Colors.text.primary : Colors.text.muted} />
                    </MotiView>
                    {index < 6 ? <View style={[styles.timelineLine, complete && styles.timelineLineComplete]} /> : null}
                    <View style={styles.timelineTextWrap}>
                      <Text style={styles.timelineHint}>
                        {index === 0 ? 'We have placed your order' : index === 6 ? 'We have delivered your order' : 'We have updated your order'}
                      </Text>
                      <Text style={styles.timelineLabel}>{label}</Text>
                      <Text style={styles.timelineDate}>{formatDate(date)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.itemsCard}>
              <Text style={styles.sectionTitle}>{t('Ordered Items')}</Text>
              {selectedOrder.map((item) => (
                <TouchableOpacity
                  key={item.orderItemId}
                  style={[
                    styles.orderedItemRow,
                    item.orderItemId === selectedItem?.orderItemId && styles.orderedItemRowActive,
                  ]}
                  activeOpacity={0.84}
                  onPress={() => {
                    setSelectedOrderItemId(item.orderItemId);
                    openProductOverview(item);
                  }}
                >
                  {item.imageUrl ? <Image source={{ uri: imageUrl(item.imageUrl) ?? item.imageUrl }} style={styles.orderedItemImage} /> : <View style={styles.orderedItemImage} />}
                  <View style={styles.orderedItemInfo}>
                    <Text style={styles.orderName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={styles.orderMeta} numberOfLines={1}>Qty {item.quantity} - {item.size}</Text>
                    <Text style={styles.orderPrice}>{peso(Number(item.unitPrice) * Number(item.quantity))}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.messageButton, messageBusyId === item.productId && styles.miniButtonMuted]}
                    onPress={() => startMessage(item)}
                    disabled={messageBusyId === item.productId}
                  >
                    {messageBusyId === item.productId ? (
                      <ActivityIndicator color={Colors.text.primary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color= '#fff' />
                        <Text style={styles.messageButtonText}>Message</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {canReviewOrder(selectedHead.status) ? (
                    <TouchableOpacity style={[styles.miniButton, Boolean(item.reviewed) && styles.miniButtonMuted]} onPress={() => !item.reviewed && router.push({ pathname: '/(tabs)/reviews', params: { productId: item.productId, orderId: item.orderId } })} disabled={Boolean(item.reviewed)}>
                      <Text style={styles.miniButtonText}>{item.reviewed ? 'Reviewed' : 'To Review'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </ImageBackground>
  );
}

function Header({ onMenu, onHome }: { onMenu: () => void; onHome: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.brandLockup} onPress={onHome} accessibilityRole="button" accessibilityLabel="Go to catalog">
        <Image source={require('@/assets/afro-logo-black.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>A'FRO</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onMenu} style={styles.headerIcon}>
        <Ionicons name="menu-outline" size={28} color={Colors.brand.blue} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  bgImage: { opacity: 0.025, resizeMode: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(244, 247, 253, 0.96)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.primary },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    height: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 28, height: 28 },
  brand: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  titleRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 38, gap: Spacing.md },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  filterButton: {
    flex: 1,
    minHeight: 31,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.card,
  },
  filterButtonActive: { backgroundColor: Colors.brand.blue },
  filterText: { color: Colors.text.primary, fontSize: 10, fontWeight: '900' },
  filterTextActive: { color: Colors.white },
  orderCard: {
    minHeight: 98,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  orderImage: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  singleOrderImage: { width: '100%', height: '100%', borderRadius: Radius.sm, resizeMode: 'contain' },
  orderImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, overflow: 'hidden' },
  orderImageTile: { width: 35, height: 35, backgroundColor: '#EDF4FD' },
  orderImageTileTwo: { width: 35, height: 72 },
  orderImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  moreItems: { alignItems: 'center', backgroundColor: 'rgba(8,45,92,.80)', bottom: 0, justifyContent: 'center', position: 'absolute', right: 0, width: 27, height: 27, borderTopLeftRadius: Radius.sm },
  moreItemsText: { color: Colors.white, fontSize: 10, fontWeight: '900' },
  orderInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  orderName: { flex: 1, color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  sizeBadge: {
    minWidth: 24,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    backgroundColor: Colors.brand.blue,
  },
  orderMeta: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 2 },
  orderPrice: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900', marginTop: 2 },
  orderStatusLine: { color: Colors.status.success, fontSize: 10, fontWeight: '900', marginTop: 3 },
  cancelledText: { color: Colors.status.error },
  orderActionWrap: { justifyContent: 'flex-end', paddingBottom: 3 },
  miniButton: {
    minWidth: 58,
    height: 25,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
  },
  miniButtonMuted: { backgroundColor: '#758396' },
  miniButtonText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  trackProductCard: {
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  trackImage: { width: 82, height: 82, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  trackProductInfo: { flex: 1, justifyContent: 'center' },
  trackPrice: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.xs },
  trackingCard: { borderRadius: Radius.md, padding: Spacing.md, backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: Colors.border.default },
  trackingText: { color: Colors.text.primary, fontSize: FontSize.sm },
  trackingLink: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '900', marginTop: Spacing.sm, textDecorationLine: 'underline' },
  itemPickerCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  pickerLabel: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '900', marginBottom: Spacing.xs },
  pickerButton: {
    minHeight: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#8FA9C8',
    backgroundColor: Colors.bg.input,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  pickerButtonText: { flex: 1, color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pickerMenu: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  pickerOption: {
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
  },
  pickerOptionActive: { backgroundColor: '#EAF4FF' },
  pickerOptionTitle: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pickerOptionMeta: { color: '#D2E3F5', fontSize: FontSize.xs, marginTop: 2 },
  viewProductButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  detailCard: {
    marginTop: -Spacing.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  sectionTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.md },
  detailCell: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingRight: Spacing.sm },
  detailIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1 },
  detailLabel: { color: Colors.text.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: Colors.text.primary, fontSize: 11, fontWeight: '900', marginTop: 2 },
  statusCard: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  cancelledStatusCard: { alignItems: 'center', backgroundColor: '#FFF1F2', borderRadius: Radius.sm, flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  cancelledStatusTitle: { color: Colors.status.error, fontSize: FontSize.sm, fontWeight: '900' },
  cancelledStatusText: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 2 },
  itemsCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  orderedItemRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm, 
    borderTopWidth: 1,
    borderRadius: Radius.sm,
    borderTopColor: 'rgba(255,255,255,0.13)',
  },
  orderedItemRowActive: { backgroundColor: '#EAF4FF' },
  orderedItemImage: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  orderedItemInfo: { flex: 1 },
  messageButton: {
    minWidth: 76,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.brand.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
  },
  messageButtonText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
  statusTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.lg },
  timelineRow: { minHeight: 74, flexDirection: 'row', position: 'relative' },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9E6F5',
    zIndex: 2,
  },
  timelineDotComplete: { backgroundColor: Colors.brand.blue },
  timelineDotCurrent: { borderColor: '#7BC7FF', borderWidth: 3, shadowColor: Colors.brand.blue, shadowOpacity: 0.34, shadowRadius: 8, elevation: 4 },
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 27,
    bottom: -1,
    width: 2,
    backgroundColor: '#D9E6F5',
  },
  timelineLineComplete: { backgroundColor: Colors.brand.blue },
  timelineTextWrap: { flex: 1, marginLeft: Spacing.md, paddingBottom: Spacing.sm },
  timelineHint: { color: Colors.text.primary, fontSize: 9 },
  timelineLabel: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900', marginTop: 2 },
  timelineDate: { color: Colors.text.secondary, fontSize: 10, marginTop: 1 },
  empty: { minHeight: 310, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.sm },
  emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  error: { color: Colors.status.error, fontSize: FontSize.sm, textAlign: 'center' },
});
