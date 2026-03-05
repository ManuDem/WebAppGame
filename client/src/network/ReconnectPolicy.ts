export const RECONNECT_STORAGE_KEY = 'lucrare_reconnect_ctx_v1';
export const RECONNECT_MAX_WINDOW_MS = 25_000;
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
