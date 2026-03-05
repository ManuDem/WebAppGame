import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import {
    applyBrandTypography,
    BRAND_SUBTITLE_STYLE,
    BRAND_TITLE_STYLE,
    BRAND_TITLE_TEXT,
    getBrandHeaderMetrics,
    placeBrandHeader,
} from '../ui/Branding';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { preloadCardArtworkManifest } from '../ui/CardArtworkResolver';
import { setUiRootLanguage, setUiRootScreen, syncUiRootViewport } from '../ui/dom/UiRoot';

const FONT_UI = APP_FONT_FAMILY;

export class BootScene extends Phaser.Scene {
    private serverManager!: ServerManager;

    private bg!: Phaser.GameObjects.Graphics;
    private cloudLayer!: Phaser.GameObjects.TileSprite;
    private ditherLayer!: Phaser.GameObjects.TileSprite;

    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private status!: Phaser.GameObjects.Text;

    private progressTrack!: Phaser.GameObjects.Graphics;
    private progressFill!: Phaser.GameObjects.Graphics;
    private progressLabel!: Phaser.GameObjects.Text;

    private progressValue = 0;
    private lang: SupportedLanguage = DEFAULT_LANGUAGE;
    private readonly textResolution = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));

    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        const iconEntries: Array<[string, string]> = [
            ['ui-ap', '/icons/ap.svg'],
            ['ui-deck', '/icons/deck.svg'],
            ['ui-players', '/icons/players.svg'],
            ['ui-start', '/icons/start.svg'],
        ];

        iconEntries.forEach(([key, path]) => {
            if (!this.textures.exists(key)) {
                this.load.image(key, path);
            }
        });

        preloadCardArtworkManifest(this);
    }

    create() {
        const params = new URLSearchParams(window.location.search);
        const queryLang = params.get('lang');
        this.lang = sanitizeLanguage(queryLang ?? localStorage.getItem('lucrare_lang'));
        if (queryLang) localStorage.setItem('lucrare_lang', this.lang);
        setUiRootScreen('boot');
        setUiRootLanguage(this.lang);
        syncUiRootViewport(this.scale.width, this.scale.height);
        this.serverManager = new ServerManager();

        this.bg = this.add.graphics();
        ensurePokemonTextures(this);
        this.cloudLayer = this.add.tileSprite(0, 0, 256, 128, 'poke-clouds')
            .setOrigin(0)
            .setAlpha(0.33)
            .setDepth(-60);
        this.ditherLayer = this.add.tileSprite(0, 0, 64, 64, 'poke-dither')
            .setOrigin(0)
            .setAlpha(0.2)
            .setDepth(-59);

        this.title = this.add.text(0, 0, BRAND_TITLE_TEXT, BRAND_TITLE_STYLE).setOrigin(0.5).setAlpha(0);
        this.subtitle = this.add.text(0, 0, t(this.lang, 'brand_subtitle'), BRAND_SUBTITLE_STYLE).setOrigin(0.5).setAlpha(0);

        this.status = this.add.text(0, 0, t(this.lang, 'boot_loading'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#163b57',
            stroke: '#eff6ff',
            strokeThickness: 1,
            fontStyle: '600',
            letterSpacing: 0.5,
        }).setOrigin(0.5).setAlpha(0.92);

        this.progressTrack = this.add.graphics();
        this.progressFill = this.add.graphics();

        this.progressLabel = this.add.text(0, 0, '0%', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#143955',
            stroke: '#eef6ff',
            strokeThickness: 1,
            fontStyle: '700',
        }).setOrigin(0.5);
        this.boostText(this.title, this.subtitle, this.status, this.progressLabel);

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
        });

        this.handleResize(this.scale.gameSize);

        this.cameras.main.fadeIn(380, 8, 13, 20);

        this.tweens.add({ targets: this.title, alpha: 1, duration: 520, ease: 'Sine.Out' });
        this.tweens.add({ targets: this.subtitle, alpha: 1, duration: 520, delay: 160, ease: 'Sine.Out' });

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
                this.status.setText(t(this.lang, 'boot_ready'));
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

    update() {
        this.cloudLayer.tilePositionX += 0.09;
        this.cloudLayer.tilePositionY += 0.01;
        this.ditherLayer.tilePositionX += 0.035;
        this.ditherLayer.tilePositionY += 0.007;
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        const minSide = Math.min(w, h);
        const cx = w * 0.5;
        const cy = h * 0.5;

        this.redrawBackground(w, h);
        this.cloudLayer.setSize(w, h);
        this.ditherLayer.setSize(w, h);
        syncUiRootViewport(w, h);

        const header = getBrandHeaderMetrics(w, h);
        placeBrandHeader(this.title, this.subtitle, cx, header);
        applyBrandTypography(this.title, this.subtitle, header);

        this.status
            .setPosition(cx, cy * 1.11)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.019, 12, 16)}px`);

        this.progressLabel
            .setPosition(cx, cy * 1.16)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.018, 11, 15)}px`);

        this.redrawProgress();
    }

    private redrawBackground(w: number, h: number) {
        drawPokemonBackdrop(this.bg, w, h, 0.62);
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
        this.progressTrack.fillStyle(0x2a3243, 0.9);
        this.progressTrack.fillRoundedRect(x, y, barW, barH, barH * 0.5);
        this.progressTrack.lineStyle(1, 0x96836a, 0.8);
        this.progressTrack.strokeRoundedRect(x, y, barW, barH, barH * 0.5);

        this.progressFill.clear();
        this.progressFill.fillStyle(0xe2b980, 0.95);
        this.progressFill.fillRoundedRect(x + 2, y + 2, Math.max(0, (barW - 4) * this.progressValue), barH - 4, (barH - 4) * 0.5);

        this.progressLabel.setText(`${Math.round(this.progressValue * 100)}%`);
    }

    private boostText(...texts: Phaser.GameObjects.Text[]) {
        texts.forEach((text) => text.setResolution(this.textResolution));
    }
}
