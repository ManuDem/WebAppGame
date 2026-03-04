import Phaser from 'phaser';
import { CardGameObject } from '../gameobjects/CardGameObject';
import { ServerManager } from '../network/ServerManager';
import { VisualEventQueue } from '../systems/VisualEventQueue';
import {
    CardType,
    GamePhase,
    ICardData,
    IGameState,
    IPlayer,
    ServerEvents,
} from '../../../shared/SharedTypes';

const FONT_DISPLAY = 'Bebas Neue, Barlow Condensed, Impact, sans-serif';
const FONT_UI = 'Sora, Trebuchet MS, sans-serif';
const FONT_META = 'Barlow Condensed, Tahoma, sans-serif';

type CrisisView = {
    zone: Phaser.GameObjects.Zone;
    frame: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
    private serverManager!: ServerManager;
    private visualQueue!: VisualEventQueue;

    private latestState?: IGameState;
    private latestPlayer?: IPlayer;

    private screenW = 1280;
    private screenH = 720;
    private uiW = 1280;
    private uiX = 0;
    private topH = 130;
    private centerH = 360;
    private bottomH = 230;

    private centerDropX = 0;
    private centerDropY = 0;
    private centerDropW = 0;
    private centerDropH = 0;

    private bg!: Phaser.GameObjects.Graphics;
    private topPanel!: Phaser.GameObjects.Graphics;
    private centerPanel!: Phaser.GameObjects.Graphics;
    private bottomPanel!: Phaser.GameObjects.Graphics;
    private tableGuide!: Phaser.GameObjects.Graphics;

    private topTitle!: Phaser.GameObjects.Text;
    private opponentsPlaceholder!: Phaser.GameObjects.Text;

    private centerTitle!: Phaser.GameObjects.Text;
    private crisisTitle!: Phaser.GameObjects.Text;
    private companyTitle!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;

    private deckButton!: Phaser.GameObjects.Graphics;
    private deckHit!: Phaser.GameObjects.Rectangle;
    private deckLabel!: Phaser.GameObjects.Text;
    private deckCountText!: Phaser.GameObjects.Text;

    private endButton!: Phaser.GameObjects.Graphics;
    private endHit!: Phaser.GameObjects.Rectangle;
    private endButtonText!: Phaser.GameObjects.Text;

    private handTitle!: Phaser.GameObjects.Text;
    private paLabel!: Phaser.GameObjects.Text;
    private paOrbs: Phaser.GameObjects.Arc[] = [];

    private centerDropZone!: Phaser.GameObjects.Zone;

    private reactionOverlay!: Phaser.GameObjects.Rectangle;
    private reactionTitle!: Phaser.GameObjects.Text;
    private reactionSubtitle!: Phaser.GameObjects.Text;
    private reactionTrack!: Phaser.GameObjects.Graphics;
    private reactionFill!: Phaser.GameObjects.Graphics;
    private reactionTween?: Phaser.Tweens.Tween;
    private reactionVisible = false;
    private reactionProxy = { t: 1 };

    private fxEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

    private opponentViews: Phaser.GameObjects.Container[] = [];
    private crisisViews: CrisisView[] = [];
    private companyCards: CardGameObject[] = [];
    private handCards: CardGameObject[] = [];

    private pendingPlayedCard?: CardGameObject;
    private myTurnTween?: Phaser.Tweens.Tween;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { serverManager: ServerManager }) {
        this.serverManager = data?.serverManager;
        this.visualQueue = new VisualEventQueue();

        if (this.serverManager) {
            this.serverManager.onStateChange = this.handleStateChange.bind(this);
            this.serverManager.onPlayerChange = this.handlePlayerChange.bind(this);
            this.serverManager.onRoomMessage = this.handleRoomMessage.bind(this);
        }
    }

    create() {
        this.createUiObjects();
        this.createOverlay();
        this.createParticles();
        this.wireButtons();
        this.wireDropHandlers();

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.visualQueue.clear();
            this.hideReactionOverlay();
        });

        this.handleResize(this.scale.gameSize);

        this.cameras.main.fadeIn(280, 8, 13, 20);
        this.tweens.add({
            targets: [this.topPanel, this.centerPanel, this.bottomPanel],
            alpha: { from: 0.3, to: 1 },
            duration: 320,
            ease: 'Sine.Out',
        });
    }

    update() {
        if (!this.visualQueue.isBusy && this.latestState && this.latestPlayer) {
            this.applyState(this.latestState, this.latestPlayer);
            this.latestState = undefined;
            this.latestPlayer = undefined;
        }
    }

    private createUiObjects() {
        this.bg = this.add.graphics();
        this.topPanel = this.add.graphics();
        this.centerPanel = this.add.graphics();
        this.bottomPanel = this.add.graphics();
        this.tableGuide = this.add.graphics();

        this.topTitle = this.add.text(0, 0, 'RIVAL CEOS', {
            fontFamily: FONT_META,
            fontSize: '16px',
            color: '#9fd8f6',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);

        this.opponentsPlaceholder = this.add.text(0, 0, 'Waiting for opponents...', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#6f8597',
        }).setOrigin(0.5);

        this.centerTitle = this.add.text(0, 0, 'MAIN TABLE', {
            fontFamily: FONT_META,
            fontSize: '15px',
            color: '#9edcf8',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0.5);

        this.crisisTitle = this.add.text(0, 0, 'OPEN CRISES', {
            fontFamily: FONT_META,
            fontSize: '12px',
            color: '#ffbecb',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.companyTitle = this.add.text(0, 0, 'YOUR COMPANY', {
            fontFamily: FONT_META,
            fontSize: '12px',
            color: '#a8eaff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.turnText = this.add.text(0, 0, 'Waiting...', {
            fontFamily: FONT_DISPLAY,
            fontSize: '34px',
            color: '#dceeff',
            letterSpacing: 1.5,
        }).setOrigin(0.5);

        this.deckButton = this.add.graphics().setDepth(20);
        this.deckHit = this.add.rectangle(0, 0, 84, 116, 0x000000, 0).setDepth(21).setInteractive({ useHandCursor: true });
        this.deckLabel = this.add.text(0, 0, 'DECK', {
            fontFamily: FONT_META,
            fontSize: '12px',
            color: '#d8f0ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5).setDepth(22);
        this.deckCountText = this.add.text(0, 0, '0', {
            fontFamily: FONT_DISPLAY,
            fontSize: '26px',
            color: '#eefaff',
        }).setOrigin(0.5).setDepth(22);

        this.endButton = this.add.graphics().setDepth(20);
        this.endHit = this.add.rectangle(0, 0, 126, 50, 0x000000, 0).setDepth(21).setInteractive({ useHandCursor: true });
        this.endButtonText = this.add.text(0, 0, 'END TURN', {
            fontFamily: FONT_META,
            fontSize: '14px',
            color: '#f0f8ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5).setDepth(22);

        this.handTitle = this.add.text(0, 0, 'YOUR HAND', {
            fontFamily: FONT_META,
            fontSize: '14px',
            color: '#acd9f1',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);

        this.paLabel = this.add.text(0, 0, 'AP', {
            fontFamily: FONT_META,
            fontSize: '13px',
            color: '#d8f0ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);

        for (let i = 0; i < 3; i++) {
            this.paOrbs.push(
                this.add.circle(0, 0, 9, 0x20384b, 1)
                    .setStrokeStyle(1.4, 0x78c8ef, 0.45)
                    .setDepth(15),
            );
        }

        this.centerDropZone = this.add.zone(0, 0, 100, 100)
            .setRectangleDropZone(100, 100)
            .setData('type', 'center_table')
            .setDepth(6);
    }
    private createOverlay() {
        this.reactionOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setDepth(500).setVisible(false);
        this.reactionTitle = this.add.text(0, 0, 'REACTION WINDOW', {
            fontFamily: FONT_DISPLAY,
            fontSize: '48px',
            color: '#ecf8ff',
            letterSpacing: 2,
        }).setOrigin(0.5).setDepth(501).setVisible(false);

        this.reactionSubtitle = this.add.text(0, 0, 'Players can react now', {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: '#a9c1d4',
            fontStyle: '600',
        }).setOrigin(0.5).setDepth(501).setVisible(false);

        this.reactionTrack = this.add.graphics().setDepth(501).setVisible(false);
        this.reactionFill = this.add.graphics().setDepth(502).setVisible(false);
    }

    private createParticles() {
        if (!this.textures.exists('fx-dot')) {
            const g = this.make.graphics({ x: 0, y: 0 }, false);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(3, 3, 3);
            g.generateTexture('fx-dot', 6, 6);
            g.destroy();
        }

        this.fxEmitter = this.add.particles(0, 0, 'fx-dot', {
            speed: { min: 90, max: 250 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 700,
            quantity: 20,
            emitting: false,
            blendMode: Phaser.BlendModes.ADD,
            tint: [0x72d6ff, 0x9ef0c5, 0xffc57f, 0xc7b5ff],
        }).setDepth(490);
    }

    private wireButtons() {
        this.deckHit.on('pointerup', () => {
            if (this.deckHit.input?.enabled) this.serverManager.drawCard();
        });

        this.endHit.on('pointerup', () => {
            if (this.endHit.input?.enabled) this.serverManager.endTurn();
        });

        const bind = (hit: Phaser.GameObjects.Rectangle, targets: Phaser.GameObjects.GameObject[]) => {
            hit.on('pointerover', () => {
                if (!hit.input?.enabled) return;
                this.tweens.add({ targets, scaleX: 1.03, scaleY: 1.03, duration: 110 });
            });
            hit.on('pointerout', () => {
                this.tweens.add({ targets, scaleX: 1, scaleY: 1, duration: 110 });
            });
            hit.on('pointerdown', () => {
                if (!hit.input?.enabled) return;
                this.tweens.add({ targets, scaleX: 0.96, scaleY: 0.96, duration: 80 });
            });
            hit.on('pointerup', () => {
                this.tweens.add({ targets, scaleX: 1, scaleY: 1, duration: 80 });
            });
        };

        bind(this.deckHit, [this.deckButton, this.deckLabel, this.deckCountText]);
        bind(this.endHit, [this.endButton, this.endButtonText]);
    }

    private wireDropHandlers() {
        this.input.on('drop', (
            _pointer: Phaser.Input.Pointer,
            gameObject: Phaser.GameObjects.GameObject,
            zone: Phaser.GameObjects.Zone,
        ) => {
            const card = gameObject as CardGameObject;
            const zoneType = String(zone.getData('type') ?? '');

            const state = this.serverManager.room?.state as IGameState | undefined;
            const myId = this.serverManager.room?.sessionId;
            if (!state || !myId) {
                this.snapBack(card, 'No connection');
                return;
            }

            if (state.phase === GamePhase.REACTION_WINDOW) {
                const canReact = state.pendingAction?.playerId !== myId;
                if (card.cardData.type === CardType.REACTION && canReact) {
                    this.serverManager.playReaction(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                this.snapBack(card, 'Only reaction cards are allowed now');
                return;
            }

            if (state.phase !== GamePhase.PLAYER_TURN) {
                this.snapBack(card, 'Action not allowed in this phase');
                return;
            }

            if (zoneType === 'center_table') {
                if (card.cardData.type === CardType.EMPLOYEE) {
                    this.serverManager.playEmployee(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                if (card.cardData.type === CardType.MAGIC) {
                    this.serverManager.playMagic(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                this.snapBack(card, 'Drop this card on a valid target');
                return;
            }

            if (zoneType === 'crisis') {
                const crisisId = String(zone.getData('crisisId') ?? '');
                if (!crisisId) {
                    this.snapBack(card, 'Invalid crisis target');
                    return;
                }
                this.serverManager.solveCrisis(card.cardData.id, crisisId);
                this.stashPending(card);
                return;
            }

            this.snapBack(card, 'Invalid drop area');
        });
    }

    private handleResize(size: Phaser.Structs.Size) {
        this.screenW = size.width;
        this.screenH = size.height;

        const landscape = this.screenW > this.screenH;
        this.uiW = landscape ? Math.min(this.screenW * 0.78, 1180) : Math.min(this.screenW, 560);
        this.uiX = (this.screenW - this.uiW) * 0.5;

        this.topH = Phaser.Math.Clamp(this.screenH * 0.18, 96, 172);
        this.bottomH = Phaser.Math.Clamp(this.screenH * 0.31, 190, 320);
        this.centerH = this.screenH - this.topH - this.bottomH;
        if (this.centerH < 200) {
            this.centerH = 200;
            this.bottomH = this.screenH - this.topH - this.centerH;
        }

        this.drawBackground();
        this.layoutPanels();
        this.layoutOverlay();

        const state = this.serverManager?.room?.state as IGameState | undefined;
        if (state && this.serverManager?.room) {
            const me = (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId);
            if (me) this.applyState(state, me);
        }
    }

    private drawBackground() {
        this.bg.clear();
        this.bg.fillStyle(0x070d14, 1);
        this.bg.fillRect(0, 0, this.screenW, this.screenH);

        const stripes = 24;
        for (let i = 0; i < stripes; i++) {
            const t = i / stripes;
            this.bg.fillStyle(0x0f1f2e, 0.13 * (1 - t));
            this.bg.fillRect(0, i * this.screenH / stripes, this.screenW, this.screenH / stripes + 1);
        }

        const gridGap = Phaser.Math.Clamp(this.screenW / 28, 28, 64);
        this.bg.lineStyle(1, 0x6db8e0, 0.045);
        for (let x = 0; x <= this.screenW; x += gridGap) {
            this.bg.moveTo(x, 0);
            this.bg.lineTo(x, this.screenH);
        }
        for (let y = 0; y <= this.screenH; y += gridGap) {
            this.bg.moveTo(0, y);
            this.bg.lineTo(this.screenW, y);
        }
        this.bg.strokePath();

        this.bg.fillStyle(0x7ed4ff, 0.05);
        this.bg.fillRect(this.uiX + 18, this.topH + 2, this.uiW - 36, 2);
        this.bg.fillRect(this.uiX + 18, this.topH + this.centerH + 2, this.uiW - 36, 2);
    }

    private layoutPanels() {
        const topY = 0;
        const centerY = this.topH;
        const bottomY = this.topH + this.centerH;

        this.topPanel.clear();
        this.topPanel.fillStyle(0x11202d, 0.74);
        this.topPanel.fillRoundedRect(this.uiX + 8, topY + 8, this.uiW - 16, this.topH - 14, 16);
        this.topPanel.lineStyle(1.1, 0x4a728a, 0.85);
        this.topPanel.strokeRoundedRect(this.uiX + 8, topY + 8, this.uiW - 16, this.topH - 14, 16);

        this.centerPanel.clear();
        this.centerPanel.fillStyle(0x0f1a25, 0.72);
        this.centerPanel.fillRoundedRect(this.uiX + 8, centerY + 4, this.uiW - 16, this.centerH - 8, 16);
        this.centerPanel.lineStyle(1.1, 0x42697f, 0.78);
        this.centerPanel.strokeRoundedRect(this.uiX + 8, centerY + 4, this.uiW - 16, this.centerH - 8, 16);

        this.bottomPanel.clear();
        this.bottomPanel.fillStyle(0x111d29, 0.84);
        this.bottomPanel.fillRoundedRect(this.uiX + 8, bottomY + 2, this.uiW - 16, this.bottomH - 10, 16);
        this.bottomPanel.lineStyle(1.1, 0x4b7085, 0.75);
        this.bottomPanel.strokeRoundedRect(this.uiX + 8, bottomY + 2, this.uiW - 16, this.bottomH - 10, 16);

        this.topTitle.setPosition(this.uiX + 24, topY + 28).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.015, 12, 18)}px`);
        this.opponentsPlaceholder.setPosition(this.uiX + this.uiW * 0.5, topY + this.topH * 0.58).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.012, 12, 15)}px`);

        this.centerTitle.setPosition(this.uiX + this.uiW * 0.5, centerY + 24).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 16)}px`);
        this.turnText.setPosition(this.uiX + this.uiW * 0.5, centerY + 64).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.031, 24, 40)}px`);

        this.centerDropW = Phaser.Math.Clamp(this.uiW * 0.58, 290, 620);
        this.centerDropH = Phaser.Math.Clamp(this.centerH * 0.42, 130, 250);
        this.centerDropX = this.uiX + this.uiW * 0.5;
        this.centerDropY = centerY + this.centerH * 0.52;

        this.tableGuide.clear();
        this.tableGuide.lineStyle(2, 0x69c7f1, 0.35);
        this.tableGuide.strokeRoundedRect(
            this.centerDropX - this.centerDropW * 0.5,
            this.centerDropY - this.centerDropH * 0.5,
            this.centerDropW,
            this.centerDropH,
            16,
        );

        this.centerDropZone.setPosition(this.centerDropX, this.centerDropY).setSize(this.centerDropW, this.centerDropH);
        this.centerDropZone.input?.hitArea.setTo(0, 0, this.centerDropW, this.centerDropH);

        this.crisisTitle.setPosition(this.uiX + this.uiW * 0.5, centerY + this.centerH * 0.22).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);
        this.companyTitle.setPosition(this.uiX + this.uiW * 0.5, centerY + this.centerH * 0.79).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);

        const deckX = this.uiX + this.uiW - 68;
        const deckY = centerY + this.centerH - 74;
        this.deckHit.setPosition(deckX, deckY);
        this.deckLabel.setPosition(deckX, deckY - 34);
        this.deckCountText.setPosition(deckX, deckY + 26);

        const endX = deckX - 132;
        this.endHit.setPosition(endX, deckY);
        this.endButtonText.setPosition(endX, deckY);

        const bottomTop = bottomY + 2;
        this.handTitle.setPosition(this.uiX + 24, bottomTop + 22).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.012, 12, 15)}px`);
        this.paLabel.setPosition(this.uiX + 24, bottomTop + 52).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0105, 11, 13)}px`);
        this.paOrbs.forEach((orb, index) => orb.setPosition(this.uiX + 66 + index * 24, bottomTop + 54));

        this.drawDeckButton(false);
        this.drawEndButton(false);
    }

    private layoutOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;

        this.reactionOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);
        this.reactionTitle.setPosition(cx, cy - 34).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.035, 30, 54)}px`);
        this.reactionSubtitle.setPosition(cx, cy + 6).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.013, 13, 18)}px`);
        this.redrawReactionBar();
    }

    private redrawReactionBar() {
        const barW = Phaser.Math.Clamp(this.uiW * 0.4, 220, 460);
        const barH = Phaser.Math.Clamp(this.screenH * 0.017, 8, 14);
        const x = this.screenW * 0.5 - barW * 0.5;
        const y = this.screenH * 0.5 + 38;

        this.reactionTrack.clear();
        this.reactionTrack.fillStyle(0x162433, 0.95);
        this.reactionTrack.fillRoundedRect(x, y, barW, barH, barH * 0.5);
        this.reactionTrack.lineStyle(1, 0x547289, 0.95);
        this.reactionTrack.strokeRoundedRect(x, y, barW, barH, barH * 0.5);

        this.reactionFill.clear();
        this.reactionFill.fillStyle(0x67d5ff, 1);
        this.reactionFill.fillRoundedRect(x + 2, y + 2, Math.max(0, (barW - 4) * this.reactionProxy.t), barH - 4, (barH - 4) * 0.5);
    }

    private showReactionOverlay(durationMs: number, label?: string) {
        this.reactionVisible = true;
        if (this.reactionTween) this.reactionTween.stop();
        this.reactionTween = undefined;
        this.reactionProxy.t = 1;

        this.reactionTitle.setVisible(true);
        this.reactionSubtitle.setVisible(true);
        this.reactionOverlay.setVisible(true).setAlpha(0);
        this.reactionTrack.setVisible(true);
        this.reactionFill.setVisible(true);

        if (label) this.reactionSubtitle.setText(label);

        this.redrawReactionBar();
        this.tweens.add({ targets: this.reactionOverlay, alpha: 0.72, duration: 180, ease: 'Sine.Out' });

        this.reactionTween = this.tweens.add({
            targets: this.reactionProxy,
            t: 0,
            duration: Math.max(200, durationMs),
            ease: 'Linear',
            onUpdate: () => this.redrawReactionBar(),
        });
    }

    private hideReactionOverlay() {
        if (!this.reactionVisible) return;
        this.reactionVisible = false;

        if (this.reactionTween) this.reactionTween.stop();
        this.reactionTween = undefined;

        this.reactionOverlay.setVisible(false);
        this.reactionTitle.setVisible(false);
        this.reactionSubtitle.setVisible(false);
        this.reactionTrack.setVisible(false);
        this.reactionFill.setVisible(false);
    }

    private handleStateChange(state: IGameState) {
        if (!this.serverManager.room) return;
        const me = (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId);
        if (!me) return;

        if (this.visualQueue.isBusy) {
            this.latestState = state;
            this.latestPlayer = me;
        } else {
            this.applyState(state, me);
        }
    }

    private handlePlayerChange(player: IPlayer) {
        if (this.visualQueue.isBusy) {
            this.latestPlayer = player;
            return;
        }

        const state = this.serverManager.room?.state as IGameState | undefined;
        if (state) this.applyState(state, player);
    }

    private applyState(state: IGameState, me: IPlayer) {
        const myId = this.serverManager.room?.sessionId ?? '';

        this.deckCountText.setText(`${state.deckCount ?? 0}`);
        this.updateOpponents(state, myId);
        this.rebuildCrises((state.centralCrises as unknown as ICardData[]) ?? []);
        this.rebuildCompany((me.company as unknown as ICardData[]) ?? []);
        this.rebuildHand((me.hand as unknown as ICardData[]) ?? []);
        this.updateAP(me.actionPoints ?? 0);
        this.updateTurn(state, myId);
        this.updateControls(state, me, myId);

        if (state.phase === GamePhase.REACTION_WINDOW && !this.reactionVisible) {
            const remaining = state.reactionEndTime ? Math.max(250, state.reactionEndTime - Date.now()) : 5000;
            this.showReactionOverlay(remaining, 'Players can react now');
        }

        if (state.phase !== GamePhase.REACTION_WINDOW && this.reactionVisible) {
            this.hideReactionOverlay();
        }
    }

    private updateTurn(state: IGameState, myId: string) {
        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        if (!active) {
            this.turnText.setText('Waiting...').setColor('#dceeff').setAlpha(1);
            return;
        }

        if (state.currentTurnPlayerId === myId) {
            this.turnText.setText('YOUR TURN').setColor('#b8f8cc').setAlpha(1);

            if (!this.myTurnTween || !this.myTurnTween.isPlaying()) {
                this.myTurnTween = this.tweens.add({
                    targets: this.turnText,
                    alpha: { from: 0.65, to: 1 },
                    duration: 560,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut',
                });
            }
        } else {
            if (this.myTurnTween) this.myTurnTween.stop();
            this.myTurnTween = undefined;

            this.turnText.setText(`${active.username.toUpperCase()} TURN`).setColor('#c8d9e7').setAlpha(1);
        }
    }

    private updateAP(current: number) {
        this.paOrbs.forEach((orb, index) => {
            const on = index < current;
            orb.setFillStyle(on ? 0x77d8ff : 0x20384b, 1);
            orb.setStrokeStyle(1.5, on ? 0xa6ebff : 0x78c8ef, on ? 1 : 0.35);

            if (on) {
                this.tweens.add({ targets: orb, scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 120 });
            }
        });
    }

    private updateControls(state: IGameState, me: IPlayer, myId: string) {
        const isMyTurn = state.currentTurnPlayerId === myId;
        const canDraw = isMyTurn && state.phase === GamePhase.PLAYER_TURN && me.actionPoints >= 1 && state.deckCount > 0;
        const canEnd = isMyTurn && state.phase === GamePhase.PLAYER_TURN;

        if (this.deckHit.input) this.deckHit.input.enabled = canDraw;
        if (this.endHit.input) this.endHit.input.enabled = canEnd;

        this.drawDeckButton(canDraw);
        this.drawEndButton(canEnd);

        const canReact = state.phase === GamePhase.REACTION_WINDOW && state.pendingAction?.playerId !== myId;
        const canPlayTurn = state.phase === GamePhase.PLAYER_TURN && isMyTurn;

        this.handCards.forEach((card) => {
            const allow = canPlayTurn || (canReact && card.cardData.type === CardType.REACTION);
            if (allow) {
                if (card.input) {
                    card.input.enabled = true;
                } else {
                    card.setInteractive({ useHandCursor: true });
                    this.input.setDraggable(card as unknown as Phaser.GameObjects.GameObject);
                }
            } else {
                card.disableInteractive();
            }
        });
    }

    private drawDeckButton(active: boolean) {
        const x = this.deckHit.x;
        const y = this.deckHit.y;

        this.deckButton.clear();
        this.deckButton.fillStyle(active ? 0x244155 : 0x182a37, 1);
        this.deckButton.fillRoundedRect(x - 40, y - 55, 80, 110, 12);
        this.deckButton.fillStyle(0xffffff, active ? 0.12 : 0.05);
        this.deckButton.fillRoundedRect(x - 40, y - 55, 80, 38, { tl: 12, tr: 12, bl: 0, br: 0 });
        this.deckButton.lineStyle(1.4, active ? 0x8be3ff : 0x4f6d7e, 1);
        this.deckButton.strokeRoundedRect(x - 40, y - 55, 80, 110, 12);

        this.deckLabel.setColor(active ? '#dff5ff' : '#8da8b9');
        this.deckCountText.setColor(active ? '#ecfbff' : '#a8c2d2');
    }

    private drawEndButton(active: boolean) {
        const x = this.endHit.x;
        const y = this.endHit.y;

        this.endButton.clear();
        this.endButton.fillStyle(active ? 0x3a86ad : 0x315063, 1);
        this.endButton.fillRoundedRect(x - 63, y - 24, 126, 48, 12);
        this.endButton.fillStyle(0xffffff, active ? 0.15 : 0.07);
        this.endButton.fillRoundedRect(x - 63, y - 24, 126, 22, { tl: 12, tr: 12, bl: 0, br: 0 });
        this.endButton.lineStyle(1.2, active ? 0x9be8ff : 0x63839b, 1);
        this.endButton.strokeRoundedRect(x - 63, y - 24, 126, 48, 12);

        this.endButtonText.setColor(active ? '#f1f9ff' : '#a7c0d0');
    }

    private updateOpponents(state: IGameState, myId: string) {
        this.opponentViews.forEach((view) => view.destroy());
        this.opponentViews = [];

        const opponents: IPlayer[] = [];
        (state.players as unknown as Map<string, IPlayer>).forEach((player, sessionId) => {
            if (sessionId !== myId) opponents.push(player);
        });

        if (opponents.length === 0) {
            this.opponentsPlaceholder.setVisible(true);
            return;
        }

        this.opponentsPlaceholder.setVisible(false);

        const rowY = this.topH * 0.58;
        const panelW = Phaser.Math.Clamp((this.uiW - 46) / Math.max(opponents.length, 1) - 8, 112, 180);
        const panelH = Phaser.Math.Clamp(this.topH * 0.52, 46, 74);
        const startX = this.uiX + this.uiW * 0.5 - (opponents.length * panelW + (opponents.length - 1) * 8) * 0.5 + panelW * 0.5;

        opponents.forEach((opp, index) => {
            const x = startX + index * (panelW + 8);
            const active = state.currentTurnPlayerId === opp.sessionId;

            const frame = this.add.graphics();
            frame.fillStyle(active ? 0x214439 : 0x233646, 1);
            frame.fillRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 10);
            frame.lineStyle(1.2, active ? 0x9ff3cb : 0x6c8aa0, 1);
            frame.strokeRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 10);

            const name = this.add.text(-panelW * 0.5 + 10, -10, opp.username, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(panelW * 0.082, 10, 14)}px`,
                color: active ? '#bdf8d5' : '#d4e5f2',
                fontStyle: '700',
            }).setOrigin(0, 0.5);

            const stats = this.add.text(-panelW * 0.5 + 10, 11, `Hand ${(opp.hand as any)?.length ?? 0}  AP ${opp.actionPoints}`, {
                fontFamily: FONT_META,
                fontSize: `${Phaser.Math.Clamp(panelW * 0.07, 9, 12)}px`,
                color: '#95afc1',
                fontStyle: '700',
            }).setOrigin(0, 0.5);

            const dot = this.add.circle(panelW * 0.5 - 13, 0, 5, active ? 0x9ff3cb : 0x87a8be, 1);
            this.opponentViews.push(this.add.container(x, rowY, [frame, name, stats, dot]).setDepth(30));
        });
    }

    private rebuildCrises(crises: ICardData[]) {
        this.crisisViews.forEach(({ zone, frame, label }) => {
            zone.destroy();
            frame.destroy();
            label.destroy();
        });
        this.crisisViews = [];

        if (!crises || crises.length === 0) return;

        const y = this.topH + this.centerH * 0.3;
        const slotW = Phaser.Math.Clamp(this.uiW * 0.16, 90, 132);
        const slotH = Phaser.Math.Clamp(this.centerH * 0.34, 92, 150);
        const gap = Phaser.Math.Clamp(this.uiW * 0.012, 8, 18);
        const total = crises.length * slotW + (crises.length - 1) * gap;
        const startX = this.uiX + this.uiW * 0.5 - total * 0.5 + slotW * 0.5;

        crises.forEach((cr, i) => {
            const x = startX + i * (slotW + gap);
            const frame = this.add.graphics().setDepth(35);
            frame.fillStyle(0x301923, 0.7);
            frame.fillRoundedRect(x - slotW * 0.5, y - slotH * 0.5, slotW, slotH, 12);
            frame.lineStyle(1.5, 0xff9ab0, 0.95);
            frame.strokeRoundedRect(x - slotW * 0.5, y - slotH * 0.5, slotW, slotH, 12);

            const label = this.add.text(x, y, cr.name ?? cr.templateId, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(slotW * 0.09, 10, 13)}px`,
                color: '#ffe2e8',
                fontStyle: '700',
                align: 'center',
                wordWrap: { width: slotW - 14 },
            }).setOrigin(0.5).setDepth(36);

            const zone = this.add.zone(x, y, slotW, slotH).setRectangleDropZone(slotW, slotH)
                .setData('type', 'crisis')
                .setData('crisisId', cr.id)
                .setDepth(37);

            this.crisisViews.push({ zone, frame, label });
        });
    }

    private rebuildCompany(cards: ICardData[]) {
        this.companyCards.forEach((c) => c.destroy());
        this.companyCards = [];

        if (!cards || cards.length === 0) return;

        const y = this.topH + this.centerH * 0.78;
        const available = this.uiW * 0.78;
        const scale = Phaser.Math.Clamp(available / Math.max(1, cards.length * 124), 0.45, 0.72);
        const spacing = 118 * scale;
        const total = (cards.length - 1) * spacing;
        const startX = this.uiX + this.uiW * 0.5 - total * 0.5;

        cards.forEach((data, i) => {
            const card = new CardGameObject(this, startX + i * spacing, y, data);
            this.add.existing(card);
            card.setScale(scale);
            card.disableInteractive();
            this.companyCards.push(card);
        });
    }

    private rebuildHand(cards: ICardData[]) {
        this.handCards.forEach((c) => c.destroy());
        this.handCards = [];

        if (!cards || cards.length === 0) return;

        const yBase = this.topH + this.centerH + this.bottomH * 0.63;
        const available = this.uiW - 52;
        const maxSpread = Math.max(0, cards.length - 1);
        const scale = Phaser.Math.Clamp(available / Math.max(1, cards.length * 122), 0.62, 1);
        const spacing = maxSpread > 0 ? Math.min(98 * scale, available / maxSpread) : 0;
        const startX = this.uiX + this.uiW * 0.5 - (maxSpread * spacing) * 0.5;
        const mid = (cards.length - 1) * 0.5;

        cards.forEach((data, i) => {
            const x = startX + i * spacing;
            const y = yBase + Math.abs(i - mid) * 4;
            const card = new CardGameObject(this, x, y, data);
            this.add.existing(card);
            card.setScale(scale);
            card.setHome(x, y, 120 + i);
            this.handCards.push(card);
        });
    }

    private stashPending(card: CardGameObject) {
        card.disableInteractive();
        this.pendingPlayedCard = card;
        this.handCards = this.handCards.filter((c) => c !== card);

        this.tweens.add({
            targets: card,
            x: this.centerDropX,
            y: this.centerDropY,
            scaleX: 1.08,
            scaleY: 1.08,
            alpha: 0.95,
            duration: 190,
            ease: 'Sine.Out',
        });
    }

    private snapBack(card: CardGameObject, msg: string) {
        this.floatText(msg, '#ff8392', card.x, card.homeY - 84);
        this.tweens.add({
            targets: card,
            x: card.homeX,
            y: card.homeY,
            scaleX: 1,
            scaleY: 1,
            duration: 210,
            ease: 'Cubic.Out',
        });
    }

    private burst(x: number, y: number, count = 34) {
        if (!this.fxEmitter) return;
        this.fxEmitter.explode(count, x, y);
    }

    private handleRoomMessage(type: string | number, message: any) {
        switch (type) {
            case ServerEvents.ERROR:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    this.floatText(message?.message ?? 'Action denied', '#ff8293');
                    this.cameras.main.shake(120, 0.0018);
                    this.time.delayedCall(420, resolve);
                }));
                break;

            case ServerEvents.START_REACTION_TIMER:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const duration = Number(message?.durationMs ?? message?.duration ?? 5000);
                    const label = String(message?.actionTypeLabel ?? 'Players can react now');
                    this.showReactionOverlay(duration, label);
                    resolve();
                }));
                break;

            case ServerEvents.REACTION_TRIGGERED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const name = String(message?.playerName ?? 'Opponent');
                    this.floatText(`${name} reacted`, '#ffd6a6', this.screenW * 0.5, this.topH + 40);
                    this.time.delayedCall(460, resolve);
                }));
                break;

            case ServerEvents.ACTION_RESOLVED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const success = message?.success !== false;
                    const card = this.pendingPlayedCard;
                    this.pendingPlayedCard = undefined;

                    this.hideReactionOverlay();

                    if (success) {
                        this.floatText('Action resolved', '#9ff3c2');
                        this.burst(this.screenW * 0.5, this.topH + this.centerH * 0.6, 36);
                        if (card) {
                            this.tweens.add({
                                targets: card,
                                x: this.uiX + this.uiW * 0.5,
                                y: this.topH + this.centerH * 0.78,
                                scaleX: 0.56,
                                scaleY: 0.56,
                                alpha: 0,
                                duration: 450,
                                ease: 'Cubic.Out',
                                onComplete: () => {
                                    card.destroy();
                                    resolve();
                                },
                            });
                            return;
                        }
                    } else {
                        this.floatText('Action failed', '#ff8a97');
                        this.cameras.main.shake(180, 0.0022);
                        this.burst(this.screenW * 0.5, this.centerDropY, 26);
                        if (card) {
                            this.tweens.add({
                                targets: card,
                                alpha: 0,
                                scaleX: 0.4,
                                scaleY: 0.4,
                                angle: 55,
                                duration: 320,
                                ease: 'Cubic.In',
                                onComplete: () => {
                                    card.destroy();
                                    resolve();
                                },
                            });
                            return;
                        }
                    }

                    this.time.delayedCall(420, resolve);
                }));
                break;

            case ServerEvents.CARD_DRAWN:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const ghost = this.add.graphics().setDepth(480);
                    ghost.fillStyle(0x204054, 1);
                    ghost.fillRoundedRect(-32, -44, 64, 88, 10);
                    ghost.lineStyle(1.2, 0x9be6ff, 1);
                    ghost.strokeRoundedRect(-32, -44, 64, 88, 10);
                    ghost.setPosition(this.deckHit.x, this.deckHit.y);

                    const targetX = this.uiX + this.uiW * 0.5;
                    const targetY = this.topH + this.centerH + this.bottomH * 0.67;
                    this.tweens.add({
                        targets: ghost,
                        x: targetX,
                        y: targetY,
                        angle: 18,
                        alpha: 0,
                        duration: 520,
                        ease: 'Cubic.Out',
                        onComplete: () => {
                            ghost.destroy();
                            this.burst(targetX, targetY, 24);
                            this.floatText('+1 card', '#8ddcff', targetX, targetY - 10);
                            resolve();
                        },
                    });
                }));
                break;

            case ServerEvents.TURN_STARTED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    this.floatText(`Turn ${message?.turnNumber ?? ''}`, '#d8f4ff', this.screenW * 0.5, this.topH + 26);
                    this.time.delayedCall(320, resolve);
                }));
                break;

            case ServerEvents.GAME_WON:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const winner = String(message?.winnerName ?? 'Unknown');
                    const score = Number(message?.finalScore ?? 0);

                    this.add.rectangle(this.screenW * 0.5, this.screenH * 0.5, this.screenW, this.screenH, 0x000000, 0.84)
                        .setDepth(700);

                    const title = this.add.text(this.screenW * 0.5, this.screenH * 0.5 - 46, 'GAME OVER', {
                        fontFamily: FONT_DISPLAY,
                        fontSize: `${Phaser.Math.Clamp(this.uiW * 0.05, 42, 72)}px`,
                        color: '#eef8ff',
                        letterSpacing: 2,
                    }).setOrigin(0.5).setDepth(701);

                    this.add.text(this.screenW * 0.5, this.screenH * 0.5 + 4, `${winner} wins`, {
                        fontFamily: FONT_UI,
                        fontSize: `${Phaser.Math.Clamp(this.uiW * 0.025, 22, 34)}px`,
                        color: '#b7e2ff',
                        fontStyle: '700',
                    }).setOrigin(0.5).setDepth(701);

                    this.add.text(this.screenW * 0.5, this.screenH * 0.5 + 42, `Final score ${score}`, {
                        fontFamily: FONT_META,
                        fontSize: `${Phaser.Math.Clamp(this.uiW * 0.014, 14, 20)}px`,
                        color: '#98b5c8',
                        fontStyle: '700',
                    }).setOrigin(0.5).setDepth(701);

                    this.tweens.add({
                        targets: title,
                        alpha: { from: 0.75, to: 1 },
                        duration: 550,
                        yoyo: true,
                        repeat: -1,
                    });

                    this.burst(this.screenW * 0.5, this.screenH * 0.5 - 8, 68);
                    this.time.delayedCall(700, resolve);
                }));
                break;
        }
    }

    private floatText(message: string, color: string, x?: number, y?: number) {
        const tx = x ?? this.screenW * 0.5;
        const ty = y ?? this.screenH * 0.5;

        const t = this.add.text(tx, ty, message, {
            fontFamily: FONT_UI,
            fontSize: `${Phaser.Math.Clamp(this.uiW * 0.016, 15, 22)}px`,
            color,
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5).setDepth(520);

        this.tweens.add({
            targets: t,
            y: ty - 52,
            alpha: 0,
            duration: 700,
            ease: 'Sine.Out',
            onComplete: () => t.destroy(),
        });
    }
}
