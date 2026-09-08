import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPost, apiPostForm, imageUrl } from '@/lib/api';
import { containsProfanity, PROFANITY_ERROR } from '@/lib/profanity';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';

type ProductDetail = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  size?: string | null;
  imageUrl?: string | null;
};

type Review = {
  id: string;
  userName: string;
  productName: string;
  productImageUrl?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
  photos?: string[];
  likeCount: number;
  heartCount: number;
  replyCount: number;
  userLiked?: boolean;
  userHearted?: boolean;
  replies?: {
    id: string;
    userName: string;
    comment: string;
    createdAt: string;
  }[];
};

type Filter = 'all' | 'photos' | '1' | '2' | '3' | '4' | '5';
type Sort = 'recent' | 'liked' | 'heart' | 'replies';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All Reviews' },
  { value: 'photos', label: 'With Photos' },
  { value: '5', label: '5 Star' },
  { value: '4', label: '4 Star' },
  { value: '3', label: '3 Star' },
  { value: '2', label: '2 Star' },
  { value: '1', label: '1 Star' },
];

const SORTS: { value: Sort; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'recent', label: 'Recent', icon: 'time-outline' },
  { value: 'liked', label: 'Most Liked', icon: 'thumbs-up-outline' },
  { value: 'heart', label: 'Most Heart', icon: 'heart-outline' },
  { value: 'replies', label: 'Most Replies', icon: 'chatbubble-outline' },
];

const REVIEW_WORD_LIMIT = 100;

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function limitWords(value: string, maxWords: number) {
  const parts = words(value);
  if (parts.length <= maxWords) return value;
  return parts.slice(0, maxWords).join(' ');
}

function peso(value: number) {
  return `₱ ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(value));
}

function makePhotoPart(photo: ImagePicker.ImagePickerAsset) {
  const name = photo.fileName || `review-${Date.now()}.jpg`;
  const type = photo.mimeType || 'image/jpeg';
  return { uri: photo.uri, name, type } as unknown as Blob;
}

export default function ReviewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const { openNav } = useNav();
  const { user, token } = useAuthStore();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');

  const loadReviews = useCallback(async () => {
    setError('');
    const nextReviews = await apiGet<Review[]>(`/reviews${user?.user_id ? `?userId=${user.user_id}` : ''}`, token);
    setReviews(nextReviews);
  }, [token, user?.user_id]);

  const loadForm = useCallback(async () => {
    if (!productId || !user?.user_id) {
      setProduct(null);
      setCanReview(false);
      setAlreadyReviewed(false);
      return;
    }

    const [nextProduct, eligibility] = await Promise.all([
      apiGet<ProductDetail>(`/products/${productId}`, token),
      apiGet<{ canReview: boolean; reviewed: boolean }>(`/reviews/eligibility?userId=${user.user_id}&productId=${productId}`, token),
    ]);
    setProduct(nextProduct);
    setCanReview(eligibility.canReview);
    setAlreadyReviewed(eligibility.reviewed);
  }, [productId, token, user?.user_id]);

  const load = useCallback(async () => {
    await Promise.all([loadReviews(), loadForm()]);
  }, [loadForm, loadReviews]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load reviews.'))
        .finally(() => setLoading(false));
    }, [load]),
  );

  const visibleReviews = useMemo(() => {
    const filtered = reviews.filter((review) => {
      if (filter === 'photos') return Boolean(review.photos?.length);
      if (filter !== 'all') return Number(review.rating) === Number(filter);
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'liked') return Number(b.likeCount) - Number(a.likeCount);
      if (sort === 'heart') return Number(b.heartCount) - Number(a.heartCount);
      if (sort === 'replies') return Number(b.replyCount) - Number(a.replyCount);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, reviews, sort]);
  const selectedReview = selectedReviewId ? reviews.find((review) => review.id === selectedReviewId) : null;
  const commentWordCount = words(comment).length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh reviews.');
    } finally {
      setRefreshing(false);
    }
  };

  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  const submitReview = async () => {
    if (!user?.user_id || !productId) {
      Alert.alert('Login required', 'Please login before leaving a review.');
      return;
    }

    if (!canReview) {
      Alert.alert('Review unavailable', alreadyReviewed ? 'You already reviewed this item.' : 'Only delivered or cancelled orders can be reviewed.');
      return;
    }

    if (containsProfanity(comment)) {
      Alert.alert('Review not submitted', PROFANITY_ERROR);
      return;
    }

    if (words(comment).length > REVIEW_WORD_LIMIT) {
      Alert.alert('Review is too long', `Keep your review to ${REVIEW_WORD_LIMIT} words or fewer.`);
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('userId', user.user_id);
      form.append('productId', productId);
      form.append('rating', String(rating));
      form.append('comment', comment);
      if (photo) {
        form.append('photo', makePhotoPart(photo));
      }

      await apiPostForm('/reviews', form, token);
      setComment('');
      setPhoto(null);
      await loadReviews();
      router.replace('/(tabs)/reviews');
    } catch (err) {
      Alert.alert('Could not submit review', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReaction = async (reviewId: string, type: 'like' | 'heart') => {
    if (!user?.user_id) {
      Alert.alert('Login required', 'Please login first.');
      return;
    }

    setReviews((current) =>
      current.map((review) => {
        if (review.id !== reviewId) return review;
        const key = type === 'like' ? 'userLiked' : 'userHearted';
        const countKey = type === 'like' ? 'likeCount' : 'heartCount';
        const active = Boolean(review[key]);
        return { ...review, [key]: !active, [countKey]: Math.max(0, Number(review[countKey]) + (active ? -1 : 1)) };
      }),
    );

    try {
      await apiPost(`/reviews/${reviewId}/react`, { userId: user.user_id, type }, token);
    } catch {
      await loadReviews();
    }
  };

  const submitReply = async (reviewId: string) => {
    if (!user?.user_id || !replyText.trim()) return;

    const text = replyText.trim();
    if (containsProfanity(text)) {
      Alert.alert('Comment not added', PROFANITY_ERROR);
      return;
    }

    setReplyText('');
    setReviews((current) =>
      current.map((review) => (review.id === reviewId ? { ...review, replyCount: Number(review.replyCount) + 1 } : review)),
    );

    try {
      await apiPost(`/reviews/${reviewId}/replies`, { userId: user.user_id, comment: text }, token);
    } catch (err) {
      Alert.alert('Could not add comment', err instanceof Error ? err.message : 'Please try again.');
      await loadReviews();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  const showForm = Boolean(productId);

  return (
    <ImageBackground source={require('@/assets/afro-logo-black.png')} style={styles.screen} imageStyle={styles.bgImage}>
      <View style={styles.overlay}>
        <Header
          title={selectedReview ? 'Review Details' : showForm ? 'Leave Review' : 'Reviews'}
          onBack={() => (selectedReview ? setSelectedReviewId('') : router.back())}
          onMenu={openNav}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
        >
          {showForm ? (
            <>
              {product ? (
                <View style={styles.productCard}>
                  {product.imageUrl ? <Image source={{ uri: imageUrl(product.imageUrl) ?? product.imageUrl }} style={styles.productImage} /> : <View style={styles.productImage} />}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                    <Text style={styles.productMeta} numberOfLines={1}>{product.description || product.size || 'A FRO item'}</Text>
                    <Text style={styles.productPrice}>{peso(product.price)}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.formCard}>
                <Text style={styles.formTitle}>How is your order?</Text>
                <Text style={styles.formLabel}>Your Delivery Rating</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity key={value} onPress={() => setRating(value)} activeOpacity={0.75}>
                      <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={38} color="#185ab7" />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.commentLabel}>Add a detailed review</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Enter here"
                  placeholderTextColor="rgba(255,255,255,0.58)"
                  value={comment}
                  onChangeText={(value) => setComment(limitWords(value, REVIEW_WORD_LIMIT))}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={[styles.wordCounter, commentWordCount >= REVIEW_WORD_LIMIT && styles.wordCounterLimit]}>
                  {commentWordCount}/{REVIEW_WORD_LIMIT} words
                </Text>

                {photo ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
                      <Ionicons name="close" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.uploadButton} onPress={choosePhoto} activeOpacity={0.82}>
                  <Ionicons name="image-outline" size={17} color={Colors.text.primary} />
                  <Text style={styles.uploadText}>{photo ? 'Change Photo' : 'Upload Photo'}</Text>
                </TouchableOpacity>

                {!canReview ? (
                  <Text style={styles.formNote}>
                    {alreadyReviewed ? 'This item has already been reviewed.' : 'Reviews are available after the order is delivered or cancelled.'}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!canReview || submitting) && styles.disabledButton]}
                onPress={submitReview}
                disabled={!canReview || submitting}
                activeOpacity={0.84}
              >
                {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Submit Review</Text>}
              </TouchableOpacity>
            </>
          ) : selectedReview ? (
            <ReviewDetail
              review={selectedReview}
              replyText={replyText}
              onReplyText={setReplyText}
              onSubmitReply={() => submitReply(selectedReview.id)}
              onReact={(type) => toggleReaction(selectedReview.id, type)}
            />
          ) : (
            <>
              <View style={styles.collectionToolbar}>
                <View style={styles.collectionTabs}>
                  <Text style={styles.collectionTabText}>{FILTERS.find((item) => item.value === filter)?.label}</Text>
                  <Text style={styles.collectionTabMuted}>{SORTS.find((item) => item.value === sort)?.label}</Text>
                </View>
                <TouchableOpacity style={styles.filterIconButton} onPress={() => setFiltersOpen((current) => !current)} activeOpacity={0.82}>
                  <Ionicons name="options-outline" size={22} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              {filtersOpen ? (
                <View style={styles.filterPanel}>
                  <Text style={styles.filterPanelTitle}>Rating</Text>
                  <View style={styles.filterWrap}>
                    {FILTERS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
                        onPress={() => setFilter(item.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.filterPanelTitle}>Sort</Text>
                  <View style={styles.filterWrap}>
                    {SORTS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.sortChip, sort === item.value && styles.sortChipActive]}
                        onPress={() => setSort(item.value)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={item.icon} size={15} color={sort === item.value ? Colors.white : Colors.text.secondary} />
                        <Text style={[styles.sortText, sort === item.value && styles.sortTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!visibleReviews.length ? (
                <View style={styles.empty}>
                  <Ionicons name="star-outline" size={40} color={Colors.text.secondary} />
                  <Text style={styles.emptyTitle}>No reviews yet</Text>
                  <Text style={styles.emptyText}>Reviews will appear here after orders are reviewed.</Text>
                </View>
              ) : (
                visibleReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onOpen={() => setSelectedReviewId(review.id)}
                    onReact={(type) => toggleReaction(review.id, type)}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

function Header({ title, onBack, onMenu }: { title: string; onBack: () => void; onMenu: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
        <Image source={require('@/assets/afro-logo-black.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>A'FRO</Text>
        </View>
        <TouchableOpacity onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="menu-outline" size={28} color={Colors.brand.blue} />
        </TouchableOpacity>
      </View>
      <View style={styles.titleRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.titleText}>{title}</Text>
        <View style={styles.backButton} />
      </View>
    </View>
  );
}

function ReviewCard({
  review,
  onOpen,
  onReact,
}: {
  review: Review;
  onOpen: () => void;
  onReact: (type: 'like' | 'heart') => void;
}) {
  const photos = (review.photos ?? []).filter((photo) => photo && !/^photo\s*\d+$/i.test(photo.trim()));

  return (
    <TouchableOpacity style={styles.reviewCard} activeOpacity={0.86} onPress={onOpen}>
      <View style={styles.reviewTop}>
        <View style={styles.avatar}>
          <Image source={require('@/assets/afro-logo.png')} style={styles.avatarImage} resizeMode="contain" />
        </View>
        <View style={styles.reviewAuthor}>
          <Text style={styles.authorName}>{review.userName || 'A FRO Customer'}</Text>
          <Text style={styles.reviewDate}>{formatDate(review.createdAt)} · New</Text>
        </View>
        <View style={styles.smallStars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Ionicons key={value} name={value <= Number(review.rating) ? 'star' : 'star-outline'} size={13} color="#185ab7" />
          ))}
        </View>
      </View>

      <Text style={styles.reviewProduct} numberOfLines={1}>{review.productName}</Text>
      <Text style={styles.reviewBody}>{review.comment || 'No written comment added.'}</Text>

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewPhotos}>
          {photos.map((photo) => (
            <Image key={photo} source={{ uri: imageUrl(photo) ?? photo }} style={styles.reviewPhoto} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.reviewLine} />
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionChip, review.userLiked && styles.actionChipActive]} onPress={() => onReact('like')}>
          <Ionicons name={review.userLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={14} color={Colors.text.primary} />
          <Text style={styles.actionText}>{review.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionChip, review.userHearted && styles.actionChipActive]} onPress={() => onReact('heart')}>
          <Ionicons name={review.userHearted ? 'heart' : 'heart-outline'} size={14} color={Colors.text.primary} />
          <Text style={styles.actionText}>{review.heartCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip} onPress={onOpen}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.text.primary} />
          <Text style={styles.actionText}>{review.replyCount} replies</Text>
        </TouchableOpacity>
      </View>

      {review.replies?.length ? (
        <View style={styles.replyPreview}>
          {review.replies.slice(0, 2).map((reply) => (
            <Text key={reply.id} style={styles.replyPreviewText} numberOfLines={1}>
              <Text style={styles.replyPreviewName}>{reply.userName || 'User'}: </Text>
              {reply.comment}
            </Text>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function ReviewDetail({
  review,
  replyText,
  onReplyText,
  onSubmitReply,
  onReact,
}: {
  review: Review;
  replyText: string;
  onReplyText: (value: string) => void;
  onSubmitReply: () => void;
  onReact: (type: 'like' | 'heart') => void;
}) {
  return (
    <View style={styles.detailCard}>
      <ReviewCard review={review} onOpen={() => undefined} onReact={onReact} />
      <Text style={styles.detailTitle}>Comments</Text>
      {review.replies?.length ? (
        review.replies.map((reply) => (
          <View key={reply.id} style={styles.detailReply}>
            <View style={styles.replyAvatar}>
              <Text style={styles.replyAvatarText}>{reply.userName?.charAt(0) || 'U'}</Text>
            </View>
            <View style={styles.detailReplyBody}>
              <Text style={styles.detailReplyName}>{reply.userName || 'User'}</Text>
              <Text style={styles.detailReplyText}>{reply.comment}</Text>
              <Text style={styles.detailReplyDate}>{formatDate(reply.createdAt)}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyReplyText}>No comments yet.</Text>
      )}
      <View style={styles.replyBox}>
        <TextInput
          style={styles.replyInput}
          placeholder="Write a comment..."
          placeholderTextColor="rgba(255,255,255,0.55)"
          value={replyText}
          onChangeText={onReplyText}
        />
        <TouchableOpacity style={styles.replyButton} onPress={onSubmitReply}>
          <Ionicons name="send" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg.primary },
  bgImage: { opacity: 0.025, resizeMode: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(244, 247, 253, 0.96)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.primary },
  header: { height: 154, paddingHorizontal: Spacing.md, paddingTop: 44 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 30, height: 30 },
  brand: { flex: 1, color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleText: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 36 },
  productCard: {
    minHeight: 90,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  productImage: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  productInfo: { flex: 1 },
  productName: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  productMeta: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 3 },
  productPrice: { color: '#C8E7FF', fontSize: FontSize.md, fontWeight: '900', marginTop: 4 },
  formCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  formTitle: { color: Colors.text.primary, fontSize: FontSize.xl, fontWeight: '900', marginBottom: Spacing.lg },
  formLabel: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '800', marginBottom: Spacing.md },
  starRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  commentLabel: { alignSelf: 'flex-start', color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  commentInput: {
    width: '100%',
    minHeight: 110,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
    color: Colors.text.primary,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  wordCounter: {
    alignSelf: 'flex-end',
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  wordCounterLimit: { color: Colors.status.warning },
  uploadButton: {
    minWidth: 150,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.active,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  uploadText: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900' },
  photoPreviewWrap: { width: 86, height: 86, marginBottom: Spacing.sm },
  photoPreview: { width: '100%', height: '100%', borderRadius: Radius.sm },
  removePhoto: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.brand.blue, alignItems: 'center', justifyContent: 'center' },
  formNote: { color: Colors.status.warning, fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.md },
  submitButton: {
    alignSelf: 'center',
    minWidth: 160,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  submitText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '900' },
  disabledButton: { opacity: 0.5 },
  collectionToolbar: {
    minHeight: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  collectionTabs: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  collectionTabText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  collectionTabMuted: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  filterIconButton: {
    width: 46,
    minHeight: 42,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanel: {
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  filterPanelTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterRow: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: {
    height: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { borderColor: '#36C8F0', borderBottomWidth: 3 },
  filterText: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '900' },
  filterTextActive: { color: Colors.text.primary },
  sortRow: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  sortChip: {
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(86, 113, 143, 0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sortChipActive: { backgroundColor: Colors.brand.blue },
  sortText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '800' },
  sortTextActive: { color: Colors.white },
  reviewCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.card,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#BCEBFF', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 32, height: 32 },
  reviewAuthor: { flex: 1 },
  authorName: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  reviewDate: { color: '#19626f', fontSize: 10, fontWeight: '800' },
  smallStars: { flexDirection: 'row', gap: 1 },
  reviewProduct: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900', marginTop: Spacing.sm },
  reviewBody: { color: Colors.text.primary, fontSize: FontSize.xs, lineHeight: 17, marginTop: Spacing.xs },
  reviewPhotos: { gap: Spacing.sm, paddingTop: Spacing.sm },
  reviewPhoto: { width: 58, height: 58, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  reviewLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.24)', marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionChip: {
    minHeight: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(166, 197, 221, 0.9)',
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionChipActive: { backgroundColor: Colors.brand.blue },
  actionText: { color: Colors.text.primary, fontSize: 10, fontWeight: '900' },
  replyPreview: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  replyPreviewText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
  },
  replyPreviewName: {
    color: Colors.text.primary,
    fontWeight: '900',
  },
  detailCard: {
    paddingBottom: Spacing.lg,
  },
  detailTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginBottom: Spacing.md,
  },
  detailReply: {
    borderRadius: Radius.md,
    backgroundColor: '#EAF4FF',
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  replyAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#BCEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarText: {
    color: Colors.bg.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  detailReplyBody: { flex: 1 },
  detailReplyName: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
  },
  detailReplyText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  detailReplyDate: {
    color: Colors.text.secondary,
    fontSize: 10,
    marginTop: Spacing.xs,
  },
  emptyReplyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  replyBox: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  replyInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
    color: Colors.text.primary,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.xs,
  },
  replyButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.brand.blue, alignItems: 'center', justifyContent: 'center' },
  error: { color: Colors.status.error, textAlign: 'center', marginBottom: Spacing.md },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.sm },
  emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
});
