import { computeBrandHeaderLayout, computeInitialScreenLayout } from './InitialScreenLayout';
import { LayoutTier, getSafeAreaByTier } from './LayoutTokens';
import { computeMatchLayout, MatchLayout } from './MatchLayout';
import { getViewportInfo } from './ViewportTier';

export type LayoutEngineResult = {
    tier: LayoutTier;
    safeArea: { top: number; right: number; bottom: number; left: number };
    initial: ReturnType<typeof computeInitialScreenLayout>;
    brand: ReturnType<typeof computeBrandHeaderLayout>;
    match: MatchLayout;
};

export function computeLayoutEngine(
    width: number,
    height: number,
    options: { showForm?: boolean } = {},
): LayoutEngineResult {
    const viewport = getViewportInfo(width, height);
    const tier = viewport.tier;
    return {
        tier,
        safeArea: getSafeAreaByTier(tier),
        initial: computeInitialScreenLayout(width, height, { showForm: Boolean(options.showForm) }),
        brand: computeBrandHeaderLayout(width, height),
        match: computeMatchLayout(width, height),
    };
}

