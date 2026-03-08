import Phaser from 'phaser';
import { CardType, ICardData } from '../../../shared/SharedTypes';
import { sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { fitTextToBox } from '../ui/text/FitText';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { localizeCardType } from '../ui/cards/CardPresentationModel';

interface CardPalette {
    cardBody: number;
    cardInner: number;
    border: number;
    typeBadge: number;
    titleRibbon: number;
    footer: number;
    accentText: string;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface CardGameObjectOptions {
    lang?: SupportedLanguage;
    translate?: TranslateFn;
}

const FONT_UI = APP_FONT_FAMILY;
const TEXT_RESOLUTION = 4;

const CARD_W = 128;
const CARD_H = 184;

const FALLBACK_PALETTE: CardPalette = {
    cardBody: 0x3f5d7b,
    cardInner: 0xf2efe7,
    border: 0x2e4560,
    typeBadge: 0x45688f,
    titleRibbon: 0x294968,
    footer: 0x324a66,
    accentText: '#253a52',
};

const PALETTES: Partial<Record<CardType, CardPalette>> = {
    [CardType.HERO]: {
        cardBody: 0x2f7f5c,
        cardInner: 0xf6f3e9,
        border: 0x1f5941,
        typeBadge: 0x2b7753,
        titleRibbon: 0x1f5f44,
        footer: 0x255b43,
        accentText: '#244f3b',
    },
    [CardType.ITEM]: {
        cardBody: 0x7e7a6c,
        cardInner: 0xf6f3ea,
        border: 0x575246,
        typeBadge: 0x686355,
        titleRibbon: 0x4f4b40,
        footer: 0x5a5448,
        accentText: '#443f35',
    },
    [CardType.MAGIC]: {
        cardBody: 0x4f6daa,
        cardInner: 0xf4f2ea,
        border: 0x334f84,
        typeBadge: 0x44619d,
        titleRibbon: 0x2e4e8f,
        footer: 0x365992,
        accentText: '#223c69',
    },
    [CardType.MODIFIER]: {
        cardBody: 0x418f86,
        cardInner: 0xf4f2ea,
        border: 0x2a6e67,
        typeBadge: 0x3b7e77,
        titleRibbon: 0x2d6861,
        footer: 0x2f7069,
        accentText: '#20504b',
    },
    [CardType.CHALLENGE]: {
        cardBody: 0x745eb4,
        cardInner: 0xf4f2ea,
        border: 0x563f88,
        typeBadge: 0x644f9d,
        titleRibbon: 0x4f3c82,
        footer: 0x5a4492,
        accentText: '#3d325d',
    },
    [CardType.MONSTER]: {
        cardBody: 0x3f79b3,
        cardInner: 0xf4f2ea,
        border: 0x2d5784,
        typeBadge: 0x3c6e9e,
        titleRibbon: 0x2d618f,
        footer: 0x2f638f,
        accentText: '#25435d',
    },
};

export class CardGameObject extends Phaser.GameObjects.Container {
    public cardData: ICardData;
    public homeX = 0;
    public homeY = 0;

    private homeDepth = 0;
    private playabilityOutline?: Phaser.GameObjects.Graphics;
    private readonly lang: SupportedLanguage;
    private readonly translateFn?: TranslateFn;

    constructor(scene: Phaser.Scene, x: number, y: number, data: ICardData, options: CardGameObjectOptions = {}) {
        super(scene, x, y);

        this.cardData = data;
        this.homeX = x;
        this.homeY = y;
        this.lang = options.lang ?? sanitizeLanguage(localStorage.getItem('lucrare_lang'));
        this.translateFn = options.translate;

        this.buildVisuals();
        this.setupInput();
    }

    public setHome(x: number, y: number, depth = 0) {
        this.homeX = x;
        this.homeY = y;
        this.homeDepth = depth;
        this.setDepth(depth);
    }

    private tr(key: string, vars?: Record<string, string | number>): string {
        if (this.translateFn) return this.translateFn(key, vars);
        return t(this.lang, key, vars);
    }

    private buildVisuals() {
        const palette =
            PALETTES[this.cardData.type]
            ?? PALETTES[CardType.MAGIC]
            ?? PALETTES[CardType.EVENTO]
            ?? FALLBACK_PALETTE;
        const bodyX = -CARD_W * 0.5 + 8;
        const bodyW = CARD_W - 16;

        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.32);
        shadow.fillRoundedRect(-CARD_W * 0.5 + 3, -CARD_H * 0.5 + 4, CARD_W, CARD_H, 13);
        this.add(shadow);

        const frame = this.scene.add.graphics();
        frame.fillStyle(palette.cardBody, 1);
        frame.fillRoundedRect(-CARD_W * 0.5, -CARD_H * 0.5, CARD_W, CARD_H, 13);
        frame.fillStyle(this.shiftColor(palette.cardBody, 14), 0.28);
        frame.fillRoundedRect(-CARD_W * 0.5 + 2, -CARD_H * 0.5 + 2, CARD_W - 4, 22, { tl: 11, tr: 11, bl: 0, br: 0 });
        frame.fillStyle(this.shiftColor(palette.cardBody, -18), 0.34);
        frame.fillRoundedRect(-CARD_W * 0.5 + 4, -CARD_H * 0.5 + 4, CARD_W - 8, CARD_H - 8, 10);
        frame.lineStyle(2, palette.border, 1);
        frame.strokeRoundedRect(-CARD_W * 0.5, -CARD_H * 0.5, CARD_W, CARD_H, 13);
        frame.lineStyle(1, 0xffffff, 0.16);
        frame.strokeRoundedRect(-CARD_W * 0.5 + 3, -CARD_H * 0.5 + 3, CARD_W - 6, CARD_H - 6, 10);

        const titleBandY = -CARD_H * 0.5 + 9;
        const titleBandH = 22;
        frame.fillStyle(palette.titleRibbon, 0.94);
        frame.fillRoundedRect(bodyX, titleBandY, bodyW, titleBandH, 8);
        frame.fillStyle(0xffffff, 0.12);
        frame.fillRoundedRect(bodyX + 1, titleBandY + 1, bodyW - 2, 7, { tl: 7, tr: 7, bl: 0, br: 0 });

        const typeBadgeY = titleBandY + titleBandH + 7;
        const typeBadgeH = 20;
        frame.fillStyle(palette.typeBadge, 0.98);
        frame.fillRoundedRect(bodyX, typeBadgeY, bodyW, typeBadgeH, 7);
        frame.lineStyle(1, 0xffffff, 0.26);
        frame.strokeRoundedRect(bodyX, typeBadgeY, bodyW, typeBadgeH, 7);

        const artlessBodyY = typeBadgeY + typeBadgeH + 8;
        const artlessBodyH = 86;
        frame.fillStyle(0x0f1a27, 0.4);
        frame.fillRoundedRect(bodyX, artlessBodyY, bodyW, artlessBodyH, 8);
        frame.lineStyle(1, this.shiftColor(palette.border, 6), 0.24);
        frame.strokeRoundedRect(bodyX, artlessBodyY, bodyW, artlessBodyH, 8);

        const metaBandY = CARD_H * 0.5 - 32;
        const metaBandH = 22;
        frame.fillStyle(0x122030, 0.72);
        frame.fillRoundedRect(bodyX, metaBandY, bodyW, metaBandH, 8);
        frame.lineStyle(1, this.shiftColor(palette.border, 14), 0.42);
        frame.strokeRoundedRect(bodyX, metaBandY, bodyW, metaBandH, 8);
        this.add(frame);

        this.playabilityOutline = this.scene.add.graphics();
        this.add(this.playabilityOutline);

        const titleText = this.scene.add.text(0, titleBandY + titleBandH * 0.5, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#f4f9ff',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        const cardLabel = this.lang === 'it' ? 'CARTA' : 'CARD';
        fitTextToBox(
            titleText,
            cardLabel,
            bodyW - 8,
            titleBandH - 4,
            { maxLines: 1, ellipsis: true, fontSize: 10 },
        );
        this.add(titleText);

        const typeLine = this.scene.add.text(0, typeBadgeY + typeBadgeH * 0.5, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#f4f9ff',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        fitTextToBox(
            typeLine,
            this.getHeaderTypeLine(),
            bodyW - 10,
            typeBadgeH - 2,
            { maxLines: 1, ellipsis: true, fontSize: 10 },
        );
        this.add(typeLine);

        const centerBadge = this.scene.add.text(0, artlessBodyY + artlessBodyH * 0.5, '', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#e9f4ff',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        fitTextToBox(
            centerBadge,
            this.getTypeAbbreviation(),
            bodyW - 14,
            artlessBodyH - 6,
            { maxLines: 1, ellipsis: true, fontSize: 22 },
        );
        this.add(centerBadge);

        const metaText = this.scene.add.text(0, metaBandY + metaBandH * 0.5, '', {
            fontFamily: FONT_UI,
            fontSize: '9px',
            color: '#eef5ff',
            fontStyle: '700',
            align: 'center',
            letterSpacing: 0.5,
        }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
        fitTextToBox(
            metaText,
            this.getMetaLine(),
            bodyW - 10,
            metaBandH - 2,
            { maxLines: 1, ellipsis: true, fontSize: 9 },
        );
        this.add(metaText);

        if (this.cardData.costPA !== undefined) {
            const chipW = 32;
            const chipH = 22;
            const chipX = CARD_W * 0.5 - chipW - 9;
            const chipY = -CARD_H * 0.5 + 10;
            const costChip = this.scene.add.graphics();
            costChip.fillStyle(0x18283b, 0.98);
            costChip.fillRoundedRect(chipX, chipY, chipW, chipH, 8);
            costChip.fillStyle(0xffffff, 0.1);
            costChip.fillRoundedRect(chipX + 1, chipY + 1, chipW - 2, 7, { tl: 7, tr: 7, bl: 0, br: 0 });
            costChip.lineStyle(1.5, palette.border, 0.95);
            costChip.strokeRoundedRect(chipX, chipY, chipW, chipH, 8);
            this.add(costChip);

            const costText = this.scene.add.text(chipX + chipW * 0.5, chipY + chipH * 0.5, `${this.cardData.costPA} PA`, {
                fontFamily: FONT_UI,
                fontSize: '8px',
                color: '#f5fbff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(costText);
        }

        if (typeof this.cardData.targetRoll === 'number') {
            const rollW = 38;
            const rollH = 20;
            const rollX = -CARD_W * 0.5 + 9;
            const rollY = -CARD_H * 0.5 + 10;
            const rollChip = this.scene.add.graphics();
            rollChip.fillStyle(0x1a2d42, 0.95);
            rollChip.fillRoundedRect(rollX, rollY, rollW, rollH, 7);
            rollChip.lineStyle(1.2, 0xa6cff5, 0.9);
            rollChip.strokeRoundedRect(rollX, rollY, rollW, rollH, 7);
            this.add(rollChip);
            const rollText = this.scene.add.text(rollX + rollW * 0.5, rollY + rollH * 0.5, `${this.cardData.targetRoll}+`, {
                fontFamily: FONT_UI,
                fontSize: '8px',
                color: '#ebf6ff',
                fontStyle: '700',
            }).setOrigin(0.5).setResolution(TEXT_RESOLUTION);
            this.add(rollText);
        }

        this.setSize(CARD_W, CARD_H);
        this.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(this as unknown as Phaser.GameObjects.GameObject);
        this.setPlayableVisual(true);
    }

    public setPlayableVisual(playable: boolean) {
        if (this.playabilityOutline) {
            this.playabilityOutline.clear();
            this.playabilityOutline.lineStyle(
                3,
                playable ? 0xa8f2cc : 0x8ea0b8,
                playable ? 0.98 : 0.74,
            );
            this.playabilityOutline.strokeRoundedRect(-CARD_W * 0.5 + 1, -CARD_H * 0.5 + 1, CARD_W - 2, CARD_H - 2, 12);
        }
        this.setAlpha(playable ? 1 : 0.7);
    }

    private getHeaderTypeLine(): string {
        return localizeCardType(this.cardData, this.tr.bind(this));
    }

    private getTypeAbbreviation(): string {
        const type = String(this.cardData.type ?? '').toLowerCase();
        if (type === CardType.HERO || type === CardType.EMPLOYEE) return 'HERO';
        if (type === CardType.ITEM || type === CardType.OGGETTO) return this.lang === 'it' ? 'OGG' : 'ITEM';
        if (type === CardType.MAGIC || type === CardType.EVENTO) return this.lang === 'it' ? 'EVT' : 'MAG';
        if (type === CardType.MODIFIER) return 'MOD';
        if (type === CardType.CHALLENGE) return this.lang === 'it' ? 'REA' : 'CHAL';
        if (type === CardType.MONSTER || type === CardType.IMPREVISTO || type === CardType.CRISIS) return this.lang === 'it' ? 'MOST' : 'MON';
        return 'CARD';
    }

    private getMetaLine(): string {
        if (typeof this.cardData.targetRoll === 'number') {
            return this.tr('game_crisis_roll_badge', { value: this.cardData.targetRoll });
        }
        if (typeof this.cardData.modifier === 'number') {
            const sign = this.cardData.modifier > 0 ? `+${this.cardData.modifier}` : `${this.cardData.modifier}`;
            return `MOD ${sign}`;
        }
        if (typeof this.cardData.costPA === 'number') {
            return `${this.tr('game_ap')} ${this.cardData.costPA}`;
        }
        return '-';
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
            this.setDepth(this.homeDepth + 20);
        });

        this.on('pointerout', () => {
            if (this.getData('dragging')) return;
            this.scene.tweens.killTweensOf(this);
            this.setPosition(this.homeX, this.homeY);
            this.setScale(1);
            this.setAngle(0);
            this.setDepth(this.homeDepth);
        });

        this.on('dragstart', () => {
            this.setData('dragging', true);
            this.setData('dragStarted', true);
            this.setDepth(3000);
            this.scene.tweens.killTweensOf(this);
            this.setScale(1);
            this.setAngle(0);
        });

        this.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            this.x = dragX;
            this.y = dragY;
            this.angle = 0;
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
                    duration: 110,
                    ease: 'Linear',
                });
            } else {
                this.setScale(1).setAngle(0);
            }
        });
    }
}
