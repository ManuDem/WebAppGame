import {
    acceptPendingCard,
    createPendingPlayState,
    reconcilePendingWithHand,
    rollbackPendingCard,
    stashPendingCard,
} from '../client/src/systems/PendingPlayModel';

describe('PendingPlayModel', () => {
    test('stash -> ERROR rollback: card torna in hand senza orfani o duplicati', () => {
        const initial = createPendingPlayState(['c1', 'c2', 'c3']);
        const stashed = stashPendingCard(initial, 'c2');
        expect(stashed.pendingCardId).toBe('c2');
        expect(stashed.handIds).toEqual(['c1', 'c3']);
        expect(stashed.tableIds).toEqual(['c2']);

        const rolledBack = rollbackPendingCard(stashed);
        expect(rolledBack.pendingCardId).toBeUndefined();
        expect(rolledBack.tableIds).toEqual([]);
        expect(rolledBack.handIds.sort()).toEqual(['c1', 'c2', 'c3']);
    });

    test('stash -> state accepted: pending pulito e carta non in hand', () => {
        const initial = createPendingPlayState(['c1', 'c2']);
        const stashed = stashPendingCard(initial, 'c2');
        const reconciled = reconcilePendingWithHand(stashed, ['c1']);
        expect(reconciled.outcome).toBe('accepted');
        expect(reconciled.state.pendingCardId).toBeUndefined();
        expect(reconciled.state.tableIds).toEqual([]);
        expect(reconciled.state.handIds).toEqual(['c1']);
    });

    test('reconcile rollback quando pending card e ancora in hand autorevole', () => {
        const initial = createPendingPlayState(['a', 'b']);
        const stashed = stashPendingCard(initial, 'b');
        const reconciled = reconcilePendingWithHand(stashed, ['a', 'b']);
        expect(reconciled.outcome).toBe('rollback');
        expect(reconciled.state.pendingCardId).toBeUndefined();
        expect(reconciled.state.tableIds).toEqual([]);
        expect(reconciled.state.handIds.sort()).toEqual(['a', 'b']);
    });

    test('accept explicit non lascia residui su tavolo', () => {
        const initial = createPendingPlayState(['x', 'y']);
        const stashed = stashPendingCard(initial, 'x');
        const accepted = acceptPendingCard(stashed);
        expect(accepted.pendingCardId).toBeUndefined();
        expect(accepted.tableIds).toEqual([]);
        expect(accepted.handIds).toEqual(['y']);
    });

    test('stash multipli dello stesso id non creano duplicati', () => {
        const initial = createPendingPlayState(['a', 'b', 'c']);
        const stashed1 = stashPendingCard(initial, 'b');
        const stashed2 = stashPendingCard(stashed1, 'b');
        expect(stashed2.pendingCardId).toBe('b');
        expect(stashed2.tableIds).toEqual(['b']);
        expect(stashed2.handIds.sort()).toEqual(['a', 'c']);
    });

    test('reconcile senza pending sincronizza hand e pulisce tableIds', () => {
        const initial = createPendingPlayState(['x', 'y']);
        const stashed = stashPendingCard(initial, 'x');
        const accepted = acceptPendingCard(stashed);
        const reconciled = reconcilePendingWithHand(accepted, ['p1', 'p2']);
        expect(reconciled.outcome).toBe('none');
        expect(reconciled.state.pendingCardId).toBeUndefined();
        expect(reconciled.state.handIds).toEqual(['p1', 'p2']);
        expect(reconciled.state.tableIds).toEqual([]);
    });
});
