import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  analyzeSkinTone,
  skinToneCatalogColorNames,
  type SkinToneAnalysis,
} from '@/lib/skinTone';

export default function SkinToneScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Ready');
  const [result, setResult] = useState<SkinToneAnalysis | null>(null);
  const [error, setError] = useState('');
  const [previewUri, setPreviewUri] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function prepareImageForApi(uri: string) {
    const image = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        base64: true,
        compress: 0.88,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    if (!image.base64) {
      throw new Error('Could not convert image to JPEG Base64.');
    }

    setPreviewUri(image.uri);
    return image.base64;
  }

  async function sendToApi(base64Image: string) {
    setStatus('Sending image to AI...');
    setError('');
    setResult(null);
    setIsLoading(true);

    try {
      const data = await analyzeSkinTone(base64Image);
      setResult(data);
      setStatus('Analysis complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed.';
      setError(message);
      setStatus('Failed');
      Alert.alert('Skin Tone AI Error', message);
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadImage() {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        base64: false,
        quality: 1,
      });

      if (pickerResult.canceled) return;

      const base64Image = await prepareImageForApi(pickerResult.assets[0].uri);
      await sendToApi(base64Image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setStatus('Upload failed');
    }
  }

  async function useCamera() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setError('Camera permission denied.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        base64: false,
        quality: 1,
      });

      if (cameraResult.canceled) return;

      const base64Image = await prepareImageForApi(cameraResult.assets[0].uri);
      await sendToApi(base64Image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera failed.');
      setStatus('Camera failed');
    }
  }

  const skinTone = result?.skin_tone;
  const bestColors = result?.recommended_colors?.best ?? [];
  const neutralColors = result?.recommended_colors?.neutral ?? [];
  const catalogColorNames = skinToneCatalogColorNames(result);

  const viewCatalogMatches = () => {
    router.push({
      pathname: '/(tabs)/catalog',
      params: {
        toneColors: catalogColorNames.join('|'),
        toneLabel: skinTone?.label ?? 'Skin Tone AI',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Skin Tone AI</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>A'FRO Color Match</Text>
          <Text style={styles.title}>Find catalog colors that match your tone</Text>
          <Text style={styles.subtitle}>
            Upload or take a clear face photo. The result can filter the real catalog by matching product colors.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={uploadImage}
            disabled={isLoading}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={Colors.white} />
            <Text style={styles.primaryButtonText}>Upload Image</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={useCamera}
            disabled={isLoading}
          >
            <Ionicons name="camera-outline" size={18} color={Colors.text.primary} />
            <Text style={styles.secondaryButtonText}>Use Camera</Text>
          </Pressable>
        </View>

        <View style={styles.previewPanel}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons name="image-outline" size={34} color={Colors.text.secondary} />
              <Text style={styles.previewEmptyTitle}>Image preview</Text>
              <Text style={styles.previewEmptyText}>Your selected photo will appear here.</Text>
            </View>
          )}
        </View>

        <View style={styles.statusPanel}>
          <View>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.status}>{status}</Text>
          </View>
          {isLoading ? <ActivityIndicator color={Colors.brand.blueLight} /> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skin tone result</Text>
          {skinTone ? (
            <View style={styles.resultGrid}>
              <ResultItem label="Label" value={skinTone.label} />
              <ResultItem label="Depth" value={skinTone.depth} />
              <ResultItem label="Undertone" value={skinTone.undertone} />
              <ResultItem label="Hex" value={skinTone.hex} swatch={skinTone.hex} />
            </View>
          ) : (
            <Text style={styles.mutedText}>Results will appear after analysis.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended palette</Text>
          {bestColors.length || neutralColors.length ? (
            <>
              <View style={styles.swatchRow}>
                {bestColors.map((color) => (
                  <View style={styles.swatchItem} key={`best-${color.color_name}`}>
                    <View style={[styles.swatch, { backgroundColor: color.color_hex || '#E5E7EB' }]} />
                    <Text style={styles.swatchName}>{color.color_name}</Text>
                    <Text style={styles.swatchHex}>{color.color_hex}</Text>
                  </View>
                ))}
              </View>

              {neutralColors.length ? (
                <>
                  <Text style={styles.subheading}>Neutral options</Text>
                  <View style={styles.chipRow}>
                    {neutralColors.map((color) => (
                      <View style={styles.chip} key={`neutral-${color.color_name}`}>
                        <Text style={styles.chipText}>{color.color_name}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.mutedText}>Compatible colors will appear here.</Text>
          )}
        </View>

        {catalogColorNames.length ? (
          <TouchableOpacity style={styles.catalogButton} onPress={viewCatalogMatches} activeOpacity={0.82}>
            <View>
              <Text style={styles.catalogButtonText}>View matching catalog</Text>
              <Text style={styles.catalogButtonMeta}>{catalogColorNames.length} color filters ready</Text>
            </View>
            <Ionicons name="arrow-forward" size={21} color={Colors.white} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultItem({
  label,
  value,
  swatch,
}: {
  label: string;
  value?: string | null;
  swatch?: string | null;
}) {
  return (
    <View style={styles.resultItem}>
      <Text style={styles.resultLabel}>{label}</Text>
      <View style={styles.resultValueRow}>
        {swatch ? <View style={[styles.resultSwatch, { backgroundColor: swatch }]} /> : null}
        <Text style={styles.resultValue}>{value ?? '-'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  intro: {
    marginBottom: Spacing.md,
  },
  eyebrow: {
    color: Colors.brand.blueLight,
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.base,
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  previewPanel: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    borderWidth: 1,
    height: 280,
    justifyContent: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    resizeMode: 'cover',
    width: '100%',
  },
  previewEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  previewEmptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  previewEmptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  statusLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  status: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  error: {
    backgroundColor: '#3A1620',
    borderColor: Colors.status.error,
    borderRadius: Radius.md,
    borderWidth: 1,
    color: '#FFD1D8',
    fontWeight: '800',
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  section: {
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
    marginBottom: Spacing.md,
  },
  mutedText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  resultItem: {
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: '47%',
    padding: Spacing.sm,
  },
  resultLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  resultValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  resultSwatch: {
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 7,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  resultValue: {
    color: Colors.text.primary,
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatchItem: {
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    width: '47%',
  },
  swatch: {
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    height: 46,
    marginBottom: Spacing.sm,
  },
  swatchName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  swatchHex: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  subheading: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  catalogButton: {
    alignItems: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: Spacing.md,
  },
  catalogButtonText: {
    color: Colors.white,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  catalogButtonMeta: {
    color: '#C8EDFF',
    fontSize: FontSize.xs,
    fontWeight: '800',
    marginTop: 2,
  },
});
