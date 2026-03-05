import Phaser from 'phaser';
import { ICardData } from '../../../shared/SharedTypes';
import {
    ArtworkManifestEntry,
    buildArtworkPathIndex,
    normalizeArtworkId,
} from './cards/ArtworkCatalog';

const CARD_ART_BASE_PATH = '/cards';
const CARD_ART_TEXTURE_PREFIX = 'card-art-';
const CARD_ARTWORK_MANIFEST: ArtworkManifestEntry[] = [
    { templateId: 'emp_01', file: 'emp_01.png' },
    { templateId: 'emp_07', file: 'emp_07.png' },
];

const manifestPathById = new Map<string, string>();
const requestedTextureKeys = new Set<string>();
const pendingCallbacks = new Map<string, Array<(textureKey: string) => void>>();

function applyNearestFilter(scene: Phaser.Scene, textureKey: string) {
    if (!scene.textures.exists(textureKey)) return;
    const texture = scene.textures.get(textureKey);
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensureManifestIndex() {
    if (manifestPathById.size > 0) return;
    const index = buildArtworkPathIndex(CARD_ARTWORK_MANIFEST, CARD_ART_BASE_PATH);
    index.forEach((path, id) => manifestPathById.set(id, path));
}

function getTemplateArtworkId(card: ICardData): string {
    return normalizeArtworkId(String(card?.templateId ?? ''));
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
    const artworkId = getTemplateArtworkId(card);
    if (!artworkId) return undefined;

    const textureKey = getCardArtworkTextureKey(artworkId);
    if (scene.textures.exists(textureKey)) {
        applyNearestFilter(scene, textureKey);
        return textureKey;
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

    const preferredId = getTemplateArtworkId(card);
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
