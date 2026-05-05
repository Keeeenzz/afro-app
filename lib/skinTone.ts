export const SKIN_TONE_API_BASE_URL =
  process.env.EXPO_PUBLIC_SKIN_TONE_API_BASE_URL ??
  'https://stiffly-evacuate-oasis.ngrok-free.dev';

export const SKIN_TONE_API_KEY =
  process.env.EXPO_PUBLIC_SKIN_TONE_API_KEY ?? 'swag-dev-key-change-me';

export type SkinToneColor = {
  color_name: string;
  color_hex?: string | null;
};

export type SkinToneAnalysis = {
  skin_tone?: {
    label?: string;
    depth?: string;
    undertone?: string;
    hex?: string;
  };
  recommended_colors?: {
    best?: SkinToneColor[];
    neutral?: SkinToneColor[];
  };
  recommended_color_names?: {
    all?: string[];
  };
};

export async function analyzeSkinTone(base64Image: string) {
  const response = await fetch(`${SKIN_TONE_API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': SKIN_TONE_API_KEY,
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ image: base64Image }),
  });

  const text = await response.text();
  let data: SkinToneAnalysis & { detail?: string; message?: string };

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`AI API returned non-JSON response: ${text.slice(0, 120)}`);
  }

  if (!response.ok) {
    throw new Error(data.detail ?? data.message ?? 'AI analysis request failed');
  }

  return data;
}

export function skinToneCatalogColorNames(result: SkinToneAnalysis | null) {
  const explicitNames = result?.recommended_color_names?.all ?? [];
  const paletteNames = [
    ...(result?.recommended_colors?.best ?? []),
    ...(result?.recommended_colors?.neutral ?? []),
  ].map((color) => color.color_name);

  return Array.from(
    new Set(
      [...explicitNames, ...paletteNames]
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );
}
