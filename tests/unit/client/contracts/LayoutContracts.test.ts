import { computeBrandHeaderLayout, computeInitialScreenLayout } from 'client/src/ui/layout/InitialScreenLayout';
import { computeMatchLayout } from 'client/src/ui/layout/MatchLayout';
import { LayoutTier, getMenuTypographyByTier, getSafeAreaByTier, resolveLayoutTier } from 'client/src/ui/layout/LayoutTokens';

type ViewportCase = {
    width: number;
    height: number;
    expectedTier: LayoutTier;
};

const VIEWPORTS: ViewportCase[] = [
    { width: 360, height: 640, expectedTier: 'A' },
    { width: 390, height: 844, expectedTier: 'A' },
    { width: 414, height: 896, expectedTier: 'B' },
    { width: 540, height: 960, expectedTier: 'B' },
    { width: 768, height: 1024, expectedTier: 'D' },
    { width: 844, height: 390, expectedTier: 'C' },
    { width: 896, height: 414, expectedTier: 'C' },
    { width: 1024, height: 768, expectedTier: 'E' },
    { width: 1366, height: 768, expectedTier: 'E' },
];

const BRAND_EXPECTED: Record<LayoutTier, { title: number; subtitle: number; titleY: number; subtitleY: number; bottom: number }> = {
    A: { title: 46, subtitle: 16, titleY: 64, subtitleY: 98, bottom: 128 },
    B: { title: 50, subtitle: 17, titleY: 68, subtitleY: 104, bottom: 134 },
    C: { title: 36, subtitle: 13, titleY: 48, subtitleY: 72, bottom: 96 },
    D: { title: 58, subtitle: 19, titleY: 74, subtitleY: 110, bottom: 142 },
    E: { title: 64, subtitle: 20, titleY: 76, subtitleY: 114, bottom: 146 },
};

const MENU_TYPO_EXPECTED: Record<LayoutTier, { caption: number; body: number; label: number; button: number; sectionTitle: number; roomCode: number; input: number }> = {
    A: { caption: 12, body: 13, label: 14, button: 16, sectionTitle: 16, roomCode: 26, input: 17 },
    B: { caption: 12, body: 13, label: 14, button: 16, sectionTitle: 16, roomCode: 26, input: 17 },
    C: { caption: 12, body: 13, label: 13, button: 15, sectionTitle: 15, roomCode: 23, input: 16 },
    D: { caption: 13, body: 14, label: 15, button: 16, sectionTitle: 17, roomCode: 28, input: 18 },
    E: { caption: 13, body: 14, label: 15, button: 16, sectionTitle: 17, roomCode: 28, input: 18 },
};

function expectRectInside(
    outer: { x: number; y: number; w: number; h: number },
    inner: { x: number; y: number; w: number; h: number },
) {
    expect(inner.w).toBeGreaterThanOrEqual(0);
    expect(inner.h).toBeGreaterThanOrEqual(0);
    expect(inner.x).toBeGreaterThanOrEqual(outer.x);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y);
    expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w + 0.001);
    expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h + 0.001);
}

describe('Layout contracts', () => {
    test.each(VIEWPORTS)('tier + safe area are deterministic for %o', ({ width, height, expectedTier }) => {
        const tier = resolveLayoutTier(width, height);
        expect(tier).toBe(expectedTier);
        const safe = getSafeAreaByTier(tier);
        if (tier === 'A' || tier === 'B') {
            expect(safe).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
        } else if (tier === 'C') {
            expect(safe).toEqual({ top: 8, right: 10, bottom: 8, left: 10 });
        } else {
            expect(safe).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
        }
    });

    test.each(VIEWPORTS)('brand header follows exact tier values for %o', ({ width, height, expectedTier }) => {
        const header = computeBrandHeaderLayout(width, height);
        const expected = BRAND_EXPECTED[expectedTier];
        expect(header.titleFontSize).toBe(expected.title);
        expect(header.subtitleFontSize).toBe(expected.subtitle);
        expect(header.titleY).toBe(expected.titleY);
        expect(header.subtitleY).toBe(expected.subtitleY);
        expect(header.headerBottomY).toBe(expected.bottom);
    });

    test.each(VIEWPORTS)('menu typography is deterministic for %o', ({ expectedTier }) => {
        expect(getMenuTypographyByTier(expectedTier)).toEqual(MENU_TYPO_EXPECTED[expectedTier]);
    });

    test.each(VIEWPORTS)('initial screen panel stays inside safe area for %o', ({ width, height }) => {
        const withForm = computeInitialScreenLayout(width, height, { showForm: true });
        const noForm = computeInitialScreenLayout(width, height, { showForm: false });
        const content = {
            x: withForm.safe.left,
            y: withForm.safe.top,
            w: width - withForm.safe.left - withForm.safe.right,
            h: height - withForm.safe.top - withForm.safe.bottom,
        };

        expect(withForm.header.headerBottomY).toBeGreaterThan(withForm.header.titleY);
        expect(withForm.panel.y).toBeGreaterThanOrEqual(withForm.header.headerBottomY);
        expectRectInside(content, withForm.panel);
        expectRectInside(content, noForm.panel);
    });

    test.each(VIEWPORTS)('match layout panels remain inside content rect for %o', ({ width, height, expectedTier }) => {
        const layout = computeMatchLayout(width, height);
        expect(layout.tier).toBe(expectedTier);
        expectRectInside(layout.content, layout.topBar);
        expectRectInside(layout.content, layout.board);
        expectRectInside(layout.content, layout.hud);
        expectRectInside(layout.content, layout.controls);
        expectRectInside(layout.content, layout.log);
        expectRectInside(layout.content, layout.hand);
        expectRectInside(layout.hand, layout.handCards);

        if (expectedTier === 'A' || expectedTier === 'B') {
            expect(layout.sidebar).toBeUndefined();
        } else {
            expect(layout.sidebar).toBeDefined();
            expectRectInside(layout.content, layout.sidebar!);
        }
    });

    test('tier C uses explicit two-column board/sidebar split', () => {
        const layout = computeMatchLayout(896, 414);
        expect(layout.tier).toBe('C');
        expect(layout.topBar.h).toBe(0);
        expect(layout.sidebar).toBeDefined();
        const total = layout.board.w + (layout.sidebar?.w ?? 0);
        const boardRatio = layout.board.w / Math.max(1, total);
        expect(boardRatio).toBeGreaterThan(0.57);
        expect(boardRatio).toBeLessThan(0.63);
        expect(layout.cardSizes.handW).toBe(90);
        expect(layout.cardSizes.handH).toBe(126);
        expect(layout.cardSizes.boardW).toBe(90);
        expect(layout.cardSizes.boardH).toBe(126);
    });
});

