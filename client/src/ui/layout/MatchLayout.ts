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
    controls: LayoutRect;
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
        ? (compactLandscape ? screenH * 0.2 : screenH * 0.23)
        : screenH * 0.27;
    let handH = isLandscape
        ? (compactLandscape ? screenH * 0.29 : screenH * 0.27)
        : screenH * 0.4;

    topH = Phaser.Math.Clamp(topH, isLandscape ? (compactLandscape ? 72 : 90) : 116, isLandscape ? (compactLandscape ? 118 : 178) : 220);
    handH = Phaser.Math.Clamp(handH, isLandscape ? (compactLandscape ? 112 : 124) : 250, isLandscape ? (compactLandscape ? 180 : 222) : 390);

    let boardH = screenH - topH - handH;
    const minBoard = isLandscape ? (compactLandscape ? 164 : 154) : 230;
    if (boardH < minBoard) {
        const deficit = minBoard - boardH;
        const topMin = isLandscape ? (compactLandscape ? 70 : 84) : 96;
        const handMin = isLandscape ? (compactLandscape ? 98 : 108) : 176;
        const handShrink = Math.min(deficit * 0.7, Math.max(0, handH - handMin));
        handH -= handShrink;
        const topShrink = Math.min(deficit - handShrink, Math.max(0, topH - topMin));
        topH -= topShrink;
        boardH = screenH - topH - handH;
    }

    const topBar = rect(content.x, content.y, content.w, Math.round(topH));
    const board = rect(content.x, topBar.y + topBar.h, content.w, Math.round(boardH));
    const hand = rect(content.x, board.y + board.h, content.w, Math.round(handH));

    const logDockW = Phaser.Math.Clamp(content.w * (isLandscape ? 0.28 : 0.62), 190, isLandscape ? 360 : 470);
    const logDockH = Phaser.Math.Clamp((isLandscape ? board.h : topBar.h) * 0.16, 34, 56);
    const logBaseRect = isLandscape
        ? rect(
            content.x + content.w - logDockW - safe,
            board.y + safe,
            logDockW,
            logDockH,
        )
        : rect(
            content.x + content.w - logDockW - safe,
            topBar.y + safe,
            logDockW,
            logDockH,
        );
    const log = clampRectToContent(logBaseRect, isLandscape ? board : topBar);

    let controlsH = Phaser.Math.Clamp(
        hand.h * (isLandscape ? (compactLandscape ? 0.42 : 0.4) : 0.34),
        isLandscape ? (compactLandscape ? 62 : 68) : 80,
        isLandscape ? (compactLandscape ? 88 : 102) : 124,
    );
    const controls = clampRectToContent(rect(hand.x + 8, hand.y + 8, hand.w - 16, controlsH), hand);

    const handCardsTop = controls.y + controls.h + 8;
    const handCards = clampRectToContent(
        rect(hand.x + 8, handCardsTop, hand.w - 16, hand.h - (handCardsTop - hand.y) - 8),
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
        controls,
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
    strokeRect(layout.controls, 0xf9c5ff);
    strokeRect(layout.handCards, 0xc8f2ff, 0.72);

    textBounds.forEach((b) => strokeRect(b, 0xffffff, 0.55));
}
