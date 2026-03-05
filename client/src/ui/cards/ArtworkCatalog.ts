export interface ArtworkManifestEntry {
    templateId: string;
    file: string;
}

export const CARD_ARTWORK_ALIAS_BY_TEMPLATE: Record<string, string> = {
    // Keep explicit aliases only for legacy files that are NOT named <templateId>.png.
};

export function normalizeArtworkId(raw: string): string {
    return String(raw ?? '')
        .trim()
        .toLowerCase()
        .replace(/\.png$/i, '')
        .replace(/[^a-z0-9_-]/g, '_');
}

export function normalizeArtworkFilePath(file: string, normalizedId: string, basePath = '/cards'): string {
    const trimmed = String(file ?? '').trim();
    if (!trimmed) return `${basePath}/${normalizedId}.png`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return `${basePath}/${trimmed.replace(/^\/+/, '')}`;
}

export function buildArtworkPathIndex(
    manifest: ArtworkManifestEntry[],
    basePath = '/cards',
): Map<string, string> {
    const out = new Map<string, string>();

    for (const [templateId, fileName] of Object.entries(CARD_ARTWORK_ALIAS_BY_TEMPLATE)) {
        const normalizedId = normalizeArtworkId(templateId);
        if (!normalizedId) continue;
        out.set(normalizedId, normalizeArtworkFilePath(fileName, normalizedId, basePath));
    }

    manifest.forEach((entry) => {
        const normalizedId = normalizeArtworkId(entry.templateId);
        if (!normalizedId) return;
        out.set(normalizedId, normalizeArtworkFilePath(entry.file, normalizedId, basePath));
    });

    return out;
}
