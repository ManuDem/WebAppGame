export interface CardRegistryRef<T> {
    ref: T;
    id: string;
    active: boolean;
}

export interface CardRegistryPlan<T> {
    destroyRefs: T[];
}

function normalizeCardId(raw: string): string {
    return String(raw ?? '').trim();
}

export function buildCardRegistryPlan<T>(
    prioritized: CardRegistryRef<T>[],
    liveRefs: CardRegistryRef<T>[],
): CardRegistryPlan<T> {
    const allowed = new Set<T>(prioritized.map((entry) => entry.ref));
    const keepById = new Map<string, T>();

    prioritized.forEach((entry) => {
        const id = normalizeCardId(entry.id);
        if (!id || keepById.has(id)) return;
        keepById.set(id, entry.ref);
    });

    const destroyRefs: T[] = [];

    liveRefs.forEach((entry) => {
        if (!entry.active) return;
        const id = normalizeCardId(entry.id);
        if (id && keepById.has(id) && keepById.get(id) !== entry.ref) {
            destroyRefs.push(entry.ref);
            return;
        }
        if (!allowed.has(entry.ref)) {
            destroyRefs.push(entry.ref);
        }
    });

    return { destroyRefs };
}
