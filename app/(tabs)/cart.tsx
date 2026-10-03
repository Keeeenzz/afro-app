import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
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
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApiError, apiDelete, apiGet, apiPost, apiPostForm, imageUrl } from '@/lib/api';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore, type AuthUser } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';

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
  const { user, token } = useAuthStore();
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
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [parcelConfirmation, setParcelConfirmation] = useState<ParcelConfirmation | null>(null);
  const [acknowledgedParcelCount, setAcknowledgedParcelCount] = useState<number | null>(null);

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
    } catch (err) {
      setItems(previousItems);
      Alert.alert('Could not remove item', err instanceof Error ? err.message : 'Please try again.');
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
    if (!user?.user_id || !code.trim()) return;
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
      Alert.alert('Voucher unavailable', err instanceof Error ? err.message : 'This voucher cannot be applied to your order.');
      setAppliedVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
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
        <Header onMenu={openNav} onHome={() => router.replace('/(tabs)/catalog')} />

        {step !== 'confirmed' ? (
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => (step === 'cart' ? router.back() : setStep(step === 'receipt' ? 'checkout' : 'cart'))}>
              <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.titleText}>{step === 'cart' ? 'My Cart' : 'Checkout'}</Text>
            <View style={{ width: 25 }} />
          </View>
        ) : null}

        {step === 'cart' && (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.brand.blueLight} />}
          >
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!items.length ? (
              <EmptyCart />
            ) : (
              items.map((item) => (
                <View key={item.cartItemId} style={styles.itemCard}>
                  <TouchableOpacity style={styles.cartItemOpen} onPress={() => openProductOverview(item)} activeOpacity={0.84}>
                    {item.imageUrl ? <Image source={{ uri: imageUrl(item.imageUrl) ?? item.imageUrl }} style={styles.itemImage} /> : <View style={styles.itemImage} />}
                    <View style={styles.itemInfo}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                        <Text style={styles.sizeBadge}>{item.size}</Text>
                      </View>
                      <Text style={styles.itemDesc} numberOfLines={1}>{item.description || item.color || 'A FRO item'}</Text>
                      <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.itemActions}>
                    <Pressable style={styles.checkButton} onPress={() => toggleItem(item.cartItemId)}>
                      <Ionicons
                        name={selectedIds.has(item.cartItemId) ? 'checkmark-circle' : 'ellipse-outline'}
                        size={23}
                        color={selectedIds.has(item.cartItemId) ? '#092b61' : Colors.text.secondary}
                      />
                    </Pressable>
                    <Text style={styles.price}>{peso(Number(item.unitPrice) * Number(item.quantity))}</Text>
                    <TouchableOpacity onPress={() => removeItem(item)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <SummaryCard subtotal={subtotal} shipping={0} total={subtotal} showShipping={false} itemCount={selectedItems.length} />
            {shippingEvaluation?.allowed && Number(shippingEvaluation.parcelCount ?? 1) > 1 ? (
              <ParcelWarning
                parcelCount={Number(shippingEvaluation.parcelCount)}
                shippingFeePerParcel={Number(shippingEvaluation.shippingFeePerParcel)}
                shippingFee={Number(shippingEvaluation.shippingFee)}
              />
            ) : null}
            <TouchableOpacity
              style={[styles.primaryButton, (!selectedItems.length || shippingLoading) && styles.disabled]}
              disabled={!selectedItems.length || shippingLoading}
              onPress={beginCheckout}
            >
              <Text style={styles.primaryText}>{shippingLoading ? 'Calculating shipping…' : 'Checkout'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'checkout' && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ProgressBars active={1} />
            <AddressPanel user={user} address={fullAddress} />
            <PaymentPanel />
            <VoucherPanel vouchers={vouchers} loading={voucherLoading} code={voucherCode} appliedVoucher={appliedVoucher} onCodeChange={setVoucherCode} onApply={applyVoucher} onRemove={removeVoucher} />
            <SummaryCard subtotal={subtotal} shipping={shipping} discount={voucherDiscount} total={total} showShipping itemCount={selectedItems.length} />
            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('receipt')}>
              <Text style={styles.primaryText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'receipt' && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ProgressBars active={2} />
            <AddressPanel user={user} address={fullAddress} />
            <PaymentPanel />
            <VoucherPanel vouchers={vouchers} loading={voucherLoading} code={voucherCode} appliedVoucher={appliedVoucher} onCodeChange={setVoucherCode} onApply={applyVoucher} onRemove={removeVoucher} />
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
            <TouchableOpacity style={[styles.primaryButton, placing && styles.disabled]} onPress={() => void placeOrder()} disabled={placing}>
              {placing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Place Order</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'confirmed' && (
          <View style={styles.confirmed}>
            <View style={styles.confirmIcon}>
              <Ionicons name="checkmark" size={52} color={Colors.white} />
            </View>
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

function EmptyCart() {
  return (
    <View style={styles.empty}>
      <Ionicons name="cart-outline" size={42} color={Colors.text.secondary} />
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptyText}>Products you add from the catalog will appear here.</Text>
    </View>
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
  vouchers, loading, code, appliedVoucher, onCodeChange, onApply, onRemove,
}: {
  vouchers: Voucher[];
  loading: boolean;
  code: string;
  appliedVoucher: AppliedVoucher | null;
  onCodeChange: (value: string) => void;
  onApply: (code?: string) => void;
  onRemove: () => void;
}) {
  return (
    <Panel icon="pricetag" title="Voucher" rightText={loading ? 'Loading…' : undefined}>
      {appliedVoucher ? (
        <View style={styles.appliedVoucher}>
          <View>
            <Text style={styles.appliedVoucherCode}>{appliedVoucher.code}</Text>
            <Text style={styles.appliedVoucherText}>Discount applied: {peso(appliedVoucher.discountAmount)}</Text>
          </View>
          <TouchableOpacity onPress={onRemove}><Text style={styles.removeVoucherText}>Remove</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.voucherEntry}>
            <TextInput
              style={styles.voucherInput}
              value={code}
              onChangeText={onCodeChange}
              autoCapitalize="characters"
              placeholder="Enter voucher code"
              placeholderTextColor={Colors.text.muted}
            />
            <TouchableOpacity style={styles.applyVoucherButton} onPress={() => onApply()} disabled={loading || !code.trim()}>
              <Text style={styles.applyVoucherText}>Apply</Text>
            </TouchableOpacity>
          </View>
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
      <Text style={styles.summaryTitle}>{showShipping ? 'Order Info' : 'AMOUNT'}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Product</Text>
        <Text style={styles.summaryValue}>{itemCount} Item{itemCount === 1 ? '' : 's'}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>{peso(subtotal)}</Text>
      </View>
      {showShipping ? (
        <>
          {discount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Voucher discount</Text>
              <Text style={styles.discountValue}>−{peso(discount)}</Text>
            </View>
          ) : null}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping Fee</Text>
          <Text style={styles.summaryValue}>{peso(shipping)}</Text>
        </View>
        </>
      ) : null}
      <View style={styles.summaryTotalRow}>
        <Text style={styles.summaryTotalLabel}>Total{showShipping ? ' Payment' : ''}</Text>
        <Text style={styles.summaryTotalValue}>{peso(total)}</Text>
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
  titleText: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 36, gap: Spacing.md },
  itemCard: {
    minHeight: 92,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  cartItemOpen: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  itemImage: { width: 70, height: 70, borderRadius: Radius.sm, backgroundColor: '#EDF4FD' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName: { flex: 1, color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  itemDesc: { color: '#0f437c', fontSize: FontSize.xs, marginTop: 2 },
  itemMeta: { color: '#30586a', fontSize: FontSize.xs, fontWeight: '800', marginTop: 4 },
  sizeBadge: {
    minWidth: 25,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    color: "white",
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    backgroundColor: "#123b78",
  },
  itemActions: { width: 72, alignItems: 'flex-end', justifyContent: 'space-between' },
  checkButton: { minHeight: 24, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  price: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  removeText: { color: '#083c56', fontSize: 10, fontWeight: '900' },
  summary: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
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
  summaryTotalValue: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
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
  applyVoucherButton: { height: 42, borderRadius: Radius.sm, backgroundColor: Colors.brand.blue, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  applyVoucherText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
  voucherList: { marginTop: Spacing.md, gap: Spacing.xs },
  availableVoucherLabel: { color: Colors.text.secondary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  voucherOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: '#EDF5FF', borderWidth: 1, borderColor: '#D6E6F8' },
  voucherOptionCode: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '900' },
  voucherOptionText: { color: Colors.text.secondary, fontSize: 10, marginTop: 2 },
  voucherOptionSave: { color: '#12733E', fontSize: 10, fontWeight: '900' },
  noVoucherText: { color: Colors.text.secondary, fontSize: 10, marginTop: Spacing.sm },
  appliedVoucher: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: '#E8F8ED' },
  appliedVoucherCode: { color: '#146C36', fontSize: FontSize.sm, fontWeight: '900' },
  appliedVoucherText: { color: '#28774A', fontSize: 10, marginTop: 2 },
  removeVoucherText: { color: Colors.brand.blue, fontSize: FontSize.xs, fontWeight: '900' },
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
