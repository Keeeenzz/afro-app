import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  Image,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useTranslation } from '@/lib/i18n';
import { imageUrl } from '@/lib/api';

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

function LegacySideNav({ visible, onClose }: SideNavProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(360, Math.max(280, screenWidth * 0.8));
  const slideAnim = useRef(new Animated.Value(drawerWidth)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [avatarLoading, setAvatarLoading] = useState(Boolean(user?.profile_photo_url));
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUri = imageUrl(user?.profile_photo_url);

  useEffect(() => {
    setAvatarLoading(Boolean(avatarUri));
    setAvatarFailed(false);
  }, [avatarUri]);

  useEffect(() => {
    if (visible) {
      // Reset before presenting so reopening the native modal never leaves an
      // invisible touch layer over the drawer.
      slideAnim.setValue(drawerWidth);
      fadeAnim.setValue(0);
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
          toValue: drawerWidth,
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
  }, [drawerWidth, fadeAnim, slideAnim, visible]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 250);
  };

  const handleLogout = () => {
    onClose();
    logout();
    setTimeout(() => router.replace('/(auth)'), 250);
  };

  // Account creation is gated by verified email and SMS. An optional government
  // ID is not the source of account-verification status (the Profile screen
  // uses the same rule).
  const isVerified = Boolean(user?.user_id);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.md,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* User info */}
        <TouchableOpacity
            style={styles.userSection}
            onPress={() => handleNavigate('/(tabs)/profile')}
            activeOpacity={0.7}
        >
          <View style={styles.avatarWrap}>
            {avatarUri && !avatarFailed ? (
              <>
                {avatarLoading ? <View style={styles.avatarLoading} /> : null}
                <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" onLoadEnd={() => setAvatarLoading(false)} onError={() => { setAvatarFailed(true); setAvatarLoading(false); }} />
              </>
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
              {t(isVerified ? 'Account Verified' : 'Account Unverified')}
            </Text>
         </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* The middle section scrolls on compact displays while Logout stays
            in the drawer's safe-area footer and remains tappable. */}
        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navItems}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={22} color={Colors.text.secondary} />
              <Text style={styles.navLabel}>{t(item.label)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Log out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={Colors.status.error} />
          <Text style={styles.logoutLabel}>{t('Log Out')}</Text>
        </TouchableOpacity>
      </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.bg.secondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.default,
    zIndex: 1,
    elevation: 24,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: 12,
  },
  avatarWrap: { position: 'relative', width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: Colors.bg.card },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarLoading: { ...StyleSheet.absoluteFill, backgroundColor: Colors.border.default },
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
  navScroll: { flex: 1 },
  navItems: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
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
    minHeight: 52,
  },
  logoutLabel: {
    fontSize: FontSize.base,
    color: Colors.status.error,
    fontWeight: '500',
  },
});

export { SideNavRedesign as SideNav } from './SideNavRedesign';
