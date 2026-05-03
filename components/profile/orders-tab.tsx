import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type OrderFilter = 'All' | 'Active' | 'Delivered' | 'Cancelled';

const MOCK_ORDERS = [
  { id: '1', name: 'Black Jacket', size: 'M', price: 400, status: 'Active' },
  { id: '2', name: 'Black Jorts', size: 'L', price: 250, status: 'Delivered' },
  { id: '3', name: 'Gray Jacket', size: 'S', price: 300, status: 'Active' },
  { id: '4', name: 'Camou Pants', size: 'M', price: 200, status: 'Cancelled' },
];

export function OrdersTab() {
  const [filter, setFilter] = useState<OrderFilter>('All');
  const filters: OrderFilter[] = ['All', 'Active', 'Delivered', 'Cancelled'];

  const filtered =
    filter === 'All'
      ? MOCK_ORDERS
      : MOCK_ORDERS.filter((o) => o.status === filter);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === f && styles.filterPillTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((order) => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderImage}>
            <Ionicons name="shirt-outline" size={28} color={Colors.text.muted} />
          </View>

          <View style={styles.orderInfo}>
            <Text style={styles.orderName}>{order.name}</Text>
            <Text style={styles.orderMeta}>Size {order.size}</Text>
            <Text style={styles.orderPrice}>₱ {order.price}</Text>
          </View>

          <View style={styles.orderRight}>
            <View
              style={[
                styles.statusBadge,
                order.status === 'Active' && styles.statusActive,
                order.status === 'Delivered' && styles.statusDelivered,
                order.status === 'Cancelled' && styles.statusCancelled,
              ]}
            >
              <Text style={styles.statusText}>{order.status}</Text>
            </View>
            {order.status === 'Active' && (
              <TouchableOpacity style={styles.trackBtn}>
                <Text style={styles.trackBtnText}>Track</Text>
              </TouchableOpacity>
            )}
            {order.status === 'Cancelled' && (
              <TouchableOpacity style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  trackBtn: {
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  trackBtnText: { fontSize: FontSize.xs, color: Colors.white, fontWeight: '600' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: Colors.status.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  deleteBtnText: {
    fontSize: FontSize.xs,
    color: Colors.status.error,
    fontWeight: '600',
  },
});