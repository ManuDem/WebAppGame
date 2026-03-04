import Phaser from 'phaser';
import { ICardData } from '../../../shared/SharedTypes';

export interface CardArtworkManifestEntry {
    templateId: string;
    file: string;
}

const CARD_ART_BASE_PATH = '/cards';
const CARD_ART_TEXTURE_PREFIX = 'card-art-';

// Add real PNG mappings here as assets are produced, for example:
// { templateId: 'emp_01', file: 'emp_01.png' }
const CARD_ARTWORK_MANIFEST: CardArtworkManifestEntry[] = [];

const manifestPathById = new Map<string, string>();
const requestedTextureKeys = new Set<string>();
const pendingCallbacks = new Map<string, Array<(textureKey: string) => void>>();

function applyNearestFilter(scene: Phaser.Scene, textureKey: string) {
    if (!scene.textures.exists(textureKey)) return;
    const texture = scene.textures.get(textureKey);
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function normalizeArtworkId(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/\.png$/i, '')
        .replace(/[^a-z0-9_-]/g, '_');
}

function normalizeFilePath(file: string, normalizedId: string): string {
    const trimmed = file.trim();
    if (!trimmed) return `${CARD_ART_BASE_PATH}/${normalizedId}.png`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return `${CARD_ART_BASE_PATH}/${trimmed.replace(/^\/+/, '')}`;
}

function ensureManifestIndex() {
    if (manifestPathById.size > 0 || CARD_ARTWORK_MANIFEST.length === 0) return;
    for (const entry of CARD_ARTWORK_MANIFEST) {
        const normalizedId = normalizeArtworkId(entry.templateId);
        if (!normalizedId) continue;
        manifestPathById.set(normalizedId, normalizeFilePath(entry.file, normalizedId));
    }
}

function getCardAny(card: ICardData): Record<string, unknown> {
    return card as unknown as Record<string, unknown>;
}

function extractCardArtworkIds(card: ICardData): string[] {
    const anyCard = getCardAny(card);
    const rawCandidates = [
        anyCard.artworkKey,
        anyCard.artworkId,
        anyCard.artKey,
        card.templateId,
    ];

    const unique = new Set<string>();
    for (const candidate of rawCandidates) {
        if (typeof candidate !== 'string') continue;
        const normalized = normalizeArtworkId(candidate);
        if (normalized) unique.add(normalized);
    }
    return [...unique];
}

export function getCardArtworkTextureKey(artworkId: string): string {
    return `${CARD_ART_TEXTURE_PREFIX}${normalizeArtworkId(artworkId)}`;
}

function getArtworkPathForId(artworkId: string): string {
    ensureManifestIndex();
    const normalizedId = normalizeArtworkId(artworkId);
    const fromManifest = manifestPathById.get(normalizedId);
    if (fromManifest) return fromManifest;
    return `${CARD_ART_BASE_PATH}/${normalizedId}.png`;
}

function enqueueCallback(textureKey: string, cb: (textureKey: string) => void) {
    const list = pendingCallbacks.get(textureKey) ?? [];
    list.push(cb);
    pendingCallbacks.set(textureKey, list);
}

function flushCallbacks(textureKey: string, success: boolean) {
    const list = pendingCallbacks.get(textureKey);
    pendingCallbacks.delete(textureKey);
    if (!list || !success) return;
    list.forEach((cb) => cb(textureKey));
}

export function preloadCardArtworkManifest(scene: Phaser.Scene): void {
    ensureManifestIndex();
    for (const [artworkId, filePath] of manifestPathById.entries()) {
        const textureKey = getCardArtworkTextureKey(artworkId);
        if (scene.textures.exists(textureKey)) {
            applyNearestFilter(scene, textureKey);
        } else {
            scene.load.image(textureKey, filePath);
        }
    }
}

export function resolveCardArtworkTexture(scene: Phaser.Scene, card: ICardData): string | undefined {
    const anyCard = getCardAny(card);
    const textureCandidate = typeof anyCard.textureKey === 'string' ? anyCard.textureKey : undefined;
    if (textureCandidate && scene.textures.exists(textureCandidate)) {
        applyNearestFilter(scene, textureCandidate);
        return textureCandidate;
    }

    const candidates = extractCardArtworkIds(card);
    for (const candidate of candidates) {
        const textureKey = getCardArtworkTextureKey(candidate);
        if (scene.textures.exists(textureKey)) {
            applyNearestFilter(scene, textureKey);
            return textureKey;
        }
        if (scene.textures.exists(candidate)) {
            applyNearestFilter(scene, candidate);
            return candidate;
        }
    }
    return undefined;
}

export function requestCardArtwork(
    scene: Phaser.Scene,
    card: ICardData,
    onLoaded?: (textureKey: string) => void,
): void {
    const existing = resolveCardArtworkTexture(scene, card);
    if (existing) {
        if (onLoaded) onLoaded(existing);
        return;
    }

    const ids = extractCardArtworkIds(card);
    const preferredId = ids[0];
    if (!preferredId) return;

    const textureKey = getCardArtworkTextureKey(preferredId);
    if (onLoaded) enqueueCallback(textureKey, onLoaded);

    if (scene.textures.exists(textureKey)) {
        flushCallbacks(textureKey, true);
        return;
    }

    if (requestedTextureKeys.has(textureKey)) return;
    requestedTextureKeys.add(textureKey);

    const onComplete = () => {
        scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
        applyNearestFilter(scene, textureKey);
        flushCallbacks(textureKey, true);
    };
    const onFileError = (file: Phaser.Loader.File) => {
        if (file.key !== textureKey) return;
        scene.load.off(`filecomplete-image-${textureKey}`, onComplete);
        scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
        flushCallbacks(textureKey, false);
    };

    scene.load.once(`filecomplete-image-${textureKey}`, onComplete);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    scene.load.image(textureKey, getArtworkPathForId(preferredId));
    if (!scene.load.isLoading()) scene.load.start();
}
