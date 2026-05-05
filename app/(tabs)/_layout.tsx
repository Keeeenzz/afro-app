import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { SideNav } from '@/components/ui/SideNav';
import { HamburgerButton } from '@/components/ui/HamburgerButton';
import { NavProvider, useNav } from '@/context/NavContext';

function TabsContent() {
  const { isNavOpen, openNav, closeNav } = useNav();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HamburgerButton onPress={openNav} />,
          tabBarStyle: { display: 'none' },
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#475569',
        }}
      >
        <Tabs.Screen name="index" options={{ title: "A'FRO", headerShown: false, tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="catalog" options={{ title: 'Catalog', headerShown: false, tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="profile/index" options={{ title: 'Profile', headerTitle: 'Profile', tabBarButton: () => null }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarButton: () => null }} />
        <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarButton: () => null }} />
        <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarButton: () => null }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarButton: () => null }} />
        <Tabs.Screen name="product/[id]" options={{ title: 'Product', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="skin-tone" options={{ title: 'Skin Tone AI', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="mix-match" options={{ title: 'Mix & Match', headerShown: false, tabBarButton: () => null }} />
        <Tabs.Screen name="try-on" options={{ title: 'Try On', headerShown: false, tabBarButton: () => null }} />
      </Tabs>
      <SideNav visible={isNavOpen} onClose={closeNav} />
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
