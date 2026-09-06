import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';

type OrderItem = {
  orderId: string;
  placedAt: string;
  updatedAt?: string | null;
  totalAmount: number;
  shippingFee?: number;
  paymentMethod?: string | null;
  trackingNumber?: string | null;
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
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function normalizeStatus(status: string): Filter {
  const lower = status.toLowerCase();
  if (lower.includes('cancel')) return 'Cancelled';
  if (lower.includes('deliver') || lower.includes('complete')) return 'Delivered';
  return 'Active';
}

function timelineStatus(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes('deliver') || lower.includes('complete')) return 5;
  if (lower.includes('ship') || lower.includes('ready')) return 4;
  if (lower.includes('process')) return 3;
  if (lower.includes('confirm')) return 2;
  return 1;
}

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const targetOrderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { openNav } = useNav();
  const { user, token } = useAuthStore();
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
    const status = normalizeStatus(order.status);
    if (status === 'Active') {
      setSelectedOrderId(order.orderId);
      setSelectedOrderItemId(order.orderItemId);
      return;
    }

    if (!order.reviewed) {
      router.push({ pathname: '/(tabs)/reviews', params: { productId: order.productId, orderId: order.orderId } });
    }
  };

  const openProductOverview = (order: OrderItem) => {
    router.push({ pathname: '/(tabs)/product/[id]', params: { id: order.productId, from: 'orders' } });
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
    <ImageBackground source={require('@/assets/splash-icon.png')} style={styles.screen} imageStyle={styles.bgImage}>
      <View style={styles.overlay}>
        <Header onMenu={openNav} />

        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => (selectedOrderId ? setSelectedOrderId(null) : router.back())}>
            <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.titlePill}>
            <Text style={styles.titleText}>{selectedOrderId ? 'Track Order' : 'My Orders'}</Text>
          </View>
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
                  <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!filteredOrders.length ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={42} color={Colors.text.secondary} />
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptyText}>Your checkout orders will appear here.</Text>
              </View>
            ) : (
              filteredOrders.map((order) => {
                const status = normalizeStatus(order.status);
                const reviewed = Boolean(order.reviewed);
                return (
                  <TouchableOpacity
                    key={order.orderId}
                    activeOpacity={0.84}
                    style={styles.orderCard}
                    onPress={() => openOrder(order)}
                    disabled={status !== 'Active' && reviewed}
                  >
                    {order.imageUrl ? <Image source={{ uri: imageUrl(order.imageUrl) ?? order.imageUrl }} style={styles.orderImage} /> : <View style={styles.orderImage} />}
                    <View style={styles.orderInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.orderName} numberOfLines={1}>{order.productName}</Text>
                        <Text style={styles.sizeBadge}>{order.size}</Text>
                      </View>
                      <Text style={styles.orderMeta} numberOfLines={1}>Qty {order.quantity} • {order.status}</Text>
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
                          <Text style={styles.miniButtonText}>Track</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.miniButton, reviewed && styles.miniButtonMuted]}
                          onPress={() => !reviewed && router.push({ pathname: '/(tabs)/reviews', params: { productId: order.productId, orderId: order.orderId } })}
                          disabled={reviewed}
                        >
                          <Text style={styles.miniButtonText}>{reviewed ? 'Reviewed' : 'To Review'}</Text>
                        </TouchableOpacity>
                      )}
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
                  <Ionicons name="eye-outline" size={15} color={Colors.text.primary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              <DetailRow label="Expected Delivery Date" value={formatDate(selectedHead.expectedDeliveryAt)} />
              <DetailRow label="Tracking ID" value={selectedHead.trackingNumber || selectedHead.orderId.slice(0, 13).toUpperCase()} />
              <DetailRow label="Payment" value={selectedHead.paymentMethod || 'GCash'} />
              <DetailRow label="Ship To" value={selectedHead.shippingAddress || 'Saved customer address'} />
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Order Status</Text>
              {[
                ['Order Placed', selectedHead.placedAt],
                ['Order Confirmed', selectedHead.updatedAt],
                ['Order Processed', selectedHead.updatedAt],
                ['Ready to Ship', selectedHead.expectedDeliveryAt],
                ['Delivered', selectedHead.expectedDeliveryAt],
              ].map(([label, date], index) => {
                const complete = timelineStatus(selectedHead.status) >= index + 1;
                return (
                  <View key={label} style={styles.timelineRow}>
                    <View style={[styles.timelineDot, complete && styles.timelineDotComplete]}>
                      <Ionicons name="checkmark" size={13} color={complete ? Colors.text.primary : Colors.text.muted} />
                    </View>
                    {index < 4 ? <View style={[styles.timelineLine, complete && styles.timelineLineComplete]} /> : null}
                    <View style={styles.timelineTextWrap}>
                      <Text style={styles.timelineHint}>
                        {index === 0 ? 'We have placed your order' : index === 4 ? 'We have delivered your order' : 'We have updated your order'}
                      </Text>
                      <Text style={styles.timelineLabel}>{label}</Text>
                      <Text style={styles.timelineDate}>{formatDate(date)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.itemsCard}>
              <Text style={styles.sectionTitle}>Ordered Items</Text>
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
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.text.primary} />
                        <Text style={styles.messageButtonText}>Message</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </ImageBackground>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandLockup}>
        <Image source={require('@/assets/afro-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>A'FRO</Text>
      </View>
      <TouchableOpacity onPress={onMenu} style={styles.headerIcon}>
        <Ionicons name="menu-outline" size={30} color={Colors.brand.blueLight} />
      </TouchableOpacity>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  bgImage: { opacity: 0.1, resizeMode: 'cover' },
  overlay: { flex: 1, backgroundColor: 'rgba(10, 14, 26, 0.9)' },
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
  titlePill: {
    minWidth: 116,
    height: 38,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334B5B',
  },
  titleText: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 38, gap: Spacing.md },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  filterButton: {
    flex: 1,
    minHeight: 31,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 101, 132, 0.7)',
  },
  filterButtonActive: { backgroundColor: '#1388A6' },
  filterText: { color: Colors.text.primary, fontSize: 10, fontWeight: '900' },
  filterTextActive: { color: Colors.white },
  orderCard: {
    minHeight: 98,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  orderImage: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: '#A8DDFF' },
  orderInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  orderName: { flex: 1, color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  sizeBadge: {
    minWidth: 24,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    backgroundColor: '#315169',
  },
  orderMeta: { color: '#D2E3F5', fontSize: FontSize.xs, marginTop: 2 },
  orderPrice: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900', marginTop: 2 },
  orderStatusLine: { color: '#52F2CA', fontSize: 10, fontWeight: '900', marginTop: 3 },
  cancelledText: { color: Colors.status.error },
  orderActionWrap: { justifyContent: 'flex-end', paddingBottom: 3 },
  miniButton: {
    minWidth: 58,
    height: 25,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B6E82',
  },
  miniButtonMuted: { backgroundColor: '#758396' },
  miniButtonText: { color: Colors.text.primary, fontSize: 9, fontWeight: '900' },
  trackProductCard: {
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  trackImage: { width: 82, height: 82, borderRadius: Radius.sm, backgroundColor: '#A8DDFF' },
  trackProductInfo: { flex: 1, justifyContent: 'center' },
  trackPrice: { color: '#C8E7FF', fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.xs },
  itemPickerCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  pickerLabel: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '900', marginBottom: Spacing.xs },
  pickerButton: {
    minHeight: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#8FA9C8',
    backgroundColor: 'rgba(4, 8, 18, 0.45)',
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
    backgroundColor: 'rgba(18, 29, 50, 0.82)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.09)',
  },
  pickerOptionActive: { backgroundColor: '#1388A6' },
  pickerOptionTitle: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pickerOptionMeta: { color: '#D2E3F5', fontSize: FontSize.xs, marginTop: 2 },
  viewProductButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: '#1388A6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  detailCard: {
    marginTop: -Spacing.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  sectionTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, marginTop: Spacing.xs },
  detailLabel: { flex: 1, color: Colors.text.primary, fontSize: 10, fontWeight: '700' },
  detailValue: { flex: 1, color: Colors.text.primary, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  statusCard: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  itemsCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  orderedItemRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.13)',
  },
  orderedItemRowActive: { backgroundColor: 'rgba(19, 136, 166, 0.18)' },
  orderedItemImage: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: '#A8DDFF' },
  orderedItemInfo: { flex: 1 },
  messageButton: {
    minWidth: 76,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: '#1388A6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
  },
  messageButtonText: { color: Colors.text.primary, fontSize: 9, fontWeight: '900' },
  statusTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.lg },
  timelineRow: { minHeight: 74, flexDirection: 'row', position: 'relative' },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43546C',
    zIndex: 2,
  },
  timelineDotComplete: { backgroundColor: '#E8F4FF' },
  timelineLine: {
    position: 'absolute',
    left: 13,
    top: 27,
    bottom: -1,
    width: 2,
    backgroundColor: '#43546C',
  },
  timelineLineComplete: { backgroundColor: '#E8F4FF' },
  timelineTextWrap: { flex: 1, marginLeft: Spacing.md, paddingBottom: Spacing.sm },
  timelineHint: { color: Colors.text.primary, fontSize: 9 },
  timelineLabel: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900', marginTop: 2 },
  timelineDate: { color: Colors.text.secondary, fontSize: 10, marginTop: 1 },
  empty: { minHeight: 310, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.sm },
  emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  error: { color: Colors.status.error, fontSize: FontSize.sm, textAlign: 'center' },
});
