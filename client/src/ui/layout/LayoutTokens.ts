export type LayoutTier = 'A' | 'B' | 'C' | 'D' | 'E';

export interface SafeArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface ButtonContract {
    primaryHeight: number;
    secondaryHeight: number;
    minHitTarget: number;
}

export interface TypographyContract {
    uiMin: number;
    panelTitleMin: number;
    panelTitleMax: number;
    ctaMin: number;
    ctaMax: number;
}

export interface MenuTypographyContract {
    caption: number;
    body: number;
    label: number;
    button: number;
    sectionTitle: number;
    roomCode: number;
    input: number;
}

export function resolveLayoutTier(width: number, height: number): LayoutTier {
    const portrait = height > width;
    const aspect = portrait ? (height / Math.max(1, width)) : (width / Math.max(1, height));
    if (portrait && width <= 390) return 'A';
    if (portrait && width >= 391 && width <= 600 && aspect >= 1.35) return 'B';
    if (height <= 430 && width >= 720) return 'C';
    if (width >= 431 && width <= 900 && height >= width) return 'D';
    return 'E';
}

export function getSafeAreaByTier(tier: LayoutTier): SafeArea {
    if (tier === 'A' || tier === 'B') {
        return { top: 12, right: 12, bottom: 12, left: 12 };
    }
    if (tier === 'C') {
        return { top: 8, right: 10, bottom: 8, left: 10 };
    }
    return { top: 16, right: 16, bottom: 16, left: 16 };
}

export function getButtonContractByTier(tier: LayoutTier): ButtonContract {
    if (tier === 'A' || tier === 'B') {
        return { primaryHeight: 50, secondaryHeight: 42, minHitTarget: 44 };
    }
    if (tier === 'C') {
        return { primaryHeight: 44, secondaryHeight: 40, minHitTarget: 44 };
    }
    return { primaryHeight: 48, secondaryHeight: 40, minHitTarget: 44 };
}

export function getTypographyContractByTier(tier: LayoutTier): TypographyContract {
    if (tier === 'C') {
        return {
            uiMin: 11,
            panelTitleMin: 13,
            panelTitleMax: 15,
            ctaMin: 13,
            ctaMax: 13,
        };
    }
    if (tier === 'A' || tier === 'B') {
        return {
            uiMin: 12,
            panelTitleMin: 14,
            panelTitleMax: 16,
            ctaMin: 14,
            ctaMax: 14,
        };
    }
    return {
        uiMin: 12,
        panelTitleMin: 14,
        panelTitleMax: 16,
        ctaMin: 14,
        ctaMax: 15,
    };
}

export function getMenuTypographyByTier(tier: LayoutTier): MenuTypographyContract {
    if (tier === 'C') {
        return {
            caption: 12,
            body: 13,
            label: 13,
            button: 15,
            sectionTitle: 15,
            roomCode: 23,
            input: 16,
        };
    }
    if (tier === 'A' || tier === 'B') {
        return {
            caption: 12,
            body: 13,
            label: 14,
            button: 16,
            sectionTitle: 16,
            roomCode: 26,
            input: 17,
        };
    }
    return {
        caption: 13,
        body: 14,
        label: 15,
        button: 16,
        sectionTitle: 17,
        roomCode: 28,
        input: 18,
    };
}

export function clampToSafeArea(
    value: { x: number; y: number; w: number; h: number },
    screenW: number,
    screenH: number,
    safe: SafeArea,
) {
    const x = Math.max(safe.left, Math.min(value.x, screenW - safe.right));
    const y = Math.max(safe.top, Math.min(value.y, screenH - safe.bottom));
    const maxW = Math.max(0, screenW - safe.left - safe.right - (x - safe.left));
    const maxH = Math.max(0, screenH - safe.top - safe.bottom - (y - safe.top));
    return {
        x,
        y,
        w: Math.max(0, Math.min(value.w, maxW)),
        h: Math.max(0, Math.min(value.h, maxH)),
    };
}
