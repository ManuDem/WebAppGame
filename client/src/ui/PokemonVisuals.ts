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

        g.fillStyle(0xffffff, 0.25);
        g.fillRect(0, 0, 256, 6);
        g.fillStyle(0x9bc8ef, 0.18);
        g.fillRect(0, 122, 256, 6);

        g.generateTexture('poke-clouds', 256, 128);
        g.destroy();
    }

    if (!scene.textures.exists('poke-dither')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0x7ac492, 1);
        g.fillRect(0, 0, 64, 64);
        g.fillStyle(0x68a97f, 1);
        for (let y = 0; y < 64; y += 4) {
            for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < 64; x += 4) {
                g.fillRect(x, y, 2, 2);
            }
        }
        g.fillStyle(0xb1e3be, 0.38);
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

    graphics.fillStyle(0x7fc1ec, 1);
    graphics.fillRect(0, 0, width, height);

    const skyBands = [0x8cc9ef, 0x7ab6e1, 0x6da7d7, 0x5f93c6];
    const skyBandH = Math.max(24, height * 0.12);
    skyBands.forEach((color, index) => {
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, index * skyBandH, width, skyBandH + 1);
    });

    graphics.fillStyle(0xffdb97, 0.12);
    graphics.fillCircle(width * 0.84, height * 0.17, Math.max(46, Math.min(width, height) * 0.09));
    graphics.fillStyle(0xffffff, 0.09);
    graphics.fillRect(0, 0, width, Math.max(10, height * 0.05));

    const horizonY = height * horizonRatio;
    const mountainStep = Phaser.Math.Clamp(width / 11, 64, 138);
    graphics.fillStyle(0x5a86ad, 0.82);
    for (let i = -1; i < Math.ceil(width / mountainStep) + 2; i++) {
        const x = i * mountainStep;
        const wave = (Math.sin(i * 1.23) + 1) * 0.5;
        const peak = horizonY - (44 + wave * 48);
        graphics.fillTriangle(x, horizonY, x + mountainStep * 0.5, peak, x + mountainStep, horizonY);
    }

    graphics.fillStyle(0x6bc28a, 1);
    graphics.fillRect(0, horizonY, width, height - horizonY);

    graphics.fillStyle(0x4e9d70, 0.36);
    graphics.fillRect(0, horizonY + 2, width, Math.max(6, height * 0.03));

    const stripe = 6;
    for (let y = horizonY; y < height; y += stripe) {
        const t = (y - horizonY) / Math.max(1, height - horizonY);
        graphics.fillStyle(t > 0.5 ? 0x5eaf78 : 0x66ba83, 0.64);
        graphics.fillRect(0, y, width, 2);
    }

    graphics.fillStyle(0x2f4f69, 0.32);
    graphics.fillRect(0, horizonY - 2, width, 2);

    graphics.lineStyle(1, 0xffffff, 0.045);
    for (let y = 0; y <= height; y += 4) {
        graphics.moveTo(0, y);
        graphics.lineTo(width, y);
    }
    graphics.strokePath();
}
