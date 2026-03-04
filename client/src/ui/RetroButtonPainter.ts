import Phaser from 'phaser';

export type RetroButtonColors = {
    base: number;
    border: number;
    gloss?: number;
    glossAlpha?: number;
};

export type RetroButtonShape = {
    width: number;
    height: number;
    radius?: number;
    borderWidth?: number;
};

export function paintRetroButton(
    gfx: Phaser.GameObjects.Graphics,
    shape: RetroButtonShape,
    colors: RetroButtonColors,
) {
    const radius = shape.radius ?? 10;
    const borderWidth = shape.borderWidth ?? 1.2;
    const glossColor = colors.gloss ?? 0xffffff;
    const glossAlpha = colors.glossAlpha ?? 0.12;
    const { width: w, height: h } = shape;

    gfx.clear();
    gfx.fillStyle(colors.base, 1);
    gfx.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, radius);
    gfx.fillStyle(glossColor, glossAlpha);
    gfx.fillRoundedRect(
        -w * 0.5,
        -h * 0.5,
        w,
        h * 0.45,
        { tl: radius, tr: radius, bl: 0, br: 0 },
    );
    gfx.lineStyle(borderWidth, colors.border, 1);
    gfx.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, radius);
}
