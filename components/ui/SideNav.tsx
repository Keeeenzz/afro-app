import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const NAV_WIDTH = width * 0.75;

interface SideNavProps {
  visible: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Home', icon: 'home-outline' as const, route: '/(tabs)/' },
  { label: 'Skin Tone AI', icon: 'color-palette-outline' as const, route: '/(tabs)/skin-tone' },
  { label: 'Orders', icon: 'receipt-outline' as const, route: '/(tabs)/orders' },
  { label: 'Carts', icon: 'cart-outline' as const, route: '/(tabs)/cart' },
  { label: 'Messages', icon: 'chatbubble-outline' as const, route: '/(tabs)/messages' },
  { label: 'Reviews', icon: 'star-outline' as const, route: '/(tabs)/reviews' },
  { label: 'Settings', icon: 'settings-outline' as const, route: '/(tabs)/settings' },
  { label: 'Profile', icon: 'person-outline' as const, route: '/(tabs)/profile' },
];

export function SideNav({ visible, onClose }: SideNavProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const slideAnim = useRef(new Animated.Value(NAV_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: NAV_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 250);
  };

  const handleLogout = () => {
    onClose();
    logout();
    setTimeout(() => router.replace('/(auth)'), 250);
  };

  const idNumber = user?.id_number ?? user?.idNumber;
  const isVerified = !!idNumber?.trim();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* User info */}
        <TouchableOpacity
            style={styles.userSection}
            onPress={() => handleNavigate('/(tabs)/profile')}
            activeOpacity={0.7}
        >
          <View style={styles.avatarWrap}>
            {user?.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
                </Text>
              </View>
            )}
            <View style={styles.notifDot} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name ?? 'Guest'}
            </Text>
            <Text style={[styles.userStatus, isVerified && styles.userStatusVerified]}>
              {isVerified ? 'Account Verified' : 'Account Unverified'}
            </Text>
         </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Nav items */}
        <View style={styles.navItems}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={22} color={Colors.text.secondary} />
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Log out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={Colors.status.error} />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: NAV_WIDTH,
    backgroundColor: Colors.bg.secondary,
    paddingTop: 60,
    paddingBottom: Spacing['2xl'],
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.default,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.status.error,
    borderWidth: 2,
    borderColor: Colors.bg.secondary,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: FontSize.base,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  userStatus: {
    fontSize: FontSize.xs,
    color: Colors.status.error,
    marginTop: 2,
  },
  userStatusVerified: {
    color: Colors.status.success,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  navItems: { flex: 1, paddingHorizontal: Spacing.md },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
  },
  navLabel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.lg + Spacing.md,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  logoutLabel: {
    fontSize: FontSize.base,
    color: Colors.status.error,
    fontWeight: '500',
  },
});
