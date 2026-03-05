import { LayoutTier, getButtonContractByTier, getSafeAreaByTier, resolveLayoutTier } from './LayoutTokens';

export interface BrandHeaderContract {
    tier: LayoutTier;
    titleFontSize: number;
    subtitleFontSize: number;
    titleY: number;
    subtitleY: number;
    headerBottomY: number;
    headerGap: number;
}

type BrandValues = {
    titleFontSize: number;
    subtitleFontSize: number;
    titleY: number;
    subtitleY: number;
    headerBottomY: number;
};

const BRAND_BY_TIER: Record<LayoutTier, BrandValues> = {
    A: {
        titleFontSize: 52,
        subtitleFontSize: 17,
        titleY: 72,
        subtitleY: 112,
        headerBottomY: 142,
    },
    B: {
        titleFontSize: 56,
        subtitleFontSize: 18,
        titleY: 76,
        subtitleY: 118,
        headerBottomY: 148,
    },
    C: {
        titleFontSize: 40,
        subtitleFontSize: 14,
        titleY: 56,
        subtitleY: 84,
        headerBottomY: 108,
    },
    D: {
        titleFontSize: 66,
        subtitleFontSize: 20,
        titleY: 82,
        subtitleY: 124,
        headerBottomY: 156,
    },
    E: {
        titleFontSize: 74,
        subtitleFontSize: 21,
        titleY: 80,
        subtitleY: 122,
        headerBottomY: 156,
    },
};

export interface LoginPanelTokens {
    panelWidthPx: number;
    panelMaxHeightPx?: number;
    panelPaddingX: number;
    panelPaddingY: number;
    sectionGap: number;
    rowGap: number;
    inputHeight: number;
    primaryButtonHeight: number;
    segmentedButtonHeight: number;
    contentWidth: number;
}

export interface InitialScreenLayout {
    tier: LayoutTier;
    safe: { top: number; right: number; bottom: number; left: number };
    header: BrandHeaderContract;
    panel: { x: number; y: number; w: number; h: number };
    loginTokens: LoginPanelTokens;
}

type LoginTokenBase = {
    widthVw: number;
    maxWidth: number;
    maxHeight?: number;
    panelPaddingX: number;
    panelPaddingY: number;
    sectionGap: number;
    rowGap: number;
    inputHeight: number;
};

const LOGIN_BASE_BY_TIER: Record<LayoutTier, LoginTokenBase> = {
    A: {
        widthVw: 0.92,
        maxWidth: 500,
        panelPaddingX: 18,
        panelPaddingY: 16,
        sectionGap: 14,
        rowGap: 10,
        inputHeight: 46,
    },
    B: {
        widthVw: 0.9,
        maxWidth: 520,
        panelPaddingX: 20,
        panelPaddingY: 18,
        sectionGap: 16,
        rowGap: 12,
        inputHeight: 48,
    },
    C: {
        widthVw: 0.58,
        maxWidth: 620,
        maxHeight: 300,
        panelPaddingX: 18,
        panelPaddingY: 14,
        sectionGap: 12,
        rowGap: 10,
        inputHeight: 40,
    },
    D: {
        widthVw: 0.62,
        maxWidth: 620,
        panelPaddingX: 22,
        panelPaddingY: 18,
        sectionGap: 16,
        rowGap: 12,
        inputHeight: 46,
    },
    E: {
        widthVw: 0.62,
        maxWidth: 620,
        panelPaddingX: 22,
        panelPaddingY: 18,
        sectionGap: 16,
        rowGap: 12,
        inputHeight: 46,
    },
};

export function computeBrandHeaderLayout(screenW: number, screenH: number): BrandHeaderContract {
    const tier = resolveLayoutTier(screenW, screenH);
    const values = BRAND_BY_TIER[tier];
    return {
        tier,
        titleFontSize: values.titleFontSize,
        subtitleFontSize: values.subtitleFontSize,
        titleY: values.titleY,
        subtitleY: values.subtitleY,
        headerBottomY: values.headerBottomY,
        headerGap: values.subtitleY - values.titleY,
    };
}

export function computeInitialScreenLayout(
    screenW: number,
    screenH: number,
    options: { showForm: boolean },
): InitialScreenLayout {
    const tier = resolveLayoutTier(screenW, screenH);
    const safe = getSafeAreaByTier(tier);
    const header = computeBrandHeaderLayout(screenW, screenH);
    const buttonContract = getButtonContractByTier(tier);
    const base = LOGIN_BASE_BY_TIER[tier];

    const panelWidthPx = Math.min(base.maxWidth, Math.round(screenW * base.widthVw));
    const contentWidth = Math.max(220, panelWidthPx - (base.panelPaddingX * 2));

    const estimatedHeaderRows = options.showForm ? 9 : 6;
    const estimatedPanelHeight = (
        base.panelPaddingY * 2
        + (estimatedHeaderRows * 18)
        + (base.sectionGap * (options.showForm ? 5 : 4))
        + (base.rowGap * (options.showForm ? 6 : 4))
        + (base.inputHeight * (options.showForm ? 2 : 0))
        + (buttonContract.primaryHeight * (options.showForm ? 1 : 0))
        + (buttonContract.secondaryHeight * (options.showForm ? 2 : 2))
    );

    const panelTop = Math.max(safe.top + 8, header.headerBottomY + 10);
    const maxPanelHeight = Math.max(180, screenH - panelTop - safe.bottom);
    const panelHeightFromTier = base.maxHeight ? Math.min(base.maxHeight, estimatedPanelHeight) : estimatedPanelHeight;
    const panelHeight = Math.max(
        Math.min(panelHeightFromTier, maxPanelHeight),
        Math.min(maxPanelHeight, options.showForm ? 260 : 220),
    );

    const panelBottomLimit = Math.max(panelTop, screenH - safe.bottom - panelHeight);
    const verticalRoom = Math.max(0, panelBottomLimit - panelTop);
    const targetY = panelTop + Math.floor(verticalRoom * (tier === 'C' ? 0.18 : 0.28));

    const panel = {
        x: Math.round((screenW - panelWidthPx) * 0.5),
        y: Math.round(Math.max(panelTop, Math.min(targetY, panelBottomLimit))),
        w: panelWidthPx,
        h: panelHeight,
    };

    return {
        tier,
        safe,
        header,
        panel,
        loginTokens: {
            panelWidthPx,
            panelMaxHeightPx: base.maxHeight,
            panelPaddingX: base.panelPaddingX,
            panelPaddingY: base.panelPaddingY,
            sectionGap: base.sectionGap,
            rowGap: base.rowGap,
            inputHeight: base.inputHeight,
            primaryButtonHeight: buttonContract.primaryHeight,
            segmentedButtonHeight: buttonContract.secondaryHeight,
            contentWidth,
        },
    };
}
