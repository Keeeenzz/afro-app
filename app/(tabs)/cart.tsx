import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
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
import { apiDelete, apiGet, apiPostForm, imageUrl } from '@/lib/api';
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

const SHIPPING_FEE = 20;
const GCASH_NUMBER = '09568313505';

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
  const shipping = selectedItems.length ? SHIPPING_FEE : 0;
  const total = subtotal + shipping;
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
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeItem = async (item: CartItem) => {
    if (!user?.user_id) return;
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

  const chooseReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });

    if (!result.canceled) {
      setReceipt(result.assets[0]);
    }
  };

  const placeOrder = async () => {
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
    form.append('shippingFee', String(SHIPPING_FEE));
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
    form.append('receipt', {
      uri: receipt.uri,
      name: receipt.fileName || `gcash-receipt-${Date.now()}.jpg`,
      type: receipt.mimeType || 'image/jpeg',
    } as unknown as Blob);

    setPlacing(true);
    try {
      const order = await apiPostForm<{ orderId: string }>('/cart/checkout', form, token);
      setCreatedOrderId(order.orderId);
      setStep('confirmed');
      setReferenceNumber('');
      setReceipt(null);
      await loadCart();
    } catch (err) {
      Alert.alert('Could not place order', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const leaveConfirmation = (route: '/(tabs)/orders' | '/(tabs)/catalog') => {
    setStep('cart');
    setCreatedOrderId('');
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
    <ImageBackground source={require('@/assets/splash-icon.png')} style={styles.screen} imageStyle={styles.bgImage}>
      <View style={styles.overlay}>
        <Header onMenu={openNav} />

        {step !== 'confirmed' ? (
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => (step === 'cart' ? router.back() : setStep(step === 'receipt' ? 'checkout' : 'cart'))}>
              <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.titlePill}>
              <Text style={styles.titleText}>{step === 'cart' ? 'My Cart' : 'Checkout'}</Text>
            </View>
            {step === 'cart' ? <Ionicons name="trash" size={24} color={Colors.text.secondary} /> : <View style={{ width: 24 }} />}
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
                        color={selectedIds.has(item.cartItemId) ? '#DDF7FF' : Colors.text.secondary}
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
            <TouchableOpacity
              style={[styles.primaryButton, !selectedItems.length && styles.disabled]}
              disabled={!selectedItems.length}
              onPress={() => setStep('checkout')}
            >
              <Text style={styles.primaryText}>Checkout</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'checkout' && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ProgressBars active={1} />
            <AddressPanel user={user} address={fullAddress} />
            <PaymentPanel />
            <SummaryCard subtotal={subtotal} shipping={SHIPPING_FEE} total={total} showShipping itemCount={selectedItems.length} />
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
            <SummaryCard subtotal={subtotal} shipping={SHIPPING_FEE} total={total} showShipping itemCount={selectedItems.length} />
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
            <TouchableOpacity style={[styles.primaryButton, placing && styles.disabled]} onPress={placeOrder} disabled={placing}>
              {placing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Place Order</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}

        {step === 'confirmed' && (
          <View style={styles.confirmed}>
            <View style={styles.confirmIcon}>
              <Ionicons name="checkmark" size={86} color="#DDF7FF" />
            </View>
            <Text style={styles.confirmText}>Order{'\n'}Confirmed</Text>
            <Text style={styles.confirmSubtext}>
              Order {createdOrderId.slice(0, 8).toUpperCase()} is now waiting for admin processing.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => leaveConfirmation('/(tabs)/orders')}>
              <Text style={styles.primaryText}>Check Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => leaveConfirmation('/(tabs)/catalog')}>
              <Text style={styles.primaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
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
  total,
  showShipping,
  itemCount,
}: {
  subtotal: number;
  shipping: number;
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
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Shipping Fee</Text>
          <Text style={styles.summaryValue}>{peso(shipping)}</Text>
        </View>
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 36, gap: Spacing.md },
  itemCard: {
    minHeight: 92,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: 'rgba(86, 113, 143, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  cartItemOpen: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  itemImage: { width: 70, height: 70, borderRadius: Radius.sm, backgroundColor: '#A8DDFF' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemName: { flex: 1, color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  itemDesc: { color: '#D2E3F5', fontSize: FontSize.xs, marginTop: 2 },
  itemMeta: { color: '#BCEBFF', fontSize: FontSize.xs, fontWeight: '800', marginTop: 4 },
  sizeBadge: {
    minWidth: 25,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    backgroundColor: '#315169',
  },
  itemActions: { width: 72, alignItems: 'flex-end', justifyContent: 'space-between' },
  checkButton: { minHeight: 24, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  price: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900' },
  removeText: { color: '#CFEFFF', fontSize: 10, fontWeight: '900' },
  summary: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(86, 113, 143, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(221, 241, 255, 0.14)',
  },
  summaryTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginBottom: Spacing.sm },
  summaryRow: { minHeight: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '700' },
  summaryValue: { color: Colors.text.primary, fontSize: FontSize.xs, fontWeight: '900' },
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
    backgroundColor: '#164E67',
    borderWidth: 1,
    borderColor: '#61C4E6',
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
  primaryText: { color: Colors.text.primary, fontSize: FontSize.sm, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  progressRow: { flexDirection: 'row', alignSelf: 'center', gap: 2, width: 210, marginBottom: Spacing.sm },
  progressBar: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressBarActive: { backgroundColor: '#A8F2FF' },
  panel: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(74, 101, 132, 0.72)',
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
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1682FF',
    transform: [{ rotate: '-42deg' }],
    marginBottom: Spacing.xl,
  },
  confirmText: { color: '#79E9FF', fontSize: 40, lineHeight: 47, fontWeight: '900', textAlign: 'center' },
  confirmSubtext: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginVertical: Spacing.lg },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text.primary, fontSize: FontSize.base, fontWeight: '900', marginTop: Spacing.sm },
  emptyText: { color: Colors.text.secondary, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  error: { color: Colors.status.error, fontSize: FontSize.sm, textAlign: 'center' },
});
