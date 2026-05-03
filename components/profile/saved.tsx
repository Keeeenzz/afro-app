import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius } from '@/constants/theme';

const MOCK_SAVED = [
  { id: '1', name: 'Blue Jorts', price: 280 },
  { id: '2', name: 'Red Hoodie', price: 500 },
  { id: '3', name: 'Vintage Tee', price: 180 },
  { id: '4', name: 'Cargo Shorts', price: 350 },
];

export function SavedTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.savedGrid}>
        {MOCK_SAVED.map((item) => (
          <View key={item.id} style={styles.savedCard}>
            <View style={styles.savedImage}>
              <Ionicons name="shirt-outline" size={32} color={Colors.text.muted} />
            </View>
            <TouchableOpacity style={styles.savedHeart}>
              <Ionicons name="heart" size={16} color={Colors.brand.blue} />
            </TouchableOpacity>
            <Text style={styles.savedName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.savedPrice}>₱ {item.price}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  savedCard: {
    width: '47%',
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  savedImage: {
    height: 130,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    padding: 4,
  },
  savedName: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  savedPrice: {
    fontSize: FontSize.sm,
    color: Colors.brand.blue,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginTop: 2,
  },
});