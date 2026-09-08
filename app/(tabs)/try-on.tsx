import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
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
  createTryOnJobId,
  getTryOnProgress,
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
import { useTryOnJobStore } from '@/hooks/useTryOnJobStore';
import { useNav } from '@/context/NavContext';

type TryOnPhase = 'upload' | 'generating' | 'result';
type PhotoGuideMode = 'full' | 'top';
type MixMatchMode = 'top_bottom' | 'dress_shirt' | 'dress_top' | 'dress_bottom';
type LayeringStyle = 'layered' | 'tucked' | 'over' | 'under';

const generationMessages = [
  'Draping the fabric…',
  'Checking the fit…',
  'Matching texture and folds…',
  'Finishing your look…',
];

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
  const text = `${product.measurements?.[0]?.garmentType ?? ''} ${product.categorySlug ?? ''} ${product.category ?? ''}`.toLowerCase();

  if (text.includes('bottom') || text.includes('pant') || text.includes('short') || text.includes('skirt')) {
    return new Set<BodyMetric>(['waist', 'hip']);
  }

  return new Set<BodyMetric>(['chest', 'waist', 'hip']);
}

function primaryGarmentType(product: Product) {
  return product.measurements?.[0]?.garmentType ?? null;
}

function fitHeadline(report: string) {
  return reportLines(report)[0] ?? '';
}

function fitScoreFromHeadline(headline: string) {
  const match = headline.match(/\((\d+)\/100\)/);
  return match ? Number(match[1]) : null;
}

function bodyMeasurementsForTryOn(bodyProfile: BodyProfile) {
  return {
    chest: bodyProfile.body_chest_cm,
    waist: bodyProfile.body_waist_cm,
    hip: bodyProfile.body_hip_cm,
    inseam: bodyProfile.body_height_cm ? Number((bodyProfile.body_height_cm * 0.46).toFixed(1)) : null,
  };
}

function garmentMeasurementsForTryOn(product: Product) {
  return preferredMeasurements(product).reduce<Record<string, number>>((items, measurement) => {
    const metric = measurementMetric(measurement.measurementName);
    if (metric) items[metric] = Number(measurement.valueCm);
    return items;
  }, {});
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
  const [openReasons, setOpenReasons] = useState<Record<string, boolean>>({});
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
  // The fit report headline is the single source of truth for this result's score.
  // We do not receive a separate AI-confidence metric from the try-on service.
  const fitScore = fitScoreFromHeadline(headline ?? '');

  useEffect(() => {
    if (reportIndex > reports.length - 1) {
      setReportIndex(Math.max(0, reports.length - 1));
    }
  }, [reportIndex, reports.length]);

  return (
    <View style={styles.reportBox}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>FIT REPORT</Text>
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
      <View style={styles.fitSummaryCard}>
        <View style={styles.fitSummaryIcon}>
          <Ionicons name="body-outline" size={20} color={Colors.brand.blue} />
        </View>
        <View style={styles.fitSummaryCopy}>
          {headline ? <Text style={styles.reportHeadline}>{headline}</Text> : null}
          {summary ? <Text style={styles.reportSummary}>{summary}</Text> : null}
        </View>
      </View>
      {fitScore !== null ? (
        <>
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Fit score</Text>
            <Text style={styles.confidenceValue}>{fitScore}/100</Text>
          </View>
          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${fitScore}%` }]} />
          </View>
        </>
      ) : null}

      {metaItems.length ? (
        <View style={styles.reportMetaList}>
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
          {sections.map((section, index) => {
            const key = `${section.title}-${index}`;
            const isOpen = !!openReasons[key];
            const { label, value } = splitLabelValue(section.title);
            return (
              <View key={key} style={styles.reportSection}>
                <View style={styles.reportSectionHeading}>
                  <Text style={styles.reportSectionTitle}>{label}</Text>
                  {value ? <Text style={styles.fitStatus}>{value}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.whyResultButton}
                  onPress={() => setOpenReasons((current) => ({ ...current, [key]: !isOpen }))}
                  activeOpacity={0.76}
                >
                  <Text style={styles.whyResultText}>Why this result</Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
                {isOpen ? (
                  <Text style={styles.reportReasonText}>
                    {section.reasons.length
                      ? section.reasons.join(' ')
                      : 'This result is based on your saved measurements and the selected garment details.'}
                  </Text>
                ) : null}
              </View>
            );
          })}
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
  const { productId, productIds, mixMatchMode, layeringStyle, bodyChestCm, bodyWaistCm, bodyHipCm, bodyHeightCm } = useLocalSearchParams<{
    productId?: string;
    productIds?: string;
    mixMatchMode?: string;
    layeringStyle?: string;
    bodyChestCm?: string;
    bodyWaistCm?: string;
    bodyHipCm?: string;
    bodyHeightCm?: string;
  }>();
  const { user, token } = useAuthStore();
  const tryOnJob = useTryOnJobStore();
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
  const [generationMessageIndex, setGenerationMessageIndex] = useState(0);
  const [resultPreviewOpen, setResultPreviewOpen] = useState(false);
  const loadingDotScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const generationMessageOpacity = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);
  const progressFillWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-280, 280],
  });

  const animateGenerationProgress = useCallback((value: number, duration = 360) => {
    const nextValue = Math.min(100, Math.max(0, Math.round(value)));
    setGenerationProgress(nextValue);
    Animated.timing(progressAnim, {
      toValue: nextValue,
      duration,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'generating') {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
      generationMessageOpacity.setValue(1);
      return;
    }

    const scanLoop = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 1900, useNativeDriver: true }),
    );
    scanLoop.start();
    const messageTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(generationMessageOpacity, { toValue: 0.25, duration: 170, useNativeDriver: true }),
        Animated.timing(generationMessageOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setGenerationMessageIndex((index) => (index + 1) % generationMessages.length);
    }, 3200);

    return () => {
      scanLoop.stop();
      clearInterval(messageTimer);
    };
  }, [generationMessageOpacity, phase, scanAnim]);

  useEffect(() => {
    if (tryOnJob.status === 'idle') return;
    if ((productIds ?? productId ?? '').trim()) return;

    if (tryOnJob.selectedProducts.length) {
      setSelectedProducts(tryOnJob.selectedProducts as Product[]);
    }
    if (tryOnJob.personUri) {
      setPersonUri(tryOnJob.personUri);
    }
    setTryOnResult(tryOnJob.result);
    setDisplayResultUri(tryOnJob.displayResultUri);
    setGenerationProgress(tryOnJob.progress);
    progressAnim.setValue(tryOnJob.progress);

    if (tryOnJob.status === 'generating') {
      setPhase('generating');
      setGenerating(true);
    } else if (tryOnJob.status === 'result') {
      setPhase('result');
      setGenerating(false);
    } else if (tryOnJob.status === 'error') {
      setError(tryOnJob.error);
      setPhase('upload');
      setGenerating(false);
    }
  }, [
    progressAnim,
    productId,
    productIds,
    tryOnJob.displayResultUri,
    tryOnJob.error,
    tryOnJob.personUri,
    tryOnJob.progress,
    tryOnJob.result,
    tryOnJob.selectedProducts,
    tryOnJob.status,
  ]);

  const resetTryOnFlow = useCallback((clearPortrait = false, clearJob = true) => {
    if (clearJob) {
      useTryOnJobStore.getState().clear();
    }
    setPhase('upload');
    setTryOnResult(null);
    setDisplayResultUri('');
    setGenerationProgress(0);
    progressAnim.setValue(0);
    setError('');
    setGenerating(false);
    setSavingImage(false);
    if (clearPortrait) {
      setPersonUri('');
      setPortraitAspectRatio(1);
    }
  }, [progressAnim]);

  const hydrateProduct = async (product: Product | null) => {
    if (!product?.id) return product;

    try {
      return await apiGet<Product>(`/products/${product.id}`);
    } catch {
      return product;
    }
  };

  const selectProduct = async (product: Product) => {
    resetTryOnFlow();
    setSelectedProducts([product]);
    const hydrated = await hydrateProduct(product);
    setSelectedProducts(hydrated ? [hydrated] : []);
  };

  const addProduct = async (product: Product) => {
    if (selectedProducts.some((item) => String(item.id) === String(product.id))) {
      return;
    }

    if (selectedProducts.length >= 3) {
      Alert.alert('Three-item limit', 'You can use up to three products in one try-on.');
      return;
    }

    resetTryOnFlow();
    const hydrated = await hydrateProduct(product);
    if (!hydrated) return;
    setSelectedProducts((current) => {
      if (current.some((item) => String(item.id) === String(hydrated.id)) || current.length >= 3) {
        return current;
      }
      return [...current, hydrated];
    });
  };

  const removeProduct = (productIdToRemove: string) => {
    resetTryOnFlow();
    setSelectedProducts((current) => current.filter((item) => String(item.id) !== String(productIdToRemove)));
  };

  useEffect(() => {
    const load = async () => {
      const requestedProductIds = (productIds ?? productId ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 3);

      if (requestedProductIds.length) {
        resetTryOnFlow(true, false);
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

      const storedJob = useTryOnJobStore.getState();
      if (!requestedProductIds.length && storedJob.status !== 'idle' && storedJob.selectedProducts.length) {
        setSelectedProducts(storedJob.selectedProducts as Product[]);
        setPersonUri(storedJob.personUri);
        setTryOnResult(storedJob.result);
        setDisplayResultUri(storedJob.displayResultUri);
        setGenerationProgress(storedJob.progress);
        progressAnim.setValue(storedJob.progress);
        setPhase(storedJob.status === 'result' ? 'result' : storedJob.status === 'generating' ? 'generating' : 'upload');
        if (storedJob.status === 'error') {
          setError(storedJob.error);
        }
        return;
      }

      const hydratedInitialProducts = await Promise.all(
        initialProducts.map((product) => hydrateProduct(product)),
      );
      setSelectedProducts(hydratedInitialProducts.filter((product): product is Product => !!product).slice(0, 3));
    };

    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load try-on data.'))
      .finally(() => setLoading(false));
  }, [productId, productIds, resetTryOnFlow, token, user?.user_id]);

  useEffect(() => {
    setSessionChestCm(String(bodyChestCm ?? user?.body_chest_cm ?? ''));
    setSessionWaistCm(String(bodyWaistCm ?? user?.body_waist_cm ?? ''));
    setSessionHipCm(String(bodyHipCm ?? user?.body_hip_cm ?? ''));
    setSessionHeightCm(String(bodyHeightCm ?? user?.body_height_cm ?? ''));
  }, [
    bodyChestCm,
    bodyHeightCm,
    bodyHipCm,
    bodyWaistCm,
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
  const activeMixMatchMode: MixMatchMode | null =
    mixMatchMode === 'dress_shirt' ||
    mixMatchMode === 'dress_top' ||
    mixMatchMode === 'dress_bottom' ||
    mixMatchMode === 'top_bottom'
      ? mixMatchMode
      : null;
  const activeLayeringStyle: LayeringStyle =
    layeringStyle === 'tucked' ||
    layeringStyle === 'under' ||
    layeringStyle === 'over' ||
    layeringStyle === 'layered'
      ? layeringStyle
      : 'over';
  const aiReport = (reportText(tryOnResult) || buildOutfitFitReport(selectedProducts, sessionBodyProfile)).replace(
    /based on the admin body reference/gi,
    'based on the product measurements',
  );

  const selectedOnlyTops = selectedProducts.length > 0 && selectedProducts.every((product) => (
    tryOnCategory(product.category, product.categorySlug, primaryGarmentType(product), product.name) === 'tops'
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
    setGenerationProgress(0);
    progressAnim.setValue(0);
    animateGenerationProgress(2, 220);
    tryOnJob.start({ personUri, selectedProducts });
    setError('');

    try {
      let currentPersonUri = personUri;
      let finalResult: TryOnResult | null = null;
      let finalResultUri = '';

      for (const [index, product] of selectedProducts.entries()) {
        const jobId = createTryOnJobId();
        const rawGarmentUri = resolvedProductImageUri(product.imageUrl);
        const garmentUri = await cacheRemoteImage(rawGarmentUri, `tryon-${product.id}.jpg`);
        const fitReport = buildMeasurementFitReport(product, sessionBodyProfile);
        const fitHeadlineText = fitHeadline(fitReport);
        const productCategory = tryOnCategory(product.category, product.categorySlug, primaryGarmentType(product), product.name);
        const isTuckedDressBottomDressPass =
          activeMixMatchMode === 'dress_bottom' &&
          activeLayeringStyle === 'under' &&
          index === 0 &&
          productCategory === 'one-pieces';
        const generationCategory = isTuckedDressBottomDressPass ? 'tops' : productCategory;
        const updateOverallProgress = (jobPercent: number) => {
          const overallPercent = ((index + jobPercent / 100) / selectedProducts.length) * 100;
          useTryOnJobStore.getState().setProgress(overallPercent);
          if (mountedRef.current) {
            animateGenerationProgress(overallPercent);
          }
        };
        const progressInterval = setInterval(() => {
          getTryOnProgress(jobId)
            .then((progress) => {
              if (!progress) return;

              if (progress.status === 'error') {
                return;
              }

              updateOverallProgress(progress.percent);
            })
            .catch(() => {});
        }, 1500);

        updateOverallProgress(0);
        let result: TryOnResult;
        try {
          result = await submitTryOn({
            jobId,
            personUri: currentPersonUri,
            garmentUri,
            category: generationCategory,
            productName: product.name,
            garmentName: product.name,
            garmentType: isTuckedDressBottomDressPass ? 'top' : primaryGarmentType(product),
            productType: isTuckedDressBottomDressPass ? 'Top' : product.category,
            mixMatchMode: activeMixMatchMode,
            layeringStyle: activeMixMatchMode?.startsWith('dress_') ? activeLayeringStyle : null,
            fitStatus: fitHeadlineText,
            fitScore: fitScoreFromHeadline(fitHeadlineText),
            fitSummary: fitReport,
            bodyMeasurements: bodyMeasurementsForTryOn(sessionBodyProfile),
            garmentMeasurements: garmentMeasurementsForTryOn(product),
          });
        } finally {
          clearInterval(progressInterval);
        }

        updateOverallProgress(100);
        finalResultUri = await materializeTryOnImage(result.image ?? '');
        currentPersonUri = finalResultUri;
        finalResult = result;
      }

      useTryOnJobStore.getState().complete({ result: finalResult, displayResultUri: finalResultUri });
      if (mountedRef.current) {
        setTryOnResult(finalResult);
        setDisplayResultUri(finalResultUri);
        animateGenerationProgress(100, 260);
        setPhase('result');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate the try-on result.';
      useTryOnJobStore.getState().fail(message);
      if (mountedRef.current) {
        setError(message);
        progressAnim.setValue(0);
        setGenerationProgress(0);
        setPhase('upload');
        Alert.alert('Try-on failed', message);
      }
    } finally {
      if (mountedRef.current) {
        setGenerating(false);
      }
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
        <View style={styles.brandLockup}>
          <Image source={require('../../assets/afro-logo-black.png')} style={styles.headerLogoImage} resizeMode="contain" />
          <Text style={styles.brand}>A'FRO</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={openNav} activeOpacity={0.75}>
          <Ionicons name="menu-outline" size={28} color={Colors.brand.blue} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleRow}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            if (phase !== 'generating') {
              useTryOnJobStore.getState().clear();
            }
            router.back();
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={25} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Try On</Text>
        <View style={styles.headerIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
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
                <Animated.View
                  pointerEvents="none"
                  style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]}
                />
                <View style={styles.scanLabel}>
                  <View style={styles.scanLabelDot} />
                  <Text style={styles.scanLabelText}>Scanning your photo</Text>
                </View>
              </View>
              <Text style={styles.generatingTitle}>Fitting your look</Text>
              <Animated.Text style={[styles.generatingStepText, { opacity: generationMessageOpacity }]}>
                {generationMessages[generationMessageIndex]}
              </Animated.Text>
              <Text style={styles.generatingText}>This may take a moment. Your fit preview is on its way.</Text>
              <View style={styles.dots}>
                {loadingDotScales.map((dotScale, index) => (
                  <Animated.View
                    key={index}
                    style={[styles.dot, { transform: [{ scaleX: dotScale }, { scaleY: dotScale }] }]}
                  />
                ))}
              </View>
              <View style={styles.progressPercentTrack}>
                <Animated.View style={[styles.progressPercentFill, { width: progressFillWidth }]} />
              </View>
              <Text style={styles.generatingFootnote}>{generationProgress}% complete</Text>
              <TouchableOpacity
                style={styles.backgroundBrowseButton}
                onPress={() => router.push('/(tabs)/catalog')}
                activeOpacity={0.82}
              >
                <Ionicons name="grid-outline" size={16} color={Colors.text.primary} />
                <Text style={styles.secondaryActionText}>Browse while waiting</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {phase === 'result' ? (
            <>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Try-on result</Text>
                <TouchableOpacity style={styles.roundIcon} onPress={() => resetTryOnFlow()}>
                  <Ionicons name="refresh" size={17} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.resultImageBox}
                onPress={() => resultImageSource && setResultPreviewOpen(true)}
                activeOpacity={0.9}
              >
                {resultImageSource ? (
                  <Image source={resultImageSource} style={styles.resultImage} resizeMode="contain" />
                ) : (
                  <Ionicons name="image-outline" size={40} color={Colors.text.secondary} />
                )}
                <View style={styles.expandHint} pointerEvents="none">
                  <Ionicons name="expand-outline" size={14} color={Colors.white} />
                  <Text style={styles.expandHintText}>Tap to view full size</Text>
                </View>
              </TouchableOpacity>

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
                onChange={() => resetTryOnFlow()}
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
                  onPress={() => resetTryOnFlow(true)}
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
      <Modal
        visible={resultPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResultPreviewOpen(false)}
      >
        <TouchableOpacity style={styles.fullPreviewBackdrop} activeOpacity={1} onPress={() => setResultPreviewOpen(false)}>
          {resultImageSource ? <Image source={resultImageSource} style={styles.fullPreviewImage} resizeMode="contain" /> : null}
          <Text style={styles.fullPreviewHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
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
  headerLogoImage: {
    height: 30,
    width: 30,
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  pageTitle: { color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: '900' },
  panel: {
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing['2xl'],
    padding: Spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: Spacing.lg,
  },
  progressBar: {
    backgroundColor: '#D9E6F5',
    borderRadius: 3,
    flex: 1,
    height: 5,
  },
  progressBarActive: {
    backgroundColor: Colors.brand.blue,
  },
  guideTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  guideTab: {
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
    minHeight: 38,
  },
  guideTabActive: {
    backgroundColor: '#EAF4FF',
    borderColor: Colors.brand.blue,
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
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
  },
  photoActionText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  bestBox: {
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
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
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
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
    color: Colors.brand.blue,
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
    backgroundColor: Colors.brand.blue,
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
    backgroundColor: Colors.bg.input,
    borderColor: Colors.border.default,
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
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
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
    color: Colors.text.secondary,
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
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
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
    backgroundColor: '#EAF4FF',
    borderRadius: Radius.full,
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 7,
  },
  miniAddButtonSelected: {
    backgroundColor: Colors.brand.blue,
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
    backgroundColor: Colors.brand.blue,
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
    borderColor: Colors.border.active,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 280,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    position: 'relative',
    width: '92%',
  },
  personPreview: {
    height: '100%',
    width: '100%',
  },
  scanLine: {
    backgroundColor: 'rgba(47, 126, 198, 0.20)',
    borderBottomColor: Colors.brand.blue,
    borderBottomWidth: 2,
    height: 84,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scanLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 42, 81, 0.84)',
    borderRadius: Radius.full,
    bottom: Spacing.sm,
    flexDirection: 'row',
    gap: 6,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    position: 'absolute',
  },
  scanLabelDot: {
    backgroundColor: Colors.status.success,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  scanLabelText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  generatingPill: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
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
  generatingStepText: {
    color: Colors.brand.blue,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginTop: Spacing.sm,
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
    backgroundColor: Colors.brand.blue,
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
  backgroundBrowseButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.full,
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
  },
  progressPercentTrack: {
    backgroundColor: '#D9E6F5',
    borderRadius: Radius.full,
    height: 8,
    marginTop: Spacing.sm,
    overflow: 'hidden',
    width: '72%',
  },
  progressPercentFill: {
    backgroundColor: Colors.brand.blue,
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
    backgroundColor: '#FFFFFF',
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 250,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
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
  expandHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 42, 81, 0.80)',
    borderRadius: Radius.full,
    bottom: Spacing.sm,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    position: 'absolute',
    right: Spacing.sm,
  },
  expandHintText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  smallAction: {
    alignItems: 'center',
    backgroundColor: '#EAF4FF',
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
    backgroundColor: Colors.bg.card,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  reportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  reportTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0,
  },
  reportPager: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    maxWidth: '70%',
  },
  reportPagerButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  reportPagerButtonDisabled: {
    opacity: 0.28,
  },
  reportScore: {
    backgroundColor: '#EAF4FF',
    borderColor: Colors.border.active,
    borderRadius: Radius.full,
    borderWidth: 1,
    color: Colors.brand.blue,
    flexShrink: 1,
    fontSize: FontSize.sm,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    textAlign: 'center',
  },
  reportHeadline: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'left',
  },
  reportSummary: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 19,
    marginTop: 2,
  },
  fitSummaryCard: {
    alignItems: 'center',
    backgroundColor: '#97d6ee',
    borderRadius: Radius.md,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  fitSummaryIcon: {
    alignItems: 'center',
    backgroundColor: '#408cbb',
    borderRadius: Radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  fitSummaryCopy: {
    flex: 1,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  confidenceValue: {
    color: Colors.brand.blue,
    fontSize: FontSize.xs,
    fontWeight: '900',
  },
  confidenceTrack: {
    backgroundColor: '#D9E6F5',
    borderRadius: Radius.full,
    height: 4,
    marginBottom: Spacing.sm,
    marginTop: 6,
    overflow: 'hidden',
  },
  confidenceFill: {
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    height: '100%',
  },
  reportMetaList: {
    alignItems: 'center',
    borderBottomColor: Colors.border.default,
    borderBottomWidth: 1,
    gap: 8,
    justifyContent: 'center',
    paddingBottom: Spacing.md,
  },
  reportMetaText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  reportMetaLabel: {
    fontWeight: '900',
  },
  reportMeasurements: {
    alignItems: 'center',
    borderBottomColor: Colors.border.default,
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
  },
  reportMeasurementsTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginBottom: 6,
  },
  reportMeasurementsText: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  reportSections: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  reportSection: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  reportSectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportSectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: '900',
    lineHeight: 22,
  },
  fitStatus: {
    backgroundColor: '#4ab5c3',
    borderRadius: Radius.full,
    color: '#183f7a',
    fontSize: FontSize.xs,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  whyResultButton: {
    alignItems: 'center',
    borderTopColor: Colors.border.default,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  whyResultText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  reportReasonLabel: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    marginBottom: 6,
  },
  reportReasonText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  fullPreviewBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 21, 39, 0.95)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.md,
  },
  fullPreviewImage: {
    height: '82%',
    width: '100%',
  },
  fullPreviewHint: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border.active,
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
    backgroundColor: Colors.brand.blue,
    borderRadius: Radius.full,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
});
