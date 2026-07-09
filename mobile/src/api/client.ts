import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY, UID_KEY, QIK_API_BASE, QIK_BACKEND_ORIGIN } from './config';

export function uploadUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${QIK_BACKEND_ORIGIN}${path}`;
}

export function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null, uid?: number | null) {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    if (uid != null) await AsyncStorage.setItem(UID_KEY, String(uid));
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(UID_KEY);
  }
}

export async function getStoredUid(): Promise<number | null> {
  const v = await AsyncStorage.getItem(UID_KEY);
  return v ? Number(v) : null;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function request<T = any>(
  path: string,
  { method = 'GET', body, auth = false, headers = {} }: RequestOptions = {},
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (auth) {
    const t = await getToken();
    if (t) finalHeaders.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${QIK_API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join('. ')
      : data?.message || `Ошибка ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

// Multipart upload helper (RN FormData with {uri,name,type}).
export async function uploadMultipart(
  path: string,
  file: { uri: string; name?: string; type?: string },
): Promise<any> {
  const t = await getToken();
  const name = file.name || `upload-${Date.now()}.jpg`;
  const type = file.type || 'image/jpeg';
  const fd = new FormData();
  // @ts-ignore — RN FormData accepts the uri shape
  fd.append('file', { uri: file.uri, name, type } as any);

  const res = await fetch(`${QIK_API_BASE}${path}`, {
    method: 'POST',
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join('. ')
      : data?.message || `Ошибка ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
