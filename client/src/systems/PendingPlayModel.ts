export interface PendingPlayState {
    handIds: string[];
    tableIds: string[];
    pendingCardId?: string;
}

export type PendingReconcileOutcome = 'none' | 'rollback' | 'accepted';

export function createPendingPlayState(handIds: string[] = []): PendingPlayState {
    return {
        handIds: dedupe(handIds),
        tableIds: [],
        pendingCardId: undefined,
    };
}

export function stashPendingCard(state: PendingPlayState, cardId: string): PendingPlayState {
    const id = String(cardId ?? '').trim();
    if (!id) return cloneState(state);

    const next = cloneState(state);
    next.pendingCardId = id;
    next.handIds = next.handIds.filter((entry) => entry !== id);
    if (!next.tableIds.includes(id)) next.tableIds.push(id);
    return next;
}

export function rollbackPendingCard(state: PendingPlayState): PendingPlayState {
    if (!state.pendingCardId) return cloneState(state);

    const pending = state.pendingCardId;
    const next = cloneState(state);
    next.pendingCardId = undefined;
    next.tableIds = next.tableIds.filter((entry) => entry !== pending);
    if (!next.handIds.includes(pending)) next.handIds.push(pending);
    next.handIds = dedupe(next.handIds);
    return next;
}

export function acceptPendingCard(state: PendingPlayState): PendingPlayState {
    if (!state.pendingCardId) return cloneState(state);

    const pending = state.pendingCardId;
    const next = cloneState(state);
    next.pendingCardId = undefined;
    next.tableIds = next.tableIds.filter((entry) => entry !== pending);
    return next;
}

export function reconcilePendingWithHand(
    state: PendingPlayState,
    authoritativeHandIds: string[],
): { state: PendingPlayState; outcome: PendingReconcileOutcome } {
    const authority = dedupe(authoritativeHandIds);
    if (!state.pendingCardId) {
        const next = cloneState(state);
        next.handIds = authority;
        next.tableIds = next.tableIds.filter((id) => !authority.includes(id));
        return { state: next, outcome: 'none' };
    }

    const pending = state.pendingCardId;
    if (authority.includes(pending)) {
        const rolledBack = rollbackPendingCard(state);
        rolledBack.handIds = authority;
        return { state: rolledBack, outcome: 'rollback' };
    }

    const accepted = acceptPendingCard(state);
    accepted.handIds = authority;
    return { state: accepted, outcome: 'accepted' };
}

function cloneState(state: PendingPlayState): PendingPlayState {
    return {
        handIds: dedupe(state.handIds),
        tableIds: dedupe(state.tableIds),
        pendingCardId: state.pendingCardId,
    };
}

function dedupe(list: string[]): string[] {
    const out: string[] = [];
    list.forEach((entry) => {
        const id = String(entry ?? '').trim();
        if (!id || out.includes(id)) return;
        out.push(id);
    });
    return out;
}
