import { LayoutTier, resolveLayoutTier } from './LayoutTokens';

export interface ViewportInfo {
    width: number;
    height: number;
    tier: LayoutTier;
    isPortrait: boolean;
    isLandscape: boolean;
}

export function getViewportInfo(width: number, height: number): ViewportInfo {
    const safeW = Math.max(0, Math.floor(width));
    const safeH = Math.max(0, Math.floor(height));
    return {
        width: safeW,
        height: safeH,
        tier: resolveLayoutTier(safeW, safeH),
        isPortrait: safeH > safeW,
        isLandscape: safeW > safeH,
    };
}

