import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useToast } from '@/components/ui/Toast';
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
  reviewed?: boolean | number;
};

function filterStatus(status: string): OrderFilter {
  const normalized = status.toLowerCase();
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Active';
}

export function OrdersTab({ onOpenReviews, onReviewPosted }: { onOpenReviews: () => void; onReviewPosted: () => void }) {
  const { user, token } = useAuthStore();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<OrderFilter>('All');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [ratingError, setRatingError] = useState('');
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

  const postReview = async () => {
    if (!reviewTarget || !user?.user_id || rating < 1 || posting) {
      if (rating < 1) {
        setRatingError('Choose a rating from 1 to 5 stars.');
        showToast('Choose a rating from 1 to 5 stars.', 'error');
      }
      return;
    }
    setPosting(true);
    try {
      await apiPost('/reviews', { userId: user.user_id, productId: reviewTarget.productId, rating: String(rating), comment: comment.trim() }, token);
      setOrders((current) => current.map((order) => order.orderItemId === reviewTarget.orderItemId ? { ...order, reviewed: true } : order));
      setReviewTarget(null);
      setComment('');
      setRating(0);
      setRatingError('');
      showToast('Review posted', 'success');
      onReviewPosted();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not post review. Try again.', 'error');
    } finally {
      setPosting(false);
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
    <View>
      <View style={styles.filterRow}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filterPill, filter === item && styles.filterPillActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterPillText, filter === item && styles.filterPillTextActive]}>{item} <Text style={styles.filterCount}>{item === 'All' ? orders.length : orders.filter((order) => filterStatus(order.status) === item).length}</Text></Text>
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
              <View
                style={[
                  styles.statusBadge,
                  styles.cardStatusBadge,
                  status === 'Active' && styles.statusActive,
                  status === 'Delivered' && styles.statusDelivered,
                  status === 'Cancelled' && styles.statusCancelled,
                ]}
              >
                <Text style={styles.statusText} numberOfLines={1}>{order.status}</Text>
              </View>
              <View style={styles.orderTop}>
                <View style={styles.orderImage}>
                  {uri ? <Image source={{ uri }} style={styles.image} resizeMode="cover" /> : <Ionicons name="shirt-outline" size={28} color={Colors.text.muted} />}
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName} numberOfLines={2}>{order.productName}</Text>
                  <Text style={styles.orderMeta} numberOfLines={1}>Size {order.size} • Qty {order.quantity}</Text>
                  <Text style={styles.orderPrice}>₱ {Number(order.unitPrice ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}</Text>
                </View>
              </View>
              {status === 'Delivered' ? (
                <View style={styles.orderFooter}>
                <TouchableOpacity style={styles.reviewAction} onPress={() => { if (Number(order.reviewed)) onOpenReviews(); else { setRatingError(''); setReviewTarget(order); } }}>
                  <Text style={styles.reviewActionText}>{Number(order.reviewed) ? 'View review' : 'Write review'}</Text>
                </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })
      )}
      <Modal visible={Boolean(reviewTarget)} transparent animationType="slide" onRequestClose={() => setReviewTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewSheet} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Write a review</Text>
            <Text style={styles.sheetProduct} numberOfLines={1}>{reviewTarget?.productName}</Text>
            <Text style={styles.sheetLabel}>Your rating</Text>
            <View style={styles.starRow}>{[1, 2, 3, 4, 5].map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`} style={styles.starButton} onPress={() => { setRating(value); setRatingError(''); }}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={34} color="#E7A629" /></TouchableOpacity>)}</View>
            {ratingError ? <Text accessibilityRole="alert" style={styles.ratingError}>{ratingError}</Text> : null}
            <TextInput style={styles.commentInput} value={comment} onChangeText={setComment} placeholder="Share details (optional)" placeholderTextColor={Colors.text.muted} multiline maxLength={500} textAlignVertical="top" />
            <View style={styles.sheetActions}><TouchableOpacity style={styles.cancelButton} onPress={() => setReviewTarget(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.postButton, posting && styles.postDisabled]} disabled={posting} onPress={postReview}><Text style={styles.postText}>{posting ? 'Posting...' : 'Post review'}</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>
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
  filterCount: { fontWeight: '900' },
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
    borderRadius: 22,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    gap: Spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  orderImage: {
    width: 56,
    height: 56,
    flexShrink: 0,
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
  orderTop: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingRight: 112, width: '100%' },
  orderInfo: { flex: 1, flexShrink: 1, minWidth: 0 },
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
  orderFooter: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'flex-start', minHeight: 44, width: '100%' },
  reviewAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 10, flexShrink: 1 },
  reviewActionText: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '800' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
  },
  cardStatusBadge: { position: 'absolute', right: Spacing.md, top: 38, maxWidth: 104, zIndex: 1 },
  statusActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  statusDelivered: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,37,69,0.38)' },
  reviewSheet: { backgroundColor: Colors.bg.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.lg, paddingBottom: 36 },
  sheetHandle: { backgroundColor: Colors.border.default, borderRadius: 3, height: 5, width: 46, alignSelf: 'center', marginBottom: Spacing.md },
  sheetTitle: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  sheetProduct: { color: Colors.text.secondary, fontSize: FontSize.sm, marginTop: 3 },
  sheetLabel: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '800', marginTop: Spacing.lg },
  starRow: { flexDirection: 'row', marginTop: Spacing.xs },
  starButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  ratingError: { color: Colors.status.error, fontSize: FontSize.xs, marginTop: 2 },
  commentInput: { backgroundColor: Colors.bg.input, borderColor: Colors.border.default, borderRadius: Radius.md, borderWidth: 1, color: Colors.text.primary, fontSize: FontSize.sm, minHeight: 104, padding: Spacing.md, marginTop: Spacing.md },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelButton: { alignItems: 'center', borderColor: Colors.border.default, borderRadius: Radius.full, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  cancelText: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '800' },
  postButton: { alignItems: 'center', backgroundColor: Colors.brand.blue, borderRadius: Radius.full, flex: 1.3, justifyContent: 'center', minHeight: 48 },
  postDisabled: { backgroundColor: Colors.text.muted },
  postText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '800' },
});
