import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
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

// Multipart upload via expo-file-system uploadAsync.
export async function uploadMultipart(
  path: string,
  file: { uri: string; name?: string; type?: string },
): Promise<any> {
  const t = await getToken();
  const result = await FileSystem.uploadAsync(
    `${QIK_API_BASE}${path}`,
    file.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.type || 'image/jpeg',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    },
  );

  if (result.status < 200 || result.status >= 300) {
    let msg = `Ошибка ${result.status}`;
    try {
      const parsed = JSON.parse(result.body);
      msg = Array.isArray(parsed?.message) ? parsed.message.join('. ') : (parsed?.message || msg);
    } catch {}
    const err: any = new Error(msg);
    err.status = result.status;
    throw err;
  }

  try { return JSON.parse(result.body); } catch { return result.body; }
}
