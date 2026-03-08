import { computeMatchLayout } from 'client/src/ui/layout/MatchLayout';
import {
    expectInside,
    MATCH_VIEWPORT_MATRIX,
    PHONE_VIEWPORTS_LANDSCAPE,
    PHONE_VIEWPORTS_PORTRAIT,
} from 'tests/helpers/client/layoutAssertions';

describe('Match layout viewport matrix', () => {
    test.each(MATCH_VIEWPORT_MATRIX)('layout invariants hold for %ox%o', ({ w, h }) => {
        const layout = computeMatchLayout(w, h);

        expectInside(layout.content, layout.topBar);
        expectInside(layout.content, layout.board);
        expectInside(layout.content, layout.hud);
        expectInside(layout.content, layout.controls);
        expectInside(layout.content, layout.log);
        expectInside(layout.content, layout.hand);
        expectInside(layout.hand, layout.handCards);

        if (layout.tier === 'A' || layout.tier === 'B') {
            expect(layout.sidebar).toBeUndefined();
            expect(layout.topBar.y + layout.topBar.h).toBeLessThanOrEqual(layout.board.y + 0.001);
            expect(layout.board.y + layout.board.h).toBeLessThanOrEqual(layout.controls.y + 0.001);
            expect(layout.controls.y + layout.controls.h).toBeLessThanOrEqual(layout.hand.y + 0.001);
        } else {
            expect(layout.sidebar).toBeDefined();
            const sidebar = layout.sidebar!;
            expect(layout.board.x + layout.board.w).toBeLessThanOrEqual(sidebar.x + 0.001);
            expectInside(sidebar, layout.hud);
            expectInside(sidebar, layout.controls);
            expectInside(sidebar, layout.log);
            expectInside(sidebar, layout.hand);
            expect(layout.hud.y + layout.hud.h).toBeLessThanOrEqual(layout.controls.y + 0.001);
            expect(layout.controls.y + layout.controls.h).toBeLessThanOrEqual(layout.log.y + 0.001);
            expect(layout.log.y + layout.log.h).toBeLessThanOrEqual(layout.hand.y + 0.001);
        }

        expect(layout.controls.h).toBeGreaterThanOrEqual(40);
        expect(layout.hand.h).toBeGreaterThanOrEqual(layout.tier === 'C' ? 70 : 90);
        expect(layout.cardSizes.handW).toBeGreaterThanOrEqual(80);
        expect(layout.cardSizes.handH).toBeGreaterThanOrEqual(120);
    });

    test.each(PHONE_VIEWPORTS_PORTRAIT)('portrait-first phone view keeps deterministic vertical flow for %ox%o', ({ w, h }) => {
        const layout = computeMatchLayout(w, h);

        expect(layout.tier === 'A' || layout.tier === 'B').toBe(true);
        expect(layout.sidebar).toBeUndefined();
        expect(layout.content.h).toBeGreaterThan(layout.content.w);
        expect(layout.topBar.y + layout.topBar.h).toBeLessThanOrEqual(layout.board.y + 0.001);
        expect(layout.board.y + layout.board.h).toBeLessThanOrEqual(layout.controls.y + 0.001);
        expect(layout.controls.y + layout.controls.h).toBeLessThanOrEqual(layout.hand.y + 0.001);
        expect(layout.controls.h).toBeGreaterThanOrEqual(56);
        expect(layout.hand.h).toBeGreaterThanOrEqual(100);
    });

    test.each(PHONE_VIEWPORTS_LANDSCAPE)('landscape phone view keeps sidebar separation for %ox%o', ({ w, h }) => {
        const layout = computeMatchLayout(w, h);
        expect(layout.sidebar).toBeDefined();
        expect(layout.board.x + layout.board.w).toBeLessThanOrEqual(layout.sidebar!.x + 0.001);
        expect(layout.controls.w).toBeLessThanOrEqual(layout.sidebar!.w + 0.001);
    });
});
