import type Phaser from 'phaser';
import { LayoutTier, SafeArea, getSafeAreaByTier, resolveLayoutTier } from './LayoutTokens';

export type LayoutRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export interface MatchCardSizeContract {
    handW: number;
    handH: number;
    boardW: number;
    boardH: number;
}

export interface MatchLayout {
    screenW: number;
    screenH: number;
    tier: LayoutTier;
    isLandscape: boolean;
    compactLandscape: boolean;
    compactPortrait: boolean;
    safe: number;
    safeArea: SafeArea;
    gap: number;
    content: LayoutRect;
    topBar: LayoutRect;
    board: LayoutRect;
    sidebar?: LayoutRect;
    hud: LayoutRect;
    hand: LayoutRect;
    log: LayoutRect;
    controls: LayoutRect;
    handCards: LayoutRect;
    overlay: LayoutRect;
    cardSizes: MatchCardSizeContract;
}

function rect(x: number, y: number, w: number, h: number): LayoutRect {
    return { x, y, w, h };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function clampRect(value: LayoutRect, bounds: LayoutRect): LayoutRect {
    const x = clamp(value.x, bounds.x, bounds.x + bounds.w);
    const y = clamp(value.y, bounds.y, bounds.y + bounds.h);
    const maxW = Math.max(0, bounds.x + bounds.w - x);
    const maxH = Math.max(0, bounds.y + bounds.h - y);
    return rect(x, y, Math.max(0, Math.min(value.w, maxW)), Math.max(0, Math.min(value.h, maxH)));
}

function getCardSizesForTier(tier: LayoutTier): MatchCardSizeContract {
    switch (tier) {
        case 'A':
            return { handW: 80, handH: 120, boardW: 76, boardH: 108 };
        case 'B':
            return { handW: 86, handH: 124, boardW: 80, boardH: 112 };
        case 'C':
            return { handW: 90, handH: 126, boardW: 90, boardH: 126 };
        case 'D':
        case 'E':
        default:
            return { handW: 112, handH: 156, boardW: 102, boardH: 142 };
    }
}

function getTierGap(tier: LayoutTier): number {
    if (tier === 'C') return 8;
    if (tier === 'A' || tier === 'B') return 8;
    return 14;
}

function getTopBarHeight(tier: LayoutTier): number {
    void tier;
    return 0;
}

function computePortraitLayout(
    content: LayoutRect,
    _topBar: LayoutRect,
    tier: 'A' | 'B',
    gap: number,
): Pick<MatchLayout, 'board' | 'hud' | 'controls' | 'log' | 'hand' | 'handCards'> {
    const spec = tier === 'A'
        ? {
            hud: 62,
            controls: 94,
            minHud: 54,
            minControls: 82,
            minBoard: 148,
            maxBoard: 214,
            minHand: 190,
        }
        : {
            hud: 68,
            controls: 98,
            minHud: 58,
            minControls: 86,
            minBoard: 166,
            maxBoard: 246,
            minHand: 204,
        };

    const available = Math.max(200, content.h);
    let hudH = spec.hud;
    let controlsH = spec.controls;
    let boardAndHand = available - hudH - controlsH - (gap * 3);

    const minimumBoardAndHand = spec.minBoard + spec.minHand;
    if (boardAndHand < minimumBoardAndHand) {
        let deficit = minimumBoardAndHand - boardAndHand;
        const controlsShrink = Math.min(deficit, Math.max(0, controlsH - spec.minControls));
        controlsH -= controlsShrink;
        deficit -= controlsShrink;

        const hudShrink = Math.min(deficit, Math.max(0, hudH - spec.minHud));
        hudH -= hudShrink;
        deficit -= hudShrink;

        boardAndHand = available - hudH - controlsH - (gap * 3);
    }

    let boardH = clamp(Math.round(boardAndHand * 0.43), 136, spec.maxBoard);
    let handH = Math.max(136, boardAndHand - boardH);
    if (handH < spec.minHand) {
        const shift = Math.min(spec.minHand - handH, Math.max(0, boardH - 136));
        boardH -= shift;
        handH += shift;
    }

    const hud = rect(content.x, content.y, content.w, hudH);
    const board = rect(content.x, hud.y + hud.h + gap, content.w, boardH);
    const controls = rect(content.x, board.y + board.h + gap, content.w, controlsH);
    const hand = rect(
        content.x,
        controls.y + controls.h + gap,
        content.w,
        Math.max(136, content.y + content.h - (controls.y + controls.h + gap)),
    );
    const handCards = clampRect(rect(hand.x + 8, hand.y + 8, hand.w - 16, hand.h - 16), hand);
    const log = rect(content.x + content.w - 1, controls.y + controls.h, 0, 0);
    return { board, hud, controls, log, hand, handCards };
}

function computeSidebarLayout(
    content: LayoutRect,
    topBar: LayoutRect,
    tier: 'C' | 'D' | 'E',
    gap: number,
): Pick<MatchLayout, 'board' | 'sidebar' | 'hud' | 'controls' | 'log' | 'hand' | 'handCards'> {
    const afterTopY = topBar.y + topBar.h + gap;
    const rawAvailableH = Math.max(120, content.y + content.h - afterTopY);
    const availableH = rawAvailableH;
    const mainY = afterTopY;

    const maxMainW = tier === 'C'
        ? Math.min(content.w, 1180)
        : (tier === 'D' ? Math.min(content.w, 1240) : Math.min(content.w, 1320));
    const mainX = content.x + Math.floor((content.w - maxMainW) * 0.5);
    const boardRatio = tier === 'C' ? 0.6 : 0.62;
    let boardW = Math.round(maxMainW * boardRatio);
    boardW = clamp(boardW, Math.round(maxMainW * 0.54), Math.max(220, maxMainW - gap - 220));
    let sidebarW = Math.max(220, maxMainW - gap - boardW);
    if (boardW + gap + sidebarW > maxMainW) {
        sidebarW = Math.max(220, maxMainW - gap - boardW);
    }

    const board = rect(mainX, mainY, boardW, availableH);
    const sidebar = rect(board.x + board.w + gap, mainY, sidebarW, availableH);

    const hudTarget = tier === 'C' ? 72 : (tier === 'D' ? 82 : 88);
    const controlsTarget = tier === 'C' ? 114 : (tier === 'D' ? 122 : 128);
    const minHand = tier === 'C' ? 138 : (tier === 'D' ? 156 : 170);

    let hudH = hudTarget;
    let controlsH = controlsTarget;
    const staticTotal = hudH + controlsH + (gap * 2);
    let handH = sidebar.h - staticTotal;

    if (handH < minHand) {
        let deficit = minHand - handH;
        const controlsShrink = Math.min(deficit, Math.max(0, controlsH - (tier === 'C' ? 96 : (tier === 'D' ? 102 : 108))));
        controlsH -= controlsShrink;
        deficit -= controlsShrink;

        const hudShrink = Math.min(deficit, Math.max(0, hudH - (tier === 'C' ? 58 : (tier === 'D' ? 64 : 68))));
        hudH -= hudShrink;
        deficit -= hudShrink;

        handH = Math.max(minHand - deficit, 112);
    }

    const hud = clampRect(rect(sidebar.x, sidebar.y, sidebar.w, hudH), sidebar);
    const controls = clampRect(rect(sidebar.x, hud.y + hud.h + gap, sidebar.w, controlsH), sidebar);
    const log = rect(sidebar.x + sidebar.w - 1, controls.y + controls.h, 0, 0);
    const hand = clampRect(rect(sidebar.x, controls.y + controls.h + gap, sidebar.w, sidebar.y + sidebar.h - (controls.y + controls.h + gap)), sidebar);
    const handCards = clampRect(rect(hand.x + 8, hand.y + 7, hand.w - 16, hand.h - 14), hand);

    return { board, sidebar, hud, controls, log, hand, handCards };
}

export function computeMatchLayout(screenW: number, screenH: number): MatchLayout {
    const tier = resolveLayoutTier(screenW, screenH);
    const safeArea = getSafeAreaByTier(tier);
    const safe = Math.min(safeArea.top, safeArea.right, safeArea.bottom, safeArea.left);
    const gap = getTierGap(tier);
    const isLandscape = screenW > screenH;
    const compactLandscape = tier === 'C';
    const compactPortrait = tier === 'A';
    const cardSizes = getCardSizesForTier(tier);

    const content = rect(
        safeArea.left,
        safeArea.top,
        Math.max(0, screenW - safeArea.left - safeArea.right),
        Math.max(0, screenH - safeArea.top - safeArea.bottom),
    );
    const topBar = rect(content.x, content.y, content.w, getTopBarHeight(tier));
    if (tier === 'C' || tier === 'D' || tier === 'E') {
        const topBarMaxW = tier === 'C'
            ? Math.min(content.w, 1180)
            : (tier === 'D' ? Math.min(content.w, 1240) : Math.min(content.w, 1320));
        topBar.x = content.x + Math.floor((content.w - topBarMaxW) * 0.5);
        topBar.w = topBarMaxW;
        if (tier === 'C') {
            const blockTargetH = topBar.h + gap + clamp(330, 292, Math.min(356, Math.max(120, content.h - topBar.h - gap)));
            const freeV = Math.max(0, content.h - blockTargetH);
            topBar.y = content.y + Math.floor(freeV * 0.5);
        }
    }

    let board: LayoutRect;
    let sidebar: LayoutRect | undefined;
    let hud: LayoutRect;
    let controls: LayoutRect;
    let log: LayoutRect;
    let hand: LayoutRect;
    let handCards: LayoutRect;

    if (tier === 'A' || tier === 'B') {
        const portrait = computePortraitLayout(content, topBar, tier, gap);
        board = portrait.board;
        hud = portrait.hud;
        controls = portrait.controls;
        log = portrait.log;
        hand = portrait.hand;
        handCards = portrait.handCards;
    } else {
        const sidebarLayout = computeSidebarLayout(content, topBar, tier, gap);
        board = sidebarLayout.board;
        sidebar = sidebarLayout.sidebar;
        hud = sidebarLayout.hud;
        controls = sidebarLayout.controls;
        log = sidebarLayout.log;
        hand = sidebarLayout.hand;
        handCards = sidebarLayout.handCards;
    }

    return {
        screenW,
        screenH,
        tier,
        isLandscape,
        compactLandscape,
        compactPortrait,
        safe,
        safeArea,
        gap,
        content,
        topBar,
        board,
        sidebar,
        hud,
        hand,
        log,
        controls,
        handCards,
        overlay: rect(0, 0, screenW, screenH),
        cardSizes,
    };
}

export function drawMatchLayoutDebug(
    graphics: Phaser.GameObjects.Graphics,
    layout: MatchLayout,
    textBounds: LayoutRect[] = [],
): void {
    graphics.clear();
    const strokeRect = (r: LayoutRect | undefined, color: number, alpha = 0.9) => {
        if (!r) return;
        graphics.lineStyle(1.1, color, alpha);
        graphics.strokeRect(r.x, r.y, r.w, r.h);
    };

    strokeRect(layout.content, 0x9be7ff);
    strokeRect(layout.topBar, 0xa7d992);
    strokeRect(layout.board, 0xf6d288);
    strokeRect(layout.sidebar, 0x7b6fff);
    strokeRect(layout.hud, 0xadf8d8);
    strokeRect(layout.controls, 0xf9c5ff);
    strokeRect(layout.log, 0xff9fb8);
    strokeRect(layout.hand, 0x9ca8ff);
    strokeRect(layout.handCards, 0xc8f2ff, 0.72);

    textBounds.forEach((b) => strokeRect(b, 0xffffff, 0.55));
}
