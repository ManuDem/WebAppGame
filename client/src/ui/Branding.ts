import Phaser from 'phaser';
import { APP_FONT_FAMILY } from './Typography';
import { computeBrandHeaderLayout } from './layout/InitialScreenLayout';
import { getSafeAreaByTier, resolveLayoutTier } from './layout/LayoutTokens';

export const BRAND_TITLE_TEXT = 'LUCrAre: SEMPRE';

export const BRAND_TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: APP_FONT_FAMILY,
    color: '#0f3048',
    stroke: '#eff8ff',
    strokeThickness: 4.5,
    fontStyle: '700',
    letterSpacing: 1.15,
};

export const BRAND_SUBTITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: APP_FONT_FAMILY,
    color: '#214e6e',
    stroke: '#ebf7ff',
    strokeThickness: 2,
    fontStyle: '700',
    letterSpacing: 0.75,
};

export interface BrandHeaderLayout {
    titleFontSize: number;
    subtitleFontSize: number;
    titleY: number;
    subtitleY: number;
    bottomY: number;
    headerGap: number;
}

export function applyBrandTypography(
    title: Phaser.GameObjects.Text,
    subtitle: Phaser.GameObjects.Text,
    layout: BrandHeaderLayout,
) {
    const sceneW = title.scene.scale.width;
    const sceneH = title.scene.scale.height;
    const tier = resolveLayoutTier(sceneW, sceneH);
    const safe = getSafeAreaByTier(tier);
    const maxTitleWidth = Math.max(180, sceneW - safe.left - safe.right - 4);
    const maxSubtitleWidth = Math.max(160, sceneW - safe.left - safe.right - 8);

    let titleSize = Math.round(layout.titleFontSize);
    title.setFontSize(`${titleSize}px`);
    while (title.width > maxTitleWidth && titleSize > 26) {
        titleSize -= 1;
        title.setFontSize(`${titleSize}px`);
    }

    let subtitleSize = Math.round(layout.subtitleFontSize);
    subtitle.setFontSize(`${subtitleSize}px`);
    while (subtitle.width > maxSubtitleWidth && subtitleSize > 11) {
        subtitleSize -= 1;
        subtitle.setFontSize(`${subtitleSize}px`);
    }
}

export function placeBrandHeader(
    title: Phaser.GameObjects.Text,
    subtitle: Phaser.GameObjects.Text,
    x: number,
    layout: BrandHeaderLayout,
) {
    const sceneW = title.scene.scale.width;
    const sceneH = title.scene.scale.height;
    const tier = resolveLayoutTier(sceneW, sceneH);
    const safe = getSafeAreaByTier(tier);

    const titleHalf = Math.max(10, title.height * 0.5);
    const subtitleHalf = Math.max(8, subtitle.height * 0.5);

    const minTitleY = safe.top + titleHalf + 2;
    const maxSubtitleY = sceneH - safe.bottom - subtitleHalf - 2;
    const desiredTitleY = Math.max(layout.titleY, minTitleY);
    const minSubtitleY = desiredTitleY + Math.max(16, titleHalf * 0.6);
    const desiredSubtitleY = Math.max(layout.subtitleY, minSubtitleY);
    const subtitleY = Math.min(desiredSubtitleY, maxSubtitleY);
    const titleY = Math.min(desiredTitleY, subtitleY - Math.max(14, subtitleHalf + 2));

    title.setPosition(x, titleY);
    subtitle.setPosition(x, subtitleY);
}

export function layoutBrandHeader(
    sceneW: number,
    sceneH: number,
    _minSide: number,
): BrandHeaderLayout {
    const contract = computeBrandHeaderLayout(sceneW, sceneH);
    return {
        titleFontSize: contract.titleFontSize,
        subtitleFontSize: contract.subtitleFontSize,
        titleY: contract.titleY,
        subtitleY: contract.subtitleY,
        bottomY: contract.headerBottomY,
        headerGap: contract.headerGap,
    };
}

export function getBrandHeaderMetrics(sceneW: number, sceneH: number): BrandHeaderLayout {
    return layoutBrandHeader(sceneW, sceneH, Math.min(sceneW, sceneH));
}
