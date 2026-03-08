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
        titleFontSize: 46,
        subtitleFontSize: 16,
        titleY: 64,
        subtitleY: 98,
        headerBottomY: 128,
    },
    B: {
        titleFontSize: 50,
        subtitleFontSize: 17,
        titleY: 68,
        subtitleY: 104,
        headerBottomY: 134,
    },
    C: {
        titleFontSize: 36,
        subtitleFontSize: 13,
        titleY: 48,
        subtitleY: 72,
        headerBottomY: 96,
    },
    D: {
        titleFontSize: 58,
        subtitleFontSize: 19,
        titleY: 74,
        subtitleY: 110,
        headerBottomY: 142,
    },
    E: {
        titleFontSize: 64,
        subtitleFontSize: 20,
        titleY: 76,
        subtitleY: 114,
        headerBottomY: 146,
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
    panelWidth: number;
    maxWidth: number;
    panelHeightForm: number;
    panelHeightMode: number;
    panelPaddingX: number;
    panelPaddingY: number;
    sectionGap: number;
    rowGap: number;
    inputHeight: number;
};

const LOGIN_BASE_BY_TIER: Record<LayoutTier, LoginTokenBase> = {
    A: {
        panelWidth: 336,
        maxWidth: 420,
        panelHeightForm: 442,
        panelHeightMode: 316,
        panelPaddingX: 18,
        panelPaddingY: 16,
        sectionGap: 14,
        rowGap: 10,
        inputHeight: 48,
    },
    B: {
        panelWidth: 356,
        maxWidth: 460,
        panelHeightForm: 480,
        panelHeightMode: 330,
        panelPaddingX: 20,
        panelPaddingY: 18,
        sectionGap: 16,
        rowGap: 12,
        inputHeight: 48,
    },
    C: {
        panelWidth: 560,
        maxWidth: 640,
        panelHeightForm: 300,
        panelHeightMode: 244,
        panelPaddingX: 20,
        panelPaddingY: 14,
        sectionGap: 12,
        rowGap: 10,
        inputHeight: 42,
    },
    D: {
        panelWidth: 560,
        maxWidth: 640,
        panelHeightForm: 520,
        panelHeightMode: 352,
        panelPaddingX: 22,
        panelPaddingY: 18,
        sectionGap: 16,
        rowGap: 12,
        inputHeight: 46,
    },
    E: {
        panelWidth: 600,
        maxWidth: 700,
        panelHeightForm: 552,
        panelHeightMode: 368,
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

    const maxPanelWidth = Math.max(220, screenW - safe.left - safe.right - 8);
    const panelWidthPx = Math.max(220, Math.min(base.maxWidth, maxPanelWidth, base.panelWidth));
    const contentWidth = Math.max(220, panelWidthPx - (base.panelPaddingX * 2));

    const panelTop = Math.max(safe.top + 8, header.headerBottomY + 12);
    const maxPanelHeight = Math.max(180, screenH - panelTop - safe.bottom);
    const requestedHeight = options.showForm ? base.panelHeightForm : base.panelHeightMode;
    const panelHeight = Math.max(Math.min(requestedHeight, maxPanelHeight), Math.min(maxPanelHeight, 220));
    const panelBottomLimit = Math.max(panelTop, screenH - safe.bottom - panelHeight);
    const rigidOffset = tier === 'C' ? 6 : 10;
    const targetY = panelTop + Math.min(rigidOffset, Math.max(0, panelBottomLimit - panelTop));

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
            panelMaxHeightPx: options.showForm ? base.panelHeightForm : base.panelHeightMode,
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
