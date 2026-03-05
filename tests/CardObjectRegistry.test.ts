import { buildCardRegistryPlan } from '../client/src/systems/CardObjectRegistry';

type Ref = { key: string };

function makeRef(key: string): Ref {
    return { key };
}

describe('CardObjectRegistry', () => {
    test('rimuove oggetti orfani non presenti nei gruppi validi', () => {
        const keepA = makeRef('keep-a');
        const keepB = makeRef('keep-b');
        const orphan = makeRef('orphan');

        const plan = buildCardRegistryPlan(
            [
                { ref: keepA, id: 'c1', active: true },
                { ref: keepB, id: 'c2', active: true },
            ],
            [
                { ref: keepA, id: 'c1', active: true },
                { ref: keepB, id: 'c2', active: true },
                { ref: orphan, id: 'c3', active: true },
            ],
        );

        expect(plan.destroyRefs).toEqual([orphan]);
    });

    test('in presenza di duplicati mantiene solo il primo riferimento prioritario', () => {
        const keep = makeRef('keep');
        const dup = makeRef('dup');

        const plan = buildCardRegistryPlan(
            [{ ref: keep, id: 'x1', active: true }],
            [
                { ref: keep, id: 'x1', active: true },
                { ref: dup, id: 'x1', active: true },
            ],
        );

        expect(plan.destroyRefs).toEqual([dup]);
    });
});
