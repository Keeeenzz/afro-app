import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTryOnJobStore } from '@/hooks/useTryOnJobStore';
import { resolvedProductImageUri } from '@/lib/tryOn';

export function TryOnDock() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, progress, displayResultUri, selectedProducts } = useTryOnJobStore();

  // The dock is only a progress shortcut. Once a result is ready, it must not
  // sit above product controls or keep a completed job visible.
  if (status !== 'generating' || pathname.includes('/try-on')) {
    return null;
  }

  const previewUri = displayResultUri || resolvedProductImageUri(selectedProducts[0]?.imageUrl as string | null | undefined);
  const title = 'Fitting your look';
  const subtitle = `${progress}% complete`;

  return (
    <TouchableOpacity
      style={styles.dock}
      activeOpacity={0.86}
      onPress={() => router.push('/(tabs)/try-on')}
    >
      <View style={styles.preview}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <Ionicons name="shirt-outline" size={22} color={Colors.text.primary} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(3, progress))}%` }]} />
        </View>
      </View>
      <View style={styles.iconBadge}>
        <Ionicons name="sparkles-outline" size={16} color={Colors.white} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.full,
    borderWidth: 1,
    bottom: 22,
    elevation: 10,
    flexDirection: 'row',
    gap: Spacing.sm,
    left: Spacing.md,
    minHeight: 62,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    position: 'absolute',
    right: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    zIndex: 50,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.full,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: 2,
  },
  track: {
    backgroundColor: '#D9E6F5',
    borderRadius: Radius.full,
    height: 5,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    height: '100%',
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
