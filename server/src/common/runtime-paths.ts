import { accessSync, constants, mkdirSync } from 'fs';
import { basename, dirname, isAbsolute, resolve } from 'path';
import { tmpdir } from 'os';

const DEFAULT_APP_ROOT = resolve(__dirname, '..', '..');
const appRootFromEnv = process.env.APP_ROOT?.trim();

export const APP_ROOT = appRootFromEnv
  ? isAbsolute(appRootFromEnv)
    ? appRootFromEnv
    : resolve(DEFAULT_APP_ROOT, appRootFromEnv)
  : DEFAULT_APP_ROOT;

function resolveFromAppRoot(
  envValue: string | undefined,
  fallbackRelativePath: string,
) {
  const value = envValue?.trim() || fallbackRelativePath;
  return isAbsolute(value) ? value : resolve(APP_ROOT, value);
}

function ensureWritableDir(path: string, fallbackName: string) {
  try {
    mkdirSync(path, { recursive: true });
    accessSync(path, constants.W_OK);
    return path;
  } catch {
    const fallback = resolve(tmpdir(), 'quickik-runtime', fallbackName);
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const requestedUploadsDir = resolveFromAppRoot(process.env.UPLOAD_DIR, 'uploads');
const requestedDbPath = resolveFromAppRoot(process.env.DB_PATH, 'data/qik-anime.db');

export const UPLOAD_DIR_ABSOLUTE = ensureWritableDir(requestedUploadsDir, 'uploads');

const dbDir = ensureWritableDir(dirname(requestedDbPath), 'db');
export const DB_PATH = resolve(dbDir, basename(requestedDbPath));
