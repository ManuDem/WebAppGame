export type BoundsRect = { x: number; y: number; w: number; h: number };

export const PHONE_VIEWPORTS_PORTRAIT = [
    { w: 320, h: 568 },
    { w: 360, h: 640 },
    { w: 375, h: 667 },
    { w: 390, h: 844 },
    { w: 393, h: 852 },
    { w: 412, h: 915 },
    { w: 414, h: 896 },
    { w: 430, h: 932 },
    { w: 540, h: 960 },
];

export const PHONE_VIEWPORTS_LANDSCAPE = [
    { w: 844, h: 390 },
    { w: 896, h: 414 },
    { w: 932, h: 430 },
];

export const TABLET_VIEWPORTS = [
    { w: 1024, h: 768 },
    { w: 1180, h: 820 },
    { w: 1366, h: 768 },
];

export const MATCH_VIEWPORT_MATRIX = [
    ...PHONE_VIEWPORTS_PORTRAIT,
    ...PHONE_VIEWPORTS_LANDSCAPE,
    ...TABLET_VIEWPORTS,
];

export function expectInside(outer: BoundsRect, inner: BoundsRect): void {
    expect(inner.x).toBeGreaterThanOrEqual(outer.x - 0.001);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y - 0.001);
    expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w + 0.001);
    expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h + 0.001);
}

