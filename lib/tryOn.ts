import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE_URL, imageUrl } from '@/lib/api';

export const TRY_ON_API_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

type TryOnUploadOptions = {
  jobId?: string;
  personUri: string;
  garmentUri: string;
  category?: string | null;
  mixMatchMode?: string | null;
  layeringStyle?: string | null;
  garmentPhotoType?: 'model' | 'flat-lay';
  productName?: string | null;
  garmentName?: string | null;
  garmentType?: string | null;
  productType?: string | null;
  fitStatus?: string | null;
  fitScore?: number | null;
  fitVisualIntent?: string | null;
  fitSummary?: string | null;
  bodyMeasurements?: Record<string, number | null | undefined>;
  garmentMeasurements?: Record<string, number | null | undefined>;
};

export type TryOnResult = {
  status?: string;
  job_id?: string;
  image?: string;
  image_path?: string;
  report?: string | string[];
  fit_report?: string | string[];
  analysis?: string | string[];
  image_url?: string;
  image_base64?: string;
};

export type TryOnProgress = {
  job_id: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  current_step: number;
  total_steps: number;
  percent: number;
  error?: string | null;
};

export function createTryOnJobId() {
  return `tryon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function tryOnCategory(
  category?: string | null,
  categorySlug?: string | null,
  garmentType?: string | null,
  productName?: string | null,
) {
  const garmentTypeValue = (garmentType ?? '').toLowerCase();

  if (
    garmentTypeValue.includes('bottom') ||
    garmentTypeValue.includes('pant') ||
    garmentTypeValue.includes('short') ||
    garmentTypeValue.includes('skirt')
  ) {
    return 'bottoms';
  }

  if (
    garmentTypeValue.includes('dress') ||
    garmentTypeValue.includes('jumpsuit') ||
    garmentTypeValue.includes('one')
  ) {
    return 'one-pieces';
  }

  if (
    garmentTypeValue.includes('top') ||
    garmentTypeValue.includes('shirt') ||
    garmentTypeValue.includes('hoodie') ||
    garmentTypeValue.includes('jacket')
  ) {
    return 'tops';
  }

  const value = `${productName ?? ''} ${categorySlug ?? ''} ${category ?? ''}`.toLowerCase();

  if (value.includes('bottom') || value.includes('pant') || value.includes('short') || value.includes('skirt')) {
    return 'bottoms';
  }

  if (value.includes('dress') || value.includes('jumpsuit') || value.includes('one')) {
    return 'one-pieces';
  }

  return 'tops';
}

export function reportText(result: TryOnResult | null) {
  const raw = result?.report ?? result?.fit_report ?? result?.analysis;

  if (Array.isArray(raw)) {
    return raw.filter(Boolean).join('\n');
  }

  return raw ?? '';
}

export async function cacheRemoteImage(uri: string, filename = 'tryon-garment.jpg') {
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  const destination = `${FileSystem.cacheDirectory}${filename}`;
  const downloaded = await FileSystem.downloadAsync(uri, destination);
  return downloaded.uri;
}

export async function saveDataImageToGallery(dataImage: string) {
  if (/^file:\/\//i.test(dataImage)) {
    return dataImage;
  }

  if (/^https?:\/\//i.test(dataImage)) {
    const downloaded = await FileSystem.downloadAsync(
      dataImage,
      `${FileSystem.cacheDirectory}afro-tryon-${Date.now()}.jpg`,
    );
    return downloaded.uri;
  }

  const base64 = dataImage
    .replace(/^data:image\/[^;,]+;base64,/i, '')
    .replace(/\s/g, '');
  if (!base64 || base64.length < 100 || !/^[a-z\d+/]+=*$/i.test(base64)) {
    throw new Error('Try-on service returned image data that is empty or invalid.');
  }
  const uri = `${FileSystem.cacheDirectory}afro-tryon-${Date.now()}.jpg`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const savedImage = await FileSystem.getInfoAsync(uri);
  if (!savedImage.exists || !savedImage.size) {
    throw new Error('The generated try-on image could not be saved on this device.');
  }

  return uri;
}

export async function materializeTryOnImage(imageReference: string) {
  const normalizedReference = imageReference.trim();
  if (/^https?:\/\//i.test(normalizedReference)) {
    const downloaded = await FileSystem.downloadAsync(
      normalizedReference,
      `${FileSystem.cacheDirectory}afro-tryon-result-${Date.now()}.jpg`,
      {
        headers: {
          'User-Agent': 'AFRO-React-Native-TryOn',
        },
      },
    );
    return downloaded.uri;
  }

  if (/^data:image\//i.test(normalizedReference)) {
    return saveDataImageToGallery(normalizedReference);
  }

  if (normalizedReference.length > 100 && /^[a-z\d+/]+=*$/i.test(normalizedReference)) {
    return saveDataImageToGallery(`data:image/jpeg;base64,${normalizedReference}`);
  }

  return normalizedReference;
}

export async function submitTryOn({
  jobId,
  personUri,
  garmentUri,
  category,
  mixMatchMode,
  layeringStyle,
  garmentPhotoType = 'flat-lay',
  productName,
  garmentName,
  garmentType,
  productType,
  fitStatus,
  fitScore,
  fitVisualIntent,
  fitSummary,
  bodyMeasurements,
  garmentMeasurements,
}: TryOnUploadOptions) {
  const form = new FormData();
  form.append('person_image', {
    uri: personUri,
    name: 'person.jpg',
    type: 'image/jpeg',
  } as unknown as string);
  form.append('garment_image', {
    uri: garmentUri,
    name: 'garment.jpg',
    type: 'image/jpeg',
  } as unknown as string);
  form.append('category', category ?? 'auto');
  form.append('garment_photo_type', garmentPhotoType);
  if (mixMatchMode) form.append('mix_match_mode', mixMatchMode);
  if (layeringStyle) form.append('layering_style', layeringStyle);
  if (jobId) form.append('job_id', jobId);
  if (productName) form.append('product_name', productName);
  if (garmentName) form.append('garment_name', garmentName);
  if (garmentType) form.append('garment_type', garmentType);
  if (productType) form.append('product_type', productType);
  if (fitStatus) form.append('fit_status', fitStatus);
  if (fitScore !== null && fitScore !== undefined) form.append('fit_score', String(fitScore));
  if (fitVisualIntent) form.append('fit_visual_intent', fitVisualIntent);
  if (fitSummary) form.append('fit_summary', fitSummary);
  if (bodyMeasurements) form.append('body_measurements', JSON.stringify(bodyMeasurements));
  if (garmentMeasurements) form.append('garment_measurements', JSON.stringify(garmentMeasurements));

  const { ok, text } = await uploadTryOnForm(`${API_BASE_URL}/tryon/upload`, form);
  let data: TryOnResult & { detail?: string; message?: string };

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Try-on API returned non-JSON response: ${text.slice(0, 120)}`);
  }

  if (!ok) {
    throw new Error(data.detail ?? data.message ?? 'Try-on generation failed.');
  }

  data.image ??= data.image_path ?? data.image_url;
  if (!data.image && data.image_base64) {
    data.image = data.image_base64.startsWith('data:')
      ? data.image_base64
      : `data:image/jpeg;base64,${data.image_base64}`;
  }
  if (data.image?.startsWith('/')) {
    data.image = `${API_BASE_URL}${data.image}`;
  }

  if (!data.image) {
    throw new Error('Try-on API did not return a generated image.');
  }

  return data;
}

function uploadTryOnForm(url: string, form: FormData) {
  return new Promise<{ ok: boolean; text: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', url);
    request.setRequestHeader('User-Agent', 'AFRO-React-Native-TryOn');
    request.onload = () => {
      resolve({
        ok: request.status >= 200 && request.status < 300,
        text: request.responseText ?? '',
      });
    };
    request.onerror = () =>
      reject(new Error('Could not reach the try-on API. Keep the API terminal running and make sure your phone stays on the same Wi-Fi.'));
    request.ontimeout = () => reject(new Error('Try-on API request timed out. The AI generation took too long to respond.'));
    request.timeout = 600000;
    request.send(form);
  });
}

export async function getTryOnProgress(_jobId: string): Promise<TryOnProgress | null> {
  // The Modal endpoint returns the generated image synchronously and has no progress route.
  return null;
}

export function resolvedProductImageUri(raw?: string | null) {
  const resolved = imageUrl(raw);
  return resolved ?? raw ?? '';
}
