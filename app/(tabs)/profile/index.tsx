import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { InfoTab } from '@/components/profile/info';
import { OrdersTab } from '@/components/profile/orders-tab';
import { SavedTab } from '@/components/profile/saved';
import { StyleTab } from '@/components/profile/style';
import { ReviewsTab } from '@/components/profile/reviews-tab';
import { apiDelete, apiGet, apiPostForm, imageUrl } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useNav } from '@/context/NavContext';
import { useTranslation } from '@/lib/i18n';

type Tab = 'Info' | 'Orders' | 'Saved' | 'Reviews' | 'Style';

export default function ProfileScreen() {
  const { user, token, setUser } = useAuthStore();
  const router = useRouter();
  const { openNav } = useNav();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ tab?: string; fromSettings?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Info');
  const [summary, setSummary] = useState({ orders: 0, saved: 0, reviews: 0 });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const tabs: Tab[] = ['Info', 'Orders', 'Saved', 'Reviews', 'Style'];
  // Registration is gated by verified email and SMS. Government-ID upload is
  // no longer an account-verification requirement.
  const isVerified = Boolean(user?.user_id);
  const { t } = useTranslation();

  useEffect(() => {
    if (!user?.user_id) return;

    apiGet<{ orders: number; saved: number; reviews: number }>(
      `/profile/${user.user_id}/summary`,
      token,
    )
      .then(setSummary)
      .catch(() => setSummary({ orders: 0, saved: 0, reviews: 0 }));
  }, [activeTab, token, user?.user_id]);

  useEffect(() => {
    const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const matchingTab = tabs.find((tab) => tab.toLowerCase() === tabParam?.toLowerCase());
    if (matchingTab) setActiveTab(matchingTab);
  }, [params.tab]);

  const location = [user?.address_city, user?.address_province].filter(Boolean).join(', ') || 'No location saved';
  const profilePhoto = imageUrl(user?.profile_photo_url);
  const coverPhoto = coverPreview ?? imageUrl(user?.cover_photo_url);

  const chooseProfilePhoto = async () => {
    if (!user?.user_id || uploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Allow photo-library access to choose a profile photo.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (result.canceled) return;

    const photo = result.assets[0];
    const form = new FormData();
    form.append('photo', { uri: photo.uri, name: photo.fileName || `profile-${Date.now()}.jpg`, type: photo.mimeType || 'image/jpeg' } as unknown as Blob);
    setUploadingPhoto(true);
    try {
      const response = await apiPostForm<{ user: typeof user }>(`/auth/app/profile/${user.user_id}/photo`, form, token);
      if (response.user) setUser(response.user, token ?? '');
      showToast('Profile photo updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const chooseCoverPhoto = async () => {
    if (!user?.user_id || uploadingCover) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Allow photo-library access to choose a cover image.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.85 });
    if (result.canceled) return;
    const photo = result.assets[0];
    const form = new FormData();
    form.append('photo', { uri: photo.uri, name: photo.fileName || `cover-${Date.now()}.jpg`, type: photo.mimeType || 'image/jpeg' } as unknown as Blob);
    setCoverPreview(photo.uri);
    setUploadingCover(true);
    try {
      const response = await apiPostForm<{ user: typeof user }>(`/auth/app/profile/${user.user_id}/cover`, form, token);
      if (response.user) setUser(response.user, token ?? '');
      showToast('Cover image updated', 'success');
    } catch (error) {
      setCoverPreview(null);
      showToast(error instanceof Error ? error.message : 'Could not upload cover image.', 'error');
    } finally { setUploadingCover(false); }
  };

  const removeCoverPhoto = async () => {
    if (!user?.user_id || uploadingCover) return;
    setUploadingCover(true);
    try {
      const response = await apiDelete<{ user: typeof user }>(`/auth/app/profile/${user.user_id}/cover`, undefined, token);
      setCoverPreview(null);
      if (response.user) setUser(response.user, token ?? '');
      showToast('Cover image removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not remove cover image.', 'error');
    } finally { setUploadingCover(false); }
  };

return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        {coverPhoto ? <Image source={{ uri: coverPhoto }} style={styles.coverImage} resizeMode="cover" /> : null}
        <View style={styles.coverOverlay} />
        <Text style={styles.watermark}>A'FRO</Text>
        <View style={styles.heroTop}><TouchableOpacity style={styles.heroButton} onPress={() => params.fromSettings ? router.replace('/(tabs)/settings') : router.back()}><Ionicons name="arrow-back" size={23} color={Colors.white} /></TouchableOpacity><Text style={styles.pageTitle}>{t('Profile')}</Text><TouchableOpacity style={styles.heroButton} onPress={() => router.push('/(tabs)/settings')}><Ionicons name="options-outline" size={22} color={Colors.white} /></TouchableOpacity></View>
        <View style={styles.coverActions}><TouchableOpacity disabled={uploadingCover} style={styles.coverAction} accessibilityRole="button" accessibilityLabel="Change cover image" onPress={() => void chooseCoverPhoto()}><Ionicons name={uploadingCover ? 'hourglass-outline' : 'camera-outline'} size={15} color={Colors.white} /><Text style={styles.coverActionText}>Change cover</Text></TouchableOpacity>{user?.cover_photo_url ? <TouchableOpacity disabled={uploadingCover} style={styles.coverAction} accessibilityRole="button" accessibilityLabel="Remove cover image" onPress={() => void removeCoverPhoto()}><Ionicons name="trash-outline" size={15} color={Colors.white} /></TouchableOpacity> : null}</View>
      </View>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>{profilePhoto ? <Image source={{ uri: profilePhoto }} style={styles.avatarImage} /> : <Text style={styles.avatarInitial}>{user?.full_name?.[0]?.toUpperCase() ?? 'U'}</Text>}<TouchableOpacity disabled={uploadingPhoto} accessibilityRole="button" accessibilityLabel="Change profile photo" style={styles.cameraBadge} onPress={() => void chooseProfilePhoto()}>{uploadingPhoto ? <Ionicons name="hourglass-outline" size={15} color={Colors.brand.blue} /> : <Ionicons name="camera-outline" size={15} color={Colors.brand.blue} />}</TouchableOpacity></View>
        <Text style={styles.profileName} numberOfLines={1}>{user?.full_name ?? 'Guest'}</Text>
        <View style={styles.chipRow}>{isVerified ? <View style={styles.badge}><Ionicons name="checkmark-circle" size={15} color={Colors.brand.blue} /><Text style={styles.badgeText}>Verified</Text></View> : null}<View style={styles.locationChip}><Ionicons name="location-outline" size={14} color={Colors.text.secondary} /><Text style={styles.locationText} numberOfLines={1}>{location}</Text></View></View>
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={() => setActiveTab('Orders')}><Text style={styles.statNum}>{summary.orders}</Text><Text style={styles.statLabel}>Orders</Text></TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={() => setActiveTab('Saved')}><Text style={styles.statNum}>{summary.saved}</Text><Text style={styles.statLabel}>Saved</Text></TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={() => setActiveTab('Reviews')}><Text style={styles.statNum}>{summary.reviews}</Text><Text style={styles.statLabel}>Reviews</Text></TouchableOpacity>
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
              {t(tab)}
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
        {activeTab === 'Orders' && <OrdersTab onOpenReviews={() => setActiveTab('Reviews')} onReviewPosted={() => setActiveTab('Reviews')} />}
        {activeTab === 'Saved' && <SavedTab />}
        {activeTab === 'Reviews' && <ReviewsTab onChanged={() => setSummary((current) => ({ ...current, reviews: Math.max(0, current.reviews - 1) }))} />}
        {activeTab === 'Style' && <StyleTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg.primary },

  hero: { backgroundColor: Colors.brand.blue, height: 178, overflow: 'hidden', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  coverImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(14, 76, 143, 0.44)' },
  watermark: { color: 'rgba(255,255,255,0.08)', fontSize: 76, fontWeight: '900', position: 'absolute', right: -8, top: 48 },
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  coverActions: { position: 'absolute', right: Spacing.md, bottom: Spacing.sm, flexDirection: 'row', gap: Spacing.xs },
  coverAction: { alignItems: 'center', backgroundColor: 'rgba(14, 76, 143, 0.78)', borderRadius: Radius.full, flexDirection: 'row', gap: 5, minHeight: 34, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  coverActionText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '800' },
  headerCard: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 28,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: -48,
    shadowColor: Colors.black,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    marginTop: -70,
    position: 'relative',
  },
  avatarInitial: { fontSize: 42, fontWeight: '900', color: Colors.white },
  avatarImage: { width: '100%', height: '100%', borderRadius: 52 },
  cameraBadge: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 18, bottom: -2, height: 36, justifyContent: 'center', position: 'absolute', right: -2, shadowColor: Colors.black, shadowOpacity: 0.14, shadowRadius: 6, width: 36 },
  profileName: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: Spacing.sm,
  },
  chipRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  badge: {
    alignItems: 'center', flexDirection: 'row', gap: 4,
    backgroundColor: '#E9F2FC',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0,
  },
  badgeText: { fontSize: FontSize.xs, color: Colors.text.primary, fontWeight: '800' },
  locationChip: { alignItems: 'center', backgroundColor: '#F0F4FA', borderRadius: Radius.full, flexDirection: 'row', gap: 4, maxWidth: '64%', paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  locationText: { color: Colors.text.secondary, fontSize: FontSize.xs, fontWeight: '700' },
  pageTitle: { color: Colors.white, fontSize: FontSize.md, fontWeight: '900', textAlign: 'center' },
  statsRow: { backgroundColor: '#F1F5FB', borderRadius: 20, flexDirection: 'row', marginTop: Spacing.md, paddingVertical: Spacing.sm, width: '100%' },
  stat: { alignItems: 'center', flex: 1, minHeight: 52, justifyContent: 'center' },
  statNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.muted, marginTop: 1 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: 4,
    backgroundColor: Colors.bg.primary,
    borderRadius: Radius.full,
    gap: 2,
    shadowColor: Colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  tabPill: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
  },
  tabPillActive: { backgroundColor: Colors.brand.blue, shadowColor: Colors.black, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  tabPillText: { fontSize: 12.5, color: Colors.text.muted, fontWeight: '700' },
  tabPillTextActive: { color: Colors.white },

  // Content
  tabContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
        paddingBottom: 104,
  },
});
