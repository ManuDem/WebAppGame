import Phaser from 'phaser';

export type LayoutRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export interface MatchLayout {
    screenW: number;
    screenH: number;
    isLandscape: boolean;
    compactLandscape: boolean;
    compactPortrait: boolean;
    safe: number;
    gap: number;
    content: LayoutRect;
    topBar: LayoutRect;
    board: LayoutRect;
    hand: LayoutRect;
    log: LayoutRect;
    handCards: LayoutRect;
    overlay: LayoutRect;
}

function rect(x: number, y: number, w: number, h: number): LayoutRect {
    return { x, y, w, h };
}

function clampRectToContent(value: LayoutRect, content: LayoutRect): LayoutRect {
    const x = Phaser.Math.Clamp(value.x, content.x, content.x + content.w);
    const y = Phaser.Math.Clamp(value.y, content.y, content.y + content.h);
    const maxW = Math.max(0, content.x + content.w - x);
    const maxH = Math.max(0, content.y + content.h - y);
    return rect(
        x,
        y,
        Phaser.Math.Clamp(value.w, 0, maxW),
        Phaser.Math.Clamp(value.h, 0, maxH),
    );
}

export function computeMatchLayout(screenW: number, screenH: number): MatchLayout {
    const isLandscape = screenW > screenH;
    const compactLandscape = isLandscape && screenH < 520;
    const compactPortrait = !isLandscape && screenW < 410;

    const safe = Phaser.Math.Clamp(Math.round(Math.min(screenW, screenH) * 0.018), 6, 16);
    const gap = Phaser.Math.Clamp(Math.round(Math.min(screenW, screenH) * 0.012), 6, 14);

    const content = rect(
        Math.round((screenW - (isLandscape ? Math.min(screenW * 0.94, 1480) : Math.min(screenW * 0.98, 640))) * 0.5),
        0,
        Math.round(isLandscape ? Math.min(screenW * 0.94, 1480) : Math.min(screenW * 0.98, 640)),
        screenH,
    );

    let topH = isLandscape
        ? (compactLandscape ? screenH * 0.22 : screenH * 0.25)
        : screenH * 0.27;
    let handH = isLandscape
        ? (compactLandscape ? screenH * 0.31 : screenH * 0.32)
        : screenH * 0.4;

    topH = Phaser.Math.Clamp(topH, isLandscape ? (compactLandscape ? 78 : 96) : 116, isLandscape ? (compactLandscape ? 124 : 188) : 220);
    handH = Phaser.Math.Clamp(handH, isLandscape ? (compactLandscape ? 120 : 132) : 250, isLandscape ? (compactLandscape ? 190 : 240) : 390);

    let boardH = screenH - topH - handH;
    const minBoard = isLandscape ? (compactLandscape ? 150 : 138) : 230;
    if (boardH < minBoard) {
        const deficit = minBoard - boardH;
        const topMin = isLandscape ? (compactLandscape ? 70 : 84) : 96;
        const handMin = isLandscape ? (compactLandscape ? 108 : 116) : 176;
        const handShrink = Math.min(deficit * 0.7, Math.max(0, handH - handMin));
        handH -= handShrink;
        const topShrink = Math.min(deficit - handShrink, Math.max(0, topH - topMin));
        topH -= topShrink;
        boardH = screenH - topH - handH;
    }

    const topBar = rect(content.x, content.y, content.w, Math.round(topH));
    const board = rect(content.x, topBar.y + topBar.h, content.w, Math.round(boardH));
    const hand = rect(content.x, board.y + board.h, content.w, Math.round(handH));

    const logDockW = Phaser.Math.Clamp(content.w * (isLandscape ? 0.36 : 0.62), 190, isLandscape ? 420 : 470);
    const logDockH = Phaser.Math.Clamp(topBar.h * (isLandscape ? 0.28 : 0.25), 34, 56);
    const log = clampRectToContent(
        rect(
            content.x + content.w - logDockW - 12,
            topBar.y + 10,
            logDockW,
            logDockH,
        ),
        topBar,
    );

    const handCards = clampRectToContent(
        rect(hand.x + 8, hand.y + 66, hand.w - 16, hand.h - 74),
        hand,
    );

    return {
        screenW,
        screenH,
        isLandscape,
        compactLandscape,
        compactPortrait,
        safe,
        gap,
        content,
        topBar,
        board,
        hand,
        log,
        handCards,
        overlay: rect(0, 0, screenW, screenH),
    };
}

export function drawMatchLayoutDebug(
    graphics: Phaser.GameObjects.Graphics,
    layout: MatchLayout,
    textBounds: LayoutRect[] = [],
): void {
    graphics.clear();

    const strokeRect = (r: LayoutRect, color: number, alpha = 0.9) => {
        graphics.lineStyle(1.1, color, alpha);
        graphics.strokeRect(r.x, r.y, r.w, r.h);
    };

    strokeRect(layout.content, 0x9be7ff);
    strokeRect(layout.topBar, 0xa7d992);
    strokeRect(layout.board, 0xf6d288);
    strokeRect(layout.hand, 0x9ca8ff);
    strokeRect(layout.log, 0xff9fb8);
    strokeRect(layout.handCards, 0xc8f2ff, 0.72);

    textBounds.forEach((b) => strokeRect(b, 0xffffff, 0.55));
}
