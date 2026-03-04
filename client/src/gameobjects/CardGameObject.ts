import Phaser from 'phaser';
import { CardType, ICardData } from '../../../shared/SharedTypes';

interface CardPalette {
    body: number;
    border: number;
    topBand: number;
    badge: number;
    accentText: string;
    label: string;
}

const FONT_TITLE = 'Sora, Trebuchet MS, sans-serif';
const FONT_META = 'Barlow Condensed, Tahoma, sans-serif';

const CARD_W = 114;
const CARD_H = 164;

const PALETTES: Record<CardType, CardPalette> = {
    [CardType.EMPLOYEE]: {
        body: 0x102436,
        border: 0x6fd3ff,
        topBand: 0x17374e,
        badge: 0x1f4d6d,
        accentText: '#bce9ff',
        label: 'EMPLOYEE',
    },
    [CardType.MAGIC]: {
        body: 0x2a2610,
        border: 0xf3d26a,
        topBand: 0x3b3518,
        badge: 0x6f5e29,
        accentText: '#ffeab1',
        label: 'MAGIC',
    },
    [CardType.CRISIS]: {
        body: 0x2d1820,
        border: 0xff8ba5,
        topBand: 0x43222d,
        badge: 0x713245,
        accentText: '#ffd6df',
        label: 'CRISIS',
    },
    [CardType.REACTION]: {
        body: 0x211d37,
        border: 0xcab2ff,
        topBand: 0x332b57,
        badge: 0x5849a1,
        accentText: '#e6dbff',
        label: 'REACTION',
    },
};

export class CardGameObject extends Phaser.GameObjects.Container {
    public cardData: ICardData;
    public homeX = 0;
    public homeY = 0;

    private homeDepth = 0;

    private shadow!: Phaser.GameObjects.Graphics;
    private frame!: Phaser.GameObjects.Graphics;

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
        const palette = PALETTES[this.cardData.type] ?? PALETTES[CardType.MAGIC];

        this.shadow = this.scene.add.graphics();
        this.shadow.fillStyle(0x000000, 0.35);
        this.shadow.fillRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 6, CARD_W, CARD_H, 14);
        this.add(this.shadow);

        this.frame = this.scene.add.graphics();
        this.frame.fillStyle(palette.body, 0.98);
        this.frame.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);

        this.frame.fillStyle(palette.topBand, 1);
        this.frame.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 30, { tl: 14, tr: 14, bl: 0, br: 0 });

        this.frame.lineStyle(1.6, palette.border, 0.92);
        this.frame.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 14);

        this.frame.lineStyle(1, palette.border, 0.2);
        this.frame.beginPath();
        this.frame.moveTo(-CARD_W / 2 + 8, -CARD_H / 2 + 38);
        this.frame.lineTo(CARD_W / 2 - 8, -CARD_H / 2 + 38);
        this.frame.strokePath();

        this.add(this.frame);

        const titleText = this.scene.add.text(0, -CARD_H / 2 + 15, (this.cardData.name ?? this.cardData.templateId).slice(0, 22), {
            fontFamily: FONT_TITLE,
            fontSize: '11px',
            color: '#edf7ff',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: CARD_W - 20 },
        }).setOrigin(0.5);
        this.add(titleText);

        const templateText = this.scene.add.text(0, -CARD_H / 2 + 49, this.cardData.templateId, {
            fontFamily: FONT_META,
            fontSize: '9px',
            color: palette.accentText,
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5);
        this.add(templateText);

        const desc = this.cardData.description
            ? (this.cardData.description.length > 78
                ? `${this.cardData.description.slice(0, 75)}...`
                : this.cardData.description)
            : '';

        const descText = this.scene.add.text(0, 8, desc, {
            fontFamily: FONT_TITLE,
            fontSize: '10px',
            color: '#d6e6f2',
            align: 'center',
            wordWrap: { width: CARD_W - 18 },
            lineSpacing: 1,
        }).setOrigin(0.5, 0.5);
        this.add(descText);

        const footer = this.scene.add.graphics();
        footer.fillStyle(palette.badge, 1);
        footer.fillRoundedRect(-CARD_W / 2, CARD_H / 2 - 22, CARD_W, 22, { tl: 0, tr: 0, bl: 12, br: 12 });
        this.add(footer);

        const typeText = this.scene.add.text(0, CARD_H / 2 - 11, palette.label, {
            fontFamily: FONT_META,
            fontSize: '10px',
            color: '#f2f8ff',
            fontStyle: '700',
            letterSpacing: 1.2,
        }).setOrigin(0.5);
        this.add(typeText);

        if (this.cardData.costPA !== undefined) {
            const bubble = this.scene.add.graphics();
            const cx = CARD_W / 2 - 14;
            const cy = -CARD_H / 2 + 14;
            bubble.fillStyle(0x0d1621, 1);
            bubble.fillCircle(cx, cy, 12);
            bubble.lineStyle(1.6, palette.border, 1);
            bubble.strokeCircle(cx, cy, 12);
            this.add(bubble);

            const costText = this.scene.add.text(cx, cy, `${this.cardData.costPA}`, {
                fontFamily: FONT_META,
                fontSize: '13px',
                color: '#ecf7ff',
                fontStyle: '700',
            }).setOrigin(0.5);
            this.add(costText);
        }

        this.setSize(CARD_W, CARD_H);
        this.setInteractive({ useHandCursor: true });
        this.scene.input.setDraggable(this as unknown as Phaser.GameObjects.GameObject);
    }

    private setupInput() {
        this.on('pointerover', () => {
            if (this.getData('dragging')) return;
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
            this.setDepth(3000);
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
        });

        this.on('dragend', (_pointer: Phaser.Input.Pointer, dropped: boolean) => {
            this.setData('dragging', false);
            this.setDepth(this.homeDepth);

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