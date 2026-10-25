import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { useToast } from '@/components/ui/Toast';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { MotiView } from 'moti';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApiError, apiDelete, apiGet, apiPost, apiPostForm, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore, type AuthUser } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CartItem = {
  cartItemId: string;
  productId: string;
  sizeId: number | string;
  size: string;
  quantity: number;
  productName: string;
  description?: string | null;
  unitPrice: number;
  color?: string | null;
  imageUrl?: string | null;
};

type Step = 'cart' | 'checkout' | 'receipt' | 'confirmed';

const GCASH_NUMBER = '09568313505';
const BOTTOM_TAB_BAR_HEIGHT = 74;
const CHECKOUT_ACTION_HEIGHT = 48;
const CART_CHECKOUT_BAR_HEIGHT = 76;

type ShippingEvaluation = {
  allowed: boolean;
  code?: string;
  message?: string;
  totalWeightKg?: number;
  totalBulkUnits?: number;
  packageLabel?: string;
  parcelCount?: number;
  shippingFeePerParcel?: number;
  shippingFee?: number;
  destinationProvince?: string;
};

type Voucher = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountAmount: number;
  minimumOrderAmount: number;
  estimatedDiscount: number;
};

type AppliedVoucher = {
  code: string;
  discountAmount: number;
};

type ParcelConfirmation = {
  parcelCount: number;
  shippingFeePerParcel: number;
  shippingFee: number;
  source: 'checkout' | 'placeOrder';
};

function peso(value: number) {
  return `₱ ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function getAddress(user: AuthUser | null) {
  const parts = [
    user?.address_house_no,
    user?.address_street,
    user?.address_barangay,
    user?.address_city,
    user?.address_province,
    user?.address_zip,
  ].filter(Boolean);

  return user?.shipping_address || parts.join(', ') || 'No saved address yet';
}

export default function CartScreen() {
  const router = useRouter();
  const { openNav } = useNav();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const { showToast } = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>('cart');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdOrderItemCount, setCreatedOrderItemCount] = useState(0);
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0);
  const [createdOrderImages, setCreatedOrderImages] = useState<string[]>([]);
  const [shippingEvaluation, setShippingEvaluation] = useState<ShippingEvaluation | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [parcelConfirmation, setParcelConfirmation] = useState<ParcelConfirmation | null>(null);
  const [acknowledgedParcelCount, setAcknowledgedParcelCount] = useState<number | null>(null);
  const [undoItem, setUndoItem] = useState<CartItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const loadCart = useCallback(async () => {
    if (!user?.user_id) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }

    setError('');
    const nextItems = await apiGet<CartItem[]>(`/cart/${user.user_id}/items`, token);
    setItems(nextItems);
    setSelectedIds((current) => {
      const availableIds = new Set(nextItems.map((item) => item.cartItemId));
      const kept = Array.from(current).filter((id) => availableIds.has(id));
      return new Set(kept.length ? kept : nextItems.map((item) => item.cartItemId));
    });
  }, [token, user?.user_id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCart()
        .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your cart.'))
        .finally(() => setLoading(false));
    }, [loadCart]),
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.cartItemId)),
    [items, selectedIds],
  );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 1),
    0,
  );
  const shipping = shippingEvaluation?.allowed ? Number(shippingEvaluation.shippingFee ?? 0) : 0;
  const voucherDiscount = Number(appliedVoucher?.discountAmount ?? 0);
  const total = subtotal - voucherDiscount + shipping;
  const fullAddress = getAddress(user);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh your cart.');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleItem = (id: string) => {
    setShippingEvaluation(null);
    setAcknowledgedParcelCount(null);
    setAppliedVoucher(null);
    setVoucherCode('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeItem = async (item: CartItem) => {
    if (!user?.user_id) return;
    setShippingEvaluation(null);
    setAcknowledgedParcelCount(null);
    setAppliedVoucher(null);
    setVoucherCode('');
    const previousItems = items;
    setItems((current) => current.filter((currentItem) => currentItem.cartItemId !== item.cartItemId));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.cartItemId);
      return next;
    });

    try {
      await apiDelete(`/cart/items/${item.cartItemId}`, { userId: user.user_id }, token);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndoItem(item);
      undoTimer.current = setTimeout(() => setUndoItem(null), 4500);
      showToast('Removed from cart', 'info', { label: 'Undo', onPress: () => void undoRemove() }, 4500);
    } catch (err) {
      setItems(previousItems);
      Alert.alert('Could not remove item', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const undoRemove = async () => {
    const item = undoItem;
    if (!item || !user?.user_id) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoItem(null);
    try {
      await apiPost('/cart/items', { userId: user.user_id, productId: item.productId, sizeId: item.sizeId, quantity: item.quantity }, token);
      await loadCart();
    } catch (err) {
      Alert.alert('Could not restore item', err instanceof Error ? err.message : 'Please add it to your cart again.');
    }
  };

  const openProductOverview = (item: CartItem) => {
    router.push({ pathname: '/(tabs)/product/[id]', params: { id: item.productId, from: 'cart' } });
  };

  const evaluateShipping = async (): Promise<ShippingEvaluation | null> => {
    if (!user?.user_id || !selectedItems.length) {
      Alert.alert('Choose items', 'Select at least one product to checkout.');
      return null;
    }

    setShippingLoading(true);
    setError('');
    try {
      const evaluation = await apiPost<ShippingEvaluation>('/cart/shipping/evaluate', {
        userId: user.user_id,
        selectedCartItemIds: selectedItems.map((item) => item.cartItemId),
      }, token);
      setShippingEvaluation(evaluation);
      if (!evaluation.allowed) {
        Alert.alert('Shipping unavailable', evaluation.message ?? 'The selected items cannot be shipped.');
        return null;
      }
      return evaluation;
    } catch (shippingError) {
      const message = shippingError instanceof Error ? shippingError.message : 'Could not calculate shipping. Please try again.';
      setShippingEvaluation(null);
      Alert.alert('Shipping unavailable', message);
      return null;
    } finally {
      setShippingLoading(false);
    }
  };

  const beginCheckout = async () => {
    const evaluation = await evaluateShipping();
    if (!evaluation) return;
    if (Number(evaluation.parcelCount ?? 1) > 1) {
      setParcelConfirmation({
        parcelCount: Number(evaluation.parcelCount),
        shippingFeePerParcel: Number(evaluation.shippingFeePerParcel),
        shippingFee: Number(evaluation.shippingFee),
        source: 'checkout',
      });
      return;
    }
    setStep('checkout');
    void loadVouchers();
  };

  const loadVouchers = async () => {
    if (!user?.user_id || !selectedItems.length) return;
    setVoucherLoading(true);
    try {
      const cartItemIds = encodeURIComponent(JSON.stringify(selectedItems.map((item) => item.cartItemId)));
      const available = await apiGet<Voucher[]>(`/cart/${user.user_id}/vouchers?selectedCartItemIds=${cartItemIds}`, token);
      setVouchers(available);
    } catch {
      setVouchers([]);
    } finally {
      setVoucherLoading(false);
    }
  };

  const applyVoucher = async (code = voucherCode) => {
    if (!code.trim()) {
      const message = 'Enter a voucher code';
      setVoucherError(message);
      showToast(message, 'error');
      return;
    }
    if (!user?.user_id) return;

    setVoucherError('');
    setVoucherLoading(true);
    try {
      const result = await apiPost<{ code: string; discountAmount: number }>('/cart/voucher/evaluate', {
        userId: user.user_id,
        voucherCode: code.trim(),
        selectedCartItemIds: selectedItems.map((item) => item.cartItemId),
      }, token);
      setAppliedVoucher({ code: result.code, discountAmount: Number(result.discountAmount) });
      setVoucherCode(result.code);
    } catch (err) {
      const message = err instanceof ApiError && typeof err.data?.message === 'string'
        ? err.data.message
        : err instanceof ApiError
          ? 'Invalid voucher code'
          : "Couldn't apply voucher. Try again.";
      setVoucherError(message);
      showToast(message, 'error');
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError('');
  };

  const updateVoucherCode = (value: string) => {
    setVoucherCode(value);
    if (voucherError) setVoucherError('');
  };

  const toggleSelectAll = () => {
    setShippingEvaluation(null);
    setAcknowledgedParcelCount(null);
    setAppliedVoucher(null);
    setVoucherCode('');
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map((item) => item.cartItemId)));
  };

  const chooseReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled) {
      setReceipt(result.assets[0]);
    }
  };

  const placeOrder = async (acknowledgedParcelCountOverride?: number) => {
    if (!user?.user_id) {
      Alert.alert('Login required', 'Please login before checking out.');
      return;
    }

    if (!selectedItems.length) {
      Alert.alert('Choose items', 'Select at least one product to checkout.');
      return;
    }

    if (!referenceNumber.trim()) {
      Alert.alert('Reference number required', 'Enter your GCash reference number.');
      return;
    }

    if (!receipt) {
      Alert.alert('Receipt required', 'Upload a screenshot of your GCash payment.');
      return;
    }

    const form = new FormData();
    form.append('userId', user.user_id);
    form.append('selectedCartItemIds', JSON.stringify(selectedItems.map((item) => item.cartItemId)));
    form.append('paymentMethod', 'GCash');
    form.append('referenceNumber', referenceNumber.trim());
    form.append('shippingAddress', fullAddress);
    form.append('recipientName', user.full_name || 'A FRO Customer');
    form.append('phone', user.phone || '');
    form.append('street', user.address_street || user.shipping_address || fullAddress);
    form.append('barangay', user.address_barangay || '');
    form.append('city', user.address_city || 'Metro Manila');
    form.append('province', user.address_province || 'Metro Manila');
    form.append('region', 'NCR');
    form.append('postalCode', user.address_zip || '');
    if (appliedVoucher?.code) form.append('voucherCode', appliedVoucher.code);
    const acknowledgedCount = acknowledgedParcelCountOverride ?? acknowledgedParcelCount;
    if (acknowledgedCount) form.append('acknowledgedParcelCount', String(acknowledgedCount));
    form.append('receipt', {
      uri: receipt.uri,
      name: receipt.fileName || `gcash-receipt-${Date.now()}.jpg`,
      type: receipt.mimeType || 'image/jpeg',
    } as unknown as Blob);

    setPlacing(true);
    try {
      const order = await apiPostForm<{ orderId: string }>('/cart/checkout', form, token);
      setCreatedOrderId(order.orderId);
      setCreatedOrderItemCount(selectedItems.length);
      setCreatedOrderTotal(total);
      setCreatedOrderImages(selectedItems.map((item) => item.imageUrl).filter((value): value is string => Boolean(value)).slice(0, 2));
      setStep('confirmed');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Order confirmed — we’ll keep you posted.', 'success');
      setReferenceNumber('');
      setReceipt(null);
      await loadCart();
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'MULTIPLE_PARCELS_CONFIRMATION_REQUIRED') {
        const parcelCount = Number(err.data.parcelCount);
        const shippingFeePerParcel = Number(err.data.shippingFeePerParcel);
        const shippingFee = Number(err.data.shippingFee);
        if (Number.isFinite(parcelCount) && parcelCount > 1 && Number.isFinite(shippingFeePerParcel) && Number.isFinite(shippingFee)) {
          setParcelConfirmation({ parcelCount, shippingFeePerParcel, shippingFee, source: 'placeOrder' });
          return;
        }
      }
      const message = err instanceof Error ? err.message : 'Please try again.';
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(message, 'error');
      Alert.alert('Could not place order', message);
    } finally {
      setPlacing(false);
    }
  };

  const continueWithMultipleParcels = () => {
    const confirmation = parcelConfirmation;
    if (!confirmation) return;
    setParcelConfirmation(null);
    setAcknowledgedParcelCount(confirmation.parcelCount);
    if (confirmation.source === 'checkout') {
      setStep('checkout');
      void loadVouchers();
      return;
    }
    void placeOrder(confirmation.parcelCount);
  };

  const reduceItems = () => {
    setParcelConfirmation(null);
    setAcknowledgedParcelCount(null);
    setStep('cart');
  };

  const leaveConfirmation = (route: '/(tabs)/orders' | '/(tabs)/catalog') => {
    setStep('cart');
    setCreatedOrderId('');
    setCreatedOrderItemCount(0);
    setCreatedOrderTotal(0);
    setCreatedOrderImages([]);
    setReferenceNumber('');
    setReceipt(null);
    router.replace(route);
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
        {step !== 'cart' ? <Header onMenu={openNav} onHome={() => router.replace('/(tabs)/catalog')} /> : null}

        {step !== 'confirmed' ? (
          <View style={[styles.titleRow, step === 'cart' && styles.cartTitleRow, step === 'cart' && { paddingTop: insets.top + 14 }]}>
            <TouchableOpacity style={step === 'cart' ? styles.cartBackButton : undefined} onPress={() => (step === 'cart' ? router.back() : setStep(step === 'receipt' ? 'checkout' : 'cart'))}>
              <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.cartTitleWrap}><Text style={styles.titleText}>{step === 'cart' ? 'My Cart' : 'Checkout'}</Text>{step === 'cart' ? <View style={styles.cartCount}><Text style={styles.cartCountText}>{items.length}</Text></View> : null}</View>
            <View pointerEvents="none" style={step === 'cart' ? styles.cartHeaderSpacer : { width: 25 }} />
          </View>
        ) : null}

        {step === 'cart' && (
          <ScrollView
            contentContainerStyle={styles.cartContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!items.length ? (
              <EmptyCart onBrowse={() => router.replace('/(tabs)/catalog')} />
            ) : (
              <>
                <View style={styles.cartListTools}>
                  <Pressable style={styles.selectAllButton} onPress={toggleSelectAll}><Ionicons name={selectedIds.size === items.length ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selectedIds.size === items.length ? Colors.brand.blue : Colors.text.secondary} /><Text style={styles.selectAllText}>Select all</Text></Pressable>
                  <View style={styles.swipeHelper}><Ionicons name="arrow-back" size={18} color={Colors.text.secondary} /><Text style={styles.swipeHelperText}>Swipe a card to remove</Text></View>
                </View>
                {items.map((item) => <CartItemCard key={item.cartItemId} item={item} selected={selectedIds.has(item.cartItemId)} onToggle={() => toggleItem(item.cartItemId)} onOpen={() => openProductOverview(item)} onRemove={() => void removeItem(item)} />)}
              </>
            )}

            {items.length ? <>
              <Text style={styles.cartSummaryHeading}>Order summary</Text>
              <SummaryCard subtotal={subtotal} shipping={0} discount={voucherDiscount} total={total} showShipping={false} itemCount={selectedItems.length} />
            </> : null}
            {shippingEvaluation?.allowed && Number(shippingEvaluation.parcelCount ?? 1) > 1 ? (
              <ParcelWarning
                parcelCount={Number(shippingEvaluation.parcelCount)}
                shippingFeePerParcel={Number(shippingEvaluation.shippingFeePerParcel)}
                shippingFee={Number(shippingEvaluation.shippingFee)}
              />
            ) : null}
          </ScrollView>
        )}

        {step === 'cart' && items.length ? <View style={[styles.cartCheckoutBar, { bottom: BOTTOM_TAB_BAR_HEIGHT + insets.bottom + Spacing.sm }]}><View><Text style={styles.cartTotalLabel}>Total</Text><Text style={styles.cartTotal}>{peso(total)}</Text></View><TouchableOpacity style={[styles.cartCheckoutButton, (!selectedItems.length || shippingLoading) && styles.cartCheckoutDisabled]} disabled={!selectedItems.length || shippingLoading} onPress={beginCheckout}><Text style={styles.cartCheckoutText}>{shippingLoading ? 'Calculating…' : 'Checkout'}</Text><Ionicons name="arrow-forward" size={20} color={Colors.white} /></TouchableOpacity></View> : null}

        {step === 'checkout' && (
          <KeyboardAvoidingView style={styles.checkoutScreen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={[styles.content, styles.checkoutContent, { paddingBottom: BOTTOM_TAB_BAR_HEIGHT + insets.bottom + CHECKOUT_ACTION_HEIGHT + Spacing.xl }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              <ProgressBars active={1} />
              <AddressPanel user={user} address={fullAddress} />
              <PaymentPanel />
              <VoucherPanel vouchers={vouchers} loading={voucherLoading} code={voucherCode} error={voucherError} appliedVoucher={appliedVoucher} onCodeChange={updateVoucherCode} onApply={applyVoucher} onRemove={removeVoucher} />
              <SummaryCard subtotal={subtotal} shipping={shipping} discount={voucherDiscount} total={total} showShipping itemCount={selectedItems.length} />
            </ScrollView>
            <View style={[styles.checkoutFooter, { paddingBottom: BOTTOM_TAB_BAR_HEIGHT + insets.bottom + Spacing.sm }]}>
              <TouchableOpacity style={styles.checkoutPrimaryButton} onPress={() => setStep('receipt')}>
                <Text style={styles.primaryText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {step === 'receipt' && (
          <KeyboardAvoidingView style={styles.checkoutScreen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={[styles.content, styles.checkoutContent, { paddingBottom: BOTTOM_TAB_BAR_HEIGHT + insets.bottom + CHECKOUT_ACTION_HEIGHT + Spacing.xl }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              <ProgressBars active={2} />
              <AddressPanel user={user} address={fullAddress} />
              <PaymentPanel />
              <VoucherPanel vouchers={vouchers} loading={voucherLoading} code={voucherCode} error={voucherError} appliedVoucher={appliedVoucher} onCodeChange={updateVoucherCode} onApply={applyVoucher} onRemove={removeVoucher} />
              <SummaryCard subtotal={subtotal} shipping={shipping} discount={voucherDiscount} total={total} showShipping itemCount={selectedItems.length} />
              <Panel icon="receipt" title="Upload Receipt">
                <Image source={require('@/assets/gcash-qr.png')} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.gcashNumber}>GCash Number: {GCASH_NUMBER}</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={chooseReceipt}>
                  {receipt ? (
                    <Image source={{ uri: receipt.uri }} style={styles.receiptPreview} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={26} color={Colors.text.primary} />
                      <Text style={styles.uploadText}>Tap to upload your receipt</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.inputLabel}>Reference Number</Text>
                <TextInput
                  style={styles.referenceInput}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                  placeholder="Enter GCash reference no."
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                />
              </Panel>
            </ScrollView>
            <View style={[styles.checkoutFooter, { paddingBottom: BOTTOM_TAB_BAR_HEIGHT + insets.bottom + Spacing.sm }]}>
              <TouchableOpacity style={[styles.checkoutPrimaryButton, placing && styles.disabled]} onPress={() => void placeOrder()} disabled={placing}>
                {placing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Place Order</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {step === 'confirmed' && (
          <View style={styles.confirmed}>
            <View style={styles.confirmIcon}><LottieView source={require('@/assets/order-success.json')} autoPlay loop={false} style={styles.successLottie} /></View>
            <Text style={styles.confirmText}>Order confirmed</Text>
            <Text style={styles.confirmSubtext}>We'll notify you once it's processed.</Text>
            <View style={styles.confirmationCard}>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Order number</Text>
                <Text style={styles.confirmationValue}>{createdOrderId.slice(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Status</Text>
                <View style={styles.statusPill}><Text style={styles.statusPillText}>Waiting for admin</Text></View>
              </View>
              <View style={styles.confirmationDivider} />
              <View style={styles.confirmationItems}>
                <View style={styles.itemPlaceholders}>
                  {createdOrderImages.length ? createdOrderImages.map((source, index) => (
                    <Image key={`${source}-${index}`} source={{ uri: imageUrl(source) ?? source }} style={styles.itemPlaceholder} />
                  )) : <View style={styles.itemPlaceholder} />}
                </View>
                <View style={styles.confirmationItemText}>
                  <Text style={styles.itemCount}>{createdOrderItemCount} {createdOrderItemCount === 1 ? 'item' : 'items'}</Text>
                  <Text style={styles.itemCaption}>Your selected items</Text>
                </View>
                <Text style={styles.confirmationTotal}>₱{createdOrderTotal.toFixed(2)}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.primaryButton, styles.confirmationAction]} onPress={() => leaveConfirmation('/(tabs)/orders')}>
              <Text style={styles.primaryText}>Check Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.confirmationSecondaryAction]} onPress={() => leaveConfirmation('/(tabs)/catalog')}>
              <Text style={styles.secondaryText}>Continue shopping</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={Boolean(parcelConfirmation)} transparent animationType="fade" onRequestClose={() => undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.parcelModal}>
              <Text style={styles.parcelModalTitle}>Multiple Parcels Required</Text>
              <Text style={styles.parcelModalText}>Your selected items don't fit in one parcel.</Text>
              <Text style={styles.parcelModalText}>This order will be shipped in {parcelConfirmation?.parcelCount} parcels.</Text>
              <Text style={styles.parcelModalShipping}>{peso(parcelConfirmation?.shippingFeePerParcel ?? 0)} per parcel × {parcelConfirmation?.parcelCount} = {peso(parcelConfirmation?.shippingFee ?? 0)} total shipping</Text>
              <Text style={styles.parcelModalText}>Continue with {parcelConfirmation?.parcelCount} parcels or reduce your selected items?</Text>
              <View style={styles.parcelModalActions}>
                <TouchableOpacity style={styles.reduceItemsButton} onPress={reduceItems}>
                  <Text style={styles.reduceItemsText}>Reduce Items</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.continueParcelsButton} onPress={continueWithMultipleParcels}>
                  <Text style={styles.primaryText}>Continue with {parcelConfirmation?.parcelCount} Parcels</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      {undoItem ? <MotiView from={{ opacity: 0, translateY: 22 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0 }} style={styles.undoBar}><Text style={styles.undoText} numberOfLines={1}>{undoItem.productName} removed</Text><TouchableOpacity onPress={() => void undoRemove()}><Text style={styles.undoAction}>UNDO</Text></TouchableOpacity></MotiView> : null}
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

function EmptyCart({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="cart-outline" size={42} color={Colors.text.secondary} />
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptyText}>Products you add from the catalog will appear here.</Text>
      <TouchableOpacity style={styles.emptyBrowseButton} onPress={onBrowse}><Text style={styles.emptyBrowseText}>Browse catalog</Text></TouchableOpacity>
    </View>
  );
}

function SwipeDeleteAction({ translation, onRemove }: { translation: SharedValue<number>; onRemove: () => void }) {
  const actionStyle = useAnimatedStyle(() => ({ opacity: interpolate(translation.value, [-112, -20, 0], [1, 0.18, 0]) }));
  useAnimatedReaction(
    () => translation.value < -190,
    (shouldRemove, previouslyRemoving) => {
      if (shouldRemove && !previouslyRemoving) runOnJS(onRemove)();
    },
  );
  return <Animated.View style={[styles.swipeDelete, actionStyle]}><TouchableOpacity style={styles.swipeDeletePressable} onPress={onRemove}><Ionicons name="trash-outline" size={22} color={Colors.white} /><Text style={styles.swipeDeleteText}>Remove</Text></TouchableOpacity></Animated.View>;
}

function CartItemCard({ item, selected, onToggle, onOpen, onRemove }: { item: CartItem; selected: boolean; onToggle: () => void; onOpen: () => void; onRemove: () => void }) {
  return (
    <Swipeable
      renderRightActions={(_, translation) => <SwipeDeleteAction translation={translation} onRemove={onRemove} />}
      rightThreshold={56}
      overshootRight
      overshootFriction={2}
      dragOffsetFromRight={-12}
      containerStyle={styles.swipeContainer}
      childrenContainerStyle={styles.swipeChildren}
    >
      <View style={styles.itemCard}>
        <TouchableOpacity style={styles.itemImageTile} onPress={onOpen} activeOpacity={0.86}>
          {item.imageUrl ? <Image source={{ uri: imageUrl(item.imageUrl) ?? item.imageUrl }} style={styles.itemImage} /> : <Ionicons name="shirt-outline" size={32} color={Colors.text.secondary} />}
          <Pressable style={styles.itemSelectOverlay} hitSlop={6} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Ionicons name={selected ? 'checkmark' : 'ellipse-outline'} size={17} color={Colors.white} /></Pressable>
        </TouchableOpacity>
        <TouchableOpacity style={styles.itemInfo} onPress={onOpen} activeOpacity={0.86}>
          <View style={styles.itemTitleRow}><Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text><Text style={styles.itemPrice}>{peso(item.unitPrice)}</Text></View>
          <View style={styles.sizeBadge}><Text style={styles.sizeBadgeText}>Size {item.size}</Text></View>
          <Text style={styles.itemDesc} numberOfLines={1}>{item.description || item.color || 'A FRO item'}</Text>
          <View style={styles.itemBottomRow}><View style={styles.prelovedTag}><Ionicons name="heart-outline" size={16} color={Colors.text.secondary} /><Text style={styles.prelovedText}>Qty 1 · Preloved</Text></View><TouchableOpacity style={styles.itemTrashButton} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${item.productName} from cart`}><Ionicons name="trash-outline" size={21} color={Colors.text.secondary} /></TouchableOpacity></View>
        </TouchableOpacity>
      </View>
    </Swipeable>
  );
}

function AddressPanel({ user, address }: { user: AuthUser | null; address: string }) {
  return (
    <Panel icon="location" title="Address">
      <Text style={styles.addressName}>{user?.full_name || 'Customer'}</Text>
      <Text style={styles.addressText}>{address}</Text>
    </Panel>
  );
}

function PaymentPanel() {
  return (
    <Panel icon="card" title="Payment Methods" rightText="GCash only">
      <View style={styles.paymentRow}>
        <View style={styles.paymentIcon}>
          <Text style={styles.paymentLetter}>G</Text>
        </View>
        <Text style={styles.paymentText}>GCash</Text>
        <Ionicons name="radio-button-on" size={20} color={Colors.brand.blueLight} />
      </View>
    </Panel>
  );
}

function ParcelWarning({ parcelCount, shippingFeePerParcel, shippingFee }: Omit<ParcelConfirmation, 'source'>) {
  return (
    <View style={styles.parcelWarning}>
      <Ionicons name="warning-outline" size={20} color="#8A5A00" />
      <View style={styles.parcelWarningCopy}>
        <Text style={styles.parcelWarningTitle}>Multiple parcels required</Text>
        <Text style={styles.parcelWarningText}>Your selected items need {parcelCount} parcels.</Text>
        <Text style={styles.parcelWarningText}>Shipping: {peso(shippingFeePerParcel)} × {parcelCount} = {peso(shippingFee)}</Text>
      </View>
    </View>
  );
}

function VoucherPanel({
  vouchers, loading, code, error, appliedVoucher, onCodeChange, onApply, onRemove,
}: {
  vouchers: Voucher[];
  loading: boolean;
  code: string;
  error: string;
  appliedVoucher: AppliedVoucher | null;
  onCodeChange: (value: string) => void;
  onApply: (code?: string) => void;
  onRemove: () => void;
}) {
  return (
    <Panel icon="pricetag" title="Voucher" rightText={loading ? 'Loading…' : undefined}>
      {appliedVoucher ? (
        <View style={styles.appliedVoucher}>
          <View style={styles.appliedVoucherCopy}>
            <View style={styles.appliedVoucherChip}><Ionicons name="checkmark" size={14} color="#146C36" /><Text style={styles.appliedVoucherCode}>{appliedVoucher.code} applied</Text></View>
            <Text style={styles.appliedVoucherText}>Discount applied: {peso(appliedVoucher.discountAmount)}</Text>
          </View>
          <TouchableOpacity style={styles.removeVoucherButton} onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove voucher"><Ionicons name="close" size={18} color="#146C36" /></TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.voucherEntry}>
            <TextInput
              style={[styles.voucherInput, error ? styles.voucherInputError : undefined]}
              value={code}
              onChangeText={onCodeChange}
              autoCapitalize="characters"
              placeholder="Enter voucher code"
              placeholderTextColor={Colors.text.muted}
              accessibilityHint={error || 'Enter a voucher code, then apply it to your order.'}
            />
            <TouchableOpacity style={styles.applyVoucherButton} onPress={() => onApply()} disabled={loading}>
              <Text style={styles.applyVoucherText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.voucherError} accessibilityLiveRegion="polite">{error}</Text> : null}
          {vouchers.length ? (
            <View style={styles.voucherList}>
              <Text style={styles.availableVoucherLabel}>Available vouchers</Text>
              {vouchers.map((voucher) => (
                <TouchableOpacity key={voucher.id} style={styles.voucherOption} onPress={() => onApply(voucher.code)} disabled={loading}>
                  <View>
                    <Text style={styles.voucherOptionCode}>{voucher.code}</Text>
                    <Text style={styles.voucherOptionText}>
                      {voucher.discountType === 'percentage' ? `${voucher.discountAmount}% off` : `${peso(voucher.discountAmount)} off`}
                      {voucher.minimumOrderAmount > 0 ? ` · min. ${peso(voucher.minimumOrderAmount)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.voucherOptionSave}>Save {peso(voucher.estimatedDiscount)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : !loading ? <Text style={styles.noVoucherText}>No vouchers are currently available for these items.</Text> : null}
        </>
      )}
    </Panel>
  );
}

function ProgressBars({ active }: { active: number }) {
  return (
    <View style={styles.progressRow}>
      {[0, 1].map((index) => (
        <View key={index} style={[styles.progressBar, index < active && styles.progressBarActive]} />
      ))}
    </View>
  );
}

function Panel({
  children,
  icon,
  title,
  rightText,
}: {
  children: React.ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  rightText?: string;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <Ionicons name={icon} size={17} color={Colors.text.primary} />
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
        {rightText ? <Text style={styles.panelRight}>{rightText}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function SummaryCard({
  subtotal,
  shipping,
  discount = 0,
  total,
  showShipping,
  itemCount,
}: {
  subtotal: number;
  shipping: number;
  discount?: number;
  total: number;
  showShipping: boolean;
  itemCount: number;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{showShipping ? 'Order Info' : 'Order summary'}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Product</Text>
        <Text style={styles.summaryValue}>{itemCount} Item{itemCount === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>{peso(subtotal)}</Text>
      </View>
      {discount > 0 ? (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Voucher discount</Text>
          <Text style={styles.discountValue}>−{peso(discount)}</Text>
        </View>
      ) : null}
      {showShipping ? (
        <>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping Fee</Text>
          <Text style={styles.summaryValue}>{peso(shipping)}</Text>
        </View>
        </>
      ) : null}
      <View style={styles.summaryTotalRow}>
        <Text style={styles.summaryTotalLabel}>Total{showShipping ? ' Payment' : ''}</Text>
        <MotiView key={Math.round(total * 100)} from={{ opacity: 0.25, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 190 }}><Text style={styles.summaryTotalValue}>{peso(total)}</Text></MotiView>
      </View>
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
  cartTitleRow: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg },
  cartTitleWrap: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm },
  cartBackButton: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 22, height: 44, justifyContent: 'center', width: 44, shadowColor: Colors.black, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  cartHeaderSpacer: { height: 44, width: 44 },
  cartCount: { alignItems: 'center', backgroundColor: '#E5ECF5', borderRadius: Radius.full, height: 32, justifyContent: 'center', minWidth: 32, paddingHorizontal: Spacing.sm },
  cartCountText: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  titleText: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 36, gap: Spacing.md },
  cartContent: { gap: Spacing.md, paddingHorizontal: Spacing.md, paddingBottom: BOTTOM_TAB_BAR_HEIGHT + CART_CHECKOUT_BAR_HEIGHT + 72 },
  cartListTools: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  selectAllButton: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, minHeight: 44 },
  selectAllText: { color: Colors.text.secondary, fontSize: FontSize.base, fontWeight: '800' },
  swipeHelper: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs },
  swipeHelperText: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '700' },
  checkoutScreen: { flex: 1 },
  checkoutContent: { flexGrow: 1 },
  checkoutFooter: {
    backgroundColor: 'rgba(244, 247, 253, 0.98)',
    borderTopColor: Colors.border.default,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  checkoutPrimaryButton: {
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    height: CHECKOUT_ACTION_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  swipeContainer: { borderRadius: 26, marginBottom: Spacing.md, overflow: 'hidden' },
  swipeChildren: { borderRadius: 26 },
  itemCard: {
    minHeight: 152,
    borderRadius: 26,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.white,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  itemImageTile: { backgroundColor: '#EAF1FA', borderRadius: 20, height: 120, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 120, alignItems: 'center' },
  itemImage: { height: '100%', width: '100%' },
  itemSelectOverlay: { alignItems: 'center', backgroundColor: Colors.brand.blue, borderColor: Colors.white, borderRadius: 16, borderWidth: 2, height: 32, justifyContent: 'center', left: 6, position: 'absolute', top: 6, width: 32 },
  itemInfo: { flex: 1, justifyContent: 'space-between', minHeight: 120 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName: { flex: 1, color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  itemPrice: { color: Colors.text.primary, fontSize: FontSize.md, fontWeight: '900' },
  itemDesc: { color: '#0f437c', fontSize: FontSize.xs, marginTop: 2 },
  sizeBadge: {
    alignSelf: 'flex-start', backgroundColor: '#E5ECF5', borderRadius: Radius.full, marginTop: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 5,
  },
  sizeBadgeText: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900' },
  itemBottomRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  prelovedTag: { alignItems: 'center', backgroundColor: '#F2F6FC', borderRadius: Radius.full, flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 7 },
  prelovedText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '800' },
  itemTrashButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  swipeDelete: { alignSelf: 'stretch', backgroundColor: Colors.status.error, borderRadius: 26, justifyContent: 'center', width: 112 },
  swipeDeletePressable: { alignItems: 'center', flex: 1, gap: Spacing.xs, justifyContent: 'center' },
  swipeDeleteText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },
  undoBar: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: 88, minHeight: 54, borderRadius: Radius.md, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.text.primary, elevation: 12, shadowColor: Colors.black, shadowOpacity: 0.18, shadowRadius: 12 },
  undoText: { flex: 1, color: Colors.white, fontSize: FontSize.sm, fontWeight: '700', marginRight: Spacing.sm },
  undoAction: { color: '#A9DBFF', fontSize: FontSize.sm, fontWeight: '900' },
  summary: {
    borderRadius: 26,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  cartSummaryHeading: { color: Colors.text.secondary, fontSize: FontSize.base, fontWeight: '900', letterSpacing: 1.2, marginTop: Spacing.sm, textTransform: 'uppercase' },
  summaryTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  summaryRow: { minHeight: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '700' },
  summaryValue: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900' },
  discountValue: { color: '#12733E', fontSize: FontSize.xs, fontWeight: '900' },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(221, 241, 255, 0.25)',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTotalLabel: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  summaryTotalValue: { color: Colors.text.primary, fontSize: FontSize['2xl'], fontWeight: '900' },
  cartCheckoutBar: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 26, flexDirection: 'row', justifyContent: 'space-between', left: Spacing.md, padding: Spacing.md, position: 'absolute', right: Spacing.md, shadowColor: Colors.black, shadowOpacity: 0.14, shadowRadius: 18, elevation: 12, zIndex: 40 },
  cartTotalLabel: { color: Colors.text.secondary, fontSize: FontSize.sm, fontWeight: '800' },
  cartTotal: { color: Colors.text.primary, fontSize: FontSize['2xl'], fontWeight: '900', marginTop: 2 },
  cartCheckoutButton: { alignItems: 'center', backgroundColor: Colors.brand.blue, borderRadius: Radius.full, flexDirection: 'row', gap: Spacing.sm, height: 52, justifyContent: 'center', minWidth: 168, paddingHorizontal: Spacing.lg },
  cartCheckoutDisabled: { backgroundColor: '#AEBBCB' },
  cartCheckoutText: { color: Colors.white, fontSize: FontSize.base, fontWeight: '900' },
  primaryButton: {
    alignSelf: 'center',
    minWidth: 150,
    height: 42,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
  },
  secondaryButton: {
    alignSelf: 'center',
    minWidth: 150,
    height: 42,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#425469',
    borderWidth: 1,
    borderColor: '#8FA9C8',
    marginTop: Spacing.sm,
  },
  primaryText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },
  secondaryText: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '900' },
  confirmationAction: { width: '100%', borderRadius: Radius.md, height: 48 },
  confirmationSecondaryAction: { width: '100%', backgroundColor: 'transparent', borderColor: 'transparent', height: 44, marginTop: Spacing.xs },
  disabled: { opacity: 0.45 },
  progressRow: { flexDirection: 'row', alignSelf: 'center', gap: 2, width: 210, marginBottom: Spacing.sm },
  progressBar: { flex: 1, height: 5, backgroundColor: '#D9E6F5' },
  progressBarActive: { backgroundColor: Colors.brand.blue },
  panel: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(221, 241, 255, 0.12)',
    marginBottom: Spacing.sm,
  },
  panelTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  panelTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  panelRight: { color: Colors.brand.blueLight, fontSize: 10, fontWeight: '800' },
  addressName: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900' },
  addressText: { color: Colors.text.primary, fontSize: 10, lineHeight: 15, marginTop: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42, gap: Spacing.md },
  paymentIcon: { width: 24, height: 24, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#BCEBFF' },
  paymentLetter: { color: '#1466A4', fontSize: FontSize.base, fontWeight: '900' },
  paymentText: { flex: 1, color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '800' },
  voucherEntry: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  voucherInput: { flex: 1, height: 42, borderRadius: Radius.sm, borderWidth: 1, borderColor: '#8FA9C8', color: Colors.text.primary, paddingHorizontal: Spacing.sm, fontSize: FontSize.sm },
  voucherInputError: { borderColor: Colors.status.error },
  voucherError: { color: Colors.status.error, fontSize: FontSize.xs, fontWeight: '700', marginTop: Spacing.xs },
  applyVoucherButton: { height: 42, borderRadius: Radius.sm, backgroundColor: Colors.brand.blue, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  applyVoucherText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  voucherList: { marginTop: Spacing.md, gap: Spacing.xs },
  availableVoucherLabel: { color: Colors.text.secondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  voucherOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: '#EDF5FF', borderWidth: 1, borderColor: '#D6E6F8' },
  voucherOptionCode: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '900' },
  voucherOptionText: { color: Colors.text.secondary, fontSize: 10, marginTop: 2 },
  voucherOptionSave: { color: '#12733E', fontSize: 10, fontWeight: '900' },
  noVoucherText: { color: Colors.text.secondary, fontSize: 10, marginTop: Spacing.sm },
  appliedVoucher: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: '#E8F8ED' },
  appliedVoucherCopy: { flex: 1 },
  appliedVoucherChip: { alignSelf: 'flex-start', alignItems: 'center', backgroundColor: '#D6F2DE', borderRadius: Radius.full, flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  appliedVoucherCode: { color: '#146C36', fontSize: FontSize.sm, fontWeight: '900' },
  appliedVoucherText: { color: '#28774A', fontSize: 10, marginTop: 2 },
  removeVoucherButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  qrImage: { alignSelf: 'center', width: 160, height: 210, marginBottom: Spacing.sm, backgroundColor: Colors.white },
  gcashNumber: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900', marginBottom: Spacing.sm },
  uploadBox: {
    height: 88,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  uploadText: { color: Colors.text.primary, fontSize: 10, fontWeight: '800', marginTop: 4 },
  receiptPreview: { width: '100%', height: '100%' },
  inputLabel: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900', marginBottom: 5 },
  referenceInput: {
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#8FA9C8',
    color: Colors.text.primary,
    paddingHorizontal: Spacing.sm,
  },
  confirmed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
    marginBottom: Spacing.lg,
  },
  successLottie: { width: 96, height: 96 },
  confirmText: { color: Colors.text.primary, fontSize: 28, lineHeight: 34, fontWeight: '900', textAlign: 'center' },
  confirmSubtext: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.lg },
  confirmationCard: { width: '100%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: '#E2EAF4' },
  confirmationRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmationLabel: { color: Colors.text.secondary, fontSize: FontSize.xs },
  confirmationValue: { color: Colors.brand.blue, fontWeight: '800', fontSize: FontSize.sm },
  statusPill: { backgroundColor: '#EAF2FC', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  statusPillText: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '800' },
  confirmationDivider: { height: 1, backgroundColor: '#E2EAF4', marginVertical: Spacing.sm },
  confirmationItems: { flexDirection: 'row', alignItems: 'center' },
  itemPlaceholders: { flexDirection: 'row', width: 68 },
  itemPlaceholder: { width: 38, height: 38, borderRadius: Radius.sm, backgroundColor: '#E7EEF8', marginRight: -8, borderWidth: 1, borderColor: Colors.white },
  confirmationItemText: { flex: 1, marginLeft: Spacing.sm },
  itemCount: { color: Colors.text.primary, fontWeight: '800', fontSize: FontSize.sm },
  itemCaption: { color: Colors.text.secondary, fontSize: FontSize.xs, marginTop: 2 },
  confirmationTotal: { color: Colors.text.primary, fontWeight: '900', fontSize: FontSize.base },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.sm },
  emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  emptyBrowseButton: { alignItems: 'center', backgroundColor: Colors.brand.blue, borderRadius: Radius.full, height: 44, justifyContent: 'center', marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
  emptyBrowseText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '900' },
  error: { color: Colors.status.error, fontSize: FontSize.sm, textAlign: 'center' },
  parcelWarning: { flexDirection: 'row', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: '#FFF4D6', borderWidth: 1, borderColor: '#E6BF67' },
  parcelWarningCopy: { flex: 1 },
  parcelWarningTitle: { color: '#714800', fontSize: FontSize.sm, fontWeight: '900', marginBottom: 3 },
  parcelWarningText: { color: '#714800', fontSize: FontSize.xs, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(8, 20, 36, 0.7)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  parcelModal: { width: '100%', maxWidth: 420, borderRadius: Radius.lg, padding: Spacing.lg, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#B8D9EE' },
  parcelModalTitle: { color: Colors.brand.blue, fontSize: FontSize.lg, fontWeight: '900', marginBottom: Spacing.sm },
  parcelModalText: { color: Colors.text.primary, fontSize: FontSize.sm, lineHeight: 21, marginBottom: Spacing.xs },
  parcelModalShipping: { color: Colors.brand.blue, fontSize: FontSize.base, fontWeight: '900', lineHeight: 22, marginVertical: Spacing.sm },
  parcelModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  reduceItemsButton: { minHeight: 42, paddingHorizontal: Spacing.md, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8FA9C8', backgroundColor: '#EEF4F9' },
  reduceItemsText: { color: Colors.brand.blue, fontSize: FontSize.sm, fontWeight: '900' },
  continueParcelsButton: { minHeight: 42, paddingHorizontal: Spacing.lg, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164E67', borderWidth: 1, borderColor: '#61C4E6' },
});
