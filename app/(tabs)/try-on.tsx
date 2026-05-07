import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiGet } from '@/lib/api';
import {
  cacheRemoteImage,
  materializeTryOnImage,
  reportText,
  resolvedProductImageUri,
  saveDataImageToGallery,
  submitTryOn,
  tryOnCategory,
  type TryOnResult,
} from '@/lib/tryOn';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useNav } from '@/context/NavContext';

type TryOnPhase = 'upload' | 'generating' | 'result';
type PhotoGuideMode = 'full' | 'top';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  qty?: number;
  brand?: string | null;
  color?: string | null;
  colorName?: string | null;
  category?: string | null;
  categorySlug?: string | null;
  gender?: string | null;
  imageUrl?: string | null;
  size?: string | null;
  sizeId?: number | string | null;
  sizeReference?: SizeReference | null;
  measurements?: Measurement[];
};

type SizeReference = {
  label?: string | null;
  chestCmMin?: number | null;
  chestCmMax?: number | null;
  waistCmMin?: number | null;
  waistCmMax?: number | null;
  hipCmMin?: number | null;
  hipCmMax?: number | null;
  heightCmMin?: number | null;
  heightCmMax?: number | null;
};

type Measurement = {
  sizeId?: number | string | null;
  sizeLabel?: string | null;
  garmentType?: string | null;
  measurementName: string;
  valueCm: number;
};

type BodyMetric = 'chest' | 'waist' | 'hip' | 'inseam';

type BodyProfile = {
  body_chest_cm?: number | null;
  body_waist_cm?: number | null;
  body_hip_cm?: number | null;
  body_height_cm?: number | null;
};

type FitComparison = {
  label: string;
  userCm: number;
  garmentCm: number;
  easeCm: number;
  status: string;
  message: string;
  penalty: number;
};

type ReferenceComparison = {
  label: string;
  userCm: number;
  minCm: number;
  maxCm: number;
  status: string;
  message: string;
  penalty: number;
};

function reportLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLabelValue(line: string) {
  const [label, ...rest] = line.split(':');
  return {
    label: label?.trim() ?? '',
    value: rest.join(':').trim(),
  };
}

function peso(value: number) {
  return `PHP ${Number(value ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function productText(product: Product) {
  return [
    product.name,
    product.description,
    product.brand,
    product.color,
    product.colorName,
    product.category,
    product.gender,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function styleTokens(style?: string | null) {
  return (style ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function normalizeMeasurementName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function measurementMetric(name: string): BodyMetric | null {
  const normalized = normalizeMeasurementName(name);

  if (normalized.includes('chest') || normalized.includes('bust')) return 'chest';
  if (normalized.includes('waist')) return 'waist';
  if (normalized.includes('hip') || normalized.includes('seat')) return 'hip';
  if (normalized.includes('inseam')) return 'inseam';

  return null;
}

function garmentMetricScope(product: Product) {
  const text = `${product.categorySlug ?? ''} ${product.category ?? ''} ${product.measurements?.[0]?.garmentType ?? ''}`.toLowerCase();

  if (text.includes('bottom') || text.includes('pant') || text.includes('short') || text.includes('skirt')) {
    return new Set<BodyMetric>(['waist', 'hip']);
  }

  return new Set<BodyMetric>(['chest', 'waist', 'hip']);
}

function garmentMetricLabel(product: Product) {
  const metrics = [...garmentMetricScope(product)];
  if (metrics.includes('chest')) return 'chest, waist, and hip/seat';
  return 'waist and hip/seat';
}

function issueLabel(items: { label: string; penalty: number }[]) {
  const issueLabels = items
    .filter((item) => item.penalty > 0)
    .map((item) => item.label.toLowerCase());

  if (!issueLabels.length) return '';
  if (issueLabels.length === 1) return issueLabels[0];
  if (issueLabels.length === 2) return `${issueLabels[0]} and ${issueLabels[1]}`;
  return `${issueLabels.slice(0, -1).join(', ')}, and ${issueLabels[issueLabels.length - 1]}`;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function userMetricCm(metric: BodyMetric, bodyProfile: BodyProfile | null) {
  if (!bodyProfile) return null;

  if (metric === 'chest') return bodyProfile.body_chest_cm ?? null;
  if (metric === 'waist') return bodyProfile.body_waist_cm ?? null;
  if (metric === 'hip') return bodyProfile.body_hip_cm ?? null;

  if (metric === 'inseam') {
    const height = bodyProfile.body_height_cm;
    return height ? Number((height * 0.46).toFixed(1)) : null;
  }

  return null;
}

function fitStatus(metric: BodyMetric, easeCm: number) {
  const comfortableMin = metric === 'inseam' ? -3 : 2;
  const looseMax = metric === 'inseam' ? 5 : 18;
  const veryLooseMax = metric === 'inseam' ? 9 : 30;

  if (easeCm < comfortableMin) {
    return {
      status: 'Too tight',
      penalty: metric === 'inseam' ? 22 : 28,
      message:
        metric === 'inseam'
          ? 'Inseam may look short based on your estimated leg length.'
          : 'Garment measurement is below the comfortable allowance for your body measurement.',
    };
  }

  if (easeCm > veryLooseMax) {
    return {
      status: 'Likely too loose',
      penalty: 26,
      message: 'This has much more room than your body measurement and may drape loosely.',
    };
  }

  if (easeCm > looseMax) {
    return {
      status: 'Loose',
      penalty: 14,
      message: 'This has extra ease and may fit relaxed.',
    };
  }

  return {
    status: 'Good fit',
    penalty: 0,
    message: 'Measurement allowance is within a comfortable range.',
  };
}

function preferredMeasurements(product: Product) {
  const measurements = product.measurements ?? [];

  if (!measurements.length) return [];

  const sizeLabel = product.size?.split(',')[0]?.trim();

  if (!sizeLabel) {
    return measurements;
  }

  const sameSize = measurements.filter(
    (measurement) => measurement.sizeLabel?.toLowerCase() === sizeLabel.toLowerCase(),
  );

  return sameSize.length ? sameSize : measurements;
}

function measurementSummary(measurements: Measurement[]) {
  return measurements
    .map((measurement) => `${measurement.measurementName} ${Number(measurement.valueCm).toFixed(0)} cm`)
    .join(' | ');
}

function referenceRanges(product: Product) {
  const reference = product.sizeReference;

  if (!reference) return [];

  const allowedMetrics = garmentMetricScope(product);

  return [
    { metric: 'chest' as const, label: 'Chest', min: reference.chestCmMin, max: reference.chestCmMax },
    { metric: 'waist' as const, label: 'Waist', min: reference.waistCmMin, max: reference.waistCmMax },
    { metric: 'hip' as const, label: 'Hip/Seat', min: reference.hipCmMin, max: reference.hipCmMax },
  ].filter(
    (item) =>
      allowedMetrics.has(item.metric) &&
      item.min !== null &&
      item.min !== undefined &&
      item.max !== null &&
      item.max !== undefined,
  );
}

function referenceSummary(product: Product) {
  return referenceRanges(product)
    .map((item) => {
      const min = Number(item.min).toFixed(0);
      const max = Number(item.max).toFixed(0);
      return item.min === item.max ? `${item.label} ${min} cm` : `${item.label} ${min}-${max} cm`;
    })
    .join(' | ');
}

function buildSizeReferenceFitReport(
  product: Product,
  bodyProfile: BodyProfile | null,
) {
  const ranges = referenceRanges(product);

  if (!ranges.length) return '';

  const comparisons = ranges.reduce<ReferenceComparison[]>((items, range) => {
    const userCm = userMetricCm(range.metric, bodyProfile);
    if (!userCm) return items;

    const minCm = Number(range.min);
    const maxCm = Number(range.max);
    const belowCm = Number((minCm - userCm).toFixed(1));
    const aboveCm = Number((userCm - maxCm).toFixed(1));

    if (belowCm > 0) {
      items.push({
        label: range.label,
        userCm: Number(userCm),
        minCm,
        maxCm,
        status: 'Likely too loose',
        penalty: belowCm > 12 ? 26 : 14,
        message: `${range.label} is ${belowCm.toFixed(1)} cm below the size ${product.sizeReference?.label ?? product.size ?? ''} product measurement range.`,
      });
      return items;
    }

    if (aboveCm > 0) {
      items.push({
        label: range.label,
        userCm: Number(userCm),
        minCm,
        maxCm,
        status: 'Likely too tight',
        penalty: aboveCm > 8 ? 28 : 16,
        message: `${range.label} is ${aboveCm.toFixed(1)} cm above the size ${product.sizeReference?.label ?? product.size ?? ''} product measurement range.`,
      });
      return items;
    }

    items.push({
      label: range.label,
      userCm: Number(userCm),
      minCm,
      maxCm,
      status: 'Good fit',
      penalty: 0,
        message: 'The try-on body measurement sits within the selected product measurement range.',
    });
    return items;
  }, []);

  if (!comparisons.length) return '';

  const score = Math.max(0, 100 - comparisons.reduce((total, item) => total + item.penalty, 0));
  const strongestIssue = comparisons
    .filter((item) => item.penalty > 0)
    .sort((a, b) => b.penalty - a.penalty)[0];
  const title = strongestIssue ? strongestIssue.status : 'Likely good fit';
  const sizeLabel = product.sizeReference?.label ?? product.size?.split(',')[0]?.trim() ?? 'Not set';
  const issueArea = issueLabel(comparisons);
  const summary = strongestIssue
    ? `${product.name} size ${sizeLabel} is ${strongestIssue.status.toLowerCase()} around ${issueArea} based on the product measurements.`
    : `${product.name} size ${sizeLabel} matches the try-on body measurements based on the product measurements.`;

  const details = comparisons.flatMap((item) => [
    `${item.label}: ${item.status}`,
    `User ${item.userCm.toFixed(1)} cm vs reference ${item.minCm.toFixed(1)}-${item.maxCm.toFixed(1)} cm. ${item.message}`,
  ]);

  return [
    `${title} (${score}/100)`,
    summary,
    '',
    `Product: ${product.name}`,
    `Static garment type: ${product.category ?? 'Not set'}`,
    `Static product size: ${sizeLabel}`,
    `Product measurements: ${referenceSummary(product)}`,
    `Measured areas: ${garmentMetricLabel(product)}`,
    '',
    ...details,
  ].join('\n');
}

function buildMeasurementFitReport(
  product: Product | null,
  bodyProfile: BodyProfile | null,
) {
  if (!product) return 'No selected product was available for the fit report.';

  const measurements = preferredMeasurements(product);

  if (!measurements.length) {
    const referenceReport = buildSizeReferenceFitReport(product, bodyProfile);

    if (referenceReport) {
      return referenceReport;
    }

    return [
      'Fit data unavailable',
      `${product.name} does not have admin product measurements yet.`,
      'Add custom garment measurements or size body reference data in admin to compare this item with the try-on body profile.',
      product.size ? `Available size label: ${product.size}.` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const allowedMetrics = garmentMetricScope(product);
  const scopedMeasurements = measurements.filter((measurement) => {
    const metric = measurementMetric(measurement.measurementName);
    return metric ? allowedMetrics.has(metric) : false;
  });

  const comparisons = scopedMeasurements.reduce<FitComparison[]>((items, measurement) => {
    const metric = measurementMetric(measurement.measurementName);
    if (!metric || !allowedMetrics.has(metric)) return items;

    const userCm = userMetricCm(metric, bodyProfile);
    if (!userCm) return items;

    const garmentCm = Number(measurement.valueCm);
    const easeCm = Number((garmentCm - userCm).toFixed(1));
    const fit = fitStatus(metric, easeCm);

    items.push({
      label: measurement.measurementName,
      userCm: Number(userCm),
      garmentCm,
      easeCm,
      status: fit.status,
      message: fit.message,
      penalty: fit.penalty,
    });

    return items;
  }, []);

  if (!comparisons.length) {
    return [
      'Fit data incomplete',
      `${product.name} has product measurements, but none match the needed ${garmentMetricLabel(product)} fields yet.`,
      `Supported comparisons for this garment include ${garmentMetricLabel(product)}.`,
      `Product measurements: ${measurementSummary(measurements)}`,
    ].join('\n');
  }

  const score = Math.max(0, 100 - comparisons.reduce((total, item) => total + item.penalty, 0));
  const strongestIssue = comparisons
    .filter((item) => item.penalty > 0)
    .sort((a, b) => b.penalty - a.penalty)[0];
  const title = strongestIssue ? strongestIssue.status : 'Likely good fit';
  const sizeLabel = scopedMeasurements[0]?.sizeLabel ?? product.size?.split(',')[0]?.trim() ?? 'Not set';
  const garmentType = scopedMeasurements[0]?.garmentType ?? product.category ?? 'Not set';
  const issueArea = issueLabel(comparisons);
  const summary = strongestIssue
    ? `${product.name} size ${sizeLabel} is ${strongestIssue.status.toLowerCase()} around ${issueArea} based on the product measurements.`
    : `${product.name} size ${sizeLabel} looks close to the try-on body measurements.`;

  const detailLines = comparisons.flatMap((item) => {
    const easeText = item.easeCm >= 0 ? `+${item.easeCm.toFixed(1)}` : item.easeCm.toFixed(1);

    return [
      `${item.label}: ${item.status}`,
      `User ${item.userCm.toFixed(1)} cm vs product ${item.garmentCm.toFixed(1)} cm (${easeText} cm ease). ${item.message}`,
    ];
  });

  const lines = [
    `${title} (${score}/100)`,
    summary,
    '',
    `Product: ${product.name}`,
    `Static garment type: ${garmentType}`,
    `Static product size: ${sizeLabel}`,
    `Product measurements: ${measurementSummary(scopedMeasurements)}`,
    `Measured areas: ${garmentMetricLabel(product)}`,
    '',
    ...detailLines,
  ];

  return lines.join('\n');
}

function buildOutfitFitReport(
  products: Product[],
  bodyProfile: BodyProfile | null,
) {
  if (!products.length) return 'No selected product was available for the fit report.';

  return products
    .map((product, index) => {
      const report = buildMeasurementFitReport(product, bodyProfile);
      return products.length > 1 ? `Item ${index + 1}: ${product.name}\n${report}` : report;
    })
    .join('\n\n');
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function BulletText({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.boxText}>{text}</Text>
    </View>
  );
}

function FitReport({
  text,
  products = [],
  bodyProfile,
}: {
  text: string;
  products?: Product[];
  bodyProfile?: BodyProfile | null;
}) {
  const [reportIndex, setReportIndex] = useState(0);
  const reports = products.length
    ? products.map((product) => ({
        product,
        text: buildMeasurementFitReport(product, bodyProfile ?? null),
      }))
    : [{ product: null, text }];
  const activeIndex = Math.min(reportIndex, reports.length - 1);
  const activeReport = reports[activeIndex];
  const lines = reportLines(activeReport.text);
  const [headline, summary, ...details] = lines;
  const product = details.find((line) => line.startsWith('Product:'));
  const garmentType = details.find((line) => line.startsWith('Static garment type:'));
  const productSize = details.find((line) => line.startsWith('Static product size:'));
  const measurements = details.find((line) => line.startsWith('Product measurements:'));
  const comparisonLines = details.filter(
    (line) =>
      !line.startsWith('Product:') &&
      !line.startsWith('Static garment type:') &&
      !line.startsWith('Static product size:') &&
      !line.startsWith('Product measurements:') &&
      !line.startsWith('Measured areas:'),
  );
  const sections = comparisonLines.reduce<{ title: string; reasons: string[] }[]>((items, line) => {
    if (!line.toLowerCase().startsWith('user ') && line.includes(':')) {
      const parsed = splitLabelValue(line);
      items.push({ title: `${parsed.label}: ${parsed.value}`, reasons: [] });
      return items;
    }

    const current = items[items.length - 1];
    if (current) {
      current.reasons.push(line);
    }
    return items;
  }, []);
  const metaItems = [product, garmentType, productSize]
    .filter((item): item is string => !!item)
    .map(splitLabelValue);
  const measurementValue = measurements ? splitLabelValue(measurements).value : '';
  const canGoBack = activeIndex > 0;
  const canGoNext = activeIndex < reports.length - 1;
  const activeName = activeReport.product?.name ?? splitLabelValue(product ?? '').value ?? 'Report';

  useEffect(() => {
    if (reportIndex > reports.length - 1) {
      setReportIndex(Math.max(0, reports.length - 1));
    }
  }, [reportIndex, reports.length]);

  return (
    <View style={styles.reportBox}>
      <View style={styles.reportHeader}>
        <Text style={styles.boxTitle}>Fit report</Text>
        <View style={styles.reportPager}>
          <TouchableOpacity
            style={[styles.reportPagerButton, !canGoBack && styles.reportPagerButtonDisabled]}
            onPress={() => setReportIndex((index) => Math.max(0, index - 1))}
            disabled={!canGoBack}
            activeOpacity={0.72}
          >
            <Ionicons name="chevron-back" size={17} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.reportScore}>
            Item {activeIndex + 1}: {activeName || 'Report'}
          </Text>
          <TouchableOpacity
            style={[styles.reportPagerButton, !canGoNext && styles.reportPagerButtonDisabled]}
            onPress={() => setReportIndex((index) => Math.min(reports.length - 1, index + 1))}
            disabled={!canGoNext}
            activeOpacity={0.72}
          >
            <Ionicons name="chevron-forward" size={17} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
      {headline ? <Text style={styles.reportHeadline}>{headline}</Text> : null}
      {summary ? <Text style={styles.reportSummary}>{summary}</Text> : null}

      {metaItems.length ? (
        <View style={styles.reportMetaRow}>
          {metaItems.map((item) => (
            <Text key={item.label} style={styles.reportMetaText}>
              <Text style={styles.reportMetaLabel}>{item.label}: </Text>
              {item.value}
            </Text>
          ))}
        </View>
      ) : null}

      {measurementValue ? (
        <View style={styles.reportMeasurements}>
          <Text style={styles.reportMeasurementsTitle}>Product Measurements</Text>
          <Text style={styles.reportMeasurementsText}>{measurementValue}</Text>
        </View>
      ) : null}

      {sections.length ? (
        <View style={styles.reportSections}>
          {sections.map((section, index) => (
            <View key={`${section.title}-${index}`} style={styles.reportSection}>
              <Text style={styles.reportSectionTitle}>{section.title}</Text>
              {section.reasons.length ? <Text style={styles.reportReasonLabel}>Reason:</Text> : null}
              {section.reasons.map((reason, reasonIndex) => (
                <Text key={`${section.title}-reason-${reasonIndex}`} style={styles.reportReasonText}>
                  {reason}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MeasurementInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.measureField}>
      <Text style={styles.measureLabel}>{label} (cm)</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.text.muted}
        keyboardType="decimal-pad"
        style={styles.measureInput}
      />
    </View>
  );
}

export default function TryOnScreen() {
  const router = useRouter();
  const { openNav } = useNav();
  const { productId, productIds } = useLocalSearchParams<{ productId?: string; productIds?: string }>();
  const { user, token } = useAuthStore();
  const [phase, setPhase] = useState<TryOnPhase>('upload');
  const [products, setProducts] = useState<Product[]>([]);
  const [savedItems, setSavedItems] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [personUri, setPersonUri] = useState('');
  const [tryOnResult, setTryOnResult] = useState<TryOnResult | null>(null);
  const [displayResultUri, setDisplayResultUri] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [error, setError] = useState('');
  const [photoGuideMode, setPhotoGuideMode] = useState<PhotoGuideMode>('full');
  const [sessionChestCm, setSessionChestCm] = useState('');
  const [sessionWaistCm, setSessionWaistCm] = useState('');
  const [sessionHipCm, setSessionHipCm] = useState('');
  const [sessionHeightCm, setSessionHeightCm] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [portraitAspectRatio, setPortraitAspectRatio] = useState(1);
  const loadingDotScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;

  const hydrateProduct = async (product: Product | null) => {
    if (!product?.id) return product;

    try {
      return await apiGet<Product>(`/products/${product.id}`);
    } catch {
      return product;
    }
  };

  const selectProduct = async (product: Product) => {
    setSelectedProducts([product]);
    const hydrated = await hydrateProduct(product);
    setSelectedProducts(hydrated ? [hydrated] : []);
  };

  const addProduct = async (product: Product) => {
    if (selectedProducts.some((item) => String(item.id) === String(product.id))) {
      return;
    }

    if (selectedProducts.length >= 2) {
      Alert.alert('Two-item limit', 'You can use up to two products in one try-on.');
      return;
    }

    const hydrated = await hydrateProduct(product);
    if (!hydrated) return;
    setSelectedProducts((current) => {
      if (current.some((item) => String(item.id) === String(hydrated.id)) || current.length >= 2) {
        return current;
      }
      return [...current, hydrated];
    });
  };

  const removeProduct = (productIdToRemove: string) => {
    setSelectedProducts((current) => current.filter((item) => String(item.id) !== String(productIdToRemove)));
  };

  useEffect(() => {
    const load = async () => {
      const requestedProductIds = (productIds ?? productId ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 2);

      if (requestedProductIds.length) {
        setPhase('upload');
        setTryOnResult(null);
        setDisplayResultUri('');
        setPersonUri('');
        setGenerationProgress(0);
      }

      const [allProducts, saved] = await Promise.all([
        apiGet<Product[]>('/products'),
        user?.user_id ? apiGet<Product[]>(`/saved/${user.user_id}`, token) : Promise.resolve([]),
      ]);

      const activeProducts = allProducts.filter((product) => product.qty === undefined || Number(product.qty) > 0);
      const initialProducts = requestedProductIds.length
        ? requestedProductIds
            .map((id) => activeProducts.find((product) => String(product.id) === String(id)))
            .filter((product): product is Product => !!product)
        : [
            saved[0] ??
              activeProducts.find((product) => product.imageUrl) ??
              null,
          ].filter((product): product is Product => !!product);

      setProducts(activeProducts);
      setSavedItems(saved);
      const hydratedInitialProducts = await Promise.all(
        initialProducts.map((product) => hydrateProduct(product)),
      );
      setSelectedProducts(hydratedInitialProducts.filter((product): product is Product => !!product).slice(0, 2));
    };

    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load try-on data.'))
      .finally(() => setLoading(false));
  }, [productId, productIds, token, user?.user_id]);

  useEffect(() => {
    setSessionChestCm(String(user?.body_chest_cm ?? ''));
    setSessionWaistCm(String(user?.body_waist_cm ?? ''));
    setSessionHipCm(String(user?.body_hip_cm ?? ''));
    setSessionHeightCm(String(user?.body_height_cm ?? ''));
  }, [
    user?.body_chest_cm,
    user?.body_height_cm,
    user?.body_hip_cm,
    user?.body_waist_cm,
  ]);

  useEffect(() => {
    if (phase !== 'generating') {
      loadingDotScales.forEach((dot) => dot.setValue(1));
      return;
    }

    const animation = Animated.loop(
      Animated.stagger(
        140,
        loadingDotScales.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1.32,
              duration: 260,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 1,
              duration: 260,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    );

    animation.start();
    return () => animation.stop();
  }, [loadingDotScales, phase]);

  useEffect(() => {
    if (phase !== 'generating') return;

    setGenerationProgress((current) => (current > 0 ? current : 5));
    const interval = setInterval(() => {
      setGenerationProgress((current) => {
        if (current >= 94) return current;
        const increment = current < 50 ? 7 : current < 80 ? 4 : 2;
        return Math.min(94, current + increment);
      });
    }, 700);

    return () => clearInterval(interval);
  }, [phase]);

  const mightLike = useMemo(() => {
    const tokens = styleTokens(user?.fashion_style);

    if (!tokens.length) {
      return [];
    }

    return products
      .filter((product) => !selectedProducts.some((selected) => String(selected.id) === String(product.id)))
      .filter((product) => {
        const text = productText(product);
        return tokens.some((token) => text.includes(token));
      })
      .slice(0, 6);
  }, [products, selectedProducts, user?.fashion_style]);

  const progressIndex = phase === 'upload' ? 1 : phase === 'generating' ? 2 : 3;
  const resultImage = displayResultUri || tryOnResult?.image || '';
  const resultImageSource = resultImage ? { uri: resultImage } : null;
  const sessionBodyProfile: BodyProfile = {
    body_chest_cm: toNullableNumber(sessionChestCm),
    body_waist_cm: toNullableNumber(sessionWaistCm),
    body_hip_cm: toNullableNumber(sessionHipCm),
    body_height_cm: toNullableNumber(sessionHeightCm),
  };
  const aiReport = (reportText(tryOnResult) || buildOutfitFitReport(selectedProducts, sessionBodyProfile)).replace(
    /based on the admin body reference/gi,
    'based on the product measurements',
  );

  const selectedOnlyTops = selectedProducts.length > 0 && selectedProducts.every((product) => (
    tryOnCategory(product.category, product.categorySlug) === 'tops'
  ));

  const processPortrait = async (uri: string) => {
    const image = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 900 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
    );

    setPersonUri(image.uri);
    Image.getSize(
      image.uri,
      (width, height) => setPortraitAspectRatio(Math.min(1.45, Math.max(0.62, width / height))),
      () => setPortraitAspectRatio(1),
    );
    setError('');
  };

  const pickPortrait = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        base64: false,
        quality: 1,
      });

      if (pickerResult.canceled) return;

      await processPortrait(pickerResult.assets[0].uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload portrait.');
    }
  };

  const takePortrait = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to take a try-on photo.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        base64: false,
        cameraType: ImagePicker.CameraType.front,
        quality: 1,
      });

      if (cameraResult.canceled) return;

      await processPortrait(cameraResult.assets[0].uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open camera.');
    }
  };

  const generateTryOn = async () => {
    if (!personUri) {
      Alert.alert('Upload your photo', 'Choose a clear portrait before generating the try-on.');
      return;
    }

    if (!selectedProducts.length) {
      Alert.alert('Select an item', 'Choose at least one product to try on first.');
      return;
    }

    const missingImage = selectedProducts.find((product) => !resolvedProductImageUri(product.imageUrl));

    if (missingImage) {
      Alert.alert('Product image missing', `${missingImage.name} needs an uploaded image before it can be used for try-on.`);
      return;
    }

    setGenerating(true);
    setPhase('generating');
    setGenerationProgress(5);
    setError('');

    try {
      let currentPersonUri = personUri;
      let finalResult: TryOnResult | null = null;
      let finalResultUri = '';

      for (const [index, product] of selectedProducts.entries()) {
        const rawGarmentUri = resolvedProductImageUri(product.imageUrl);
        const garmentUri = await cacheRemoteImage(rawGarmentUri, `tryon-${product.id}.jpg`);
        setGenerationProgress(Math.max(12, Math.round((index / selectedProducts.length) * 70)));
        const result = await submitTryOn({
          personUri: currentPersonUri,
          garmentUri,
          category: tryOnCategory(product.category, product.categorySlug),
        });
        finalResultUri = await materializeTryOnImage(result.image ?? '');
        currentPersonUri = finalResultUri;
        finalResult = result;
        setGenerationProgress(Math.round(((index + 1) / selectedProducts.length) * 92));
      }

      setTryOnResult(finalResult);
      setDisplayResultUri(finalResultUri);
      setGenerationProgress(100);
      setPhase('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate the try-on result.';
      setError(message);
      setGenerationProgress(0);
      setPhase('upload');
      Alert.alert('Try-on failed', message);
    } finally {
      setGenerating(false);
    }
  };

  const saveGeneratedImage = async () => {
    if (!resultImage) return;

    setSavingImage(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to save the generated try-on image.');
        return;
      }

      const localUri = await saveDataImageToGallery(resultImage);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved', 'The generated try-on image was saved to your gallery.');
    } catch (err) {
      Alert.alert('Could not save image', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSavingImage(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.brand.blueLight} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={26} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.brandLockup}>
          <View style={styles.logoMark}>
            <Image source={require('../../assets/afro-logo.png')} style={styles.headerLogoImage} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>A'FRO</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={openNav} activeOpacity={0.75}>
          <Ionicons name="menu-outline" size={30} color={Colors.brand.blueLight} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <Text style={styles.pillTitle}>Try it On</Text>
          <View style={styles.progressRow}>
            {[1, 2, 3].map((step) => (
              <View key={step} style={[styles.progressBar, step <= progressIndex && styles.progressBarActive]} />
            ))}
          </View>

          {phase === 'upload' ? (
            <>
              <View style={styles.guideTabs}>
                <TouchableOpacity
                  style={[styles.guideTab, photoGuideMode === 'full' && styles.guideTabActive]}
                  onPress={() => setPhotoGuideMode('full')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="body-outline" size={15} color={Colors.text.primary} />
                  <Text style={styles.guideTabText}>Full body</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.guideTab, photoGuideMode === 'top' && styles.guideTabActive]}
                  onPress={() => setPhotoGuideMode('top')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="shirt-outline" size={15} color={Colors.text.primary} />
                  <Text style={styles.guideTabText}>Top only</Text>
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.uploadBox,
                  personUri && styles.uploadBoxFilled,
                  personUri && { aspectRatio: portraitAspectRatio },
                ]}
              >
                {personUri ? (
                  <Image source={{ uri: personUri }} style={styles.uploadPreview} resizeMode="contain" />
                ) : (
                  <View style={styles.uploadEmpty}>
                    <View style={photoGuideMode === 'full' ? styles.bodyGuide : styles.topGuide}>
                      <View style={styles.guideHead} />
                      <View style={styles.guideShoulders} />
                      <View style={photoGuideMode === 'full' ? styles.guideTorso : styles.guideTorsoShort} />
                      {photoGuideMode === 'full' ? (
                        <View style={styles.guideLegs}>
                          <View style={styles.guideLeg} />
                          <View style={styles.guideLeg} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.uploadTitle}>
                      {photoGuideMode === 'full' ? 'Fit your whole body inside the guide' : 'Frame from head to waist'}
                    </Text>
                    <Text style={styles.uploadText}>
                      {photoGuideMode === 'full'
                        ? 'Best for dresses, bottoms, and full outfits.'
                        : 'Half-body photos work best for tops only.'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoAction} onPress={takePortrait} activeOpacity={0.78}>
                  <Ionicons name="camera-outline" size={18} color={Colors.text.primary} />
                  <Text style={styles.photoActionText}>Use Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoAction} onPress={pickPortrait} activeOpacity={0.78}>
                  <Ionicons name="image-outline" size={18} color={Colors.text.primary} />
                  <Text style={styles.photoActionText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bestBox}>
                <Text style={styles.boxTitle}>For best results</Text>
                <BulletText text={photoGuideMode === 'full' ? 'Full body visible, front-facing' : 'Head to waist visible, front-facing'} />
                <BulletText text="Plain or simple background" />
                <BulletText text="Good lighting, no heavy filters" />
                <BulletText text="Fitted clothing for accurate fit" />
                <BulletText text="Half-body photos are only recommended when trying on tops." />
                {photoGuideMode === 'top' && !selectedOnlyTops ? (
                  <Text style={styles.guideWarning}>Top-only framing is less reliable for dresses or bottoms. Use full body for this selection.</Text>
                ) : null}
              </View>

              <View style={styles.measurementBox}>
                <View style={styles.measurementHeader}>
                  <Text style={styles.boxTitle}>Try-on measurements</Text>
                </View>

                <View style={styles.measureGrid}>
                  <MeasurementInput label="Chest" value={sessionChestCm} onChange={setSessionChestCm} />
                  <MeasurementInput label="Waist" value={sessionWaistCm} onChange={setSessionWaistCm} />
                </View>
                <View style={styles.measureGrid}>
                  <MeasurementInput label="Hip" value={sessionHipCm} onChange={setSessionHipCm} />
                  <MeasurementInput label="Height" value={sessionHeightCm} onChange={setSessionHeightCm} />
                </View>
              </View>

              <SectionTitle title="Selected items" />
              <SelectedItems products={selectedProducts} compact onRemove={removeProduct} onChange={() => {}} />

              <SectionTitle title="Saved items" />
              <HorizontalProducts
                products={savedItems}
                emptyText="Saved products will appear here after you tap hearts in the catalog."
                onSelect={selectProduct}
                onAdd={addProduct}
                selectedIds={selectedProducts.map((product) => String(product.id))}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity style={styles.primaryAction} onPress={generateTryOn} activeOpacity={0.82}>
                <Text style={styles.primaryActionText}>Try it On</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {phase === 'generating' ? (
            <View style={styles.generatingWrap}>
              <View style={styles.personPreviewBox}>
                {personUri ? <Image source={{ uri: personUri }} style={styles.personPreview} resizeMode="contain" /> : null}
              </View>
              <View style={styles.generatingPill}>
                <ActivityIndicator color={Colors.text.primary} size="small" />
                <Text style={styles.generatingPillText}>Generating image...</Text>
              </View>
              <Text style={styles.generatingTitle}>Fitting your look</Text>
              <Text style={styles.generatingText}>
                Our app is draping your selected item{selectedProducts.length > 1 ? 's' : ''} onto your photo.
              </Text>
              <View style={styles.dots}>
                {loadingDotScales.map((dotScale, index) => (
                  <Animated.View
                    key={index}
                    style={[styles.dot, { transform: [{ scaleX: dotScale }, { scaleY: dotScale }] }]}
                  />
                ))}
              </View>
              <View style={styles.progressPercentTrack}>
                <View style={[styles.progressPercentFill, { width: `${generationProgress}%` }]} />
              </View>
              <Text style={styles.generatingFootnote}>{generationProgress}% complete</Text>
            </View>
          ) : null}

          {phase === 'result' ? (
            <>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Try-on result</Text>
                <TouchableOpacity style={styles.roundIcon} onPress={() => setPhase('upload')}>
                  <Ionicons name="refresh" size={17} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.resultImageBox}>
                <ScrollView
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  centerContent
                  contentContainerStyle={styles.zoomContent}
                >
                  {resultImageSource ? (
                    <Image source={resultImageSource} style={styles.resultImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="image-outline" size={40} color={Colors.text.secondary} />
                  )}
                </ScrollView>
              </View>

              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.smallAction} onPress={saveGeneratedImage} disabled={savingImage}>
                  {savingImage ? (
                    <ActivityIndicator color={Colors.text.primary} size="small" />
                  ) : (
                    <Ionicons name="download-outline" size={15} color={Colors.text.primary} />
                  )}
                  <Text style={styles.smallActionText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallAction}>
                  <Ionicons name="heart-outline" size={15} color={Colors.text.primary} />
                  <Text style={styles.smallActionText}>Wishlist</Text>
                </TouchableOpacity>
              </View>

              <SelectedItems
                products={selectedProducts}
                compact={false}
                onRemove={removeProduct}
                onChange={() => setPhase('upload')}
              />

              <FitReport text={aiReport} products={selectedProducts} bodyProfile={sessionBodyProfile} />

              <SectionTitle title="You might also like" />
              <HorizontalProducts
                products={mightLike}
                emptyText={
                  user?.fashion_style
                    ? 'No products match your preferred style yet.'
                    : 'Set a preferred style to power this section.'
                }
                onSelect={selectProduct}
                onAdd={addProduct}
                selectedIds={selectedProducts.map((product) => String(product.id))}
              />

              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.secondaryAction}
                  onPress={() => router.replace('/(tabs)/')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.secondaryActionText}>Try another</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryHalfAction}
                  onPress={() => Alert.alert('Coming soon', 'Add to Cart can be connected after this result flow is finalized.')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.primaryActionText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectedItems({
  products,
  compact,
  onRemove,
  onChange,
}: {
  products: Product[];
  compact: boolean;
  onRemove: (productId: string) => void;
  onChange: () => void;
}) {
  if (!products.length) {
    return (
      <View style={styles.selectedCard}>
        <Ionicons name="shirt-outline" size={26} color={Colors.text.secondary} />
        <Text style={styles.selectedEmpty}>No selected products yet.</Text>
      </View>
    );
  }

  return (
    <>
      {products.map((product) => {
        const uri = resolvedProductImageUri(product.imageUrl);
        return (
          <View key={product.id} style={styles.selectedCard}>
            <View style={styles.selectedImageWrap}>
              {uri ? (
                <Image source={{ uri }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <Ionicons name="shirt-outline" size={28} color={Colors.text.secondary} />
              )}
            </View>
            <View style={styles.selectedCopy}>
              <Text style={styles.selectedName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.selectedMeta} numberOfLines={2}>
                {product.description || [product.colorName, product.category].filter(Boolean).join(' / ')}
              </Text>
              {product.size ? <Text style={styles.sizeTag}>{product.size.split(',')[0]}</Text> : null}
            </View>
            <View style={styles.selectedRight}>
              <Text style={styles.selectedPrice}>{peso(product.price)}</Text>
              {products.length > 1 ? (
                <TouchableOpacity style={styles.changeButton} onPress={() => onRemove(product.id)}>
                  <Text style={styles.changeText}>Remove</Text>
                </TouchableOpacity>
              ) : !compact ? (
                <TouchableOpacity style={styles.changeButton} onPress={onChange}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.changeText}>Selected</Text>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

function HorizontalProducts({
  products,
  emptyText,
  onSelect,
  onAdd,
  selectedIds = [],
}: {
  products: Product[];
  emptyText: string;
  onSelect: (product: Product) => void | Promise<void>;
  onAdd?: (product: Product) => void | Promise<void>;
  selectedIds?: string[];
}) {
  if (!products.length) {
    return <Text style={styles.emptyInline}>{emptyText}</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
      {products.map((product) => {
        const uri = resolvedProductImageUri(product.imageUrl);
        const selected = selectedIds.includes(String(product.id));

        return (
          <TouchableOpacity
            key={product.id}
            style={styles.miniCard}
            activeOpacity={0.82}
            onPress={() => onSelect(product)}
          >
            <View style={styles.miniImageWrap}>
              {uri ? (
                <Image source={{ uri }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <Ionicons name="shirt-outline" size={24} color={Colors.text.secondary} />
              )}
              <View style={styles.miniHeart}>
                <Ionicons name="heart" size={12} color="#276296" />
              </View>
            </View>
            <Text style={styles.miniName} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.miniFooter}>
              <Text style={styles.miniPrice} numberOfLines={1}>{peso(product.price)}</Text>
              <TouchableOpacity
                style={[styles.miniAddButton, selected && styles.miniAddButtonSelected]}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!selected) {
                    onAdd?.(product);
                  }
                }}
                activeOpacity={0.76}
              >
                <Text style={[styles.miniAdd, selected && styles.miniAddSelected]}>
                  {selected ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: Colors.border.subtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  headerIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
  headerLogoImage: {
    height: 27,
    width: 27,
  },
  brand: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  container: {
    padding: Spacing.md,
    paddingBottom: 140,
  },
  panel: {
    backgroundColor: 'rgba(26, 34, 53, 0.9)',
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing['2xl'],
    padding: Spacing.md,
  },
  pillTitle: {
    alignSelf: 'center',
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.full,
    borderWidth: 1,
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginBottom: Spacing.md,
    minWidth: 132,
    overflow: 'hidden',
    paddingVertical: 7,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 3,
    flex: 1,
    height: 5,
  },
  progressBarActive: {
    backgroundColor: '#9AE9F5',
  },
  guideTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  guideTab: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
    minHeight: 38,
  },
  guideTabActive: {
    backgroundColor: 'rgba(154, 233, 245, 0.22)',
    borderColor: '#9AE9F5',
  },
  guideTabText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  uploadBox: {
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    height: 170,
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  uploadBoxFilled: {
    alignSelf: 'center',
    height: undefined,
    maxHeight: 360,
    minHeight: 210,
    width: '86%',
  },
  uploadPreview: {
    height: '100%',
    width: '100%',
  },
  uploadEmpty: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  bodyGuide: {
    alignItems: 'center',
    borderColor: 'rgba(216,237,255,0.55)',
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 86,
    justifyContent: 'center',
    width: 70,
  },
  topGuide: {
    alignItems: 'center',
    borderColor: 'rgba(216,237,255,0.55)',
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 92,
  },
  guideHead: {
    borderColor: '#D8EDFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 18,
    marginBottom: 3,
    width: 18,
  },
  guideShoulders: {
    borderColor: '#D8EDFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    height: 8,
    width: 48,
  },
  guideTorso: {
    borderColor: '#D8EDFF',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    height: 25,
    width: 28,
  },
  guideTorsoShort: {
    borderColor: '#D8EDFF',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    height: 22,
    width: 34,
  },
  guideLegs: {
    flexDirection: 'row',
    gap: 7,
  },
  guideLeg: {
    backgroundColor: '#D8EDFF',
    borderRadius: 2,
    height: 22,
    width: 3,
  },
  uploadTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginTop: Spacing.sm,
  },
  uploadText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  uploadChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  uploadChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.full,
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  photoAction: {
    alignItems: 'center',
    backgroundColor: '#276296',
    borderRadius: Radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
  },
  photoActionText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  bestBox: {
    backgroundColor: 'rgba(8, 14, 27, 0.78)',
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  guideWarning: {
    color: '#FFD89A',
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
  measurementBox: {
    backgroundColor: 'rgba(8, 14, 27, 0.78)',
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  measurementHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  measurementHint: {
    color: '#9AE9F5',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  bulletRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  bulletDot: {
    backgroundColor: '#9AE9F5',
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  measureGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  measureField: {
    flex: 1,
  },
  measureLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  measureInput: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(206, 232, 255, 0.28)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    minHeight: 40,
    paddingHorizontal: Spacing.sm,
  },
  boxTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  boxText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    lineHeight: 17,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
  },
  selectedCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(96, 132, 166, 0.62)',
    borderColor: 'rgba(206, 232, 255, 0.2)',
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    minHeight: 76,
    padding: Spacing.sm,
  },
  selectedImageWrap: {
    alignItems: 'center',
    backgroundColor: '#BDE7FF',
    borderRadius: Radius.sm,
    height: 62,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 62,
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  selectedCopy: {
    flex: 1,
  },
  selectedName: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  selectedMeta: {
    color: '#D6E7F6',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  sizeTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selectedRight: {
    alignItems: 'flex-end',
  },
  selectedPrice: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  changeButton: {
    marginTop: Spacing.sm,
  },
  changeText: {
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedEmpty: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  productRail: {
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  miniCard: {
    backgroundColor: 'rgba(96, 132, 166, 0.62)',
    borderColor: 'rgba(206, 232, 255, 0.24)',
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 148,
    padding: 6,
    width: 92,
  },
  miniImageWrap: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: '#BDE7FF',
    borderRadius: Radius.sm,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniHeart: {
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: 3,
    top: 3,
    width: 16,
  },
  miniName: {
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 5,
  },
  miniFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 4,
  },
  miniPrice: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 9,
    fontWeight: '900',
  },
  miniAddButton: {
    alignItems: 'center',
    backgroundColor: '#D8EDFF',
    borderRadius: Radius.full,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 7,
  },
  miniAddButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  miniAdd: {
    color: Colors.bg.primary,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  miniAddSelected: {
    color: Colors.text.primary,
  },
  emptyInline: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  error: {
    color: Colors.status.error,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.full,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    width: '72%',
  },
  primaryActionText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  generatingWrap: {
    alignItems: 'center',
    minHeight: 540,
  },
  personPreviewBox: {
    alignItems: 'center',
    borderColor: 'rgba(154, 233, 245, 0.8)',
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 280,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    width: '92%',
  },
  personPreview: {
    height: '100%',
    width: '100%',
  },
  generatingPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(96, 132, 166, 0.62)',
    borderColor: 'rgba(206, 232, 255, 0.24)',
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    minHeight: 42,
    paddingHorizontal: Spacing.lg,
  },
  generatingPillText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  generatingTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  generatingText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dot: {
    backgroundColor: '#22D3EE',
    borderRadius: 6,
    height: 12,
    width: 22,
  },
  generatingFootnote: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  progressPercentTrack: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.full,
    height: 8,
    marginTop: Spacing.sm,
    overflow: 'hidden',
    width: '72%',
  },
  progressPercentFill: {
    backgroundColor: '#22D3EE',
    borderRadius: Radius.full,
    height: '100%',
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  resultTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.base,
    fontWeight: '900',
  },
  roundIcon: {
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  resultImageBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 14, 27, 0.78)',
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 250,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  zoomContent: {
    alignItems: 'center',
    height: 250,
    justifyContent: 'center',
    width: '100%',
  },
  resultImage: {
    height: 250,
    width: 280,
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  smallAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: Spacing.md,
  },
  smallActionText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
  },
  reportBox: {
    backgroundColor: 'rgba(8, 14, 27, 0.78)',
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  reportPager: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    maxWidth: '70%',
  },
  reportPagerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: Radius.full,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  reportPagerButtonDisabled: {
    opacity: 0.28,
  },
  reportScore: {
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    borderColor: 'rgba(154, 233, 245, 0.35)',
    borderRadius: Radius.full,
    borderWidth: 1,
    color: '#9AE9F5',
    flexShrink: 1,
    fontSize: FontSize.xs,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    textAlign: 'right',
  },
  reportHeadline: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    lineHeight: 20,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  reportSummary: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  reportMetaRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.16)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingBottom: Spacing.sm,
  },
  reportMetaText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  reportMetaLabel: {
    fontWeight: '900',
  },
  reportMeasurements: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.16)',
    borderBottomWidth: 1,
    paddingVertical: Spacing.sm,
  },
  reportMeasurementsTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    marginBottom: 4,
  },
  reportMeasurementsText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
  },
  reportSections: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  reportSection: {
    borderBottomColor: 'rgba(255,255,255,0.14)',
    borderBottomWidth: 1,
    paddingBottom: Spacing.sm,
  },
  reportSectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    lineHeight: 18,
    marginBottom: 5,
  },
  reportReasonLabel: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: '900',
    marginBottom: 4,
  },
  reportReasonText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginBottom: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryActionText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
  primaryHalfAction: {
    alignItems: 'center',
    backgroundColor: '#0B809A',
    borderRadius: Radius.full,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
});
