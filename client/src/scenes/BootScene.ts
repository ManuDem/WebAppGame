import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';

const FONT_DISPLAY = 'Bebas Neue, Barlow Condensed, Impact, sans-serif';
const FONT_UI = 'Sora, Trebuchet MS, sans-serif';

export class BootScene extends Phaser.Scene {
    private serverManager!: ServerManager;

    private bg!: Phaser.GameObjects.Graphics;
    private glowA!: Phaser.GameObjects.Ellipse;
    private glowB!: Phaser.GameObjects.Ellipse;
    private glowC!: Phaser.GameObjects.Ellipse;
    private ring!: Phaser.GameObjects.Arc;

    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private status!: Phaser.GameObjects.Text;

    private progressTrack!: Phaser.GameObjects.Graphics;
    private progressFill!: Phaser.GameObjects.Graphics;
    private progressLabel!: Phaser.GameObjects.Text;

    private progressValue = 0;

    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        this.serverManager = new ServerManager();

        this.bg = this.add.graphics();

        this.glowA = this.add.ellipse(0, 0, 100, 100, 0x35b3ff, 0.17).setBlendMode(Phaser.BlendModes.ADD);
        this.glowB = this.add.ellipse(0, 0, 100, 100, 0x56f2b3, 0.14).setBlendMode(Phaser.BlendModes.ADD);
        this.glowC = this.add.ellipse(0, 0, 100, 100, 0xffb454, 0.12).setBlendMode(Phaser.BlendModes.ADD);

        this.ring = this.add.circle(0, 0, 80)
            .setStrokeStyle(2, 0x8ad7ff, 0.55)
            .setFillStyle(0x000000, 0);

        this.title = this.add.text(0, 0, 'LUCrAre', {
            fontFamily: FONT_DISPLAY,
            fontSize: '86px',
            color: '#f2f9ff',
            letterSpacing: 3,
        }).setOrigin(0.5).setAlpha(0);

        this.subtitle = this.add.text(0, 0, 'SEMPRE', {
            fontFamily: FONT_UI,
            fontSize: '24px',
            color: '#9cd4f5',
            fontStyle: '700',
            letterSpacing: 8,
        }).setOrigin(0.5).setAlpha(0);

        this.status = this.add.text(0, 0, 'Loading assets and network...', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#95a6b8',
            fontStyle: '600',
            letterSpacing: 0.5,
        }).setOrigin(0.5).setAlpha(0.92);

        this.progressTrack = this.add.graphics();
        this.progressFill = this.add.graphics();

        this.progressLabel = this.add.text(0, 0, '0%', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#d6e6f2',
            fontStyle: '700',
        }).setOrigin(0.5);

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
        });

        this.handleResize(this.scale.gameSize);

        this.cameras.main.fadeIn(380, 8, 13, 20);

        this.tweens.add({ targets: this.title, alpha: 1, y: this.title.y - 8, duration: 520, ease: 'Sine.Out' });
        this.tweens.add({ targets: this.subtitle, alpha: 1, y: this.subtitle.y + 4, duration: 520, delay: 160, ease: 'Sine.Out' });

        this.tweens.add({
            targets: this.ring,
            angle: 360,
            duration: 6400,
            repeat: -1,
            ease: 'Linear',
        });

        this.tweens.add({
            targets: [this.glowA, this.glowB, this.glowC],
            alpha: '+=0.08',
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });

        const progressProxy = { value: 0 };
        this.tweens.add({
            targets: progressProxy,
            value: 1,
            duration: 1850,
            delay: 220,
            ease: 'Cubic.Out',
            onUpdate: () => {
                this.progressValue = progressProxy.value;
                this.redrawProgress();
            },
            onComplete: () => {
                this.status.setText('Ready. Opening lobby...');
                this.time.delayedCall(260, () => this.leaveScene());
            },
        });

        this.tweens.add({
            targets: this.status,
            alpha: { from: 0.65, to: 1 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    private leaveScene() {
        this.cameras.main.fadeOut(360, 8, 13, 20);
        this.time.delayedCall(380, () => {
            this.scene.start('LoginScene', { serverManager: this.serverManager });
        });
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        const minSide = Math.min(w, h);
        const cx = w * 0.5;
        const cy = h * 0.5;

        this.redrawBackground(w, h);

        this.glowA.setPosition(w * 0.22, h * 0.3).setSize(minSide * 0.6, minSide * 0.6);
        this.glowB.setPosition(w * 0.78, h * 0.68).setSize(minSide * 0.7, minSide * 0.7);
        this.glowC.setPosition(w * 0.5, h * 0.15).setSize(minSide * 0.4, minSide * 0.4);

        this.ring.setPosition(cx, cy * 0.72).setRadius(Math.max(74, minSide * 0.1));

        this.title
            .setPosition(cx, cy * 0.68)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.108, 56, 106)}px`);

        this.subtitle
            .setPosition(cx, cy * 0.77)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.034, 18, 30)}px`);

        this.status
            .setPosition(cx, cy * 1.11)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.019, 12, 16)}px`);

        this.progressLabel
            .setPosition(cx, cy * 1.16)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.018, 11, 15)}px`);

        this.redrawProgress();
    }

    private redrawBackground(w: number, h: number) {
        this.bg.clear();

        this.bg.fillStyle(0x080d14, 1);
        this.bg.fillRect(0, 0, w, h);

        const steps = 18;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const alpha = 0.2 * (1 - t);
            const y = h * t;
            this.bg.fillStyle(0x0e1a29, alpha);
            this.bg.fillRect(0, y, w, h / steps + 2);
        }

        this.bg.fillStyle(0x79d7ff, 0.04);
        this.bg.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.002 + 2);
        this.bg.fillRect(w * 0.2, h * 0.92, w * 0.6, h * 0.002 + 2);
    }

    private redrawProgress() {
        const w = this.scale.width;
        const h = this.scale.height;
        const minSide = Math.min(w, h);

        const barW = Phaser.Math.Clamp(minSide * 0.42, 240, 460);
        const barH = Phaser.Math.Clamp(minSide * 0.018, 8, 14);
        const x = w * 0.5 - barW * 0.5;
        const y = h * 0.64 + minSide * 0.22;

        this.progressTrack.clear();
        this.progressTrack.fillStyle(0x162331, 0.88);
        this.progressTrack.fillRoundedRect(x, y, barW, barH, barH * 0.5);
        this.progressTrack.lineStyle(1, 0x355874, 0.75);
        this.progressTrack.strokeRoundedRect(x, y, barW, barH, barH * 0.5);

        this.progressFill.clear();
        this.progressFill.fillStyle(0x66d1ff, 0.95);
        this.progressFill.fillRoundedRect(x + 2, y + 2, Math.max(0, (barW - 4) * this.progressValue), barH - 4, (barH - 4) * 0.5);

        this.progressLabel.setText(`${Math.round(this.progressValue * 100)}%`);
    }
}