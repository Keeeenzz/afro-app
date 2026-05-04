import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, imageUrl } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type OrderFilter = 'All' | 'Active' | 'Delivered' | 'Cancelled';

type OrderItem = {
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  size: string;
  status: string;
  imageUrl?: string | null;
};

function filterStatus(status: string): OrderFilter {
  const normalized = status.toLowerCase();
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Active';
}

export function OrdersTab() {
  const { user, token } = useAuthStore();
  const [filter, setFilter] = useState<OrderFilter>('All');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const filters: OrderFilter[] = ['All', 'Active', 'Delivered', 'Cancelled'];

  useEffect(() => {
    if (!user?.user_id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    apiGet<OrderItem[]>(`/profile/${user.user_id}/orders`, token)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token, user?.user_id]);

  const filtered = useMemo(
    () => (filter === 'All' ? orders : orders.filter((order) => filterStatus(order.status) === filter)),
    [filter, orders],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.filterRow}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filterPill, filter === item && styles.filterPillActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterPillText, filter === item && styles.filterPillTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!filtered.length ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={34} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your real orders will show here after checkout.</Text>
        </View>
      ) : (
        filtered.map((order) => {
          const status = filterStatus(order.status);
          const uri = imageUrl(order.imageUrl);
          return (
            <View key={order.orderItemId} style={styles.orderCard}>
              <View style={styles.orderImage}>
                {uri ? (
                  <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                ) : (
                  <Ionicons name="shirt-outline" size={28} color={Colors.text.muted} />
                )}
              </View>

              <View style={styles.orderInfo}>
                <Text style={styles.orderName}>{order.productName}</Text>
                <Text style={styles.orderMeta}>Size {order.size} • Qty {order.quantity}</Text>
                <Text style={styles.orderPrice}>
                  ₱ {Number(order.unitPrice ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                </Text>
              </View>

              <View style={styles.orderRight}>
                <View
                  style={[
                    styles.statusBadge,
                    status === 'Active' && styles.statusActive,
                    status === 'Delivered' && styles.statusDelivered,
                    status === 'Cancelled' && styles.statusCancelled,
                  ]}
                >
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterPillActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  filterPillText: {
    fontSize: FontSize.sm,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  filterPillTextActive: { color: Colors.white },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 12,
  },
  orderImage: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  orderInfo: { flex: 1 },
  orderName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  orderMeta: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 2 },
  orderPrice: {
    fontSize: FontSize.sm,
    color: Colors.brand.blue,
    fontWeight: '700',
    marginTop: 4,
  },
  orderRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
  },
  statusActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  statusDelivered: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
