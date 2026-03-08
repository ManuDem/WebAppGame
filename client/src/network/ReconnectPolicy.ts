export const RECONNECT_STORAGE_KEY = 'lucrare_reconnect_ctx_v1';
export const RECONNECT_MAX_WINDOW_MS = 30_000;
export const RECONNECT_ALLOWED_AGE_MS = 30_000;
export const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 3000, 5000] as const;

export interface PersistedReconnectContext {
    roomId?: string;
    sessionId?: string;
    reconnectToken?: string;
    ceoName: string;
    roomCode: string;
    updatedAt: number;
}

type ReconnectStorageReader = Pick<Storage, 'getItem'>;

export function getReconnectDelayMs(attempt: number): number {
    if (!Number.isFinite(attempt) || attempt <= 1) {
        return RECONNECT_BACKOFF_MS[0];
    }
    const idx = Math.min(RECONNECT_BACKOFF_MS.length - 1, Math.floor(attempt) - 1);
    return RECONNECT_BACKOFF_MS[idx];
}

export function isReconnectContextFresh(
    snapshot: PersistedReconnectContext | null | undefined,
    nowMs: number = Date.now(),
    allowedAgeMs: number = RECONNECT_ALLOWED_AGE_MS,
): boolean {
    if (!snapshot) return false;
    if (!snapshot.ceoName || !snapshot.roomCode) return false;
    if (!Number.isFinite(snapshot.updatedAt) || snapshot.updatedAt <= 0) return false;
    const ageMs = Math.max(0, nowMs - snapshot.updatedAt);
    return ageMs <= allowedAgeMs;
}

export function parseReconnectContext(raw: string | null | undefined): PersistedReconnectContext | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<PersistedReconnectContext> | null;
        if (!parsed || typeof parsed !== 'object') return null;

        const ceoName = String(parsed.ceoName ?? '').trim();
        const roomCode = String(parsed.roomCode ?? '').trim();
        const updatedAt = Number(parsed.updatedAt ?? 0);
        if (!ceoName || !roomCode) return null;
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;

        const snapshot: PersistedReconnectContext = {
            ceoName,
            roomCode,
            updatedAt,
        };

        if (typeof parsed.roomId === 'string') snapshot.roomId = parsed.roomId.trim();
        if (typeof parsed.sessionId === 'string') snapshot.sessionId = parsed.sessionId.trim();
        if (typeof parsed.reconnectToken === 'string') snapshot.reconnectToken = parsed.reconnectToken.trim();
        return snapshot;
    } catch {
        return null;
    }
}

export function readReconnectContext(storage: ReconnectStorageReader | null | undefined): PersistedReconnectContext | null {
    if (!storage) return null;
    try {
        return parseReconnectContext(storage.getItem(RECONNECT_STORAGE_KEY));
    } catch {
        return null;
    }
}

export function readFreshReconnectContext(
    storage: ReconnectStorageReader | null | undefined,
    nowMs: number = Date.now(),
    allowedAgeMs: number = RECONNECT_ALLOWED_AGE_MS,
): PersistedReconnectContext | null {
    const snapshot = readReconnectContext(storage);
    return isReconnectContextFresh(snapshot, nowMs, allowedAgeMs) ? snapshot : null;
}
