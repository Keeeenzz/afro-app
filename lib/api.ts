const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');

// A physical device cannot reach its development machine through localhost.
// Keep the host entirely environment-driven: development builds must define
// EXPO_PUBLIC_API_BASE_URL to a LAN hostname/IP or a tunnel URL.
export const API_BASE_URL = configuredBaseUrl ?? '';

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('The app server address is not configured. Set EXPO_PUBLIC_API_BASE_URL and reload the app.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || /timed out/i.test(error.message))) {
      throw new Error('The server took too long to respond. Check your connection and try again.');
    }
    throw new Error('Could not reach A\'FRO. Check that the app server is running and your phone can reach it.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null) as Record<string, unknown> | null;
    throw new ApiError(
      typeof error?.message === 'string' ? error.message : `API request failed: ${response.status}`,
      response.status,
      error,
    );
  }

  return response.json();
}

export function apiGet<T>(path: string, token?: string | null, signal?: AbortSignal) {
  return apiRequest<T>(path, { token, signal });
}

export function apiPost<T>(path: string, body: unknown, token?: string | null, signal?: AbortSignal) {
  return apiRequest<T>(path, { method: 'POST', body, token, signal });
}

export function apiPatch<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: 'PATCH', body, token });
}

export function apiDelete<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: 'DELETE', body, token });
}

export async function apiPostForm<T>(path: string, form: FormData, token?: string | null): Promise<T> {
  if (!API_BASE_URL) {
    return Promise.reject(new Error('The app server address is not configured. Set EXPO_PUBLIC_API_BASE_URL and reload the app.'));
  }
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open('POST', `${API_BASE_URL}${path}`);
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.onload = () => {
      let data: Record<string, unknown> | T | null = null;

      try {
        data = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        reject(new Error(`API request returned non-JSON response: ${request.responseText.slice(0, 120)}`));
        return;
      }

      if (request.status < 200 || request.status >= 300) {
        const error = data as Record<string, unknown> | null;
        reject(new ApiError(
          typeof error?.message === 'string' ? error.message : `API request failed: ${request.status}`,
          request.status,
          error,
        ));
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
