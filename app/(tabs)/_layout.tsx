import { Tabs, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SideNav } from '@/components/ui/SideNav';
import { TryOnDock } from '@/components/ui/TryOnDock';
import { BottomTabBar } from '@/components/ui/BottomTabBar';
import { NavProvider, useNav } from '@/context/NavContext';

// `index` re-exports the catalog screen, so these two URLs are aliases for
// the single Home destination. Exact matching is intentional: every current
// and future child route is excluded without each screen having to control
// the tab bar itself.
const MAIN_TAB_PATHS = new Set([
  '/',
  '/catalog',
  '/try-on',
  '/cart',
  '/orders',
  '/profile',
  '/settings',
  '/about',
  '/privacy',
  '/change-password',
  '/language',
  '/help',
]);

function TabsContent() {
  const { isNavOpen, openNav, closeNav } = useNav();
  const pathname = usePathname();
  // Keep the custom bar scoped to the five top-level destinations. Every
  // detail, conversation, settings, or other nested route in this navigator
  // automatically falls outside this whitelist.
  const showBottomTabs = MAIN_TAB_PATHS.has(pathname);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarActiveTintColor: '#0E4F8D',
          tabBarInactiveTintColor: '#8CA2BA',
        }}
      >
        <Tabs.Screen name="index" options={{ title: "A'FRO", tabBarButton: () => null }} />
        <Tabs.Screen name="catalog" options={{ title: 'Catalog', tabBarButton: () => null }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarButton: () => null }} />
        <Tabs.Screen name="profile/index" options={{ title: 'Profile', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="cart" options={{ title: 'Cart', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="reviews" options={{ title: 'Reviews', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="about" options={{ title: "About A'FRO", tabBarButton: () => null }} />
        <Tabs.Screen name="privacy" options={{ headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="change-password" options={{ headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="language" options={{ headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="help" options={{ headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="product/[id]" options={{ title: 'Product', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="skin-tone" options={{ title: 'Skin Tone AI', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="mix-match" options={{ title: 'Mix & Match', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="try-on" options={{ title: 'Try On', tabBarButton: () => null }} />
      </Tabs>
      <TryOnDock />
      <SideNav visible={isNavOpen} onClose={closeNav} />
      {showBottomTabs ? <BottomTabBar /> : null}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <NavProvider>
      <TabsContent />
    </NavProvider>
  );
}
