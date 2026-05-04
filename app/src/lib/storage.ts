export type StorageScope = 'local' | 'session';

function getStorage(scope: StorageScope): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return scope === 'local' ? window.localStorage : window.sessionStorage;
  } catch (error) {
    const storageName = scope === 'local' ? 'localStorage' : 'sessionStorage';
    console.warn(`Failed to access ${storageName}.`, error);
    return null;
  }
}

export function safeGetItem(key: string, scope: StorageScope = 'local'): string | null {
  const storage = getStorage(scope);
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch (error) {
    const storageName = scope === 'local' ? 'localStorage' : 'sessionStorage';
    console.warn(`Failed to read ${storageName} key "${key}".`, error);
    return null;
  }
}

export function safeGetItemFromScopes(
  key: string,
  scopes: readonly StorageScope[] = ['local', 'session'],
): string | null {
  for (const scope of scopes) {
    const value = safeGetItem(key, scope);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function safeParseJSON<T>(key: string, fallback: T, scope: StorageScope = 'local'): T {
  const raw = safeGetItem(key, scope);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const storageName = scope === 'local' ? 'localStorage' : 'sessionStorage';
    console.warn(`Failed to parse ${storageName} JSON for key "${key}".`, error);
    return fallback;
  }
}

export function safeParseJSONFromScopes<T>(
  key: string,
  fallback: T,
  scopes: readonly StorageScope[] = ['local', 'session'],
): T {
  const raw = safeGetItemFromScopes(key, scopes);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse browser storage JSON for key "${key}".`, error);
    return fallback;
  }
}

export function safeSetItem(key: string, value: string, scope: StorageScope = 'local'): void {
  const storage = getStorage(scope);
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, value);
  } catch (error) {
    const storageName = scope === 'local' ? 'localStorage' : 'sessionStorage';
    console.warn(`Failed to write ${storageName} key "${key}".`, error);
  }
}

export function safeRemoveItem(key: string, scope: StorageScope = 'local'): void {
  const storage = getStorage(scope);
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch (error) {
    const storageName = scope === 'local' ? 'localStorage' : 'sessionStorage';
    console.warn(`Failed to remove ${storageName} key "${key}".`, error);
  }
}

export function safeRemoveItemFromScopes(
  key: string,
  scopes: readonly StorageScope[] = ['local', 'session'],
): void {
  for (const scope of scopes) {
    safeRemoveItem(key, scope);
  }
}
