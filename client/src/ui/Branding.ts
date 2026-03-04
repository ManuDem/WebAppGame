import Phaser from 'phaser';
import { APP_FONT_FAMILY } from './Typography';

export const BRAND_TITLE_TEXT = 'LUCrAre: SEMPRE';

export const BRAND_TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: APP_FONT_FAMILY,
    color: '#102e44',
    stroke: '#f6f7f2',
    strokeThickness: 4,
    fontStyle: '700',
    letterSpacing: 1.2,
};

export const BRAND_SUBTITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: APP_FONT_FAMILY,
    color: '#123650',
    stroke: '#f0f8ff',
    strokeThickness: 2,
    fontStyle: '700',
    letterSpacing: 0.8,
};

export function applyBrandTypography(
    title: Phaser.GameObjects.Text,
    subtitle: Phaser.GameObjects.Text,
    minSide: number,
) {
    title.setFontSize(`${Phaser.Math.Clamp(minSide * 0.102, 52, 96)}px`);
    subtitle.setFontSize(`${Phaser.Math.Clamp(minSide * 0.023, 14, 22)}px`);
}

export function placeBrandHeader(
    title: Phaser.GameObjects.Text,
    subtitle: Phaser.GameObjects.Text,
    x: number,
    titleY: number,
    minSide: number,
) {
    title.setPosition(x, titleY);
    subtitle.setPosition(x, titleY + Phaser.Math.Clamp(minSide * 0.058, 32, 46));
}

export function layoutBrandHeader(
    _sceneW: number,
    sceneH: number,
    minSide: number,
): { titleY: number; subtitleY: number; bottomY: number } {
    const topPad = Phaser.Math.Clamp(sceneH * 0.03, 10, 22);
    const blockH = Phaser.Math.Clamp(minSide * 0.24, 86, 170);
    const titleY = topPad + blockH * 0.38;
    const subtitleY = titleY + Phaser.Math.Clamp(minSide * 0.058, 32, 46);
    const bottomY = subtitleY + Phaser.Math.Clamp(minSide * 0.048, 24, 34);
    return { titleY, subtitleY, bottomY };
}
