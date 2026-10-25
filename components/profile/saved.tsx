import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiGet, apiPost, imageUrl } from '@/lib/api';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Colors, FontSize, Radius } from '@/constants/theme';
import { useToast } from '@/components/ui/Toast';

type SavedProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
  size?: string | null;
};

export function SavedTab() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { showToast } = useToast();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = async () => {
    if (!user?.user_id) {
      setItems([]);
      return;
    }

    const saved = await apiGet<SavedProduct[]>(`/saved/${user.user_id}`, token);
    setItems(saved);
  };

  useEffect(() => {
    loadSaved()
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, user?.user_id]);

  const toggleSaved = async (productId: string) => {
    if (!user?.user_id) return;

    const previous = items;
    setItems((current) => current.filter((item) => item.id !== productId));
    try {
      await apiPost('/saved/toggle', { userId: user.user_id, productId }, token);
      showToast('Removed from saved', 'success');
    } catch {
      setItems(previous);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="heart-outline" size={34} color={Colors.text.muted} />
        <Text style={styles.emptyTitle}>Nothing saved yet</Text>
        <Text style={styles.emptyText}>Tap the heart on a product to keep it here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.savedGrid}>
      {items.map((item) => {
        const uri = imageUrl(item.imageUrl);
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.savedCard}
            activeOpacity={0.82}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/product/[id]',
                params: { id: item.id, from: 'saved' },
              })
            }
          >
            <View style={styles.savedImage}>
              {uri ? (
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
              ) : (
                <Ionicons name="shirt-outline" size={32} color={Colors.text.muted} />
              )}
            </View>
            <TouchableOpacity
              style={styles.savedHeart}
              onPress={() => toggleSaved(item.id)}
              activeOpacity={0.75}
            >
              <Ionicons name="heart" size={16} color={Colors.brand.blue} />
            </TouchableOpacity>
            <Text style={styles.savedName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.savedMeta} numberOfLines={1}>
              {[item.category, item.size].filter(Boolean).join(' / ')}
            </Text>
            <Text style={styles.savedPrice}>
              ₱ {Number(item.price ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            </Text>
            <TouchableOpacity style={styles.tryOnButton} onPress={() => router.push({ pathname: '/(tabs)/try-on', params: { productId: item.id } })}><Ionicons name="sparkles-outline" size={15} color={Colors.white} /><Text style={styles.tryOnText}>Try on</Text></TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  savedCard: {
    width: '47%',
    backgroundColor: Colors.bg.card,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  savedImage: {
    height: 142,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  savedHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E8F4FF',
    borderRadius: 22,
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedName: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  savedMeta: {
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  savedPrice: {
    fontSize: FontSize.sm,
    color: Colors.brand.blue,
    fontWeight: '800',
    paddingHorizontal: 10,
    marginTop: 2,
  },
  tryOnButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Colors.brand.blue, borderRadius: Radius.full, flexDirection: 'row', gap: 4, height: 36, justifyContent: 'center', margin: 10, marginTop: 8, paddingHorizontal: 12 },
  tryOnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '900' },
});
