import Phaser from 'phaser';
import { CardGameObject } from '../gameobjects/CardGameObject';
import { ServerManager } from '../network/ServerManager';
import { VisualEventQueue } from '../systems/VisualEventQueue';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { APP_FONT_FAMILY } from '../ui/Typography';
import {
    CardType,
    GamePhase,
    ICardData,
    IGameState,
    IPlayer,
    MIN_PLAYERS_TO_START,
    ServerEvents,
} from '../../../shared/SharedTypes';

const FONT_UI = APP_FONT_FAMILY;

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
    private lang: SupportedLanguage = DEFAULT_LANGUAGE;
    private roomCode = '';
    private readonly textResolution = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));
    private isLandscapeLayout = false;

    private bg!: Phaser.GameObjects.Graphics;
    private retroLayerA!: Phaser.GameObjects.TileSprite;
    private retroLayerB!: Phaser.GameObjects.TileSprite;

    private topPanel!: Phaser.GameObjects.Graphics;
    private centerPanel!: Phaser.GameObjects.Graphics;
    private bottomPanel!: Phaser.GameObjects.Graphics;
    private tableGuide!: Phaser.GameObjects.Graphics;

    private topTitle!: Phaser.GameObjects.Text;
    private opponentsPlaceholder!: Phaser.GameObjects.Text;
    private roomCodeText!: Phaser.GameObjects.Text;

    private centerTitle!: Phaser.GameObjects.Text;
    private crisisTitle!: Phaser.GameObjects.Text;
    private companyTitle!: Phaser.GameObjects.Text;
    private turnText!: Phaser.GameObjects.Text;

    private deckButton!: Phaser.GameObjects.Graphics;
    private deckHit!: Phaser.GameObjects.Rectangle;
    private deckLabel!: Phaser.GameObjects.Text;
    private deckCountText!: Phaser.GameObjects.Text;
    private deckIcon!: Phaser.GameObjects.Image;

    private endButton!: Phaser.GameObjects.Graphics;
    private endHit!: Phaser.GameObjects.Rectangle;
    private endButtonText!: Phaser.GameObjects.Text;

    private readyButton!: Phaser.GameObjects.Graphics;
    private readyHit!: Phaser.GameObjects.Rectangle;
    private readyButtonText!: Phaser.GameObjects.Text;

    private lobbyPanel!: Phaser.GameObjects.Graphics;
    private lobbyTitle!: Phaser.GameObjects.Text;
    private lobbyInfo!: Phaser.GameObjects.Text;
    private lobbyList!: Phaser.GameObjects.Text;

    private handTitle!: Phaser.GameObjects.Text;
    private paLabel!: Phaser.GameObjects.Text;
    private paOrbs: Phaser.GameObjects.Arc[] = [];
    private playersIcon!: Phaser.GameObjects.Image;
    private apIcon!: Phaser.GameObjects.Image;
    private startIcon!: Phaser.GameObjects.Image;
    private showPlayersIcon = true;
    private showDeckIcon = true;
    private showApIcon = true;
    private showStartIcon = true;

    private centerDropZone!: Phaser.GameObjects.Zone;

    private reactionOverlay!: Phaser.GameObjects.Rectangle;
    private reactionTitle!: Phaser.GameObjects.Text;
    private reactionSubtitle!: Phaser.GameObjects.Text;
    private reactionTrack!: Phaser.GameObjects.Graphics;
    private reactionFill!: Phaser.GameObjects.Graphics;
    private reactionTween?: Phaser.Tweens.Tween;
    private reactionVisible = false;
    private reactionProxy = { t: 1 };

    private cardInspectOverlay!: Phaser.GameObjects.Rectangle;
    private cardInspectPanel!: Phaser.GameObjects.Graphics;
    private cardInspectTitle!: Phaser.GameObjects.Text;
    private cardInspectType!: Phaser.GameObjects.Text;
    private cardInspectBody!: Phaser.GameObjects.Text;
    private cardInspectHint!: Phaser.GameObjects.Text;
    private cardInspectVisible = false;

    private fxEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private ambientEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

    private opponentViews: Phaser.GameObjects.Container[] = [];
    private crisisViews: CrisisView[] = [];
    private companyCards: CardGameObject[] = [];
    private handCards: CardGameObject[] = [];

    private pendingPlayedCard?: CardGameObject;
    private myTurnTween?: Phaser.Tweens.Tween;
    private deckButtonFx?: SimpleButtonController;
    private endButtonFx?: SimpleButtonController;
    private readyButtonFx?: SimpleButtonController;
    private previousAP = -1;

    // Target Selector state
    private targetSelectorOverlay?: Phaser.GameObjects.Rectangle;
    private targetSelectorElements: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { serverManager: ServerManager; lang?: SupportedLanguage; roomCode?: string; isHost?: boolean }) {
        this.serverManager = data?.serverManager;
        this.lang = sanitizeLanguage(data?.lang ?? localStorage.getItem('lucrare_lang'));
        this.roomCode = String(data?.roomCode ?? '');
        this.visualQueue = new VisualEventQueue();

        if (this.serverManager) {
            this.serverManager.onStateChange = this.handleStateChange.bind(this);
            this.serverManager.onPlayerChange = this.handlePlayerChange.bind(this);
            this.serverManager.onRoomMessage = this.handleRoomMessage.bind(this);
        }
    }

    create() {
        this.createAnimatedBackground();
        this.createUiObjects();
        this.createOverlay();
        this.createParticles();
        this.applyLocalizedLabels();
        this.wireButtons();
        this.wireDropHandlers();

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.visualQueue.clear();
            this.hideReactionOverlay();
            this.hideCardInspect();
            this.deckButtonFx?.destroy();
            this.endButtonFx?.destroy();
            this.readyButtonFx?.destroy();
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
        this.updateDynamicBackground();
        const pulse = Math.sin(this.time.now * 0.0026);
        if (this.tableGuide.visible) {
            this.tableGuide.setAlpha(0.72 + pulse * 0.1);
        }
        if (!this.visualQueue.isBusy && this.latestState && this.latestPlayer) {
            this.applyState(this.latestState, this.latestPlayer);
            this.latestState = undefined;
            this.latestPlayer = undefined;
        }
    }

    private tr(key: string, vars?: Record<string, string | number>) {
        return t(this.lang, key, vars);
    }

    private boostText(...texts: Array<Phaser.GameObjects.Text | undefined>) {
        texts.forEach((text) => text?.setResolution(this.textResolution));
    }

    private createAnimatedBackground() {
        ensurePokemonTextures(this);

        this.retroLayerA = this.add.tileSprite(0, 0, 256, 128, 'poke-clouds')
            .setOrigin(0)
            .setAlpha(0.33)
            .setDepth(-60);
        this.retroLayerB = this.add.tileSprite(0, 0, 64, 64, 'poke-dither')
            .setOrigin(0)
            .setAlpha(0.16)
            .setDepth(-59);
    }

    private updateDynamicBackground() {
        if (this.retroLayerA) {
            this.retroLayerA.tilePositionX += 0.13;
            this.retroLayerA.tilePositionY += 0.01;
        }
        if (this.retroLayerB) {
            this.retroLayerB.tilePositionX += 0.045;
            this.retroLayerB.tilePositionY += 0.008;
        }
    }

    private applyLocalizedLabels() {
        this.topTitle.setText(this.tr('game_top_title'));
        this.opponentsPlaceholder.setText(this.tr('game_waiting_opponents'));
        this.roomCodeText.setText(this.tr('game_room_code', { code: this.roomCode || '----' }));
        this.centerTitle.setText(this.tr('game_center_title'));
        this.crisisTitle.setText(this.tr('game_crisis_title'));
        this.companyTitle.setText(this.tr('game_company_title'));
        this.turnText.setText(this.tr('game_waiting'));
        this.deckLabel.setText(this.tr('game_deck'));
        this.endButtonText.setText(this.tr('game_end_turn'));
        this.readyButtonText.setText(this.tr('game_ready'));
        this.lobbyTitle.setText(this.tr('game_lobby'));
        this.handTitle.setText(this.tr('game_hand'));
        this.paLabel.setText(this.tr('game_ap'));
        this.reactionTitle.setText(this.tr('game_reaction_title'));
        this.reactionSubtitle.setText(this.tr('game_reaction_subtitle'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));
    }

    private localizeServerError(message: any): string {
        if (this.lang === 'it') {
            return String(message?.message ?? this.tr('game_action_denied'));
        }

        const code = String(message?.code ?? '');
        switch (code) {
            case 'NOT_YOUR_TURN': return 'It is not your turn.';
            case 'WRONG_PHASE': return 'Action not allowed in this phase.';
            case 'NO_PA': return 'Not enough action points.';
            case 'CARD_NOT_IN_HAND': return 'Card is not in your hand.';
            case 'CRISIS_NOT_FOUND': return 'Crisis not found on table.';
            case 'NO_REACTION_WINDOW': return 'No active reaction window.';
            case 'SELF_REACTION': return 'You cannot react to your own action.';
            case 'HOST_ONLY': return 'Only the host can start the match.';
            case 'PLAYERS_NOT_READY': return 'All connected players must confirm first.';
            case 'NOT_ENOUGH_PLAYERS': return 'At least two connected players are required.';
            case 'NOT_ENOUGH_READY': return 'At least two ready players are required.';
            default:
                return String(message?.message ?? this.tr('game_action_denied'));
        }
    }

    private createUiObjects() {
        this.bg = this.add.graphics();
        this.topPanel = this.add.graphics();
        this.centerPanel = this.add.graphics();
        this.bottomPanel = this.add.graphics();
        this.tableGuide = this.add.graphics();

        this.topTitle = this.add.text(0, 0, this.tr('game_top_title'), {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: '#f1d8aa',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);

        this.roomCodeText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#f7f0d8',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(1, 0.5);

        this.opponentsPlaceholder = this.add.text(0, 0, this.tr('game_waiting_opponents'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#b9c6d5',
        }).setOrigin(0.5);

        this.centerTitle = this.add.text(0, 0, this.tr('game_center_title'), {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#c8d8f2',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0.5);

        this.crisisTitle = this.add.text(0, 0, this.tr('game_crisis_title'), {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#ffd2da',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.companyTitle = this.add.text(0, 0, this.tr('game_company_title'), {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#d0e3ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.turnText = this.add.text(0, 0, this.tr('game_waiting'), {
            fontFamily: FONT_UI,
            fontSize: '34px',
            color: '#f4f8ff',
            letterSpacing: 1.5,
        }).setOrigin(0.5);

        this.deckButton = this.add.graphics().setDepth(20);
        this.deckHit = this.add.rectangle(0, 0, 84, 116, 0x000000, 0).setDepth(21).setInteractive({ useHandCursor: true });
        this.deckLabel = this.add.text(0, 0, this.tr('game_deck'), {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#d8f0ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5).setDepth(22);
        this.deckCountText = this.add.text(0, 0, '0', {
            fontFamily: FONT_UI,
            fontSize: '26px',
            color: '#eefaff',
        }).setOrigin(0.5).setDepth(22);

        this.endButton = this.add.graphics().setDepth(20);
        this.endHit = this.add.rectangle(0, 0, 126, 50, 0x000000, 0).setDepth(21).setInteractive({ useHandCursor: true });
        this.endButtonText = this.add.text(0, 0, this.tr('game_end_turn'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#f0f8ff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5).setDepth(22);

        this.readyButton = this.add.graphics().setDepth(62);
        this.readyHit = this.add.rectangle(0, 0, 212, 52, 0x000000, 0).setDepth(63).setInteractive({ useHandCursor: true });
        this.readyButtonText = this.add.text(0, 0, this.tr('game_ready'), {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#fdf4e2',
            fontStyle: '700',
            letterSpacing: 1.2,
        }).setOrigin(0.5).setDepth(64);

        this.lobbyPanel = this.add.graphics().setDepth(56);
        this.lobbyTitle = this.add.text(0, 0, this.tr('game_lobby'), {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: '#ffdca4',
            fontStyle: '700',
            letterSpacing: 1.8,
        }).setOrigin(0.5).setDepth(57);
        this.lobbyInfo = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#f8e3be',
            align: 'center',
            wordWrap: { width: 380 },
            lineSpacing: 3,
        }).setOrigin(0.5, 0).setDepth(57);
        this.lobbyList = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ebf5ff',
            align: 'left',
            lineSpacing: 4,
            wordWrap: { width: 370 },
        }).setOrigin(0.5, 0).setDepth(57);
        this.lobbyPanel.setVisible(false);
        this.lobbyTitle.setVisible(false);
        this.lobbyInfo.setVisible(false);
        this.lobbyList.setVisible(false);
        this.readyButton.setVisible(false);
        this.readyHit.setVisible(false);
        this.readyButtonText.setVisible(false);

        this.handTitle = this.add.text(0, 0, this.tr('game_hand'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#c6d9ef',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);

        this.paLabel = this.add.text(0, 0, this.tr('game_ap'), {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#dce8f4',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);

        this.playersIcon = this.add.image(0, 0, this.textures.exists('ui-players') ? 'ui-players' : 'retro-grid').setDepth(23).setScale(0.3).setAlpha(0.95);
        this.deckIcon = this.add.image(0, 0, this.textures.exists('ui-deck') ? 'ui-deck' : 'retro-grid').setDepth(23).setScale(0.26).setAlpha(0.95);
        this.apIcon = this.add.image(0, 0, this.textures.exists('ui-ap') ? 'ui-ap' : 'retro-grid').setDepth(16).setScale(0.23).setAlpha(0.95);
        this.startIcon = this.add.image(0, 0, this.textures.exists('ui-start') ? 'ui-start' : 'retro-grid').setDepth(65).setScale(0.24).setAlpha(0.95);
        this.startIcon.setVisible(false);

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

        this.boostText(
            this.topTitle,
            this.opponentsPlaceholder,
            this.roomCodeText,
            this.centerTitle,
            this.crisisTitle,
            this.companyTitle,
            this.turnText,
            this.deckLabel,
            this.deckCountText,
            this.endButtonText,
            this.readyButtonText,
            this.lobbyTitle,
            this.lobbyInfo,
            this.lobbyList,
            this.handTitle,
            this.paLabel,
        );
    }
    private createOverlay() {
        this.reactionOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.65).setDepth(500).setVisible(false);
        this.reactionTitle = this.add.text(0, 0, this.tr('game_reaction_title'), {
            fontFamily: FONT_UI,
            fontSize: '48px',
            color: '#ecf8ff',
            letterSpacing: 2,
        }).setOrigin(0.5).setDepth(501).setVisible(false);

        this.reactionSubtitle = this.add.text(0, 0, this.tr('game_reaction_subtitle'), {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: '#a9c1d4',
            fontStyle: '600',
        }).setOrigin(0.5).setDepth(501).setVisible(false);

        this.reactionTrack = this.add.graphics().setDepth(501).setVisible(false);
        this.reactionFill = this.add.graphics().setDepth(502).setVisible(false);
        this.cardInspectOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72)
            .setDepth(540)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.cardInspectOverlay.on('pointerdown', () => this.hideCardInspect());

        this.cardInspectPanel = this.add.graphics().setDepth(541).setVisible(false);
        this.cardInspectTitle = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f5f9ff',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: 720 },
        }).setOrigin(0.5, 0).setDepth(542).setVisible(false);
        this.cardInspectType = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#c2d7eb',
            fontStyle: '700',
            letterSpacing: 1,
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(542).setVisible(false);
        this.cardInspectBody = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#ecf6ff',
            align: 'left',
            wordWrap: { width: 760 },
            lineSpacing: 6,
        }).setOrigin(0.5, 0).setDepth(542).setVisible(false);
        this.cardInspectHint = this.add.text(0, 0, this.tr('game_close_hint'), {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#9eb5c8',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5, 1).setDepth(542).setVisible(false);

        this.boostText(
            this.reactionTitle,
            this.reactionSubtitle,
            this.cardInspectTitle,
            this.cardInspectType,
            this.cardInspectBody,
            this.cardInspectHint,
        );
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

        this.ambientEmitter = this.add.particles(0, 0, 'fx-dot', {
            x: { min: 0, max: this.screenW },
            y: { min: 0, max: this.screenH },
            speedX: { min: -10, max: 10 },
            speedY: { min: -14, max: -4 },
            scale: { start: 0.45, end: 0 },
            alpha: { start: 0.26, end: 0 },
            lifespan: { min: 2200, max: 3400 },
            quantity: 1,
            frequency: 260,
            emitting: true,
            blendMode: Phaser.BlendModes.ADD,
            tint: [0x8ad9ff, 0xa7e9c1, 0xffd4a6],
        }).setDepth(4);

        this.updateAmbientEmitterBounds();
    }

    private wireButtons() {
        this.deckButtonFx = createSimpleButtonFx(
            this,
            this.deckHit,
            [this.deckButton, this.deckLabel, this.deckCountText],
            { onClick: () => this.serverManager.drawCard() },
        );

        this.endButtonFx = createSimpleButtonFx(
            this,
            this.endHit,
            [this.endButton, this.endButtonText],
            { onClick: () => this.serverManager.endTurn() },
        );

        this.readyButtonFx = createSimpleButtonFx(
            this,
            this.readyHit,
            [this.readyButton, this.readyButtonText, this.startIcon],
            {
                onClick: () => {
                    const room = this.serverManager.room;
                    if (!room) return;

                    const state = room.state as IGameState;
                    if (state.phase !== GamePhase.WAITING_FOR_PLAYERS) return;

                    const me = (state.players as unknown as Map<string, IPlayer>).get(room.sessionId);
                    if (!me) return;

                    const isHost = state.hostSessionId === room.sessionId;
                    const connectedPlayers = Array.from((state.players as unknown as Map<string, IPlayer>).values())
                        .filter((player) => player.isConnected);
                    const enoughPlayers = connectedPlayers.length >= MIN_PLAYERS_TO_START;
                    const everyoneReady = enoughPlayers && connectedPlayers.every((player) => player.isReady);

                    if (!me.isReady) {
                        this.serverManager.joinGame();
                        this.floatText(this.tr('game_ready_waiting'), '#ffe0a8', this.readyHit.x, this.readyHit.y - 46);
                        return;
                    }

                    if (isHost && everyoneReady) {
                        this.serverManager.startMatch();
                        this.floatText(this.tr('game_starting_match'), '#b9f8cf', this.readyHit.x, this.readyHit.y - 46);
                    }
                },
            },
        );
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
                this.snapBack(card, this.tr('game_no_connection'));
                return;
            }

            if (state.phase === GamePhase.REACTION_WINDOW) {
                const canReact = state.pendingAction?.playerId !== myId;
                if (card.cardData.type === CardType.REACTION && canReact) {
                    this.serverManager.playReaction(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                this.snapBack(card, this.tr('game_only_reaction'));
                return;
            }

            if (state.phase !== GamePhase.PLAYER_TURN) {
                this.snapBack(card, this.tr('game_wrong_phase'));
                return;
            }

            if (zoneType === 'center_table') {
                if (card.cardData.type === CardType.EMPLOYEE) {
                    this.serverManager.playEmployee(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                if (card.cardData.type === CardType.MAGIC) {
                    this.showTargetSelector(card);
                    return;
                }
                this.snapBack(card, this.tr('game_drop_invalid_target'));
                return;
            }

            if (zoneType === 'crisis') {
                const crisisId = String(zone.getData('crisisId') ?? '');
                if (!crisisId) {
                    this.snapBack(card, this.tr('game_invalid_crisis_target'));
                    return;
                }
                this.serverManager.solveCrisis(card.cardData.id, crisisId);
                this.stashPending(card);
                return;
            }

            this.snapBack(card, this.tr('game_invalid_drop_area'));
        });
    }

    private handleResize(size: Phaser.Structs.Size) {
        this.screenW = size.width;
        this.screenH = size.height;

        this.isLandscapeLayout = this.screenW > this.screenH;
        this.uiW = this.isLandscapeLayout ? Math.min(this.screenW * 0.94, 1480) : Math.min(this.screenW * 0.98, 640);
        this.uiX = (this.screenW - this.uiW) * 0.5;

        if (this.isLandscapeLayout) {
            this.topH = Phaser.Math.Clamp(this.screenH * 0.28, 90, 188);
            this.bottomH = Phaser.Math.Clamp(this.screenH * 0.34, 132, 246);
        } else {
            this.topH = Phaser.Math.Clamp(this.screenH * 0.23, 104, 190);
            this.bottomH = Phaser.Math.Clamp(this.screenH * 0.35, 210, 340);
        }
        this.centerH = this.screenH - this.topH - this.bottomH;
        const minCenterH = this.isLandscapeLayout ? 122 : 220;
        if (this.centerH < minCenterH) {
            const deficit = minCenterH - this.centerH;
            if (this.isLandscapeLayout) {
                const bottomShrink = Math.min(deficit * 0.68, this.bottomH - 116);
                this.bottomH -= bottomShrink;
                const topShrink = Math.min(deficit - bottomShrink, this.topH - 84);
                this.topH -= topShrink;
            } else {
                const bottomShrink = Math.min(deficit * 0.7, this.bottomH - 176);
                this.bottomH -= bottomShrink;
                const topShrink = Math.min(deficit - bottomShrink, this.topH - 96);
                this.topH -= topShrink;
            }
            this.centerH = this.screenH - this.topH - this.bottomH;
        }

        this.retroLayerA.setSize(this.screenW, this.screenH);
        this.retroLayerB.setSize(this.screenW, this.screenH);

        this.drawBackground();
        this.layoutPanels();
        this.layoutOverlay();
        this.updateAmbientEmitterBounds();

        const state = this.serverManager?.room?.state as IGameState | undefined;
        if (state && this.serverManager?.room) {
            const me = (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId);
            if (me) this.applyState(state, me);
        }
    }

    private drawBackground() {
        drawPokemonBackdrop(this.bg, this.screenW, this.screenH, 0.58);

        this.bg.fillStyle(0xf6e2b9, 0.14);
        this.bg.fillRect(this.uiX + 18, this.topH + 2, this.uiW - 36, 2);
        this.bg.fillRect(this.uiX + 18, this.topH + this.centerH + 2, this.uiW - 36, 2);
    }

    private updateAmbientEmitterBounds() {
        if (!this.ambientEmitter) return;
        this.ambientEmitter.setConfig({
            x: { min: this.uiX + 16, max: this.uiX + this.uiW - 16 },
            y: { min: this.topH + 12, max: this.topH + this.centerH + this.bottomH - 18 },
        });
    }

    private layoutPanels() {
        const topY = 0;
        const centerY = this.topH;
        const bottomY = this.topH + this.centerH;

        this.showPlayersIcon = this.uiW >= (this.isLandscapeLayout ? 860 : 560);
        this.showDeckIcon = this.uiW >= (this.isLandscapeLayout ? 760 : 520);
        this.showApIcon = this.uiW >= (this.isLandscapeLayout ? 700 : 420);
        this.showStartIcon = this.uiW >= (this.isLandscapeLayout ? 1120 : 560);

        this.playersIcon.setVisible(this.showPlayersIcon);
        this.deckIcon.setVisible(this.showDeckIcon);
        this.apIcon.setVisible(this.showApIcon);

        this.topPanel.clear();
        this.topPanel.fillStyle(0x262b37, 0.86);
        this.topPanel.fillRoundedRect(this.uiX + 8, topY + 8, this.uiW - 16, this.topH - 14, 16);
        this.topPanel.lineStyle(1.1, 0x978369, 0.9);
        this.topPanel.strokeRoundedRect(this.uiX + 8, topY + 8, this.uiW - 16, this.topH - 14, 16);

        this.centerPanel.clear();
        this.centerPanel.fillStyle(0x1b2130, 0.84);
        this.centerPanel.fillRoundedRect(this.uiX + 8, centerY + 4, this.uiW - 16, this.centerH - 8, 16);
        this.centerPanel.lineStyle(1.1, 0x7188a8, 0.84);
        this.centerPanel.strokeRoundedRect(this.uiX + 8, centerY + 4, this.uiW - 16, this.centerH - 8, 16);

        this.bottomPanel.clear();
        this.bottomPanel.fillStyle(0x202736, 0.92);
        this.bottomPanel.fillRoundedRect(this.uiX + 8, bottomY + 2, this.uiW - 16, this.bottomH - 10, 16);
        this.bottomPanel.lineStyle(1.1, 0x7e96b6, 0.8);
        this.bottomPanel.strokeRoundedRect(this.uiX + 8, bottomY + 2, this.uiW - 16, this.bottomH - 10, 16);

        const topInfoY = topY + Phaser.Math.Clamp(this.topH * 0.22, 22, 34);
        const opponentRowY = topY + Phaser.Math.Clamp(this.topH * 0.63, 62, this.topH - 24);

        this.topTitle
            .setPosition(this.uiX + (this.showPlayersIcon ? 54 : 18), topInfoY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 19)}px`);
        this.roomCodeText
            .setPosition(this.uiX + this.uiW - 24, topInfoY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0115, 11, 14)}px`);
        if (this.showPlayersIcon) {
            this.playersIcon.setPosition(this.uiX + 30, opponentRowY).setDisplaySize(26, 26);
        }
        this.opponentsPlaceholder
            .setPosition(this.uiX + this.uiW * 0.5, opponentRowY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0118, 11, 16)}px`);

        const centerTop = centerY + (this.isLandscapeLayout ? 12 : 16);
        const centerTitleY = centerTop + 2;
        const turnTextY = centerTop + Phaser.Math.Clamp(this.centerH * 0.19, 34, 72);
        const crisisTitleY = centerTop + Phaser.Math.Clamp(this.centerH * 0.36, 66, 112);

        this.centerTitle
            .setPosition(this.uiX + this.uiW * 0.5, centerTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 17)}px`);
        this.turnText
            .setPosition(this.uiX + this.uiW * 0.5, turnTextY)
            .setWordWrapWidth(this.isLandscapeLayout ? this.uiW * 0.72 : this.uiW * 0.82)
            .setFontSize(this.isLandscapeLayout
                ? `${Phaser.Math.Clamp(this.uiW * 0.018, 16, 24)}px`
                : `${Phaser.Math.Clamp(this.uiW * 0.022, 18, 30)}px`);

        this.centerDropW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.uiW * 0.52, 270, 620)
            : Phaser.Math.Clamp(this.uiW * 0.82, 260, 580);
        this.centerDropH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerH * 0.34, 92, 170)
            : Phaser.Math.Clamp(this.centerH * 0.36, 112, 220);
        this.centerDropX = this.uiX + this.uiW * 0.5;
        this.centerDropY = centerY + this.centerH * (this.isLandscapeLayout ? 0.58 : 0.62);

        this.tableGuide.clear();
        this.tableGuide.lineStyle(2, 0xd1d9ec, 0.35);
        this.tableGuide.strokeRoundedRect(
            this.centerDropX - this.centerDropW * 0.5,
            this.centerDropY - this.centerDropH * 0.5,
            this.centerDropW,
            this.centerDropH,
            16,
        );

        this.centerDropZone.setPosition(this.centerDropX, this.centerDropY).setSize(this.centerDropW, this.centerDropH);
        this.centerDropZone.input?.hitArea.setTo(0, 0, this.centerDropW, this.centerDropH);

        this.crisisTitle.setPosition(this.uiX + this.uiW * 0.5, crisisTitleY).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);
        this.companyTitle
            .setPosition(this.uiX + this.uiW * 0.5, centerY + this.centerH - Phaser.Math.Clamp(this.centerH * 0.13, 20, 34))
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);

        const deckW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerH * 0.22, 66, 82)
            : Phaser.Math.Clamp(this.centerH * 0.24, 74, 92);
        const deckH = deckW * 1.36;
        const controlsY = centerY + this.centerH - Phaser.Math.Clamp(this.centerH * 0.16, 26, 40);
        const deckX = this.uiX + this.uiW - deckW * 0.72 - 16;
        this.deckHit.setSize(deckW, deckH).setPosition(deckX, controlsY);
        this.deckButton.setPosition(deckX, controlsY);
        this.deckLabel
            .setPosition(deckX, controlsY - deckH * 0.38)
            .setFontSize(`${Phaser.Math.Clamp(deckW * 0.19, 10, 14)}px`);
        this.deckCountText
            .setPosition(deckX, controlsY + deckH * 0.29)
            .setFontSize(`${Phaser.Math.Clamp(deckW * 0.34, 20, 28)}px`);
        if (this.showDeckIcon) {
            const iconSize = deckW * 0.38;
            this.deckIcon
                .setPosition(deckX, controlsY - deckH * 0.13)
                .setDisplaySize(iconSize, iconSize);
        }

        const endW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(deckW * 1.7, 110, 138)
            : Phaser.Math.Clamp(deckW * 1.8, 118, 152);
        const endH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(deckH * 0.42, 40, 48)
            : Phaser.Math.Clamp(deckH * 0.44, 42, 52);
        const endX = deckX - (deckW * 0.5 + endW * 0.5 + 18);
        this.endHit.setSize(endW, endH).setPosition(endX, controlsY);
        this.endButton.setPosition(endX, controlsY);
        this.endButtonText
            .setPosition(endX, controlsY)
            .setFontSize(`${Phaser.Math.Clamp(endW * 0.12, 12, 15)}px`);

        const lobbyW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.uiW * 0.62, 380, 760)
            : Phaser.Math.Clamp(this.uiW * 0.9, 300, 560);
        const lobbyH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerH * 0.95, 170, 330)
            : Phaser.Math.Clamp(this.centerH * 0.88, 220, 380);
        const lobbyX = this.uiX + this.uiW * 0.5;
        const lobbyY = centerY + this.centerH * 0.56;

        this.lobbyPanel.clear();
        this.lobbyPanel.fillStyle(0x2d2623, 0.93);
        this.lobbyPanel.fillRoundedRect(lobbyX - lobbyW * 0.5, lobbyY - lobbyH * 0.5, lobbyW, lobbyH, 16);
        this.lobbyPanel.lineStyle(1.2, 0xc6a777, 0.95);
        this.lobbyPanel.strokeRoundedRect(lobbyX - lobbyW * 0.5, lobbyY - lobbyH * 0.5, lobbyW, lobbyH, 16);

        this.lobbyTitle
            .setPosition(lobbyX, lobbyY - lobbyH * 0.4)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.015, 13, 18)}px`);

        this.lobbyInfo
            .setPosition(lobbyX, lobbyY - lobbyH * 0.3)
            .setWordWrapWidth(lobbyW - 34)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0104, 11, 15)}px`);

        this.lobbyList
            .setPosition(lobbyX, lobbyY - lobbyH * 0.08)
            .setWordWrapWidth(lobbyW - 42)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0102, 10, 14)}px`);

        const readyW = Phaser.Math.Clamp(lobbyW * 0.72, 230, 340);
        const readyH = Phaser.Math.Clamp(lobbyH * 0.2, 46, 56);
        const readyY = lobbyY + lobbyH * 0.34;
        this.readyHit.setPosition(lobbyX, readyY).setSize(readyW, readyH);
        this.readyButton.setPosition(lobbyX, readyY);
        this.readyButtonText
            .setPosition(lobbyX, readyY)
            .setFontSize(`${Phaser.Math.Clamp(readyW * 0.08, 13, 17)}px`);
        this.startIcon.setPosition(lobbyX - readyW * 0.36, readyY).setDisplaySize(20, 20);

        const bottomTop = bottomY + 2;
        const handTitleY = bottomTop + Phaser.Math.Clamp(this.bottomH * 0.13, 18, 32);
        const apY = handTitleY + Phaser.Math.Clamp(this.bottomH * 0.17, 20, 34);
        this.handTitle
            .setPosition(this.uiX + 24, handTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.012, 12, 16)}px`);
        this.paLabel
            .setPosition(this.uiX + (this.showApIcon ? 52 : 14), apY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0105, 11, 14)}px`);
        if (this.showApIcon) {
            this.apIcon.setPosition(this.uiX + 26, apY + 2).setDisplaySize(18, 18);
        }
        const orbStart = this.uiX + (this.showApIcon ? 116 : 44);
        const orbGap = Phaser.Math.Clamp(this.uiW * 0.018, 22, 28);
        this.paOrbs.forEach((orb, index) => orb.setPosition(orbStart + index * orbGap, apY + 2));

        this.drawDeckButton(false);
        this.drawEndButton(false);
        this.drawReadyButton(false);
    }

    private layoutOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;

        this.reactionOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);
        this.reactionTitle.setPosition(cx, cy - 34).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.035, 30, 54)}px`);
        this.reactionSubtitle.setPosition(cx, cy + 6).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.013, 13, 18)}px`);
        this.redrawReactionBar();
        this.layoutCardInspectOverlay();
    }

    private layoutCardInspectOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;
        const panelW = Phaser.Math.Clamp(this.screenW * (this.isLandscapeLayout ? 0.74 : 0.94), 320, 900);
        const panelH = Phaser.Math.Clamp(this.screenH * (this.isLandscapeLayout ? 0.84 : 0.82), 300, 760);
        const panelX = cx - panelW * 0.5;
        const panelY = cy - panelH * 0.5;

        this.cardInspectOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);

        this.cardInspectPanel.clear();
        this.cardInspectPanel.fillStyle(0x1b2430, 0.97);
        this.cardInspectPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
        this.cardInspectPanel.fillStyle(0xffffff, 0.07);
        this.cardInspectPanel.fillRoundedRect(panelX + 2, panelY + 2, panelW - 4, panelH * 0.22, { tl: 16, tr: 16, bl: 0, br: 0 });
        this.cardInspectPanel.lineStyle(1.5, 0xc3d6e8, 0.92);
        this.cardInspectPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);

        this.cardInspectTitle
            .setPosition(cx, panelY + 20)
            .setWordWrapWidth(panelW - 48)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.034, 20, 34)}px`);
        this.cardInspectType
            .setPosition(cx, panelY + 74)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.018, 12, 18)}px`);
        this.cardInspectBody
            .setPosition(cx, panelY + 112)
            .setWordWrapWidth(panelW - 44)
            .setLineSpacing(5)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.022, 15, 24)}px`);
        this.cardInspectHint
            .setPosition(cx, panelY + panelH - 14)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.014, 11, 14)}px`);

        if (!this.cardInspectVisible) {
            this.cardInspectPanel.setVisible(false);
        }
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

    private showCardInspect(card: ICardData) {
        const typeLabel = String(card.type ?? '').toUpperCase();
        this.cardInspectTitle.setText(card.name ?? card.templateId ?? 'CARD');
        this.cardInspectType.setText(`${typeLabel}  |  ${card.templateId ?? ''}`);
        this.cardInspectBody.setText(card.description && card.description.trim().length > 0
            ? card.description
            : this.tr('game_no_card_description'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));

        this.cardInspectVisible = true;
        this.cardInspectOverlay.setVisible(true);
        this.cardInspectPanel.setVisible(true);
        this.cardInspectTitle.setVisible(true);
        this.cardInspectType.setVisible(true);
        this.cardInspectBody.setVisible(true);
        this.cardInspectHint.setVisible(true);
        this.layoutCardInspectOverlay();
    }

    private hideCardInspect() {
        if (!this.cardInspectVisible) return;
        this.cardInspectVisible = false;
        this.cardInspectOverlay.setVisible(false);
        this.cardInspectPanel.setVisible(false);
        this.cardInspectTitle.setVisible(false);
        this.cardInspectType.setVisible(false);
        this.cardInspectBody.setVisible(false);
        this.cardInspectHint.setVisible(false);
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
        const handCards = (me.hand as unknown as ICardData[]) ?? [];
        this.rebuildHand(handCards);
        if (handCards.length === 0 && this.cardInspectVisible) {
            this.hideCardInspect();
        }
        this.updateAP(me.actionPoints ?? 0);
        this.updateTurn(state, myId);
        this.updateLobby(state, myId, me);
        this.updateControls(state, me, myId);

        if (state.phase === GamePhase.REACTION_WINDOW && !this.reactionVisible) {
            const remaining = state.reactionEndTime ? Math.max(250, state.reactionEndTime - Date.now()) : 5000;
            this.showReactionOverlay(remaining, this.tr('game_reaction_subtitle'));
        }

        if (state.phase !== GamePhase.REACTION_WINDOW && this.reactionVisible) {
            this.hideReactionOverlay();
        }
    }

    private updateTurn(state: IGameState, myId: string) {
        if (state.phase === GamePhase.WAITING_FOR_PLAYERS) {
            if (this.myTurnTween) this.myTurnTween.stop();
            this.myTurnTween = undefined;
            this.turnText.setText(this.tr('game_lobby')).setColor('#f6d7a6').setAlpha(1);
            return;
        }

        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        if (!active) {
            this.turnText.setText(this.tr('game_waiting')).setColor('#dceeff').setAlpha(1);
            return;
        }

        if (state.currentTurnPlayerId === myId) {
            this.turnText.setText(this.tr('game_turn_your')).setColor('#b8f8cc').setAlpha(1);

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

            this.turnText.setText(this.tr('game_turn_other', { name: active.username.toUpperCase() })).setColor('#c8d9e7').setAlpha(1);
        }
    }

    private updateLobby(state: IGameState, myId: string, me: IPlayer) {
        const waiting = state.phase === GamePhase.WAITING_FOR_PLAYERS;
        const hostId = state.hostSessionId ?? '';
        const localIsHost = hostId === myId;

        this.lobbyPanel.setVisible(waiting);
        this.lobbyTitle.setVisible(waiting);
        this.lobbyInfo.setVisible(waiting);
        this.lobbyList.setVisible(waiting);
        this.readyButton.setVisible(waiting);
        this.readyHit.setVisible(waiting);
        this.readyButtonText.setVisible(waiting);
        this.startIcon.setVisible(waiting && this.showStartIcon && localIsHost && me.isReady);
        this.roomCodeText.setVisible(waiting && localIsHost && this.roomCode.length === 4);

        this.tableGuide.setVisible(!waiting);
        this.crisisTitle.setVisible(!waiting);
        this.companyTitle.setVisible(!waiting);

        if (!waiting) {
            if (this.readyHit.input) this.readyHit.input.enabled = false;
            this.readyButtonFx?.reset();
            return;
        }

        const players = Array.from((state.players as unknown as Map<string, IPlayer>).values());
        const connectedPlayers = players.filter((player) => player.isConnected);
        const readyCount = connectedPlayers.filter((player) => player.isReady).length;
        const enoughPlayers = connectedPlayers.length >= MIN_PLAYERS_TO_START;
        const everyoneReady = enoughPlayers && connectedPlayers.every((player) => player.isReady);
        const missing = Math.max(0, MIN_PLAYERS_TO_START - readyCount);

        let lobbyInfoText = '';
        if (!enoughPlayers) {
            lobbyInfoText = this.tr('game_lobby_need_more', { connected: connectedPlayers.length, ready: readyCount, missing });
        } else if (!everyoneReady) {
            lobbyInfoText = this.tr('game_lobby_wait_all', { ready: readyCount, total: connectedPlayers.length });
        } else if (localIsHost) {
            lobbyInfoText = this.tr('game_lobby_host_can_start');
        } else {
            lobbyInfoText = this.tr('game_lobby_wait_host_start');
        }
        this.lobbyInfo.setText(`${lobbyInfoText}\n${this.tr('game_rules_brief')}`);

        const roster = players.length > 0
            ? players.map((player) => {
                const marker = player.isReady ? this.tr('game_status_ready') : this.tr('game_status_not_ready');
                const meTag = player.sessionId === myId ? ` ${this.tr('game_you')}` : '';
                const net = player.isConnected ? this.tr('game_status_online') : this.tr('game_status_offline');
                const icon = player.isReady ? '*' : 'o';
                return `${icon} ${player.username}${meTag}  ${marker} | ${net}`;
            }).join('\n')
            : this.tr('game_lobby_no_players');

        this.lobbyList.setText(roster);
        this.lobbyTitle.setText(localIsHost ? this.tr('game_lobby_host') : this.tr('game_lobby'));

        const canReady = !me.isReady;
        const canStart = localIsHost && me.isReady && everyoneReady;
        const buttonActive = canReady || canStart;
        const buttonLabel = canReady
            ? this.tr('game_ready')
            : canStart
                ? this.tr('game_start_match')
                : localIsHost
                    ? this.tr('game_start_waiting')
                    : this.tr('game_ready_confirmed');

        if (this.readyHit.input) this.readyHit.input.enabled = buttonActive;
        this.drawReadyButton(buttonActive);
        this.readyButtonText.setText(buttonLabel);

        if (!buttonActive) this.readyButtonFx?.reset();
    }

    private updateAP(current: number) {
        this.paOrbs.forEach((orb, index) => {
            const on = index < current;
            orb.setFillStyle(on ? 0x77d8ff : 0x20384b, 1);
            orb.setStrokeStyle(1.5, on ? 0xa6ebff : 0x78c8ef, on ? 1 : 0.35);

            if (on && current !== this.previousAP) {
                this.tweens.killTweensOf(orb);
                this.tweens.add({ targets: orb, scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 120 });
            }
        });
        this.previousAP = current;
    }

    private updateControls(state: IGameState, me: IPlayer, myId: string) {
        const isMyTurn = state.currentTurnPlayerId === myId;
        const canDraw = isMyTurn && state.phase === GamePhase.PLAYER_TURN && me.actionPoints >= 1 && state.deckCount > 0;
        const canEnd = isMyTurn && state.phase === GamePhase.PLAYER_TURN;

        if (this.deckHit.input) this.deckHit.input.enabled = canDraw;
        if (this.endHit.input) this.endHit.input.enabled = canEnd;

        this.drawDeckButton(canDraw);
        this.drawEndButton(canEnd);
        if (!canDraw) this.deckButtonFx?.reset();
        if (!canEnd) this.endButtonFx?.reset();

        const canReact = state.phase === GamePhase.REACTION_WINDOW && state.pendingAction?.playerId !== myId;
        const canPlayTurn = state.phase === GamePhase.PLAYER_TURN && isMyTurn;

        this.handCards.forEach((card) => {
            const canPlayThisCard = canPlayTurn || (canReact && card.cardData.type === CardType.REACTION);
            if (!card.input) {
                card.setInteractive({ useHandCursor: true });
            }
            if (card.input) card.input.enabled = true;
            this.input.setDraggable(card as unknown as Phaser.GameObjects.GameObject, canPlayThisCard);
        });
    }

    private drawDeckButton(active: boolean) {
        const w = this.deckHit.width;
        const h = this.deckHit.height;

        paintRetroButton(
            this.deckButton,
            { width: w, height: h, radius: 12, borderWidth: 1.4 },
            {
                base: active ? 0x37445c : 0x2a3346,
                border: active ? 0xcdd8f4 : 0x69778e,
                glossAlpha: active ? 0.16 : 0.08,
            },
        );

        this.deckLabel.setColor(active ? '#f4f9ff' : '#b5c0d0');
        this.deckCountText.setColor(active ? '#fbfeff' : '#c3cfde');
    }

    private drawEndButton(active: boolean) {
        const w = this.endHit.width;
        const h = this.endHit.height;

        paintRetroButton(
            this.endButton,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x367ba3 : 0x3a5366,
                border: active ? 0xd6ecff : 0x7b93a8,
                glossAlpha: active ? 0.18 : 0.08,
            },
        );

        this.endButtonText.setColor(active ? '#ffffff' : '#b9c8d8');
    }

    private drawReadyButton(active: boolean) {
        const w = this.readyHit.width;
        const h = this.readyHit.height;

        paintRetroButton(
            this.readyButton,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x8a5a2d : 0x5d4b37,
                border: active ? 0xffd7a1 : 0x98775b,
                glossAlpha: active ? 0.18 : 0.09,
            },
        );

        this.readyButtonText.setColor(active ? '#ffffff' : '#d5c7b3');
    }

    private updateOpponents(state: IGameState, myId: string) {
        this.opponentViews.forEach((view) => view.destroy());
        this.opponentViews = [];

        const opponents: IPlayer[] = [];
        (state.players as unknown as Map<string, IPlayer>).forEach((player, sessionId) => {
            if (sessionId !== myId) opponents.push(player);
        });
        opponents.sort((a, b) => a.username.localeCompare(b.username));

        if (opponents.length === 0) {
            const waitMsg = state.phase === GamePhase.WAITING_FOR_PLAYERS
                ? this.tr('game_open_tab_hint')
                : this.tr('game_waiting_opponents');
            this.opponentsPlaceholder.setText(waitMsg);
            this.opponentsPlaceholder.setVisible(true);
            return;
        }

        this.opponentsPlaceholder.setVisible(false);

        const gapX = this.isLandscapeLayout ? 8 : 10;
        const gapY = this.isLandscapeLayout ? 8 : 10;
        const topHeaderH = Phaser.Math.Clamp(this.topH * 0.28, 30, 46);
        const areaTop = topHeaderH + 14;
        const areaBottom = this.topH - 12;
        const areaW = this.uiW - 34;
        const areaH = Math.max(40, areaBottom - areaTop);
        const minPanelW = this.isLandscapeLayout ? 112 : 118;
        const maxColumns = Math.max(1, Math.floor((areaW + gapX) / (minPanelW + gapX)));
        const columns = Math.max(1, Math.min(opponents.length, maxColumns));
        const rows = Math.ceil(opponents.length / columns);

        const panelW = Phaser.Math.Clamp((areaW - gapX * (columns - 1)) / columns, 102, this.isLandscapeLayout ? 190 : 212);
        const panelH = Phaser.Math.Clamp((areaH - gapY * (rows - 1)) / rows, 38, this.isLandscapeLayout ? 64 : 82);
        const totalW = columns * panelW + (columns - 1) * gapX;
        const totalH = rows * panelH + (rows - 1) * gapY;
        const startX = this.uiX + this.uiW * 0.5 - totalW * 0.5 + panelW * 0.5;
        const startY = areaTop + (areaH - totalH) * 0.5 + panelH * 0.5;

        opponents.forEach((opp, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            const x = startX + col * (panelW + gapX);
            const y = startY + row * (panelH + gapY);
            const active = state.phase === GamePhase.PLAYER_TURN && state.currentTurnPlayerId === opp.sessionId;
            const ready = state.phase === GamePhase.WAITING_FOR_PLAYERS && opp.isReady;
            const offline = !opp.isConnected;

            const frame = this.add.graphics();
            frame.fillStyle(
                offline
                    ? 0x3c2f35
                    : ready
                        ? 0x3a4a34
                        : active
                            ? 0x2d4a58
                            : 0x2e3b4d,
                1,
            );
            frame.fillRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 10);
            frame.lineStyle(1.2, active ? 0xbbe3ff : ready ? 0xd8eaa0 : offline ? 0xd79aa8 : 0x8ea4bb, 1);
            frame.strokeRoundedRect(-panelW * 0.5, -panelH * 0.5, panelW, panelH, 10);

            const name = this.add.text(-panelW * 0.5 + 10, -panelH * 0.21, opp.username, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(panelW * 0.076, 10, 15)}px`,
                color: active ? '#d5edff' : ready ? '#eaf8bf' : offline ? '#f4c4cf' : '#ddebf9',
                fontStyle: '700',
                wordWrap: { width: panelW - 26 },
            }).setOrigin(0, 0.5).setResolution(this.textResolution);

            const companyLen = (opp.company as unknown as ICardData[])?.length ?? 0;
            const statsLabel = state.phase === GamePhase.WAITING_FOR_PLAYERS
                ? `${opp.isReady ? this.tr('game_status_ready') : this.tr('game_status_waiting_short')} | ${opp.isConnected ? this.tr('game_status_online_short') : this.tr('game_status_offline_short')}`
                : `${this.tr('game_hand_short')} ${(opp.hand as any)?.length ?? 0} | ${this.tr('game_ap')} ${opp.actionPoints} | \ud83d\udc54 ${companyLen}`;

            const stats = this.add.text(-panelW * 0.5 + 10, panelH * 0.2, statsLabel, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(panelW * 0.062, 9, 12)}px`,
                color: '#b2c3d3',
                fontStyle: '700',
                wordWrap: { width: panelW - 24 },
            }).setOrigin(0, 0.5).setResolution(this.textResolution);

            const dotColor = offline ? 0xd88ea0 : ready ? 0xd9ef98 : active ? 0xa9daff : 0xa4b5c9;
            const dot = this.add.circle(panelW * 0.5 - 12, 0, 4.5, dotColor, 1);
            this.opponentViews.push(this.add.container(x, y, [frame, name, stats, dot]).setDepth(30));
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

        const y = Phaser.Math.Clamp(
            this.centerDropY - this.centerDropH * (this.isLandscapeLayout ? 0.72 : 0.74),
            this.topH + 46,
            this.centerDropY - 40,
        );
        const slotW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerDropW * 0.22, 74, 122)
            : Phaser.Math.Clamp(this.centerDropW * 0.24, 84, 132);
        const slotH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerDropH * 0.88, 82, 130)
            : Phaser.Math.Clamp(this.centerDropH * 0.92, 96, 154);
        const gap = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.uiW * 0.01, 6, 14)
            : Phaser.Math.Clamp(this.uiW * 0.012, 8, 16);
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
                fontSize: `${Phaser.Math.Clamp(slotW * 0.09, 9, 13)}px`,
                color: '#ffe2e8',
                fontStyle: '700',
                align: 'center',
                wordWrap: { width: slotW - 14 },
            }).setOrigin(0.5).setDepth(36).setResolution(this.textResolution);

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

        const y = Phaser.Math.Clamp(
            this.centerDropY + this.centerDropH * 0.67,
            this.centerDropY + 54,
            this.topH + this.centerH - 24,
        );
        const available = this.uiW * (this.isLandscapeLayout ? 0.72 : 0.86);
        const scale = this.isLandscapeLayout
            ? Phaser.Math.Clamp(available / Math.max(1, cards.length * 126), 0.48, 0.78)
            : Phaser.Math.Clamp(available / Math.max(1, cards.length * 126), 0.58, 0.92);
        const spacing = 112 * scale;
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

        const cardCount = cards.length;
        const useTwoRows = this.isLandscapeLayout ? cardCount > 6 : cardCount > 5;
        const cardsPerRow = useTwoRows ? Math.ceil(cardCount / 2) : cardCount;
        const available = this.uiW - 48;

        const baseCardW = 122;
        let scale = this.isLandscapeLayout
            ? Phaser.Math.Clamp(available / Math.max(1, cardsPerRow * (baseCardW * 0.94)), 0.66, 0.96)
            : Phaser.Math.Clamp(available / Math.max(1, cardsPerRow * (baseCardW * 0.9)), 0.72, 1.05);
        if (useTwoRows) {
            scale = Math.max(scale, this.isLandscapeLayout ? 0.68 : 0.76);
        }

        const spacing = cardsPerRow > 1
            ? Math.min(baseCardW * 0.88 * scale, available / (cardsPerRow - 1))
            : 0;

        const firstRowY = this.topH + this.centerH + this.bottomH * (useTwoRows
            ? (this.isLandscapeLayout ? 0.36 : 0.4)
            : (this.isLandscapeLayout ? 0.5 : 0.58));
        const rowGap = useTwoRows
            ? Phaser.Math.Clamp(this.bottomH * (this.isLandscapeLayout ? 0.34 : 0.31), 44, 76)
            : 0;

        cards.forEach((data, i) => {
            const row = useTwoRows && i >= cardsPerRow ? 1 : 0;
            const indexInRow = row === 0 ? i : i - cardsPerRow;
            const rowCount = useTwoRows
                ? (row === 0 ? Math.min(cardsPerRow, cardCount) : cardCount - cardsPerRow)
                : cardCount;
            const rowSpread = Math.max(0, rowCount - 1);
            const rowStartX = this.uiX + this.uiW * 0.5 - (rowSpread * spacing) * 0.5;
            const rowMid = rowSpread * 0.5;

            const x = rowStartX + indexInRow * spacing;
            const y = firstRowY
                + row * rowGap
                + Math.abs(indexInRow - rowMid) * (this.isLandscapeLayout ? 1.7 : 2.8);

            const card = new CardGameObject(this, x, y, data);
            this.add.existing(card);
            card.setScale(scale);
            card.setHome(x, y, 120 + i + row * 8);

            card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                card.setData('inspectDownX', pointer.x);
                card.setData('inspectDownY', pointer.y);
                card.setData('dragStarted', false);
            });
            card.on('dragstart', () => {
                card.setData('dragStarted', true);
                this.hideCardInspect();
            });
            card.on('pointerup', (pointer: Phaser.Input.Pointer) => {
                if (card.getData('dragStarted')) return;
                const downX = Number(card.getData('inspectDownX') ?? pointer.x);
                const downY = Number(card.getData('inspectDownY') ?? pointer.y);
                const moved = Phaser.Math.Distance.Between(downX, downY, pointer.x, pointer.y);
                if (moved > 14) return;
                this.showCardInspect(card.cardData);
            });

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
                    const code = String(message?.code ?? '');
                    if (code === 'TRICKS_LOCKED') {
                        this.floatText(this.lang === 'en' ? 'Tricks are locked this turn!' : 'I Trucchi sono bloccati questo turno!', '#ff5566');
                        this.cameras.main.shake(200, 0.005);
                    } else {
                        this.floatText(this.localizeServerError(message), '#ff8293');
                        this.cameras.main.shake(120, 0.0018);
                    }
                    this.time.delayedCall(420, resolve);
                }));
                break;

            case ServerEvents.START_REACTION_TIMER:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const duration = Number(message?.durationMs ?? message?.duration ?? 5000);
                    const label = this.lang === 'en'
                        ? this.tr('game_reaction_subtitle')
                        : String(message?.actionTypeLabel ?? this.tr('game_reaction_subtitle'));
                    this.showReactionOverlay(duration, label);
                    resolve();
                }));
                break;

            case ServerEvents.REACTION_TRIGGERED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const name = String(message?.playerName ?? this.tr('game_opponent'));
                    this.floatText(this.tr('game_reacted', { name }), '#ffd6a6', this.screenW * 0.5, this.topH + 40);
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
                        this.floatText(this.tr('game_action_resolved'), '#9ff3c2');
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
                        this.floatText(this.tr('game_action_failed'), '#ff8a97');
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
                            this.floatText(this.tr('game_card_plus'), '#8ddcff', targetX, targetY - 10);
                            resolve();
                        },
                    });
                }));
                break;

            case ServerEvents.TURN_STARTED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    this.floatText(this.tr('game_turn_number', { turn: message?.turnNumber ?? '' }), '#d8f4ff', this.screenW * 0.5, this.topH + 26);
                    this.time.delayedCall(320, resolve);
                }));
                break;

            case ServerEvents.GAME_WON: {
                const event = message as { winnerId?: string; winnerName?: string; finalScore?: number };
                this.showVictoryScreen(event);
                break;
            }
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
        }).setOrigin(0.5).setDepth(520).setResolution(this.textResolution);

        this.tweens.add({
            targets: t,
            y: ty - 52,
            alpha: 0,
            duration: 700,
            ease: 'Sine.Out',
            onComplete: () => t.destroy(),
        });
    }

    // ─────────────────────────────────────────────────────────
    //  VICTORY SCREEN
    // ─────────────────────────────────────────────────────────
    private showVictoryScreen(event: { winnerId?: string; winnerName?: string; finalScore?: number }) {
        this.visualQueue.enqueue(() => new Promise((_resolve) => {
            const winnerName = String(event.winnerName ?? 'Unknown');
            const score = Number(event.finalScore ?? 0);
            const isMe = event.winnerId === this.serverManager.room?.sessionId;
            const cx = this.screenW * 0.5;
            const cy = this.screenH * 0.5;

            // Overlay
            this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.85)
                .setDepth(600);

            // Title with scale-in
            const title = this.add.text(
                cx,
                cy - 56,
                `\ud83c\udfc6 ${this.tr('game_over')}\n${this.tr('game_wins', { winner: winnerName })}`,
                {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(this.uiW * 0.038, 28, 36)}px`,
                color: '#ffd700',
                fontStyle: '700',
                letterSpacing: 2,
                align: 'center',
                lineSpacing: 8,
            },
            ).setOrigin(0.5).setDepth(601).setResolution(this.textResolution).setScale(0);

            this.tweens.add({
                targets: title,
                scaleX: 1, scaleY: 1,
                duration: 600,
                ease: 'Back.easeOut',
            });

            // Score
            this.add.text(cx, cy + 10, this.tr('game_final_score', { score }), {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(this.uiW * 0.018, 16, 22)}px`,
                color: '#d8e8f4',
                fontStyle: '700',
            }).setOrigin(0.5).setDepth(601).setResolution(this.textResolution);

            // "Nuova Partita" button
            const btnW = Phaser.Math.Clamp(this.uiW * 0.38, 180, 280);
            const btnH = 52;
            const btnY = cy + 70;

            const btnGfx = this.add.graphics().setDepth(601);
            btnGfx.setPosition(cx, btnY);
            paintRetroButton(
                btnGfx,
                { width: btnW, height: btnH, radius: 14, borderWidth: 1.4 },
                {
                    base: 0x2a6090,
                    border: 0x8cc8ff,
                    glossAlpha: 0.16,
                },
            );

            this.add.text(cx, btnY, this.tr('game_new_match'), {
                fontFamily: FONT_UI,
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: '700',
            }).setOrigin(0.5).setDepth(602).setResolution(this.textResolution);

            const btnHit = this.add.rectangle(cx, btnY, btnW, btnH, 0x000000, 0)
                .setDepth(603).setInteractive({ useHandCursor: true });
            btnHit.on('pointerdown', () => {
                window.location.reload();
            });

            // Confetti for winner
            if (isMe && this.fxEmitter) {
                this.fxEmitter.setConfig({
                    tint: [0xffd700, 0xff6b6b, 0x4ecdc4, 0xffe66d],
                    speed: { min: 120, max: 340 },
                    scale: { start: 1.2, end: 0 },
                    lifespan: 1200,
                    quantity: 40,
                });
                this.fxEmitter.explode(60, cx, cy - 40);
                this.time.delayedCall(400, () => this.fxEmitter?.explode(40, cx - 120, cy));
                this.time.delayedCall(800, () => this.fxEmitter?.explode(40, cx + 120, cy));
            } else {
                this.burst(cx, cy - 8, 40);
            }

            // Don't resolve — game is over, UI stays frozen
        }));
    }

    // ─────────────────────────────────────────────────────────
    //  TARGET SELECTOR (for Trick cards)
    // ─────────────────────────────────────────────────────────
    private showTargetSelector(card: CardGameObject) {
        this.hideTargetSelector();

        const state = this.serverManager.room?.state as IGameState | undefined;
        const myId = this.serverManager.room?.sessionId;
        if (!state || !myId) {
            this.snapBack(card, this.tr('game_no_connection'));
            return;
        }

        const opponents: IPlayer[] = [];
        (state.players as unknown as Map<string, IPlayer>).forEach((p, sid) => {
            if (sid !== myId) opponents.push(p);
        });

        if (opponents.length === 0) {
            // No opponents — play without target
            this.serverManager.playMagic(card.cardData.id);
            this.stashPending(card);
            return;
        }

        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;

        // Overlay
        this.targetSelectorOverlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.6)
            .setDepth(550).setInteractive();
        this.targetSelectorElements.push(this.targetSelectorOverlay);

        // Title
        const title = this.add.text(cx, cy - 90, this.tr('game_choose_target'), {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f8f0e2',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0.5).setDepth(551).setResolution(this.textResolution);
        this.targetSelectorElements.push(title);

        // Opponent buttons
        const btnW = Phaser.Math.Clamp(this.uiW * 0.4, 180, 300);
        const btnH = 46;
        const gap = 12;
        const totalH = opponents.length * btnH + (opponents.length - 1) * gap;
        const startY = cy - totalH * 0.5 + btnH * 0.5 - 20;

        opponents.forEach((opp, i) => {
            const y = startY + i * (btnH + gap);

            const bg = this.add.graphics().setDepth(551);
            bg.setPosition(cx, y);
            paintRetroButton(
                bg,
                { width: btnW, height: btnH, radius: 12, borderWidth: 1.2 },
                {
                    base: 0x2a3f54,
                    border: 0xa8d4f0,
                    glossAlpha: 0.1,
                },
            );
            this.targetSelectorElements.push(bg);

            const label = this.add.text(cx, y, opp.username, {
                fontFamily: FONT_UI,
                fontSize: '15px',
                color: '#e8f4ff',
                fontStyle: '700',
            }).setOrigin(0.5).setDepth(552).setResolution(this.textResolution);
            this.targetSelectorElements.push(label);

            const hit = this.add.rectangle(cx, y, btnW, btnH, 0x000000, 0)
                .setDepth(553).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => {
                this.serverManager.playMagic(card.cardData.id, opp.sessionId);
                this.stashPending(card);
                this.hideTargetSelector();
            });
            this.targetSelectorElements.push(hit);
        });

        // Cancel button
        const cancelY = startY + opponents.length * (btnH + gap) + 10;
        const cancelBg = this.add.graphics().setDepth(551);
        cancelBg.setPosition(cx, cancelY);
        paintRetroButton(
            cancelBg,
            { width: btnW, height: btnH, radius: 12, borderWidth: 1.2 },
            {
                base: 0x5a3030,
                border: 0xffaabb,
                glossAlpha: 0.08,
            },
        );
        this.targetSelectorElements.push(cancelBg);

        const cancelLabel = this.add.text(cx, cancelY, this.tr('game_cancel'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#ffccdd',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(552).setResolution(this.textResolution);
        this.targetSelectorElements.push(cancelLabel);

        const cancelHit = this.add.rectangle(cx, cancelY, btnW, btnH, 0x000000, 0)
            .setDepth(553).setInteractive({ useHandCursor: true });
        cancelHit.on('pointerdown', () => {
            this.snapBack(card, this.tr('game_cancelled'));
            this.hideTargetSelector();
        });
        this.targetSelectorElements.push(cancelHit);
    }

    private hideTargetSelector() {
        this.targetSelectorElements.forEach((el) => el.destroy());
        this.targetSelectorElements = [];
        this.targetSelectorOverlay = undefined;
    }
}
