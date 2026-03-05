import { getSafeAreaByTier, resolveLayoutTier } from '../layout/LayoutTokens';

const UI_ROOT_ID = 'ui-root';
const TIER_CLASSES = ['tier-a', 'tier-b', 'tier-c', 'tier-d', 'tier-e'];
const LANG_CLASSES = ['lang-it', 'lang-en'];

function hasDom(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getTierClass(tier: string): string {
    return `tier-${String(tier).toLowerCase()}`;
}

function getLangClass(lang: string): string {
    return `lang-${String(lang).toLowerCase()}`;
}

export function ensureUiRoot(): HTMLElement | null {
    if (!hasDom()) return null;
    let root = document.getElementById(UI_ROOT_ID);
    if (!root) {
        root = document.createElement('div');
        root.id = UI_ROOT_ID;
        root.setAttribute('aria-hidden', 'true');
        document.body.appendChild(root);
    }
    return root as HTMLElement;
}

export function syncUiRootViewport(width?: number, height?: number): void {
    const root = ensureUiRoot();
    if (!root) return;

    const w = Number(width ?? window.innerWidth);
    const h = Number(height ?? window.innerHeight);
    const tier = resolveLayoutTier(w, h);
    const safe = getSafeAreaByTier(tier);

    root.classList.remove(...TIER_CLASSES);
    root.classList.add(getTierClass(tier));
    root.dataset.tier = tier;
    root.style.setProperty('--safe-top', `${safe.top}px`);
    root.style.setProperty('--safe-right', `${safe.right}px`);
    root.style.setProperty('--safe-bottom', `${safe.bottom}px`);
    root.style.setProperty('--safe-left', `${safe.left}px`);
}

export function setUiRootLanguage(lang: string): void {
    const root = ensureUiRoot();
    if (!root) return;
    root.classList.remove(...LANG_CLASSES);
    root.classList.add(getLangClass(lang));
    root.dataset.lang = String(lang).toLowerCase();
}

export function setUiRootScreen(screen: string): void {
    const root = ensureUiRoot();
    if (!root) return;
    root.dataset.screen = String(screen).toLowerCase();
}

export function removeUiRootChildById(id: string): void {
    if (!hasDom()) return;
    const node = document.getElementById(id);
    if (node && node.parentElement) {
        node.parentElement.removeChild(node);
    }
}

