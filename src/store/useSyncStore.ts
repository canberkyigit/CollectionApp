import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type SyncOperationKind = 'mutation' | 'read';
export type SyncMutationStatus = 'queued' | 'running' | 'failed';

export interface SyncEvent {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface SyncMutation {
  id: string;
  label: string;
  scope: string;
  kind: SyncOperationKind;
  status: SyncMutationStatus;
  attempts: number;
  queuedAt: string;
  lastAttemptAt: string | null;
  lastSettledAt: string | null;
  errorMessage: string | null;
}

interface SyncOperationMeta {
  mutationId?: string;
  scope?: string;
  kind?: SyncOperationKind;
}

interface QueueMutationOptions {
  id: string;
  label: string;
  scope?: string;
}

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  activeOperationCount: number;
  queuedCount: number;
  runningCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  isOnline: boolean;
  recentEvents: SyncEvent[];
  mutations: SyncMutation[];
  startOperation: (label: string, meta?: SyncOperationMeta) => void;
  completeOperation: (label: string, meta?: SyncOperationMeta) => void;
  failOperation: (label: string, error: unknown, meta?: SyncOperationMeta) => void;
  queueMutation: (options: QueueMutationOptions) => void;
  markMutationRunning: (id: string) => void;
  resolveMutation: (id: string, label: string) => void;
  failMutation: (id: string, label: string, error: unknown) => void;
  removeMutation: (id: string) => void;
  pushEvent: (event: Omit<SyncEvent, 'id' | 'timestamp'>) => void;
  setOnlineState: (isOnline: boolean) => void;
  reset: () => void;
}

const MAX_SYNC_EVENTS = 25;

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown sync error';
}

function makeEvent(level: SyncEvent['level'], message: string): SyncEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    timestamp: new Date().toISOString(),
  };
}

function appendEvent(events: SyncEvent[], level: SyncEvent['level'], message: string) {
  return [makeEvent(level, message), ...events].slice(0, MAX_SYNC_EVENTS);
}

function deriveCounts(mutations: SyncMutation[]) {
  const queuedCount = mutations.filter((mutation) => mutation.status === 'queued').length;
  const runningCount = mutations.filter((mutation) => mutation.status === 'running').length;
  const failedCount = mutations.filter((mutation) => mutation.status === 'failed').length;
  return {
    queuedCount,
    runningCount,
    failedCount,
    pendingCount: queuedCount + runningCount + failedCount,
  };
}

function deriveStatus(
  isOnline: boolean,
  counts: ReturnType<typeof deriveCounts>,
  activeOperationCount = 0,
): SyncStatus {
  if (!isOnline) return 'offline';
  if (counts.failedCount > 0) return 'error';
  if (counts.pendingCount + activeOperationCount > 0) return 'syncing';
  return 'idle';
}

function updateMutation(
  mutations: SyncMutation[],
  id: string,
  updater: (mutation: SyncMutation) => SyncMutation,
) {
  return mutations.map((mutation) => mutation.id === id ? updater(mutation) : mutation);
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  activeOperationCount: 0,
  queuedCount: 0,
  runningCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  lastSuccessfulSyncAt: null,
  lastFailureAt: null,
  lastError: null,
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  recentEvents: [],
  mutations: [],

  startOperation: (label, meta) => set((state) => {
    if (meta?.mutationId) {
      return state;
    }
    const activeOperationCount = state.activeOperationCount + 1;
    return {
      activeOperationCount,
      pendingCount: deriveCounts(state.mutations).pendingCount + activeOperationCount,
      status: state.isOnline ? 'syncing' : 'offline',
      recentEvents: appendEvent(state.recentEvents, 'info', `${label} started`),
    };
  }),

  completeOperation: (label, meta) => set((state) => {
    if (meta?.mutationId) {
      return state;
    }
    const activeOperationCount = Math.max(0, state.activeOperationCount - 1);
    const counts = deriveCounts(state.mutations);
    return {
      activeOperationCount,
      pendingCount: counts.pendingCount + activeOperationCount,
      status: deriveStatus(state.isOnline, counts, activeOperationCount),
      lastSyncAt: new Date().toISOString(),
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastError: null,
      recentEvents: appendEvent(state.recentEvents, 'info', `${label} completed`),
    };
  }),

  failOperation: (label, error, meta) => set((state) => {
    if (meta?.mutationId) {
      return state;
    }
    const activeOperationCount = Math.max(0, state.activeOperationCount - 1);
    const counts = deriveCounts(state.mutations);
    return {
      activeOperationCount,
      pendingCount: counts.pendingCount + activeOperationCount,
      status: state.isOnline ? 'error' : 'offline',
      lastError: `${label}: ${toMessage(error)}`,
      lastFailureAt: new Date().toISOString(),
      recentEvents: appendEvent(state.recentEvents, 'error', `${label} failed: ${toMessage(error)}`),
    };
  }),

  queueMutation: ({ id, label, scope = 'unknown' }) => set((state) => {
    const existing = state.mutations.find((mutation) => mutation.id === id);
    const queuedMutation: SyncMutation = {
      id,
      label,
      scope,
      kind: 'mutation',
      status: 'queued',
      attempts: 0,
      queuedAt: new Date().toISOString(),
      lastAttemptAt: null,
      lastSettledAt: null,
      errorMessage: null,
    };
    const nextMutations = existing
      ? updateMutation(state.mutations, id, (mutation) => ({
          ...mutation,
          status: mutation.status === 'running' ? 'running' : 'queued',
        }))
      : [
          queuedMutation,
          ...state.mutations,
        ];
    const counts = deriveCounts(nextMutations);

    return {
      mutations: nextMutations,
      ...counts,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(state.isOnline, counts, state.activeOperationCount),
      recentEvents: appendEvent(state.recentEvents, 'info', `${label} queued`),
    };
  }),

  markMutationRunning: (id) => set((state) => {
    const mutation = state.mutations.find((entry) => entry.id === id);
    if (!mutation) return state;

    const nextMutations = updateMutation(state.mutations, id, (entry) => ({
      ...entry,
      status: 'running',
      attempts: entry.attempts + 1,
      lastAttemptAt: new Date().toISOString(),
      errorMessage: null,
    }));
    const counts = deriveCounts(nextMutations);

    return {
      mutations: nextMutations,
      ...counts,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(state.isOnline, counts, state.activeOperationCount),
      recentEvents: appendEvent(state.recentEvents, 'info', `${mutation.label} started`),
    };
  }),

  resolveMutation: (id, label) => set((state) => {
    const nextMutations = state.mutations.filter((mutation) => mutation.id !== id);
    const counts = deriveCounts(nextMutations);
    const now = new Date().toISOString();

    return {
      mutations: nextMutations,
      ...counts,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(state.isOnline, counts, state.activeOperationCount),
      lastSyncAt: now,
      lastSuccessfulSyncAt: now,
      lastError: counts.failedCount > 0 ? state.lastError : null,
      recentEvents: appendEvent(state.recentEvents, 'info', `${label} completed`),
    };
  }),

  failMutation: (id, label, error) => set((state) => {
    const nextMutations = updateMutation(state.mutations, id, (mutation) => ({
      ...mutation,
      status: 'failed',
      errorMessage: toMessage(error),
      lastSettledAt: new Date().toISOString(),
    }));
    const counts = deriveCounts(nextMutations);
    const now = new Date().toISOString();

    return {
      mutations: nextMutations,
      ...counts,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(state.isOnline, counts, state.activeOperationCount),
      lastError: `${label}: ${toMessage(error)}`,
      lastFailureAt: now,
      recentEvents: appendEvent(state.recentEvents, 'error', `${label} failed: ${toMessage(error)}`),
    };
  }),

  removeMutation: (id) => set((state) => {
    const nextMutations = state.mutations.filter((mutation) => mutation.id !== id);
    const counts = deriveCounts(nextMutations);
    return {
      mutations: nextMutations,
      ...counts,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(state.isOnline, counts, state.activeOperationCount),
    };
  }),

  pushEvent: (event) => set((state) => ({
    recentEvents: appendEvent(state.recentEvents, event.level, event.message),
  })),

  setOnlineState: (isOnline) => set((state) => {
    const counts = deriveCounts(state.mutations);
    return {
      isOnline,
      pendingCount: counts.pendingCount + state.activeOperationCount,
      status: deriveStatus(isOnline, counts, state.activeOperationCount),
      recentEvents: appendEvent(
        state.recentEvents,
        isOnline ? 'info' : 'warn',
        isOnline ? 'Connection restored' : 'Working offline',
      ),
    };
  }),

  reset: () => set({
    status: 'idle',
    pendingCount: 0,
    activeOperationCount: 0,
    queuedCount: 0,
    runningCount: 0,
    failedCount: 0,
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    lastFailureAt: null,
    lastError: null,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
    recentEvents: [],
    mutations: [],
  }),
}));
