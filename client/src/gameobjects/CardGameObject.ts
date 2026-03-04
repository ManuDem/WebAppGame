import Phaser from 'phaser';
import { CardType, ICardData } from '../../../shared/SharedTypes';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { requestCardArtwork, resolveCardArtworkTexture } from '../ui/CardArtworkResolver';

interface CardPalette {
    body: number;
    border: number;
    topBand: number;
    badge: number;
    accentText: string;
    label: string;
}

const FALLBACK_PALETTE: CardPalette = {
    body: 0x1b2836,
    border: 0x8ac5f2,
    topBand: 0x23364a,
    badge: 0x34526f,
    accentText: '#d5edff',
    label: 'CARD',
};

const FONT_TITLE = APP_FONT_FAMILY;
const FONT_META = APP_FONT_FAMILY;
const TEXT_RESOLUTION = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));

const CARD_W = 128;
const CARD_H = 182;
const ART_X = -CARD_W * 0.5 + 9;
const ART_Y = -CARD_H * 0.5 + 62;
const ART_W = CARD_W - 18;
const ART_H = 56;

const PALETTES: Partial<Record<CardType, CardPalette>> = {
    [CardType.HERO]: {
        body: 0x102436,
        border: 0x6fd3ff,
        topBand: 0x17374e,
        badge: 0x1f4d6d,
        accentText: '#bce9ff',
        label: 'HERO',
    },
    [CardType.ITEM]: {
        body: 0x302612,
        border: 0xffd374,
        topBand: 0x47361a,
        badge: 0x7a5f2c,
        accentText: '#ffe8b8',
        label: 'ITEM',
    },
    [CardType.MAGIC]: {
        body: 0x1d2438,
        border: 0x9cc3ff,
        topBand: 0x2d3550,
        badge: 0x4b5f97,
        accentText: '#d8e7ff',
        label: 'MAGIC',
    },
    [CardType.MODIFIER]: {
        body: 0x1d2f2b,
        border: 0x91efdd,
        topBand: 0x28413b,
        badge: 0x3f6e64,
        accentText: '#d6fff7',
        label: 'MOD',
    },
    [CardType.CHALLENGE]: {
        body: 0x211d37,
        border: 0xcab2ff,
        topBand: 0x332b57,
        badge: 0x5849a1,
        accentText: '#e6dbff',
        label: 'CHALL',
    },
    [CardType.MONSTER]: {
        body: 0x2d1820,
        border: 0xff8ba5,
        topBand: 0x43222d,
        badge: 0x713245,
        accentText: '#ffd6df',
        label: 'MONSTER',
    },
};

export class CardGameObject extends Phaser.GameObjects.Container {
    public cardData: ICardData;
    public homeX = 0;
    public homeY = 0;

    private homeDepth = 0;

    private shadow!: Phaser.GameObjects.Graphics;
    private frame!: Phaser.GameObjects.Graphics;
    private artFallback?: Phaser.GameObjects.Graphics;
    private artImage?: Phaser.GameObjects.Image;
    private artSheen?: Phaser.GameObjects.Rectangle;
    private artSheenTween?: Phaser.Tweens.Tween;

    constructor(scene: Phaser.Scene, x: number, y: number, data: ICardData) {
        super(scene, x, y);

        this.cardData = data;
        this.homeX = x;
        this.homeY = y;

        this.buildVisuals();
        this.setupInput();
    }

    public setHome(x: number, y: number, depth = 0) {
        this.homeX = x;
        this.homeY = y;
        this.homeDepth = depth;
        this.setDepth(depth);
    }

    private buildVisuals() {
        const palette =
            PALETTES[this.cardData.type]
            ?? PALETTES[CardType.MAGIC]
            ?? PALETTES[CardType.EVENTO]
            ?? FALLBACK_PALETTE;

        this.shadow = this.scene.add.graphics();
        this.shadow.fillStyle(0x000000, 0.35);
        this.shadow.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 6, CARD_W, CARD_H, 14);
        this.add(this.shadow);

        this.frame = this.scene.add.graphics();
        this.frame.fillStyle(palette.body, 0.98);
        this.frame.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);

        this.frame.fillStyle(palette.topBand, 1);
        this.frame.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 32, { tl: 14, tr: 14, bl: 0, br: 0 });

        this.frame.lineStyle(1.8, palette.border, 0.96);
        this.frame.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);

        this.frame.lineStyle(1, palette.border, 0.2);
        this.frame.beginPath();
        this.frame.moveTo(-CARD_W / 2 + 8, -CARD_H / 2 + 40);
        this.frame.lineTo(CARD_W / 2 - 8, -CARD_H / 2 + 40);
        this.frame.strokePath();

        this.frame.fillStyle(0xffffff, 0.04);
        this.frame.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, 24, { tl: 10, tr: 10, bl: 0, br: 0 });

        this.add(this.frame);

        const titleText = this.scene.add.text(0, -CARD_H / 2 + 16, (this.cardData.name ?? this.cardData.templateId).slice(0, 22), {
            fontFamily: FONT_TITLE,
            fontSize: '13px',
            color: '#f4fbff',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: CARD_W - 20 },
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(titleText);

        const templateText = this.scene.add.text(0, -CARD_H / 2 + 52, this.cardData.templateId, {
            fontFamily: FONT_META,
            fontSize: '10px',
            color: palette.accentText,
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(templateText);

        const typeChip = this.scene.add.graphics();
        typeChip.fillStyle(this.shiftColor(palette.badge, 12), 1);
        typeChip.fillRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 8, 18, 18, 6);
        typeChip.lineStyle(1, this.shiftColor(palette.border, 18), 0.9);
        typeChip.strokeRoundedRect(-CARD_W / 2 + 8, -CARD_H / 2 + 8, 18, 18, 6);
        this.add(typeChip);

        const typeChipText = this.scene.add.text(-CARD_W / 2 + 17, -CARD_H / 2 + 17, palette.label[0], {
            fontFamily: FONT_META,
            fontSize: '11px',
            color: '#f8fcff',
            fontStyle: '700',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(typeChipText);

        this.artFallback = this.drawUniqueArtwork(palette);
        this.add(this.artFallback);
        this.attachArtworkTexture();

        this.artSheen = this.scene.add.rectangle(
            ART_X - 18,
            ART_Y + ART_H * 0.5,
            Math.max(18, ART_W * 0.18),
            ART_H + 6,
            0xffffff,
            0.14,
        )
            .setAngle(-18)
            .setVisible(false)
            .setBlendMode(Phaser.BlendModes.SCREEN);
        this.add(this.artSheen);

        const descPanel = this.scene.add.graphics();
        descPanel.fillStyle(0x0b121b, 0.58);
        descPanel.fillRoundedRect(-CARD_W / 2 + 8, 22, CARD_W - 16, 48, 7);
        descPanel.lineStyle(1, 0x88b5d9, 0.22);
        descPanel.strokeRoundedRect(-CARD_W / 2 + 8, 22, CARD_W - 16, 48, 7);
        this.add(descPanel);

        const cardAny = this.cardData as unknown as { shortDesc?: string };
        const shortDesc = typeof cardAny.shortDesc === 'string' ? cardAny.shortDesc : '';
        const descSource = shortDesc || this.cardData.description || '';
        const desc = descSource.length > 54
            ? `${descSource.slice(0, 51)}...`
            : descSource;

        const descText = this.scene.add.text(0, 46, desc, {
            fontFamily: FONT_TITLE,
            fontSize: '11px',
            color: '#deedf8',
            align: 'center',
            wordWrap: { width: CARD_W - 22 },
            lineSpacing: 2,
        }).setOrigin(0.5, 0.5).setResolution(TEXT_RESOLUTION);
        this.add(descText);

        const footer = this.scene.add.graphics();
        footer.fillStyle(palette.badge, 1);
        footer.fillRoundedRect(-CARD_W / 2, CARD_H / 2 - 24, CARD_W, 24, { tl: 0, tr: 0, bl: 12, br: 12 });
        this.add(footer);

        const footerParts: string[] = [palette.label];
        if (typeof this.cardData.targetRoll === 'number') {
            footerParts.push(`D${this.cardData.targetRoll}+`);
        }
        if (typeof this.cardData.modifier === 'number' && this.cardData.modifier !== 0) {
            footerParts.push(`${this.cardData.modifier > 0 ? '+' : ''}${this.cardData.modifier}`);
        }
        const typeText = this.scene.add.text(0, CARD_H / 2 - 12, footerParts.join(' | '), {
            fontFamily: FONT_META,
            fontSize: '10px',
            color: '#f2f8ff',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(typeText);

        const equippedCount = this.getEquippedCount();
        if (equippedCount > 0 && this.isHeroCard()) {
            const equipBadge = this.scene.add.graphics();
            const bw = 38;
            const bh = 16;
            const bx = CARD_W * 0.5 - bw - 8;
            const by = CARD_H * 0.5 - bh - 28;
            equipBadge.fillStyle(0x12364c, 0.96);
            equipBadge.fillRoundedRect(bx, by, bw, bh, 6);
            equipBadge.lineStyle(1, 0x8fd4ff, 0.95);
            equipBadge.strokeRoundedRect(bx, by, bw, bh, 6);
            this.add(equipBadge);

            const equipText = this.scene.add.text(bx + bw * 0.5, by + bh * 0.5, `EQ ${equippedCount}`, {
                fontFamily: FONT_META,
                fontSize: '9px',
                color: '#e5f4ff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(equipText);
        }

        if (this.cardData.costPA !== undefined) {
            const bubble = this.scene.add.graphics();
            const cx = CARD_W / 2 - 15;
            const cy = -CARD_H / 2 + 15;
            bubble.fillStyle(0x0d1621, 1);
            bubble.fillCircle(cx, cy, 12);
            bubble.lineStyle(1.6, palette.border, 1);
            bubble.strokeCircle(cx, cy, 12);
            this.add(bubble);

            const costText = this.scene.add.text(cx, cy, `${this.cardData.costPA}`, {
                fontFamily: FONT_META,
                fontSize: '14px',
                color: '#ecf7ff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(costText);
        }

        this.setSize(CARD_W, CARD_H);
        this.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(this as unknown as Phaser.GameObjects.GameObject);
    }

    private attachArtworkTexture() {
        const existingTexture = resolveCardArtworkTexture(this.scene, this.cardData);
        if (existingTexture) {
            this.applyArtworkTexture(existingTexture);
            return;
        }

        this.showArtworkFallback();
        requestCardArtwork(this.scene, this.cardData, (loadedTexture) => {
            if (!this.active) return;
            this.applyArtworkTexture(loadedTexture);
        });
    }

    private applyArtworkTexture(textureKey: string) {
        if (!this.scene.textures.exists(textureKey)) {
            this.showArtworkFallback();
            return;
        }

        if (!this.artImage) {
            this.artImage = this.scene.add.image(
                ART_X + ART_W * 0.5,
                ART_Y + ART_H * 0.5,
                textureKey,
            ).setOrigin(0.5);
            this.add(this.artImage);
        } else {
            this.artImage.setTexture(textureKey);
        }

        const frame = this.artImage.frame;
        const sourceW = Math.max(1, frame.realWidth || frame.width);
        const sourceH = Math.max(1, frame.realHeight || frame.height);
        const scale = Math.min((ART_W - 8) / sourceW, (ART_H - 8) / sourceH);
        this.artImage.setDisplaySize(
            Math.max(1, Math.floor(sourceW * scale)),
            Math.max(1, Math.floor(sourceH * scale)),
        );
        this.artImage.setVisible(true);

        if (this.artFallback) {
            this.artFallback.setAlpha(0.26);
        }
        if (this.artSheen) {
            this.bringToTop(this.artSheen);
        }
    }

    private showArtworkFallback() {
        if (this.artImage) {
            this.artImage.setVisible(false);
        }
        if (this.artFallback) {
            this.artFallback.setAlpha(1);
        }
    }

    private drawUniqueArtwork(palette: CardPalette): Phaser.GameObjects.Graphics {
        const art = this.scene.add.graphics();

        const seedSource = `${this.cardData.templateId}|${this.cardData.type}|${this.cardData.name ?? ''}`;
        let seed = this.hashSeed(seedSource);
        const rand = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        art.fillStyle(this.shiftColor(palette.body, 14), 1);
        art.fillRoundedRect(ART_X, ART_Y, ART_W, ART_H, 8);
        art.lineStyle(1, this.shiftColor(palette.border, 16), 0.95);
        art.strokeRoundedRect(ART_X, ART_Y, ART_W, ART_H, 8);

        const stripeCount = 4 + Math.floor(rand() * 4);
        for (let i = 0; i < stripeCount; i++) {
            const stripeY = ART_Y + 3 + ((ART_H - 8) / Math.max(1, stripeCount - 1)) * i;
            art.fillStyle(this.shiftColor(palette.topBand, Math.floor(rand() * 24)), 0.22 + rand() * 0.18);
            art.fillRect(ART_X + 3, stripeY, ART_W - 6, 3 + Math.floor(rand() * 2));
        }

        const motifCount = 5 + Math.floor(rand() * 3);
        for (let i = 0; i < motifCount; i++) {
            const cx = ART_X + 8 + rand() * (ART_W - 16);
            const cy = ART_Y + 8 + rand() * (ART_H - 16);
            const size = 4 + rand() * 9;
            const motifColor = this.shiftColor(palette.border, -8 + Math.floor(rand() * 36));
            const shape = Math.floor(rand() * 3);

            art.fillStyle(motifColor, 0.68);
            if (shape === 0) {
                art.fillCircle(cx, cy, size * 0.5);
            } else if (shape === 1) {
                art.fillTriangle(
                    cx,
                    cy - size * 0.6,
                    cx + size * 0.6,
                    cy + size * 0.6,
                    cx - size * 0.6,
                    cy + size * 0.6,
                );
            } else {
                art.fillRect(cx - size * 0.55, cy - size * 0.55, size * 1.1, size * 1.1);
            }
        }

        art.lineStyle(1, 0xffffff, 0.16);
        art.beginPath();
        art.moveTo(ART_X + 6, ART_Y + 8);
        art.lineTo(ART_X + ART_W - 10, ART_Y + ART_H - 10);
        art.strokePath();

        return art;
    }

    private playArtSheen() {
        if (!this.artSheen) return;
        if (this.artSheenTween) this.artSheenTween.stop();

        this.artSheen
            .setVisible(true)
            .setAlpha(0)
            .setPosition(ART_X - 14, ART_Y + ART_H * 0.5);

        this.artSheenTween = this.scene.tweens.add({
            targets: this.artSheen,
            x: ART_X + ART_W + 14,
            alpha: { from: 0.02, to: 0.18 },
            duration: 320,
            ease: 'Sine.Out',
            onComplete: () => {
                if (!this.artSheen) return;
                this.scene.tweens.add({
                    targets: this.artSheen,
                    alpha: 0,
                    duration: 120,
                    onComplete: () => this.artSheen?.setVisible(false),
                });
            },
        });
    }

    private hashSeed(text: string): number {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    private isHeroCard() {
        const typeValue = String(this.cardData.type ?? '').toLowerCase();
        return typeValue === 'hero' || typeValue === 'employee';
    }

    private getEquippedCount(): number {
        const equipped = (this.cardData as unknown as { equippedItems?: { length?: number } }).equippedItems;
        const count = Number(equipped?.length ?? 0);
        return Number.isFinite(count) ? Math.max(0, count) : 0;
    }

    private shiftColor(color: number, amount: number): number {
        const r = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255);
        const g = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255);
        const b = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255);
        return (r << 16) | (g << 8) | b;
    }

    private setupInput() {
        this.on('pointerdown', () => {
            this.setData('dragStarted', false);
        });

        this.on('pointerover', () => {
            if (this.getData('dragging')) return;
            this.scene.tweens.killTweensOf(this);
            this.playArtSheen();
            this.scene.tweens.add({
                targets: this,
                y: this.homeY - 14,
                scaleX: 1.06,
                scaleY: 1.06,
                duration: 130,
                ease: 'Sine.Out',
            });
            this.setDepth(this.homeDepth + 20);
        });

        this.on('pointerout', () => {
            if (this.getData('dragging')) return;
            this.scene.tweens.killTweensOf(this);
            this.scene.tweens.add({
                targets: this,
                y: this.homeY,
                scaleX: 1,
                scaleY: 1,
                duration: 120,
                ease: 'Sine.Out',
            });
            this.setDepth(this.homeDepth);
        });

        this.on('dragstart', () => {
            this.setData('dragging', true);
            this.setData('dragStarted', true);
            this.setDepth(3000);
            this.scene.tweens.killTweensOf(this);
            this.scene.tweens.add({
                targets: this,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 100,
                ease: 'Sine.Out',
            });
        });

        this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            this.x = dragX;
            this.y = dragY;
            this.angle = Phaser.Math.Clamp((dragX - this.homeX) * 0.045, -12, 12);
        });

        this.on('dragend', (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
            this.setData('dragging', false);
            this.setDepth(this.homeDepth);
            this.scene.tweens.killTweensOf(this);

            if (!dropped) {
                this.scene.tweens.add({
                    targets: this,
                    x: this.homeX,
                    y: this.homeY,
                    scaleX: 1,
                    scaleY: 1,
                    angle: 0,
                    duration: 220,
                    ease: 'Cubic.Out',
                });
            } else {
                this.setScale(1).setAngle(0);
            }
        });
    }
}
