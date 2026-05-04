import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { InfoTab } from '@/components/profile/info';
import { OrdersTab } from '@/components/profile/orders-tab';
import { SavedTab } from '@/components/profile/saved';
import { StyleTab } from '@/components/profile/style';
import { apiGet } from '@/lib/api';

type Tab = 'Info' | 'Orders' | 'Saved' | 'Style';

export default function ProfileScreen() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('Info');
  const [summary, setSummary] = useState({ orders: 0, saved: 0, reviews: 0 });
  const tabs: Tab[] = ['Info', 'Orders', 'Saved', 'Style'];
  const idNumber = user?.id_number ?? user?.idNumber;
  const isVerified = !!idNumber?.trim();

  useEffect(() => {
    if (!user?.user_id) return;

    apiGet<{ orders: number; saved: number; reviews: number }>(
      `/profile/${user.user_id}/summary`,
      token,
    )
      .then(setSummary)
      .catch(() => setSummary({ orders: 0, saved: 0, reviews: 0 }));
  }, [activeTab, token, user?.user_id]);

return (
    <SafeAreaView style={styles.safe}>
{/* Profile header - fixed */}
<View style={styles.profileHeader}>
  <View style={styles.headerCard}>
    {/* Avatar */}
    <View style={styles.avatar}>
      <Text style={styles.avatarInitial}>
        {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
      </Text>
    </View>

    {/* Right side */}
    <View style={styles.headerRight}>
      <View style={styles.nameRow}>
        <Text style={styles.profileName} numberOfLines={1}>
          {user?.full_name ?? 'Guest'}
        </Text>
        {!isVerified && user ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.push('/(auth)/upload-id')}
          >
            <Text style={styles.verifyLink}>Verify Email</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{isVerified ? 'Verified' : 'Unverified'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.orders}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.saved}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{summary.reviews}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>
    </View>
  </View>
</View>

      {/* Tab pills - fixed */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content - scrollable */}
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'Info' && <InfoTab />}
        {activeTab === 'Orders' && <OrdersTab />}
        {activeTab === 'Saved' && <SavedTab />}
        {activeTab === 'Style' && <StyleTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },

  // Header
  profileHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg.primary,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border.active,
  },
  avatarInitial: { fontSize: FontSize['2xl'], fontWeight: '800', color: Colors.white },
  headerRight: { flex: 1, gap: Spacing.sm },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.brand.blue,
  },
  badgeText: { fontSize: FontSize.xs, color: Colors.brand.blue, fontWeight: '600' },
  verifyLink: {
    color: Colors.brand.blueLight,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  statsRow: { flexDirection: 'row', gap: Spacing.lg },
  stat: { alignItems: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 1 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    gap: 8,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
  },
  tabPillActive: { backgroundColor: Colors.brand.blue },
  tabPillText: { fontSize: FontSize.sm, color: Colors.text.muted, fontWeight: '600' },
  tabPillTextActive: { color: Colors.white },

  // Content
  tabContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
});
