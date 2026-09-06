import { Platform } from 'react-native';

const defaultBaseUrl = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  default: 'http://localhost:5000/api',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl;

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? `API request failed: ${response.status}`);
  }

  return response.json();
}

export function apiGet<T>(path: string, token?: string | null) {
  return apiRequest<T>(path, { token });
}

export function apiPost<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: 'POST', body, token });
}

export function apiPatch<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: 'PATCH', body, token });
}

export function apiDelete<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: 'DELETE', body, token });
}

export async function apiPostForm<T>(path: string, form: FormData, token?: string | null): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', `${API_BASE_URL}${path}`);
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.onload = () => {
      let data: { message?: string } | T | null = null;

      try {
        data = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        reject(new Error(`API request returned non-JSON response: ${request.responseText.slice(0, 120)}`));
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new Error((data as { message?: string } | null)?.message ?? `API request failed: ${request.status}`));
        return;
      }

      resolve(data as T);
    };
    request.onerror = () => reject(new Error('Could not reach the API. Make sure the backend is running and your phone is on the same Wi-Fi.'));
    request.send(form);
  });
}

export function imageUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url.replace('http://localhost:5000', API_BASE_URL.replace('/api', ''));
  }

  return `${API_BASE_URL.replace('/api', '')}${url.startsWith('/') ? url : `/${url}`}`;
}
