import { useSyncStore } from '@/store/useSyncStore';

export interface LoggerEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  timestamp: string;
  context?: string;
}

const STORAGE_KEY = 'collectvault-observability-log';
const MAX_LOG_ENTRIES = 100;

function serializeContext(context?: unknown): string | undefined {
  if (context === undefined) return undefined;
  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function persist(entry: LoggerEntry) {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as LoggerEntry[]) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_LOG_ENTRIES)));
  } catch {
    // Ignore persistence failures
  }
}

function record(level: LoggerEntry['level'], scope: string, message: string, context?: unknown) {
  const entry: LoggerEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    scope,
    message,
    timestamp: new Date().toISOString(),
    context: serializeContext(context),
  };

  persist(entry);
  useSyncStore.getState().pushEvent({
    level,
    message: `[${scope}] ${message}`,
  });

  const payload = context === undefined ? [] : [context];
  if (level === 'error') {
    console.error(`[${scope}] ${message}`, ...payload);
    return;
  }
  if (level === 'warn') {
    console.warn(`[${scope}] ${message}`, ...payload);
    return;
  }
  console.info(`[${scope}] ${message}`, ...payload);
}

export const logger = {
  info(scope: string, message: string, context?: unknown) {
    record('info', scope, message, context);
  },

  warn(scope: string, message: string, context?: unknown) {
    record('warn', scope, message, context);
  },

  error(scope: string, error: unknown, context?: unknown) {
    record('error', scope, toErrorMessage(error), context);
  },

  getEntries(): LoggerEntry[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LoggerEntry[]) : [];
    } catch {
      return [];
    }
  },
};
