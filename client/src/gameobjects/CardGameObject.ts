import Phaser from 'phaser';
import { CardType, ICardData } from '../../../shared/SharedTypes';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { requestCardArtwork, resolveCardArtworkTexture } from '../ui/CardArtworkResolver';

interface CardPalette {
    cardBody: number;
    cardInner: number;
    border: number;
    typeBadge: number;
    titleRibbon: number;
    footer: number;
    accentText: string;
    label: string;
}

const FONT_UI = APP_FONT_FAMILY;
const TEXT_RESOLUTION = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));

const CARD_W = 126;
const CARD_H = 178;
const ART_X = -CARD_W * 0.5 + 10;
const ART_Y = -CARD_H * 0.5 + 34;
const ART_W = CARD_W - 20;
const ART_H = 86;

const FALLBACK_PALETTE: CardPalette = {
    cardBody: 0x4a6079,
    cardInner: 0xf2efe7,
    border: 0x40586f,
    typeBadge: 0x3f5f82,
    titleRibbon: 0x294868,
    footer: 0x3a5879,
    accentText: '#2d455b',
    label: 'CARD',
};

const PALETTES: Partial<Record<CardType, CardPalette>> = {
    [CardType.HERO]: {
        cardBody: 0x2f8359,
        cardInner: 0xf6f3e9,
        border: 0x236446,
        typeBadge: 0x2b7a53,
        titleRibbon: 0x235f43,
        footer: 0x2a6e4f,
        accentText: '#2d5d45',
        label: 'HERO',
    },
    [CardType.ITEM]: {
        cardBody: 0x7d7d7d,
        cardInner: 0xf6f3ea,
        border: 0x555555,
        typeBadge: 0x5f5f5f,
        titleRibbon: 0x4d4d4d,
        footer: 0x575757,
        accentText: '#37414a',
        label: 'ITEM',
    },
    [CardType.MAGIC]: {
        cardBody: 0x5874b3,
        cardInner: 0xf4f2ea,
        border: 0x3d5792,
        typeBadge: 0x4b64a3,
        titleRibbon: 0x345393,
        footer: 0x3d5f9d,
        accentText: '#2d4677',
        label: 'MAGIC',
    },
    [CardType.MODIFIER]: {
        cardBody: 0x4a9b8f,
        cardInner: 0xf4f2ea,
        border: 0x2f756c,
        typeBadge: 0x3b867d,
        titleRibbon: 0x2c7168,
        footer: 0x337a71,
        accentText: '#2d635d',
        label: 'MOD',
    },
    [CardType.CHALLENGE]: {
        cardBody: 0x7f65c2,
        cardInner: 0xf4f2ea,
        border: 0x5c458f,
        typeBadge: 0x6b54a7,
        titleRibbon: 0x563f8b,
        footer: 0x624b98,
        accentText: '#4a3c6d',
        label: 'CHALL',
    },
    [CardType.MONSTER]: {
        cardBody: 0x3b88c7,
        cardInner: 0xf4f2ea,
        border: 0x2e6793,
        typeBadge: 0x387db3,
        titleRibbon: 0x2f6b9b,
        footer: 0x3373a4,
        accentText: '#294a62',
        label: 'MONSTER',
    },
};

export class CardGameObject extends Phaser.GameObjects.Container {
    public cardData: ICardData;
    public homeX = 0;
    public homeY = 0;

    private homeDepth = 0;

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

        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(-CARD_W * 0.5 + 4, -CARD_H * 0.5 + 6, CARD_W, CARD_H, 12);
        this.add(shadow);

        const frame = this.scene.add.graphics();
        frame.fillStyle(palette.cardBody, 1);
        frame.fillRoundedRect(-CARD_W * 0.5, -CARD_H * 0.5, CARD_W, CARD_H, 12);
        frame.fillStyle(palette.cardInner, 1);
        frame.fillRoundedRect(-CARD_W * 0.5 + 3, -CARD_H * 0.5 + 3, CARD_W - 6, CARD_H - 6, 10);
        frame.fillStyle(0xffffff, 0.52);
        frame.fillRoundedRect(-CARD_W * 0.5 + 4, -CARD_H * 0.5 + 4, CARD_W - 8, 24, { tl: 8, tr: 8, bl: 0, br: 0 });
        frame.lineStyle(2, palette.border, 1);
        frame.strokeRoundedRect(-CARD_W * 0.5, -CARD_H * 0.5, CARD_W, CARD_H, 12);
        frame.lineStyle(1, 0xffffff, 0.18);
        frame.strokeRoundedRect(-CARD_W * 0.5 + 3, -CARD_H * 0.5 + 3, CARD_W - 6, CARD_H - 6, 10);
        this.add(frame);

        const titleText = this.scene.add.text(0, -CARD_H * 0.5 + 13, this.fitCardTitle(this.cardData.name ?? this.cardData.templateId ?? 'CARD'), {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#2a2f35',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(titleText);

        const typeLine = this.scene.add.text(0, -CARD_H * 0.5 + 27, this.getHeaderTypeLine(palette.label), {
            fontFamily: FONT_UI,
            fontSize: '9px',
            color: palette.accentText,
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(typeLine);

        const artPanel = this.scene.add.graphics();
        artPanel.fillStyle(0x11161f, 1);
        artPanel.fillRoundedRect(ART_X, ART_Y, ART_W, ART_H, 8);
        artPanel.lineStyle(1.4, palette.border, 0.95);
        artPanel.strokeRoundedRect(ART_X, ART_Y, ART_W, ART_H, 8);
        artPanel.fillStyle(0xffffff, 0.06);
        artPanel.fillRoundedRect(ART_X + 2, ART_Y + 2, ART_W - 4, ART_H * 0.24, { tl: 6, tr: 6, bl: 0, br: 0 });
        this.add(artPanel);

        this.artFallback = this.drawUniqueArtwork(palette);
        this.add(this.artFallback);
        this.attachArtworkTexture();

        this.artSheen = this.scene.add.rectangle(
            ART_X - 18,
            ART_Y + ART_H * 0.5,
            Math.max(18, ART_W * 0.2),
            ART_H + 8,
            0xffffff,
            0.16,
        )
            .setAngle(-18)
            .setVisible(false)
            .setBlendMode(Phaser.BlendModes.SCREEN);
        this.add(this.artSheen);

        if (this.cardData.costPA !== undefined) {
            const costGem = this.scene.add.graphics();
            const cx = CARD_W * 0.5 - 16;
            const cy = -CARD_H * 0.5 + 16;
            costGem.fillStyle(0x161a23, 1);
            costGem.fillCircle(cx, cy, 11);
            costGem.lineStyle(1.8, palette.border, 0.95);
            costGem.strokeCircle(cx, cy, 11);
            this.add(costGem);

            const costText = this.scene.add.text(cx, cy, `${this.cardData.costPA}`, {
                fontFamily: FONT_UI,
                fontSize: '12px',
                color: '#f7fcff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(costText);
        }

        const descPanelY = CARD_H * 0.5 - 54;
        const descPanel = this.scene.add.graphics();
        descPanel.fillStyle(0xffffff, 0.92);
        descPanel.fillRoundedRect(-CARD_W * 0.5 + 10, descPanelY, CARD_W - 20, 30, 6);
        descPanel.lineStyle(1, palette.border, 0.28);
        descPanel.strokeRoundedRect(-CARD_W * 0.5 + 10, descPanelY, CARD_W - 20, 30, 6);
        this.add(descPanel);

        const descText = this.scene.add.text(0, descPanelY + 15, this.getMiniInfoStrip(), {
            fontFamily: FONT_UI,
            fontSize: '9px',
            color: '#2f3640',
            align: 'center',
            wordWrap: { width: CARD_W - 26 },
            lineSpacing: 1,
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(descText);

        const footer = this.scene.add.graphics();
        footer.fillStyle(palette.footer, 1);
        footer.fillRoundedRect(-CARD_W * 0.5, CARD_H * 0.5 - 18, CARD_W, 18, { tl: 0, tr: 0, bl: 10, br: 10 });
        this.add(footer);

        const footerText = this.scene.add.text(0, CARD_H * 0.5 - 9, this.buildFooterLabel(palette.label), {
            fontFamily: FONT_UI,
            fontSize: '8px',
            color: '#edf4ff',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        this.add(footerText);

        const equippedCount = this.getEquippedCount();
        if (equippedCount > 0 && this.isHeroCard()) {
            const equipBadge = this.scene.add.graphics();
            const bw = 36;
            const bh = 14;
            const bx = CARD_W * 0.5 - bw - 8;
            const by = CARD_H * 0.5 - bh - 20;
            equipBadge.fillStyle(0x1d2f45, 0.98);
            equipBadge.fillRoundedRect(bx, by, bw, bh, 5);
            equipBadge.lineStyle(1, 0x9dd6ff, 0.95);
            equipBadge.strokeRoundedRect(bx, by, bw, bh, 5);
            this.add(equipBadge);

            const equipText = this.scene.add.text(bx + bw * 0.5, by + bh * 0.5, `EQ ${equippedCount}`, {
                fontFamily: FONT_UI,
                fontSize: '8px',
                color: '#f1f8ff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(equipText);
        }

        this.setSize(CARD_W, CARD_H);
        this.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(this as unknown as Phaser.GameObjects.GameObject);
    }

    private fitCardTitle(raw: string): string {
        const trimmed = String(raw ?? '').trim();
        if (trimmed.length <= 21) return trimmed;
        return `${trimmed.slice(0, 18)}...`;
    }

    private getHeaderTypeLine(typeLabel: string): string {
        const rawSubtype = String(this.cardData.subtype ?? '').trim().toUpperCase();
        if (rawSubtype.length === 0) return typeLabel;
        return this.compactLine(`${typeLabel} | ${rawSubtype}`, 20);
    }

    private getMiniInfoStrip(): string {
        const cardAny = this.cardData as unknown as { shortDesc?: string };
        const shortDesc = typeof cardAny.shortDesc === 'string' ? cardAny.shortDesc.trim() : '';
        const full = String(this.cardData.description ?? '').trim();
        const source = this.compactLine(shortDesc || full, 36);
        const typeValue = String(this.cardData.type ?? '').toLowerCase();

        if (typeValue === CardType.HERO || typeValue === CardType.EMPLOYEE) {
            if (typeof this.cardData.targetRoll === 'number') return `EROE | Tiro ${this.cardData.targetRoll}+`;
            return source ? `EROE | ${source}` : 'EROE | Effetto attivo';
        }
        if (typeValue === CardType.MONSTER || typeValue === CardType.IMPREVISTO || typeValue === CardType.CRISIS) {
            const roll = typeof this.cardData.targetRoll === 'number' ? `ROLL ${this.cardData.targetRoll}+` : 'ROLL ?';
            return source ? `${roll} | ${source}` : `${roll} | Boss`;
        }
        if (typeValue === CardType.ITEM || typeValue === CardType.OGGETTO) {
            return source ? `EQUIP | ${source}` : 'EQUIP | Assegna a Hero';
        }
        if (typeValue === CardType.CHALLENGE || typeValue === CardType.MODIFIER) {
            return source ? `REACTION | ${source}` : 'REACTION | Finestra reazione';
        }
        if (typeValue === CardType.MAGIC || typeValue === CardType.EVENTO) {
            return source ? `MAGIC | ${source}` : 'MAGIC | Azione attiva';
        }

        return source || 'Carta speciale';
    }

    private buildFooterLabel(typeLabel: string): string {
        const parts: string[] = [typeLabel];
        if (typeof this.cardData.targetRoll === 'number') {
            parts.push(`D${this.cardData.targetRoll}+`);
        }
        if (typeof this.cardData.modifier === 'number' && this.cardData.modifier !== 0) {
            parts.push(`${this.cardData.modifier > 0 ? '+' : ''}${this.cardData.modifier}`);
        }
        return parts.join(' | ');
    }

    private compactLine(value: string, maxLen: number): string {
        const oneLine = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (!oneLine) return '';
        if (oneLine.length <= maxLen) return oneLine;
        return `${oneLine.slice(0, Math.max(0, maxLen - 3))}...`;
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
            this.artFallback.setAlpha(0.28);
        }
        if (this.artSheen) {
            this.bringToTop(this.artSheen);
        }
    }

    private showArtworkFallback() {
        if (this.artImage) this.artImage.setVisible(false);
        if (this.artFallback) this.artFallback.setAlpha(1);
    }

    private drawUniqueArtwork(palette: CardPalette): Phaser.GameObjects.Graphics {
        const art = this.scene.add.graphics();

        const seedSource = `${this.cardData.templateId}|${this.cardData.type}|${this.cardData.name ?? ''}`;
        let seed = this.hashSeed(seedSource);
        const rand = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        art.fillStyle(this.shiftColor(palette.cardBody, 10), 1);
        art.fillRoundedRect(ART_X + 1, ART_Y + 1, ART_W - 2, ART_H - 2, 7);

        const pixel = 6;
        const rows = Math.floor((ART_H - 8) / pixel);
        const cols = Math.floor((ART_W - 8) / pixel);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (rand() > 0.36) continue;
                const tone = this.shiftColor(palette.border, Math.floor(rand() * 20) - 10);
                art.fillStyle(tone, 0.22 + rand() * 0.22);
                art.fillRect(ART_X + 4 + c * pixel, ART_Y + 4 + r * pixel, pixel - 1, pixel - 1);
            }
        }

        const motifCount = 3 + Math.floor(rand() * 3);
        for (let i = 0; i < motifCount; i++) {
            const cx = ART_X + 10 + rand() * (ART_W - 20);
            const cy = ART_Y + 10 + rand() * (ART_H - 20);
            const size = 6 + rand() * 10;
            const motifColor = this.shiftColor(palette.border, Math.floor(rand() * 18));
            art.fillStyle(motifColor, 0.55);
            art.fillRect(cx - size * 0.5, cy - size * 0.5, size, size * 0.75);
        }

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

        this.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            if ((pointer as any).pointerType === 'touch') return;
            if (this.getData('dragging')) return;
            this.scene.tweens.killTweensOf(this);
            this.playArtSheen();
            this.scene.tweens.add({
                targets: this,
                y: this.homeY - 12,
                scaleX: 1.05,
                scaleY: 1.05,
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
                scaleX: 1.09,
                scaleY: 1.09,
                duration: 100,
                ease: 'Sine.Out',
            });
        });

        this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            this.x = dragX;
            this.y = dragY;
            this.angle = Phaser.Math.Clamp((dragX - this.homeX) * 0.04, -10, 10);
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
