import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_ERROR_SIGNATURES = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "chunkloaderror",
  "loading chunk",
  "css_chunk_load_failed",
];

const CHUNK_RECOVERY_STORAGE_PREFIX = "nexusops:chunk-recovery";
const CHUNK_RECOVERY_TTL_MS = 10 * 60 * 1000;

type LazyRetryOptions = {
  id: string;
  retryCount?: number;
  retryDelayMs?: number;
};

// Route chunks include components with many different prop shapes, so the helper keeps the component alias broad.
type RouteComponent = ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.location !== "undefined";
}

function getRecoveryStorageKey(id: string): string {
  return `${CHUNK_RECOVERY_STORAGE_PREFIX}:${id}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function readRecoveryTimestamp(id: string): number | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(getRecoveryStorageKey(id));
    if (!raw) return null;

    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return null;
    return timestamp;
  } catch {
    return null;
  }
}

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";

  const normalizedMessage = message.toLowerCase();
  return CHUNK_ERROR_SIGNATURES.some((signature) => normalizedMessage.includes(signature));
}

export function createCacheBustedUrl(reason = "chunk-load"): string {
  if (!isBrowser()) {
    return "/";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("__nexusops_refresh", `${Date.now()}`);
  url.searchParams.set("__nexusops_refresh_reason", reason);
  return url.toString();
}

export function hasRecentChunkRecoveryAttempt(id: string): boolean {
  const timestamp = readRecoveryTimestamp(id);
  if (!timestamp) return false;

  const isExpired = Date.now() - timestamp > CHUNK_RECOVERY_TTL_MS;
  if (isExpired) {
    clearChunkRecoveryAttempt(id);
    return false;
  }

  return true;
}

export function markChunkRecoveryAttempt(id: string): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.setItem(getRecoveryStorageKey(id), `${Date.now()}`);
  } catch {
    // Session storage can be blocked in privacy modes; the recovery still works without it.
  }
}

export function clearChunkRecoveryAttempt(id: string): void {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(getRecoveryStorageKey(id));
  } catch {
    // Ignore storage failures; this is just a best-effort recovery marker.
  }
}

export async function loadChunkWithRetry<T extends RouteComponent>(
  importer: () => Promise<{ default: T }>,
  options: LazyRetryOptions,
): Promise<{ default: T }> {
  const { id, retryCount = 1, retryDelayMs = 150 } = options;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const module = await importer();
      clearChunkRecoveryAttempt(id);
      return module;
    } catch (error) {
      lastError = error;

      if (!isChunkLoadError(error) || attempt === retryCount) {
        break;
      }

      await wait(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

export function lazyWithRetry<T extends RouteComponent>(
  importer: () => Promise<{ default: T }>,
  options: LazyRetryOptions,
): LazyExoticComponent<T> {
  return lazy(() => loadChunkWithRetry(importer, options));
}
