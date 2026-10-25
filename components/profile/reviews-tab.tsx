import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiDelete, apiGet, imageUrl } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useToast } from '@/components/ui/Toast';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';

type Review = {
  id: string;
  userId: string;
  productName: string;
  productImageUrl?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
};

export function ReviewsTab({ onChanged }: { onChanged?: () => void }) {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.user_id) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setError('');
    try {
      const allReviews = await apiGet<Review[]>(`/reviews?userId=${user.user_id}`, token);
      // The endpoint uses userId to personalize reactions. The Profile tab is
      // intentionally an ownership-only view, so filter the shared feed here.
      setReviews(allReviews.filter((review) => review.userId === user.user_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your reviews.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.user_id]);

  useEffect(() => { void load(); }, [load]);

  const remove = (review: Review) => {
    Alert.alert('Delete review?', 'This permanently removes your review.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiDelete(`/reviews/${review.id}`, undefined, token);
          setReviews((current) => current.filter((item) => item.id !== review.id));
          showToast('Review deleted', 'success');
          onChanged?.();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not delete review.', 'error');
        }
      } },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.brand.blue} /></View>;
  if (error) return <View style={styles.empty}><Ionicons name="alert-circle-outline" size={34} color={Colors.status.error} /><Text style={styles.emptyTitle}>Could not load reviews</Text><Text style={styles.emptyText}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); void load(); }}><Text style={styles.retryText}>Try again</Text></TouchableOpacity></View>;
  if (!reviews.length) return <View style={styles.empty}><Ionicons name="star-outline" size={38} color={Colors.text.muted} /><Text style={styles.emptyTitle}>No reviews yet</Text><Text style={styles.emptyText}>Your reviews will appear here after a delivered order.</Text></View>;

  return <View style={styles.list}>{reviews.map((review) => {
    const uri = imageUrl(review.productImageUrl);
    return <View key={review.id} style={styles.card}>
      <TouchableOpacity style={styles.cardPressable} activeOpacity={0.78} onPress={() => router.push({ pathname: '/(tabs)/reviews', params: { reviewId: review.id, fromProfile: '1' } })} accessibilityRole="button" accessibilityLabel={`Open your review for ${review.productName}`}>
      <View style={styles.imageWrap}>{uri ? <Image source={{ uri }} style={styles.image} /> : <Ionicons name="shirt-outline" size={24} color={Colors.text.muted} />}</View>
      <View style={styles.body}><Text style={styles.productName} numberOfLines={1}>{review.productName}</Text><View style={styles.stars}>{[1,2,3,4,5].map((star) => <Ionicons key={star} name={star <= review.rating ? 'star' : 'star-outline'} size={15} color="#E7A629" />)}</View>{review.comment ? <Text style={styles.comment} numberOfLines={2}>{review.comment}</Text> : <Text style={styles.noComment}>No written comment</Text>}<Text style={styles.date}>{new Date(review.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View>
      </TouchableOpacity>
      {review.userId === user?.user_id ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete review for ${review.productName}`} style={styles.delete} onPress={() => remove(review)}><Ionicons name="trash-outline" size={19} color={Colors.status.error} /></TouchableOpacity> : null}
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 48 }, list: { gap: Spacing.sm }, card: { backgroundColor: Colors.bg.card, borderRadius: 20, padding: Spacing.md, flexDirection: 'row', gap: Spacing.xs, shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }, cardPressable: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', gap: Spacing.sm, minWidth: 0 }, imageWrap: { width: 62, height: 62, borderRadius: Radius.md, backgroundColor: Colors.bg.input, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, image: { width: '100%', height: '100%' }, body: { flex: 1, minWidth: 0 }, productName: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '800' }, stars: { flexDirection: 'row', gap: 2, marginTop: 4 }, comment: { color: Colors.text.secondary, fontSize: FontSize.xs, lineHeight: 18, marginTop: 5 }, noComment: { color: Colors.text.muted, fontSize: FontSize.xs, fontStyle: 'italic', marginTop: 5 }, date: { color: Colors.text.muted, fontSize: 10, marginTop: 6 }, delete: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 48 }, emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '800', marginTop: Spacing.sm }, emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: 4, lineHeight: 19 }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, marginTop: Spacing.md }, retryText: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '800' },
});
