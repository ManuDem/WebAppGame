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
            return { handW: 86, handH: 120, boardW: 80, boardH: 112 };
        case 'B':
            return { handW: 88, handH: 122, boardW: 82, boardH: 114 };
        case 'C':
            return { handW: 72, handH: 100, boardW: 74, boardH: 102 };
        case 'D':
        case 'E':
        default:
            return { handW: 90, handH: 126, boardW: 84, boardH: 118 };
    }
}

function getTierGap(tier: LayoutTier): number {
    if (tier === 'C') return 8;
    if (tier === 'A' || tier === 'B') return 10;
    return 12;
}

function getTopBarHeight(tier: LayoutTier): number {
    switch (tier) {
        case 'A': return 78;
        case 'B': return 84;
        case 'C': return 52;
        case 'D': return 62;
        case 'E':
        default:
            return 64;
    }
}

function computePortraitLayout(
    content: LayoutRect,
    topBar: LayoutRect,
    tier: 'A' | 'B',
    gap: number,
): Pick<MatchLayout, 'board' | 'hud' | 'controls' | 'log' | 'hand' | 'handCards'> {
    const boardTarget = tier === 'A'
        ? clamp(Math.max(content.h * 0.38, 240), 240, 320)
        : clamp(Math.max(content.h * 0.4, 250), 250, 360);
    const controlsTarget = tier === 'A' ? 64 : 68;
    const handTarget = tier === 'A' ? 150 : 158;

    const afterTopY = topBar.y + topBar.h + gap;
    const available = Math.max(180, content.y + content.h - afterTopY);
    const minBoard = tier === 'A' ? 214 : 224;
    const minControls = tier === 'A' ? 56 : 60;
    const minHand = tier === 'A' ? 122 : 130;

    let boardH = boardTarget;
    let controlsH = controlsTarget;
    let handH = handTarget;

    const totalRequired = boardH + controlsH + handH + (gap * 2);
    if (totalRequired > available) {
        let overflow = totalRequired - available;
        const boardShrink = Math.min(overflow, Math.max(0, boardH - minBoard));
        boardH -= boardShrink;
        overflow -= boardShrink;

        const handShrink = Math.min(overflow, Math.max(0, handH - minHand));
        handH -= handShrink;
        overflow -= handShrink;

        const controlsShrink = Math.min(overflow, Math.max(0, controlsH - minControls));
        controlsH -= controlsShrink;
        overflow -= controlsShrink;

        if (overflow > 0) {
            handH = Math.max(minHand - overflow, 96);
        }
    }

    const board = rect(content.x, afterTopY, content.w, boardH);
    const controls = rect(content.x, board.y + board.h + gap, content.w, controlsH);
    const hand = rect(content.x, controls.y + controls.h + gap, content.w, Math.max(96, content.y + content.h - (controls.y + controls.h + gap)));
    const handCards = clampRect(rect(hand.x + 8, hand.y + 6, hand.w - 16, hand.h - 12), hand);
    const hud = clampRect(rect(topBar.x + 6, topBar.y + 6, topBar.w - 12, topBar.h - 12), topBar);
    const log = rect(topBar.x + topBar.w - 1, topBar.y + topBar.h - 1, 0, 0);
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
    const targetMainH = tier === 'C'
        ? clamp(Math.floor(content.h * 0.78), 308, Math.min(360, rawAvailableH))
        : rawAvailableH;
    const availableH = Math.max(120, Math.min(rawAvailableH, targetMainH));
    const mainY = afterTopY + Math.floor(Math.max(0, rawAvailableH - availableH) * 0.5);

    const maxMainW = tier === 'C'
        ? Math.min(content.w, 1180)
        : (tier === 'D' ? Math.min(content.w, 1240) : Math.min(content.w, 1320));
    const mainX = content.x + Math.floor((content.w - maxMainW) * 0.5);
    const boardPct = tier === 'C' ? 0.64 : tier === 'D' ? 0.66 : 0.68;
    const boardW = Math.max(220, Math.floor((maxMainW - gap) * boardPct));
    const sidebarW = Math.max(160, maxMainW - boardW - gap);

    const board = rect(mainX, mainY, boardW, availableH);
    const sidebar = rect(board.x + board.w + gap, mainY, sidebarW, availableH);

    const hudTarget = tier === 'C' ? 54 : 64;
    const controlsTarget = tier === 'C' ? 70 : 82;
    const logTarget = tier === 'C' ? 64 : 84;
    const minHand = tier === 'C' ? 96 : 110;

    let hudH = hudTarget;
    let controlsH = controlsTarget;
    let logH = logTarget;
    const staticTotal = hudH + controlsH + logH + (gap * 3);
    let handH = sidebar.h - staticTotal;

    if (handH < minHand) {
        let deficit = minHand - handH;
        const hudShrink = Math.min(deficit, Math.max(0, hudH - 44));
        hudH -= hudShrink;
        deficit -= hudShrink;

        const logShrink = Math.min(deficit, Math.max(0, logH - 48));
        logH -= logShrink;
        deficit -= logShrink;

        const controlsShrink = Math.min(deficit, Math.max(0, controlsH - 56));
        controlsH -= controlsShrink;
        deficit -= controlsShrink;

        handH = Math.max(minHand - deficit, 82);
    }

    const hud = clampRect(rect(sidebar.x, sidebar.y, sidebar.w, hudH), sidebar);
    const controls = clampRect(rect(sidebar.x, hud.y + hud.h + gap, sidebar.w, controlsH), sidebar);
    const log = clampRect(rect(sidebar.x, controls.y + controls.h + gap, sidebar.w, logH), sidebar);
    const hand = clampRect(rect(sidebar.x, log.y + log.h + gap, sidebar.w, sidebar.y + sidebar.h - (log.y + log.h + gap)), sidebar);
    const handCards = clampRect(rect(hand.x + 6, hand.y + 6, hand.w - 12, hand.h - 12), hand);

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
            const blockTargetH = topBar.h + gap + clamp(Math.floor(content.h * 0.78), 308, Math.min(360, Math.max(120, content.h - topBar.h - gap)));
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
