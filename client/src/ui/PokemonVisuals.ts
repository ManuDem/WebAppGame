import Phaser from 'phaser';

export function ensurePokemonTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists('poke-clouds')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0x000000, 0);
        g.fillRect(0, 0, 256, 128);

        const drawCloud = (x: number, y: number, w: number, h: number) => {
            g.fillStyle(0xf8fcff, 1);
            g.fillRect(x, y, w, h);
            g.fillRect(x + 6, y - 4, w * 0.42, 8);
            g.fillRect(x + w * 0.35, y - 6, w * 0.35, 10);
            g.fillStyle(0xd5e9ff, 1);
            g.fillRect(x + 4, y + h - 4, w - 8, 4);
        };

        drawCloud(18, 24, 56, 16);
        drawCloud(108, 18, 50, 14);
        drawCloud(186, 30, 48, 14);
        drawCloud(56, 72, 46, 14);
        drawCloud(152, 84, 52, 15);

        g.generateTexture('poke-clouds', 256, 128);
        g.destroy();
    }

    if (!scene.textures.exists('poke-dither')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0x8ad39a, 1);
        g.fillRect(0, 0, 64, 64);
        g.fillStyle(0x7abf87, 1);
        for (let y = 0; y < 64; y += 4) {
            for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < 64; x += 4) {
                g.fillRect(x, y, 2, 2);
            }
        }
        g.fillStyle(0xa6dfa9, 0.45);
        for (let y = 1; y < 64; y += 8) {
            g.fillRect(0, y, 64, 1);
        }
        g.generateTexture('poke-dither', 64, 64);
        g.destroy();
    }
}

export function drawPokemonBackdrop(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    horizonRatio = 0.58,
) {
    graphics.clear();

    graphics.fillStyle(0x9ed9ff, 1);
    graphics.fillRect(0, 0, width, height);

    const skyBands = [0x9ed9ff, 0x92d2ff, 0x86c9f6, 0x7ebeea];
    const skyBandH = height * 0.12;
    skyBands.forEach((color, index) => {
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, index * skyBandH, width, skyBandH + 1);
    });

    const horizonY = height * horizonRatio;
    const mountainStep = Phaser.Math.Clamp(width / 12, 70, 140);
    graphics.fillStyle(0x73a9ca, 0.92);
    for (let i = -1; i < Math.ceil(width / mountainStep) + 2; i++) {
        const x = i * mountainStep;
        const wave = (Math.sin(i * 1.23) + 1) * 0.5;
        const peak = horizonY - (56 + wave * 52);
        graphics.fillTriangle(x, horizonY, x + mountainStep * 0.5, peak, x + mountainStep, horizonY);
    }

    graphics.fillStyle(0x82d08a, 1);
    graphics.fillRect(0, horizonY, width, height - horizonY);

    const stripe = 7;
    for (let y = horizonY; y < height; y += stripe) {
        const t = (y - horizonY) / Math.max(1, height - horizonY);
        graphics.fillStyle(t > 0.5 ? 0x72bf7d : 0x78c984, 0.7);
        graphics.fillRect(0, y, width, 3);
    }

    graphics.lineStyle(1, 0xffffff, 0.05);
    for (let y = 0; y <= height; y += 4) {
        graphics.moveTo(0, y);
        graphics.lineTo(width, y);
    }
    graphics.strokePath();
}
