import * as FileSystem from 'expo-file-system/legacy';
import { imageUrl } from '@/lib/api';

export const TRY_ON_API_BASE_URL =
  process.env.EXPO_PUBLIC_TRYON_API_BASE_URL ??
  'https://glisteringly-unsyncopated-ara.ngrok-free.dev';

type TryOnUploadOptions = {
  personUri: string;
  garmentUri: string;
  category?: string | null;
  garmentPhotoType?: 'model' | 'flat-lay';
};

export type TryOnResult = {
  status?: string;
  image?: string;
  image_path?: string;
  report?: string | string[];
  fit_report?: string | string[];
  analysis?: string | string[];
};

export function tryOnCategory(category?: string | null, categorySlug?: string | null) {
  const value = `${categorySlug ?? ''} ${category ?? ''}`.toLowerCase();

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
  if (/^https?:\/\//i.test(dataImage)) {
    const downloaded = await FileSystem.downloadAsync(
      dataImage,
      `${FileSystem.cacheDirectory}afro-tryon-${Date.now()}.jpg`,
    );
    return downloaded.uri;
  }

  const base64 = dataImage.replace(/^data:image\/\w+;base64,/, '');
  const uri = `${FileSystem.cacheDirectory}afro-tryon-${Date.now()}.jpg`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uri;
}

export async function materializeTryOnImage(imageReference: string) {
  if (/^https?:\/\//i.test(imageReference)) {
    const downloaded = await FileSystem.downloadAsync(
      imageReference,
      `${FileSystem.cacheDirectory}afro-tryon-result-${Date.now()}.jpg`,
      {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'AFRO-React-Native-TryOn',
        },
      },
    );
    return downloaded.uri;
  }

  if (imageReference.startsWith('data:image')) {
    return saveDataImageToGallery(imageReference);
  }

  return imageReference;
}

export async function submitTryOn({
  personUri,
  garmentUri,
  category,
  garmentPhotoType = 'flat-lay',
}: TryOnUploadOptions) {
  const form = new FormData();
  form.append('person_image', {
    uri: personUri,
    name: 'person.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('garment_image', {
    uri: garmentUri,
    name: 'garment.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('category', category ?? 'auto');
  form.append('garment_photo_type', garmentPhotoType);

  const response = await fetch(`${TRY_ON_API_BASE_URL}/v1/tryon/upload`, {
    method: 'POST',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'AFRO-React-Native-TryOn',
    },
    body: form,
  });

  const text = await response.text();
  let data: TryOnResult & { detail?: string; message?: string };

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Try-on API returned non-JSON response: ${text.slice(0, 120)}`);
  }

  if (!response.ok) {
    throw new Error(data.detail ?? data.message ?? 'Try-on generation failed.');
  }

  if (!data.image && data.image_path) {
    data.image = data.image_path.startsWith('http')
      ? data.image_path
      : `${TRY_ON_API_BASE_URL}${data.image_path}`;
  }

  if (!data.image) {
    throw new Error('Try-on API did not return a generated image.');
  }

  return data;
}

export function resolvedProductImageUri(raw?: string | null) {
  const resolved = imageUrl(raw);
  return resolved ?? raw ?? '';
}
