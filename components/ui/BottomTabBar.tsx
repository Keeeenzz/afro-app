import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { PressableScale } from './PressableScale';

type Tab = { label: string; route: string; icon: keyof typeof Ionicons.glyphMap; active: (path: string) => boolean; cart?: boolean };
const tabs: Tab[] = [
  { label: 'Home', route: '/(tabs)/', icon: 'home-outline', active: (path) => path === '/' || path.endsWith('/(tabs)') || path.endsWith('/(tabs)/') || path.includes('/catalog') || path.includes('/product/') },
  { label: 'Try-On', route: '/(tabs)/try-on', icon: 'sparkles-outline', active: (path) => path.includes('/try-on') || path.includes('/skin-tone') || path.includes('/mix-match') },
  { label: 'Cart', route: '/(tabs)/cart', icon: 'bag-handle-outline', active: (path) => path.includes('/cart'), cart: true },
  { label: 'Orders', route: '/(tabs)/orders', icon: 'receipt-outline', active: (path) => path.includes('/orders') || path.includes('/reviews') },
  { label: 'Profile', route: '/(tabs)/profile', icon: 'person-outline', active: (path) => path.includes('/profile') || path.includes('/settings') || path.includes('/privacy') || path.includes('/help') || path.includes('/language') || path.includes('/about') || path.includes('/change-password') },
];

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.user?.user_id);
  const token = useAuthStore((state) => state.token);
  const [cartCount, setCartCount] = useState(0);
  const refreshCartCount = useCallback(async () => {
    if (!userId) return setCartCount(0);
    try {
      const items = await apiGet<Array<{ quantity?: number }>>(`/cart/${userId}/items`, token);
      setCartCount(items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)), 0));
    } catch {
      // A badge should never prevent navigation when an optional refresh fails.
    }
  }, [token, userId]);

  useEffect(() => {
    void refreshCartCount();
    const interval = setInterval(() => void refreshCartCount(), 20000);
    return () => clearInterval(interval);
  }, [pathname, refreshCartCount]);

  return <View style={styles.shell} accessibilityRole="tablist">{tabs.map((tab) => {
    const selected = tab.active(pathname);
    return <PressableScale key={tab.label} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.label} style={[styles.tab, selected && styles.tabSelected]} pressedScale={0.92} onPress={() => router.navigate(tab.route as never)}><View style={styles.iconWrap}><Ionicons name={selected ? tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : tab.icon} size={22} color={selected ? Colors.brand.blue : Colors.text.placeholder} />{tab.cart && cartCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}</View><Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text></PressableScale>;
  })}</View>;
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', bottom: 12, left: Spacing.md, right: Spacing.md, minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: Spacing.xs, borderWidth: 1, borderColor: '#E3ECF7', borderRadius: 28, backgroundColor: Colors.white, elevation: 14, shadowColor: Colors.black, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.13, shadowRadius: 14, zIndex: 60 },
  tab: { minWidth: 54, alignItems: 'center', borderRadius: Radius.md, paddingHorizontal: 7, paddingVertical: 5 },
  tabSelected: { backgroundColor: '#EAF2FC' },
  iconWrap: { position: 'relative', height: 25, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 2, color: Colors.text.placeholder, fontSize: 10, fontWeight: '700' },
  labelSelected: { color: Colors.brand.blue },
  badge: { position: 'absolute', top: -6, right: -12, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.status.error, borderWidth: 1.5, borderColor: Colors.white },
  badgeText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
});
