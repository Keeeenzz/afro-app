import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTryOnJobStore } from '@/hooks/useTryOnJobStore';
import { resolvedProductImageUri } from '@/lib/tryOn';

export function TryOnDock() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, progress, displayResultUri, selectedProducts, error } = useTryOnJobStore();

  if (status === 'idle' || pathname.includes('/try-on')) {
    return null;
  }

  const previewUri = displayResultUri || resolvedProductImageUri(selectedProducts[0]?.imageUrl as string | null | undefined);
  const title = status === 'result' ? 'Try-on ready' : status === 'error' ? 'Try-on failed' : 'Generating';
  const subtitle = status === 'error'
    ? error || 'Tap to check'
    : status === 'result'
      ? 'Tap to view result'
      : `${progress}% complete`;

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
        {status === 'generating' ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, Math.max(3, progress))}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.iconBadge, status === 'result' && styles.iconBadgeReady, status === 'error' && styles.iconBadgeError]}>
        <Ionicons
          name={status === 'result' ? 'checkmark' : status === 'error' ? 'alert' : 'sparkles-outline'}
          size={16}
          color={Colors.white}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    borderColor: 'rgba(154, 233, 245, 0.35)',
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
    shadowOpacity: 0.35,
    shadowRadius: 18,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.full,
    height: 5,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#22D3EE',
    borderRadius: Radius.full,
    height: '100%',
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.full,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconBadgeReady: {
    backgroundColor: Colors.status.success,
  },
  iconBadgeError: {
    backgroundColor: Colors.status.error,
  },
});
