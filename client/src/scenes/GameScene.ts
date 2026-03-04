import Phaser from 'phaser';
import { CardGameObject } from '../gameobjects/CardGameObject';
import { ServerManager } from '../network/ServerManager';
import { VisualEventQueue } from '../systems/VisualEventQueue';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { requestCardArtwork, resolveCardArtworkTexture } from '../ui/CardArtworkResolver';
import { fitTextToBox } from '../ui/text/FitText';
import { buildInspectPresentation } from '../ui/cards/CardPresentationModel';
import {
    ActionBlockReasonKey,
    MatchActionState,
    evaluateMatchActionState,
    evaluateSingleMonsterAttack,
} from '../ui/match/MatchActionState';
import {
    acceptPendingCard,
    createPendingPlayState,
    reconcilePendingWithHand,
    rollbackPendingCard as rollbackPendingModel,
    stashPendingCard,
} from '../systems/PendingPlayModel';
import { computeMatchLayout, drawMatchLayoutDebug, LayoutRect, MatchLayout } from '../ui/layout/MatchLayout';
import {
    CardType,
    GamePhase,
    ICardData,
    IDiceRolledEvent,
    IGameState,
    IPlayer,
    MIN_PLAYERS_TO_START,
    ServerEvents,
} from '../../../shared/SharedTypes';

const FONT_UI = APP_FONT_FAMILY;

type CrisisView = {
    crisis: ICardData;
    zone: Phaser.GameObjects.Zone;
    card: CardGameObject;
    meta?: Phaser.GameObjects.Text;
    actionBg?: Phaser.GameObjects.Graphics;
    actionHit?: Phaser.GameObjects.Rectangle;
    actionLabel?: Phaser.GameObjects.Text;
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
    private matchLayout!: MatchLayout;
    private handCardsRect: LayoutRect = { x: 0, y: 0, w: 0, h: 0 };

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
    private hudPanel!: Phaser.GameObjects.Graphics;
    private hudTurnText!: Phaser.GameObjects.Text;
    private hudStatsText!: Phaser.GameObjects.Text;
    private hudStateText!: Phaser.GameObjects.Text;
    private hudReactionText!: Phaser.GameObjects.Text;

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

    private gameLogPanel!: Phaser.GameObjects.Graphics;
    private gameLogTitle!: Phaser.GameObjects.Text;
    private gameLogBody!: Phaser.GameObjects.Text;
    private gameLogToggleBg!: Phaser.GameObjects.Graphics;
    private gameLogToggleLabel!: Phaser.GameObjects.Text;
    private gameLogToggleHit!: Phaser.GameObjects.Rectangle;
    private gameLogExpanded = false;
    private gameLogEntries: string[] = [];
    private gameLogLimit = 28;

    private handTitle!: Phaser.GameObjects.Text;
    private paLabel!: Phaser.GameObjects.Text;
    private actionPanel!: Phaser.GameObjects.Graphics;
    private actionPanelTitle!: Phaser.GameObjects.Text;
    private actionPanelHint!: Phaser.GameObjects.Text;
    private actionPanelDetail!: Phaser.GameObjects.Text;
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
    private cardInspectArtwork!: Phaser.GameObjects.Graphics;
    private cardInspectArtworkImage!: Phaser.GameObjects.Image;
    private cardInspectCloseBtn!: Phaser.GameObjects.Graphics;
    private cardInspectCloseHit!: Phaser.GameObjects.Rectangle;
    private cardInspectCloseLabel!: Phaser.GameObjects.Text;
    private cardInspectTitle!: Phaser.GameObjects.Text;
    private cardInspectType!: Phaser.GameObjects.Text;
    private cardInspectBody!: Phaser.GameObjects.Text;
    private cardInspectHint!: Phaser.GameObjects.Text;
    private cardInspectVisible = false;
    private inspectedCard?: ICardData;
    private diceToastPanel!: Phaser.GameObjects.Graphics;
    private diceToastText!: Phaser.GameObjects.Text;
    private diceToastVisible = false;
    private diceToastTween?: Phaser.Tweens.Tween;

    private fxEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private ambientEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

    private opponentViews: Phaser.GameObjects.Container[] = [];
    private crisisViews: CrisisView[] = [];
    private companyCards: CardGameObject[] = [];
    private handCards: CardGameObject[] = [];
    private liveCardObjects = new Set<CardGameObject>();

    private pendingPlayedCard?: CardGameObject;
    private pendingPlayState = createPendingPlayState();
    private myTurnTween?: Phaser.Tweens.Tween;
    private deckButtonFx?: SimpleButtonController;
    private endButtonFx?: SimpleButtonController;
    private readyButtonFx?: SimpleButtonController;
    private gameLogToggleFx?: SimpleButtonController;
    private previousAP = -1;
    private redirectingToPreLobby = false;
    private estimatedDeckBase = 0;
    private readonly debugLayoutMode = (
        window.location.search.includes('uiDebug=1')
        || localStorage.getItem('lucrare_ui_debug') === '1'
    );
    private layoutDebugGfx?: Phaser.GameObjects.Graphics;

    // Target Selector state
    private targetSelectorOverlay?: Phaser.GameObjects.Rectangle;
    private targetSelectorElements: Phaser.GameObjects.GameObject[] = [];
    private targetSelectorFx: SimpleButtonController[] = [];

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { serverManager: ServerManager; lang?: SupportedLanguage; roomCode?: string; isHost?: boolean }) {
        this.serverManager = data?.serverManager;
        this.lang = sanitizeLanguage(data?.lang ?? localStorage.getItem('lucrare_lang'));
        this.roomCode = String(data?.roomCode ?? '');
        this.visualQueue = new VisualEventQueue();
        this.redirectingToPreLobby = false;
        this.liveCardObjects.clear();
        this.pendingPlayState = createPendingPlayState();
        this.pendingPlayedCard = undefined;

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
            this.hideTargetSelector();
            this.hideDiceToast();
            this.deckButtonFx?.destroy();
            this.endButtonFx?.destroy();
            this.readyButtonFx?.destroy();
            this.gameLogToggleFx?.destroy();
            this.liveCardObjects.clear();
        });

        this.handleResize(this.scale.gameSize);
        this.appendGameLog(this.tr('game_log_match_ready'));

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

    private isPreLobbyPhase(phase?: GamePhase) {
        return phase === GamePhase.PRE_LOBBY || phase === GamePhase.WAITING_FOR_PLAYERS;
    }

    private isHeroCard(card: ICardData) {
        const type = String(card.type ?? '').toLowerCase();
        return type === 'hero' || type === 'employee';
    }

    private isReactionCard(card: ICardData) {
        const subtype = String(card.subtype ?? '').toLowerCase();
        const type = String(card.type ?? '').toLowerCase();
        return subtype === 'reaction'
            || subtype === 'modifier'
            || type === 'challenge'
            || type === 'reaction'
            || type === 'modifier';
    }

    private isItemCard(card: ICardData) {
        const type = String(card.type ?? '').toLowerCase();
        return type === 'item' || type === 'oggetto';
    }

    private isEventCard(card: ICardData) {
        const type = String(card.type ?? '').toLowerCase();
        return type === 'magic'
            || type === 'event'
            || type === 'trick'
            || type === 'item'
            || type === 'oggetto';
    }

    private isCompactLandscapeLayout() {
        return this.isLandscapeLayout && this.screenH < 520;
    }

    private compactName(value: string, maxLen = 8) {
        const clean = String(value ?? '').trim();
        if (clean.length <= maxLen) return clean;
        return `${clean.slice(0, Math.max(1, maxLen - 1))}.`;
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
        this.actionPanelTitle.setText(this.tr('game_action_panel_title'));
        this.actionPanelHint.setText(this.tr('game_action_panel_waiting'));
        this.actionPanelDetail.setText('');
        this.gameLogTitle.setText(this.tr('game_log_title'));
        this.gameLogToggleLabel.setText(this.gameLogExpanded ? this.tr('game_log_less') : this.tr('game_log_more'));
        this.reactionTitle.setText(this.tr('game_reaction_title'));
        this.reactionSubtitle.setText(this.tr('game_reaction_subtitle'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));
    }

    private localizeServerError(message: any): string {
        const code = String(message?.code ?? '');
        const codeToKey: Record<string, string> = {
            GAME_ALREADY_STARTED: 'game_error_game_already_started',
            HOST_ONLY: 'game_error_host_only',
            NOT_ENOUGH_PLAYERS: 'game_error_not_enough_players',
            PLAYERS_NOT_READY: 'game_error_players_not_ready',
            NOT_ENOUGH_READY: 'game_error_not_enough_ready',
            DECK_INIT_FAILED: 'game_error_deck_init_failed',
            DECK_EMPTY_INIT: 'game_error_deck_empty_init',
            NOT_YOUR_TURN: 'game_error_not_your_turn',
            WRONG_PHASE: 'game_error_wrong_phase',
            DECK_EMPTY: 'game_error_deck_empty',
            MISSING_CARD_ID: 'game_error_missing_card_id',
            CARD_NOT_IN_HAND: 'game_error_card_not_in_hand',
            NOT_HERO_CARD: 'game_error_not_hero_card',
            MISSING_CRISIS_ID: 'game_error_missing_crisis_id',
            CRISIS_NOT_FOUND: 'game_error_crisis_not_found',
            TRICKS_LOCKED: 'game_error_tricks_locked',
            USE_PLAY_EMPLOYEE: 'game_error_use_play_employee',
            INVALID_CARD_TYPE: 'game_error_invalid_card_type',
            REACTION_ONLY_WINDOW: 'game_error_reaction_only_window',
            MISSING_TARGET: 'game_error_missing_target',
            SELF_TARGET: 'game_error_self_target',
            INVALID_TARGET: 'game_error_invalid_target',
            NO_REACTION_WINDOW: 'game_error_no_reaction_window',
            SELF_REACTION: 'game_error_self_reaction',
            NOT_REACTION_CARD: 'game_error_not_reaction_card',
            NO_HERO_FOR_ITEM: 'game_error_no_hero_for_item',
            INVALID_HERO_TARGET: 'game_error_invalid_hero_target',
            MISSING_HERO_TARGET: 'game_error_missing_hero_target',
            GAME_OVER: 'game_error_game_over',
            NO_PA: 'game_error_no_pa',
        };

        const key = codeToKey[code];
        if (key) return this.tr(key);
        return String(message?.message ?? this.tr('game_action_denied'));
    }

    private localizeActionBlockReason(reasonKey?: ActionBlockReasonKey): string {
        if (!reasonKey) return this.tr('game_action_denied');
        return this.tr(reasonKey);
    }

    private tryDrawCard() {
        const room = this.serverManager?.room;
        if (!room) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }
        const state = room.state as IGameState;
        const me = (state.players as unknown as Map<string, IPlayer>).get(room.sessionId);
        if (!state || !me) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }

        const action = evaluateMatchActionState({ state, me, myId: room.sessionId });
        if (!action.canDraw) {
            const reason = this.localizeActionBlockReason(action.drawReasonKey);
            this.floatText(this.tr('game_draw_blocked', { reason }), '#ff9aa7');
            this.appendGameLog(this.tr('game_draw_blocked_log', { reason }));
            return;
        }

        this.serverManager.drawCard();
        this.floatText(this.tr('game_draw_sent', { cost: action.drawCost }), '#9edcff', this.deckHit.x, this.deckHit.y - 42);
    }

    private tryEndTurn() {
        const room = this.serverManager?.room;
        if (!room) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }
        const state = room.state as IGameState;
        const me = (state.players as unknown as Map<string, IPlayer>).get(room.sessionId);
        if (!state || !me) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }

        const action = evaluateMatchActionState({ state, me, myId: room.sessionId });
        if (!action.canEndTurn) {
            const reason = this.localizeActionBlockReason(action.endReasonKey);
            this.floatText(this.tr('game_end_turn_blocked', { reason }), '#ff9aa7');
            return;
        }

        this.serverManager.endTurn();
    }

    private tryAttackCrisis(crisis: ICardData) {
        const room = this.serverManager?.room;
        if (!room) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }
        const state = room.state as IGameState;
        const me = (state.players as unknown as Map<string, IPlayer>).get(room.sessionId);
        if (!state || !me) {
            this.floatText(this.tr('game_no_connection'), '#ff9aa7');
            return;
        }

        const attack = evaluateSingleMonsterAttack({ state, me, myId: room.sessionId }, crisis);
        if (!attack.canAttack) {
            const reason = this.localizeActionBlockReason(attack.reasonKey);
            this.floatText(this.tr('game_attack_blocked', { reason }), '#ff9aa7');
            this.showCardInspect(crisis);
            return;
        }

        this.serverManager.solveCrisis('', String(crisis.id));
        this.floatText(this.tr('game_attack_sent', { cost: attack.cost }), '#9ff3c2');
        this.appendGameLog(this.tr('game_attack_sent_log', { name: String(crisis.name ?? this.tr('game_card_unknown')) }));
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

        this.hudPanel = this.add.graphics().setDepth(24);
        this.hudTurnText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#f2f8ff',
            fontStyle: '700',
            letterSpacing: 0.6,
        }).setOrigin(0, 0.5).setDepth(25);
        this.hudStatsText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#cde4f8',
            fontStyle: '700',
            align: 'left',
        }).setOrigin(0, 0.5).setDepth(25);
        this.hudStateText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#d7e7f5',
            fontStyle: '700',
            align: 'left',
        }).setOrigin(0, 0.5).setDepth(25);
        this.hudReactionText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#ffe6b5',
            fontStyle: '700',
            align: 'right',
        }).setOrigin(1, 0.5).setDepth(25);

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
            fontSize: '28px',
            color: '#f4f8ff',
            letterSpacing: 1.5,
        }).setOrigin(0.5).setVisible(false);

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

        this.gameLogPanel = this.add.graphics().setDepth(260);
        this.gameLogTitle = this.add.text(0, 0, this.tr('game_log_title'), {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#fff0d0',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0, 0.5).setDepth(261);
        this.gameLogBody = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#dceeff',
            fontStyle: '600',
            lineSpacing: 3,
            wordWrap: { width: 300 },
        }).setOrigin(0, 0).setDepth(261);
        this.gameLogToggleBg = this.add.graphics().setDepth(261);
        this.gameLogToggleLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#f4f8ff',
            fontStyle: '700',
            letterSpacing: 0.5,
        }).setOrigin(0.5).setDepth(262);
        this.gameLogToggleHit = this.add.rectangle(0, 0, 66, 26, 0x000000, 0)
            .setDepth(262)
            .setInteractive({ useHandCursor: true });

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

        this.actionPanel = this.add.graphics().setDepth(18);
        this.actionPanelTitle = this.add.text(0, 0, this.tr('game_action_panel_title'), {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#f7e3ba',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0, 0.5).setDepth(19);
        this.actionPanelHint = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#dceeff',
            fontStyle: '700',
            lineSpacing: 2,
            wordWrap: { width: 280 },
        }).setOrigin(0, 0).setDepth(19);
        this.actionPanelDetail = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#bcd1e7',
            fontStyle: '600',
            lineSpacing: 2,
            wordWrap: { width: 280 },
        }).setOrigin(0, 0).setDepth(19);

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
            this.hudTurnText,
            this.hudStatsText,
            this.hudStateText,
            this.hudReactionText,
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
            this.gameLogTitle,
            this.gameLogBody,
            this.gameLogToggleLabel,
            this.handTitle,
            this.paLabel,
            this.actionPanelTitle,
            this.actionPanelHint,
            this.actionPanelDetail,
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
        this.cardInspectArtwork = this.add.graphics().setDepth(541).setVisible(false);
        this.cardInspectArtworkImage = this.add.image(
            0,
            0,
            this.textures.exists('ui-deck') ? 'ui-deck' : 'poke-dither',
        ).setDepth(542).setVisible(false);
        this.cardInspectCloseBtn = this.add.graphics().setDepth(543).setVisible(false);
        this.cardInspectCloseHit = this.add.rectangle(0, 0, 44, 44, 0x000000, 0)
            .setDepth(544)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.cardInspectCloseHit.on('pointerdown', () => this.hideCardInspect());
        this.cardInspectCloseLabel = this.add.text(0, 0, 'X', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(545).setVisible(false);
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

        this.diceToastPanel = this.add.graphics().setDepth(546).setVisible(false);
        this.diceToastText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#e9f6ff',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: 320 },
            lineSpacing: 3,
        }).setOrigin(0.5).setDepth(547).setVisible(false);

        this.boostText(
            this.reactionTitle,
            this.reactionSubtitle,
            this.cardInspectTitle,
            this.cardInspectType,
            this.cardInspectBody,
            this.cardInspectHint,
            this.cardInspectCloseLabel,
            this.diceToastText,
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

        // Background remains cloud-driven only; no ambient floating dots.
        this.ambientEmitter = undefined;
    }

    private wireButtons() {
        this.deckButtonFx = createSimpleButtonFx(
            this,
            this.deckHit,
            [this.deckButton, this.deckLabel, this.deckCountText],
            { onClick: () => this.tryDrawCard() },
        );

        this.endButtonFx = createSimpleButtonFx(
            this,
            this.endHit,
            [this.endButton, this.endButtonText],
            { onClick: () => this.tryEndTurn() },
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
                    if (!this.isPreLobbyPhase(state.phase)) return;

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

        this.gameLogToggleFx = createSimpleButtonFx(
            this,
            this.gameLogToggleHit,
            [this.gameLogToggleBg, this.gameLogToggleLabel],
            {
                onClick: () => {
                    this.gameLogExpanded = !this.gameLogExpanded;
                    this.layoutPanels();
                    const state = this.serverManager?.room?.state as IGameState | undefined;
                    const me = state && this.serverManager?.room
                        ? (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId)
                        : undefined;
                    if (state && me) this.applyState(state, me);
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
                if (this.isReactionCard(card.cardData) && canReact) {
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
                if (this.isHeroCard(card.cardData)) {
                    this.serverManager.playEmployee(card.cardData.id);
                    this.stashPending(card);
                    return;
                }
                if (this.isEventCard(card.cardData)) {
                    this.showTargetSelector(card);
                    return;
                }
                this.snapBack(card, this.tr('game_drop_invalid_target'));
                return;
            }

            if (zoneType === 'crisis') {
                this.snapBack(card, this.tr('game_attack_use_button'));
                return;
            }

            this.snapBack(card, this.tr('game_invalid_drop_area'));
        });
    }

    private handleResize(size: Phaser.Structs.Size) {
        this.screenW = size.width;
        this.screenH = size.height;

        this.matchLayout = computeMatchLayout(this.screenW, this.screenH);
        this.isLandscapeLayout = this.matchLayout.isLandscape;
        this.uiW = this.matchLayout.content.w;
        this.uiX = this.matchLayout.content.x;
        this.topH = this.matchLayout.topBar.h;
        this.centerH = this.matchLayout.board.h;
        this.bottomH = this.matchLayout.hand.h;
        this.handCardsRect = this.matchLayout.handCards;

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

        const compactLandscape = this.isCompactLandscapeLayout();
        const compactPortrait = !this.isLandscapeLayout && this.uiW < 470;

        this.showPlayersIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 860 : 520);
        this.showDeckIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 760 : 500);
        this.showApIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 700 : 420);
        this.showStartIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 1120 : 560);

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

        const topInfoY = compactLandscape
            ? topY + Phaser.Math.Clamp(this.topH * 0.2, 14, 24)
            : topY + Phaser.Math.Clamp(this.topH * 0.16, 18, 30);
        const opponentRowY = compactLandscape
            ? topY + Phaser.Math.Clamp(this.topH * 0.48, 34, this.topH - 44)
            : topY + Phaser.Math.Clamp(this.topH * 0.43, 46, this.topH - 58);

        const logDockWidth = this.gameLogExpanded ? 0 : (this.matchLayout?.log?.w ?? 0) + 18;
        const topTitleWrap = Phaser.Math.Clamp(
            this.uiW - (this.showPlayersIcon ? 84 : 50) - logDockWidth,
            120,
            this.uiW * (compactLandscape ? 0.56 : 0.7),
        );

        this.topTitle
            .setPosition(this.uiX + (this.showPlayersIcon ? 54 : 18), topInfoY)
            .setWordWrapWidth(topTitleWrap, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, compactLandscape ? 11 : 12, compactLandscape ? 17 : 19)}px`);
        this.roomCodeText
            .setPosition(this.uiX + 18, opponentRowY)
            .setOrigin(0, 0.5)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0115, compactLandscape ? 10 : 11, 14)}px`);
        if (this.showPlayersIcon) {
            this.playersIcon.setPosition(this.uiX + 30, opponentRowY).setDisplaySize(26, 26);
        }
        this.opponentsPlaceholder
            .setPosition(this.uiX + this.uiW * 0.5, opponentRowY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0118, 11, 16)}px`);
        this.layoutHud(topY, compactLandscape);

        const centerTop = centerY + (this.isLandscapeLayout ? (compactLandscape ? 8 : 12) : 14);
        const centerTitleY = centerTop + 2;
        const crisisTitleY = centerTop + Phaser.Math.Clamp(this.centerH * (compactLandscape ? 0.18 : 0.3), compactLandscape ? 28 : 52, 98);

        this.centerTitle
            .setPosition(this.uiX + this.uiW * 0.5, centerTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 17)}px`);
        this.centerTitle.setVisible(!compactPortrait && !compactLandscape);
        this.turnText.setVisible(false);

        this.centerDropW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.uiW * (compactLandscape ? 0.56 : 0.5), 280, 620)
            : Phaser.Math.Clamp(this.uiW * 0.86, 280, 580);
        this.centerDropH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerH * (compactLandscape ? 0.46 : 0.36), 98, compactLandscape ? 198 : 176)
            : Phaser.Math.Clamp(this.centerH * 0.42, 124, 230);
        this.centerDropX = this.uiX + this.uiW * 0.5;
        this.centerDropY = centerY + this.centerH * (this.isLandscapeLayout ? (compactLandscape ? 0.55 : 0.58) : 0.56);

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
            .setPosition(this.uiX + this.uiW * 0.5, centerY + this.centerH - Phaser.Math.Clamp(this.centerH * (compactLandscape ? 0.1 : 0.13), 20, 34))
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);
        this.crisisTitle.setVisible((!compactPortrait || this.centerH > 250) && !compactLandscape);
        this.companyTitle.setVisible((!compactPortrait || this.centerH > 250) && !compactLandscape);

        const controls = this.matchLayout.controls;
        const controlsY = controls.y + controls.h * 0.5;
        const deckW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(controls.h * (compactLandscape ? 0.68 : 0.78), 52, 72)
            : Phaser.Math.Clamp(controls.h * 0.72, 66, 86);
        const deckH = deckW * 1.32;
        const deckX = controls.x + controls.w - deckW * 0.5 - 10;

        this.deckHit.setSize(Math.max(48, deckW), Math.max(62, deckH)).setPosition(deckX, controlsY);
        this.deckButton.setPosition(deckX, controlsY);
        this.deckLabel
            .setPosition(deckX, controlsY - deckH * 0.37)
            .setFontSize(`${Phaser.Math.Clamp(deckW * 0.18, 10, 13)}px`);
        this.deckCountText
            .setPosition(deckX, controlsY + deckH * 0.27)
            .setFontSize(`${Phaser.Math.Clamp(deckW * 0.33, 18, 24)}px`);
        if (this.showDeckIcon) {
            const iconSize = deckW * 0.34;
            this.deckIcon
                .setPosition(deckX, controlsY - deckH * 0.11)
                .setDisplaySize(iconSize, iconSize);
        }

        const endW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(deckW * (compactLandscape ? 1.64 : 1.78), 96, 132)
            : Phaser.Math.Clamp(deckW * 1.85, 122, 154);
        const endH = Phaser.Math.Clamp(deckH * 0.44, 46, 56);
        const endX = deckX - (deckW * 0.5 + endW * 0.5 + 12);
        this.endHit.setSize(Math.max(48, endW), Math.max(46, endH)).setPosition(endX, controlsY);
        this.endButton.setPosition(endX, controlsY);
        this.endButtonText
            .setPosition(endX, controlsY)
            .setFontSize(`${Phaser.Math.Clamp(endW * 0.12, 12, 15)}px`);

        const lobbyW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.uiW * 0.62, 380, 760)
            : Phaser.Math.Clamp(this.uiW * 0.9, 300, 560);
        const lobbyH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(this.centerH * (compactLandscape ? 1 : 0.95), compactLandscape ? 160 : 170, 330)
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

        const handTitleY = controls.y + Phaser.Math.Clamp(controls.h * 0.2, 12, 18);
        const apY = controls.y + Phaser.Math.Clamp(controls.h * 0.43, 24, 34);
        this.handTitle
            .setPosition(controls.x + 14, handTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.012, 12, 16)}px`);
        this.paLabel
            .setPosition(controls.x + (this.showApIcon ? 42 : 14), apY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0105, 11, 14)}px`);
        if (this.showApIcon) {
            this.apIcon.setPosition(controls.x + 20, apY + 2).setDisplaySize(18, 18);
        }
        const orbStart = controls.x + (this.showApIcon ? 106 : 44);
        const orbGap = Phaser.Math.Clamp(this.uiW * 0.018, 22, 28);
        this.paOrbs.forEach((orb, index) => orb.setPosition(orbStart + index * orbGap, apY + 2));

        const actionLeft = controls.x + 10;
        const actionRight = endX - endW * 0.5 - 12;
        const actionAvailable = Math.max(120, actionRight - actionLeft);
        const actionW = Phaser.Math.Clamp(actionAvailable, 120, this.isLandscapeLayout ? 540 : 420);
        const actionH = Math.max(46, controls.h - 10);
        const actionY = controls.y + 5;
        this.actionPanel.clear();
        this.actionPanel.fillStyle(0x1a2736, 0.92);
        this.actionPanel.fillRoundedRect(actionLeft, actionY, actionW, actionH, 10);
        this.actionPanel.lineStyle(1, 0x89a8c7, 0.72);
        this.actionPanel.strokeRoundedRect(actionLeft, actionY, actionW, actionH, 10);

        this.actionPanelTitle
            .setPosition(actionLeft + 10, actionY + 10)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, 10, 12)}px`);
        this.actionPanelHint
            .setPosition(actionLeft + 10, actionY + 20)
            .setWordWrapWidth(Math.max(80, actionW - 20), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, 10, 13)}px`);
        this.actionPanelDetail
            .setPosition(actionLeft + 10, actionY + actionH * 0.56)
            .setWordWrapWidth(Math.max(80, actionW - 20), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0088, 9, 12)}px`);

        this.handCardsRect = {
            ...this.matchLayout.handCards,
        };

        this.layoutGameLog();
        this.layoutDebugOverlay();

        this.drawDeckButton(false);
        this.drawEndButton(false);
        this.drawReadyButton(false);
    }

    private layoutHud(topY: number, compactLandscape: boolean) {
        const hudW = this.uiW - 24;
        const hudH = Phaser.Math.Clamp(this.topH * (compactLandscape ? 0.36 : 0.34), 30, 54);
        const hudX = this.uiX + 12;
        const hudY = topY + this.topH - hudH - 8;

        this.hudPanel.clear();
        this.hudPanel.fillStyle(0x1a2838, 0.9);
        this.hudPanel.fillRoundedRect(hudX, hudY, hudW, hudH, 10);
        this.hudPanel.lineStyle(1, 0x7da0bf, 0.75);
        this.hudPanel.strokeRoundedRect(hudX, hudY, hudW, hudH, 10);

        const padX = Phaser.Math.Clamp(this.uiW * 0.012, 10, 18);
        const leftX = hudX + padX;
        const rightX = hudX + hudW - padX;
        const line1Y = hudY + hudH * 0.37;
        const line2Y = hudY + hudH * 0.74;

        this.hudTurnText
            .setPosition(leftX, line1Y)
            .setWordWrapWidth(hudW * 0.48, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0108, 10, 14)}px`);
        fitTextToBox(this.hudTurnText, this.hudTurnText.text, hudW * 0.48, hudH * 0.42, {
            maxLines: 2,
            ellipsis: true,
        });
        this.hudReactionText
            .setPosition(rightX, line1Y)
            .setWordWrapWidth(hudW * 0.44, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.01, 9, 13)}px`);
        fitTextToBox(this.hudReactionText, this.hudReactionText.text, hudW * 0.44, hudH * 0.42, {
            maxLines: 2,
            ellipsis: true,
        });
        this.hudStatsText
            .setPosition(leftX, line2Y)
            .setWordWrapWidth(hudW * 0.7, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, 9, 13)}px`);
        fitTextToBox(this.hudStatsText, this.hudStatsText.text, hudW * 0.7, hudH * 0.42, {
            maxLines: 2,
            ellipsis: true,
        });
        this.hudStateText
            .setPosition(rightX, line2Y)
            .setOrigin(1, 0.5)
            .setWordWrapWidth(hudW * 0.3, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0094, 9, 12)}px`);
        fitTextToBox(this.hudStateText, this.hudStateText.text, hudW * 0.3, hudH * 0.42, {
            maxLines: 2,
            ellipsis: true,
        });
    }

    private layoutGameLog() {
        const log = this.matchLayout?.log;
        if (!log) return;

        const content = this.matchLayout.content;

        const pad = 8;
        const compactPortrait = !this.isLandscapeLayout && this.uiW < 470;
        const collapsedW = Phaser.Math.Clamp(log.w, 180, this.isLandscapeLayout ? 360 : 500);
        const collapsedH = Phaser.Math.Clamp(log.h, 34, 52);
        const expandedW = Phaser.Math.Clamp(content.w * (this.isLandscapeLayout ? 0.56 : 0.9), 280, 760);
        const expandedH = Phaser.Math.Clamp(this.matchLayout.board.h * (this.isLandscapeLayout ? 0.72 : 0.56), 180, 360);
        const logH = this.gameLogExpanded ? expandedH : collapsedH;
        const x = this.gameLogExpanded
            ? content.x + (content.w - expandedW) * 0.5
            : log.x + Math.max(0, log.w - collapsedW);
        const y = this.gameLogExpanded
            ? this.matchLayout.board.y + Math.max(8, this.matchLayout.board.h * 0.08)
            : log.y;
        const w = this.gameLogExpanded ? expandedW : collapsedW;
        const headerH = this.gameLogExpanded ? 28 : collapsedH;

        this.gameLogPanel.clear();
        this.gameLogPanel.fillStyle(0x162435, this.gameLogExpanded ? 0.96 : 0.92);
        this.gameLogPanel.fillRoundedRect(x, y, w, logH, 10);
        this.gameLogPanel.lineStyle(1, 0x7ea3c8, this.gameLogExpanded ? 0.9 : 0.75);
        this.gameLogPanel.strokeRoundedRect(x, y, w, logH, 10);

        this.gameLogTitle
            .setPosition(x + pad, y + headerH * 0.52)
            .setWordWrapWidth(this.gameLogExpanded ? w * 0.54 : w * 0.42, true)
            .setFontSize(this.gameLogExpanded
                ? `${Phaser.Math.Clamp(this.uiW * 0.0105, 10, 14)}px`
                : `${Phaser.Math.Clamp(this.uiW * 0.0096, 9, 12)}px`);
        this.gameLogTitle.setText(this.tr('game_log_title'));

        const toggleW = Phaser.Math.Clamp(w * (this.gameLogExpanded ? 0.18 : 0.24), 68, 100);
        const toggleH = this.gameLogExpanded ? 18 : 20;
        const toggleX = x + w - toggleW - pad;
        const toggleY = y + (this.gameLogExpanded ? 6 : (logH - toggleH) * 0.5);
        this.gameLogToggleBg.clear();
        this.gameLogToggleBg.fillStyle(0x315173, 0.92);
        this.gameLogToggleBg.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, 7);
        this.gameLogToggleBg.lineStyle(1, 0xbfd9f2, 0.86);
        this.gameLogToggleBg.strokeRoundedRect(toggleX, toggleY, toggleW, toggleH, 7);
        this.gameLogToggleHit
            .setPosition(toggleX + toggleW * 0.5, toggleY + toggleH * 0.5)
            .setSize(toggleW + 12, 44);
        this.gameLogToggleLabel
            .setPosition(toggleX + toggleW * 0.5, toggleY + toggleH * 0.5)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0088, 9, 11)}px`)
            .setText(this.gameLogExpanded ? this.tr('game_log_less') : this.tr('game_log_more'));

        const bodyY = this.gameLogExpanded ? y + headerH + 2 : y + logH * 0.5;
        const maxBodyH = Math.max(0, logH - headerH - pad);
        const maxLines = this.gameLogExpanded
            ? Math.max(2, Math.floor(maxBodyH / 15))
            : 1;
        const rendered = this.gameLogEntries.slice(-maxLines).join('\n');

        this.gameLogBody
            .setPosition(x + pad, bodyY)
            .setOrigin(0, this.gameLogExpanded ? 0 : 0.5)
            .setWordWrapWidth(this.gameLogExpanded ? (w - (pad * 2)) : Math.max(80, w - (pad * 2) - toggleW - 8), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0096, 9, 12)}px`)
            .setVisible(this.gameLogExpanded ? maxBodyH > 10 : !compactPortrait || rendered.length > 0)
            .setText(rendered.length > 0 ? rendered : this.tr('game_log_empty'));

        if (!this.gameLogExpanded) {
            this.gameLogBody.setText((this.gameLogEntries[this.gameLogEntries.length - 1] ?? this.tr('game_log_empty')).replace(/\n/g, ' '));
        }
    }

    private layoutDebugOverlay() {
        if (!this.debugLayoutMode) {
            if (this.layoutDebugGfx) this.layoutDebugGfx.setVisible(false);
            return;
        }
        if (!this.layoutDebugGfx) {
            this.layoutDebugGfx = this.add.graphics().setDepth(700);
        }
        const textBounds: LayoutRect[] = [
            this.toLayoutRect(this.hudTurnText.getBounds()),
            this.toLayoutRect(this.hudStatsText.getBounds()),
            this.toLayoutRect(this.hudStateText.getBounds()),
            this.toLayoutRect(this.hudReactionText.getBounds()),
            this.toLayoutRect(this.gameLogBody.getBounds()),
            this.toLayoutRect(this.actionPanelHint.getBounds()),
            this.toLayoutRect(this.actionPanelDetail.getBounds()),
            this.toLayoutRect(this.deckHit.getBounds()),
            this.toLayoutRect(this.endHit.getBounds()),
            this.toLayoutRect(this.gameLogToggleHit.getBounds()),
            ...this.crisisViews
                .map((view) => view.actionHit)
                .filter((hit): hit is Phaser.GameObjects.Rectangle => Boolean(hit))
                .map((hit) => this.toLayoutRect(hit.getBounds())),
        ];
        drawMatchLayoutDebug(this.layoutDebugGfx, this.matchLayout, textBounds);
        this.layoutDebugGfx.setVisible(true);
    }

    private toLayoutRect(bounds: Phaser.Geom.Rectangle): LayoutRect {
        return {
            x: bounds.x,
            y: bounds.y,
            w: bounds.width,
            h: bounds.height,
        };
    }

    private layoutOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;

        this.reactionOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);
        this.reactionTitle.setPosition(cx, cy - 34).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.035, 30, 54)}px`);
        this.reactionSubtitle.setPosition(cx, cy + 6).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.013, 13, 18)}px`);
        this.redrawReactionBar();
        this.layoutCardInspectOverlay();
        this.layoutDiceToast();
    }

    private layoutCardInspectOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;
        const panelW = Phaser.Math.Clamp(this.screenW * (this.isLandscapeLayout ? 0.74 : 0.96), 320, 900);
        const panelH = Phaser.Math.Clamp(this.screenH * (this.isLandscapeLayout ? 0.84 : 0.9), 320, 780);
        const panelX = cx - panelW * 0.5;
        const panelY = cy - panelH * 0.5;

        this.cardInspectOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);

        const typeValue = String(this.inspectedCard?.type ?? '').toLowerCase();
        const accent = typeValue === CardType.MONSTER
            ? 0x3f85c4
            : typeValue === CardType.ITEM
                ? 0x627065
                : typeValue === CardType.HERO || typeValue === CardType.EMPLOYEE
                    ? 0x2e7a4e
                    : typeValue === CardType.CHALLENGE
                        ? 0x6a4cb0
                        : typeValue === CardType.MODIFIER
                            ? 0x4d9f8d
                            : 0x4c6a9a;

        this.cardInspectPanel.clear();
        this.cardInspectPanel.fillStyle(0xefece4, 0.98);
        this.cardInspectPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
        this.cardInspectPanel.fillStyle(0xffffff, 0.55);
        this.cardInspectPanel.fillRoundedRect(panelX + 3, panelY + 3, panelW - 6, panelH * 0.17, { tl: 17, tr: 17, bl: 0, br: 0 });
        this.cardInspectPanel.fillStyle(accent, 0.12);
        this.cardInspectPanel.fillRoundedRect(panelX + 8, panelY + 8, panelW - 16, 7, 4);
        this.cardInspectPanel.lineStyle(2, accent, 0.95);
        this.cardInspectPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
        this.cardInspectPanel.lineStyle(1, 0x6e655c, 0.24);
        this.cardInspectPanel.strokeRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 16);

        const artX = panelX + 18;
        const artY = panelY + panelH * 0.18;
        const artW = panelW - 36;
        const artH = panelH * (this.isLandscapeLayout ? 0.3 : 0.34);
        const artTint = typeValue === CardType.MONSTER ? 0x375273
            : typeValue === CardType.ITEM ? 0x5b625c
                : typeValue === CardType.HERO || typeValue === CardType.EMPLOYEE ? 0x365a47
                    : 0x425077;

        this.cardInspectArtwork.clear();
        this.cardInspectArtwork.fillStyle(artTint, 0.88);
        this.cardInspectArtwork.fillRoundedRect(artX, artY, artW, artH, 16);
        this.cardInspectArtwork.fillStyle(0xffffff, 0.12);
        this.cardInspectArtwork.fillRoundedRect(artX + 2, artY + 2, artW - 4, artH * 0.22, { tl: 12, tr: 12, bl: 0, br: 0 });
        this.cardInspectArtwork.lineStyle(2, accent, 0.92);
        this.cardInspectArtwork.strokeRoundedRect(artX, artY, artW, artH, 16);
        this.cardInspectArtwork.lineStyle(1, 0xffffff, 0.22);
        this.cardInspectArtwork.strokeRoundedRect(artX + 3, artY + 3, artW - 6, artH - 6, 12);
        this.layoutCardInspectArtworkImage(artX, artY, artW, artH);

        const closeSize = Phaser.Math.Clamp(panelW * 0.052, 30, 42);
        const closeCx = panelX + panelW - 14 - closeSize * 0.5;
        const closeCy = panelY + 16 + closeSize * 0.5;
        this.cardInspectCloseBtn.clear();
        this.cardInspectCloseBtn.fillStyle(0x223447, 0.95);
        this.cardInspectCloseBtn.fillCircle(closeCx, closeCy, closeSize * 0.5);
        this.cardInspectCloseBtn.lineStyle(2, 0xe8f3ff, 0.92);
        this.cardInspectCloseBtn.strokeCircle(closeCx, closeCy, closeSize * 0.5);
        this.cardInspectCloseHit
            .setPosition(closeCx, closeCy)
            .setSize(closeSize + 14, closeSize + 14);
        this.cardInspectCloseLabel
            .setPosition(closeCx, closeCy - 1)
            .setFontSize(`${Phaser.Math.Clamp(closeSize * 0.55, 18, 24)}px`);

        this.cardInspectTitle
            .setPosition(cx, panelY + 20)
            .setWordWrapWidth(panelW - 48)
            .setColor('#202126')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.033, 19, 32)}px`);
        fitTextToBox(this.cardInspectTitle, this.cardInspectTitle.text, panelW - 48, 58, {
            maxLines: 2,
            ellipsis: true,
        });
        this.cardInspectType
            .setPosition(cx, panelY + 68)
            .setColor('#2f5f89')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.018, 12, 18)}px`);
        fitTextToBox(this.cardInspectType, this.cardInspectType.text, panelW - 52, 28, {
            maxLines: 1,
            ellipsis: true,
        });
        this.cardInspectBody
            .setPosition(cx, artY + artH + 18)
            .setWordWrapWidth(panelW - 38)
            .setLineSpacing(4)
            .setColor('#2a2f37')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.019, 14, 21)}px`);
        this.cardInspectHint
            .setPosition(cx, panelY + panelH - 14)
            .setColor('#4b6075')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.014, 11, 14)}px`);

        if (!this.cardInspectVisible) {
            this.cardInspectPanel.setVisible(false);
            this.cardInspectArtwork.setVisible(false);
            this.cardInspectArtworkImage.setVisible(false);
            this.cardInspectCloseBtn.setVisible(false);
            this.cardInspectCloseHit.setVisible(false);
            this.cardInspectCloseLabel.setVisible(false);
        }
    }

    private layoutCardInspectArtworkImage(artX: number, artY: number, artW: number, artH: number) {
        if (!this.inspectedCard) {
            this.cardInspectArtworkImage.setVisible(false);
            return;
        }

        const textureKey = resolveCardArtworkTexture(this, this.inspectedCard);
        if (!textureKey) {
            this.cardInspectArtworkImage.setVisible(false);
            return;
        }

        this.cardInspectArtworkImage
            .setTexture(textureKey)
            .setPosition(artX + artW * 0.5, artY + artH * 0.5);

        const frame = this.cardInspectArtworkImage.frame;
        const sourceW = Math.max(1, frame.realWidth || frame.width);
        const sourceH = Math.max(1, frame.realHeight || frame.height);
        const scale = Math.min((artW - 12) / sourceW, (artH - 12) / sourceH);
        this.cardInspectArtworkImage.setDisplaySize(
            Math.max(1, Math.floor(sourceW * scale)),
            Math.max(1, Math.floor(sourceH * scale)),
        );
        this.cardInspectArtworkImage.setVisible(this.cardInspectVisible);
    }

    private layoutDiceToast() {
        const toastW = Phaser.Math.Clamp(this.uiW * (this.isLandscapeLayout ? 0.42 : 0.9), 240, 540);
        const toastH = Phaser.Math.Clamp(this.screenH * 0.13, 66, 110);
        const x = this.uiX + this.uiW * 0.5 - toastW * 0.5;
        const y = this.matchLayout?.board?.y
            ? this.matchLayout.board.y + 10
            : this.topH + 10;

        this.diceToastPanel.clear();
        this.diceToastPanel.fillStyle(0x1b2a3a, 0.95);
        this.diceToastPanel.fillRoundedRect(x, y, toastW, toastH, 12);
        this.diceToastPanel.lineStyle(1.2, 0xb9d9f3, 0.9);
        this.diceToastPanel.strokeRoundedRect(x, y, toastW, toastH, 12);
        this.diceToastText
            .setPosition(x + toastW * 0.5, y + toastH * 0.5)
            .setWordWrapWidth(toastW - 20)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.012, 11, 16)}px`);
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
        this.inspectedCard = card;
        const presentation = buildInspectPresentation(card, this.tr.bind(this));
        this.cardInspectTitle.setText(presentation.title);
        this.cardInspectType.setText(presentation.meta);
        this.cardInspectBody.setText(presentation.lines.join('\n\n'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));

        this.cardInspectVisible = true;
        this.cardInspectOverlay.setVisible(true);
        this.cardInspectPanel.setVisible(true);
        this.cardInspectArtwork.setVisible(true);
        this.cardInspectArtworkImage.setVisible(false);
        this.cardInspectCloseBtn.setVisible(true);
        this.cardInspectCloseHit.setVisible(true);
        this.cardInspectCloseLabel.setVisible(true);
        this.cardInspectTitle.setVisible(true);
        this.cardInspectType.setVisible(true);
        this.cardInspectBody.setVisible(true);
        this.cardInspectHint.setVisible(true);

        requestCardArtwork(this, card, () => {
            if (!this.cardInspectVisible || !this.inspectedCard) return;
            const currentId = String(this.inspectedCard.id ?? this.inspectedCard.templateId ?? '');
            const expectedId = String(card.id ?? card.templateId ?? '');
            if (currentId !== expectedId) return;
            this.layoutCardInspectOverlay();
        });

        this.layoutCardInspectOverlay();
    }

    private hideCardInspect() {
        if (!this.cardInspectVisible) return;
        this.cardInspectVisible = false;
        this.inspectedCard = undefined;
        this.cardInspectOverlay.setVisible(false);
        this.cardInspectPanel.setVisible(false);
        this.cardInspectArtwork.setVisible(false);
        this.cardInspectArtworkImage.setVisible(false);
        this.cardInspectCloseBtn.setVisible(false);
        this.cardInspectCloseHit.setVisible(false);
        this.cardInspectCloseLabel.setVisible(false);
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
        if (this.isPreLobbyPhase(state.phase)) {
            this.redirectToPreLobby();
            return;
        }

        const myId = this.serverManager.room?.sessionId ?? '';
        const handCards = (me.hand as unknown as ICardData[]) ?? [];
        this.reconcilePendingCardFromAuthoritativeHand(handCards);

        this.deckCountText.setText(`${state.deckCount ?? 0}`);
        this.updateOpponents(state, myId);
        this.rebuildCrises((state.centralCrises as unknown as ICardData[]) ?? []);
        this.rebuildCompany((me.company as unknown as ICardData[]) ?? []);
        this.rebuildHand(handCards);
        this.cleanupOrphanCardObjects();
        if (handCards.length === 0 && this.cardInspectVisible) {
            this.hideCardInspect();
        }
        this.updateAP(me.actionPoints ?? 0);
        this.updateTurn(state, myId);
        this.updateHud(state, me, myId);
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

    private redirectToPreLobby() {
        if (this.redirectingToPreLobby) return;
        this.redirectingToPreLobby = true;
        this.scene.start('PreLobbyScene', {
            serverManager: this.serverManager,
            lang: this.lang,
            roomCode: this.roomCode,
        });
    }

    private updateTurn(state: IGameState, myId: string) {
        if (this.myTurnTween) this.myTurnTween.stop();
        this.myTurnTween = undefined;
        this.turnText.setVisible(false).setAlpha(1);

        if (this.isPreLobbyPhase(state.phase)) {
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
        } else {
            this.turnText.setText(this.tr('game_turn_other', { name: active.username.toUpperCase() })).setColor('#c8d9e7').setAlpha(1);
        }
    }

    private updateHud(state: IGameState, me: IPlayer, myId: string) {
        const players = Array.from((state.players as unknown as Map<string, IPlayer>).values());
        const opponents = players.filter((p) => p.sessionId !== myId);
        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);

        const handCount = Number((me.hand as unknown as ICardData[])?.length ?? 0);
        const companyCards = (me.company as unknown as ICardData[]) ?? [];
        const companyCount = companyCards.length;
        const equippedCount = companyCards.reduce((sum, card) => {
            const eq = Number((card as any)?.equippedItems?.length ?? 0);
            return sum + (Number.isFinite(eq) ? Math.max(0, eq) : 0);
        }, 0);
        const deckCount = Number(state.deckCount ?? 0);
        const discardCount = this.estimateDiscardCount(state);

        const oppScore = opponents.length > 0
            ? opponents
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, 3)
                .map((p) => `${this.compactName(p.username, 7)}:${p.score ?? 0}`)
                .join('  ')
            : this.tr('game_waiting_opponents');

        const turnLabel = active
            ? (active.sessionId === myId ? this.tr('game_turn_your') : this.tr('game_turn_other', { name: active.username }))
            : this.tr('game_waiting');
        this.hudTurnText.setText(turnLabel);

        this.hudStatsText.setText(this.tr('game_hud_stats', {
            ap: me.actionPoints ?? 0,
            score: me.score ?? 0,
            deck: deckCount,
            discard: discardCount,
            hand: handCount,
            company: companyCount,
            equipped: equippedCount,
        }));

        this.hudStateText.setText(this.tr('game_hud_phase', {
            phase: String(state.phase ?? '').replace(/_/g, ' '),
        }));

        const reactionText = state.phase === GamePhase.REACTION_WINDOW
            ? this.tr('game_hud_reaction_active')
            : this.tr('game_hud_reaction_idle');
        this.hudReactionText.setText(reactionText);

        this.topTitle.setText(this.tr('game_hud_opponents', { value: oppScore }));

        const getWrap = (textObj: Phaser.GameObjects.Text, fallback: number) => {
            const raw = Number((textObj.style as any)?.wordWrapWidth ?? fallback);
            return Number.isFinite(raw) && raw > 0 ? raw : fallback;
        };
        fitTextToBox(this.hudTurnText, this.hudTurnText.text, getWrap(this.hudTurnText, this.uiW * 0.46), Math.max(20, this.topH * 0.18), { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudReactionText, this.hudReactionText.text, getWrap(this.hudReactionText, this.uiW * 0.4), Math.max(20, this.topH * 0.18), { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudStatsText, this.hudStatsText.text, getWrap(this.hudStatsText, this.uiW * 0.66), Math.max(20, this.topH * 0.18), { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudStateText, this.hudStateText.text, getWrap(this.hudStateText, this.uiW * 0.28), Math.max(20, this.topH * 0.18), { maxLines: 2, ellipsis: true });
        fitTextToBox(this.topTitle, this.topTitle.text, getWrap(this.topTitle, this.uiW * 0.54), Math.max(22, this.topH * 0.24), { maxLines: 2, ellipsis: true });
    }

    private estimateDiscardCount(state: IGameState): number {
        const playerMap = state.players as unknown as Map<string, IPlayer>;
        let handCards = 0;
        let companyCards = 0;
        let equippedCards = 0;

        playerMap.forEach((player) => {
            const hand = (player.hand as unknown as ICardData[]) ?? [];
            const company = (player.company as unknown as ICardData[]) ?? [];
            handCards += hand.length;
            companyCards += company.length;
            company.forEach((card) => {
                equippedCards += Number((card as any)?.equippedItems?.length ?? 0);
            });
        });

        const inCirculation = Number(state.deckCount ?? 0) + handCards + companyCards + equippedCards;
        if (inCirculation > this.estimatedDeckBase) {
            this.estimatedDeckBase = inCirculation;
        }

        return Math.max(0, this.estimatedDeckBase - inCirculation);
    }

    private updateLobby(state: IGameState, myId: string, me: IPlayer) {
        const waiting = this.isPreLobbyPhase(state.phase);
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
        const actionState = evaluateMatchActionState({ state, me, myId });

        if (this.deckHit.input) this.deckHit.input.enabled = true;
        if (this.endHit.input) this.endHit.input.enabled = true;

        this.drawDeckButton(actionState.canDraw);
        this.drawEndButton(actionState.canEndTurn);
        if (!actionState.canDraw) this.deckButtonFx?.reset();
        if (!actionState.canEndTurn) this.endButtonFx?.reset();

        const canReact = state.phase === GamePhase.REACTION_WINDOW && state.pendingAction?.playerId !== myId;
        const canPlayTurn = actionState.isMyTurn && state.phase === GamePhase.PLAYER_TURN;

        this.handCards.forEach((card) => {
            const canPlayThisCard = canPlayTurn || (canReact && this.isReactionCard(card.cardData));
            if (!card.input) {
                card.setInteractive({ useHandCursor: true });
            }
            if (card.input) card.input.enabled = true;
            this.input.setDraggable(card as unknown as Phaser.GameObjects.GameObject, canPlayThisCard);
        });

        this.updateActionPanel(state, me, myId, actionState);
        this.updateCrisisActionButtons(state, me, myId);
    }

    private updateActionPanel(state: IGameState, _me: IPlayer, myId: string, actionState: MatchActionState) {
        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        const turnInfo = actionState.isMyTurn
            ? this.tr('game_action_turn_you')
            : this.tr('game_action_turn_other', { name: String(active?.username ?? this.tr('game_unknown_player')) });
        const attackText = actionState.canAttackMonster
            ? this.tr('game_action_attack_ready', { cost: actionState.attackCost })
            : this.tr('game_action_attack_blocked', {
                reason: this.localizeActionBlockReason(actionState.attackReasonKey),
            });
        const drawText = actionState.canDraw
            ? this.tr('game_action_draw_ready', { cost: actionState.drawCost })
            : this.tr('game_action_draw_blocked_panel', {
                reason: this.localizeActionBlockReason(actionState.drawReasonKey),
            });
        const endText = actionState.canEndTurn
            ? this.tr('game_action_end_ready')
            : this.tr('game_action_end_blocked', {
                reason: this.localizeActionBlockReason(actionState.endReasonKey),
            });

        this.actionPanelHint.setText(attackText);
        this.actionPanelDetail.setText(`${drawText}\n${turnInfo} • ${endText}`);

        const hintWrap = Number((this.actionPanelHint.style as any)?.wordWrapWidth ?? 240);
        const detailWrap = Number((this.actionPanelDetail.style as any)?.wordWrapWidth ?? 240);
        fitTextToBox(this.actionPanelHint, this.actionPanelHint.text, hintWrap, Math.max(18, this.matchLayout.controls.h * 0.38), {
            maxLines: 2,
            ellipsis: true,
        });
        fitTextToBox(this.actionPanelDetail, this.actionPanelDetail.text, detailWrap, Math.max(18, this.matchLayout.controls.h * 0.46), {
            maxLines: 2,
            ellipsis: true,
        });

        if (this.targetSelectorOverlay?.visible && state.currentTurnPlayerId !== myId) {
            this.hideTargetSelector();
        }
    }

    private updateCrisisActionButtons(state: IGameState, me: IPlayer, myId: string) {
        this.crisisViews.forEach((view) => {
            if (!view.actionBg || !view.actionHit || !view.actionLabel) return;
            const evalAttack = evaluateSingleMonsterAttack({ state, me, myId }, view.crisis);
            const hit = view.actionHit;
            const w = Math.max(82, hit.width);
            const h = Math.max(44, hit.height);
            view.actionBg.clear();
            paintRetroButton(
                view.actionBg,
                { width: w, height: h, radius: 10, borderWidth: 1.1 },
                {
                    base: evalAttack.canAttack ? 0x3c7a57 : 0x334455,
                    border: evalAttack.canAttack ? 0xc4f4d8 : 0x7f97b0,
                    glossAlpha: evalAttack.canAttack ? 0.2 : 0.08,
                },
            );
            view.actionBg.setPosition(hit.x, hit.y);
            view.actionLabel
                .setText(
                    evalAttack.canAttack
                        ? this.tr('game_attack_cta_cost', { cost: evalAttack.cost })
                        : this.tr('game_attack_cta_locked'),
                )
                .setColor(evalAttack.canAttack ? '#f6fff8' : '#c7d6e6');
            fitTextToBox(view.actionLabel, view.actionLabel.text, w - 10, h - 6, { maxLines: 1, ellipsis: true });
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
            const waitMsg = this.isPreLobbyPhase(state.phase)
                ? this.tr('game_open_tab_hint')
                : this.tr('game_waiting_opponents');
            this.opponentsPlaceholder.setText(waitMsg);
            this.opponentsPlaceholder.setVisible(true);
            return;
        }

        this.opponentsPlaceholder.setVisible(false);

        const compactTop = this.isCompactLandscapeLayout() || (!this.isLandscapeLayout && this.uiW < 500);
        const gapX = this.isLandscapeLayout ? 8 : 10;
        const gapY = this.isLandscapeLayout ? 8 : 9;
        const topHeaderH = Phaser.Math.Clamp(this.topH * 0.28, 30, 46);
        const areaTop = topHeaderH + 14;
        const areaBottom = this.topH - 12;
        const areaW = this.uiW - 34;
        const areaH = Math.max(40, areaBottom - areaTop);
        const minPanelW = this.isLandscapeLayout ? 112 : (compactTop ? 102 : 114);
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
            const ready = this.isPreLobbyPhase(state.phase) && opp.isReady;
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
            fitTextToBox(name, opp.username, panelW - 24, 18, { maxLines: 1, ellipsis: true });

            const companyLen = (opp.company as unknown as ICardData[])?.length ?? 0;
            const showStats = panelH >= (compactTop ? 48 : 56);
            const statsLabel = this.isPreLobbyPhase(state.phase)
                ? `${opp.isReady ? this.tr('game_status_ready') : this.tr('game_status_waiting_short')} | ${opp.isConnected ? this.tr('game_status_online_short') : this.tr('game_status_offline_short')}`
                : compactTop
                    ? `${this.tr('game_vp_short')} ${opp.score ?? 0} | ${this.tr('game_ap')} ${opp.actionPoints} | ${this.tr('game_heroes_short')} ${companyLen}`
                    : `${this.tr('game_vp_short')} ${opp.score ?? 0} | ${this.tr('game_hand_short')} ${(opp.hand as any)?.length ?? 0} | ${this.tr('game_ap')} ${opp.actionPoints} | ${this.tr('game_heroes_short')} ${companyLen}`;

            const stats = this.add.text(-panelW * 0.5 + 10, panelH * 0.2, statsLabel, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(panelW * 0.062, 9, 12)}px`,
                color: '#b2c3d3',
                fontStyle: '700',
                wordWrap: { width: panelW - 24 },
            }).setOrigin(0, 0.5).setResolution(this.textResolution);
            fitTextToBox(stats, statsLabel, panelW - 24, 20, { maxLines: 1, ellipsis: true });
            stats.setVisible(showStats);
            if (!showStats) {
                name.setPosition(-panelW * 0.5 + 10, 0);
            }

            const dotColor = offline ? 0xd88ea0 : ready ? 0xd9ef98 : active ? 0xa9daff : 0xa4b5c9;
            const dot = this.add.circle(panelW * 0.5 - 12, 0, 4.5, dotColor, 1);
            this.opponentViews.push(this.add.container(x, y, [frame, name, stats, dot]).setDepth(30));
        });
    }

    private rebuildCrises(crises: ICardData[]) {
        this.crisisViews.forEach(({ zone, card, meta, actionBg, actionHit, actionLabel }) => {
            zone.destroy();
            card.destroy();
            meta?.destroy();
            actionBg?.destroy();
            actionHit?.destroy();
            actionLabel?.destroy();
        });
        this.crisisViews = [];

        if (!crises || crises.length === 0) return;

        const compactLandscape = this.isCompactLandscapeLayout();
        const y = Phaser.Math.Clamp(
            this.centerDropY - this.centerDropH * (this.isLandscapeLayout ? (compactLandscape ? 0.84 : 0.72) : 0.76),
            this.topH + (compactLandscape ? 34 : 46),
            this.centerDropY - 44,
        );
        const available = this.centerDropW * (this.isLandscapeLayout ? (compactLandscape ? 0.82 : 0.88) : 0.94);
        const scale = this.isLandscapeLayout
            ? Phaser.Math.Clamp(available / Math.max(1, crises.length * 128), compactLandscape ? 0.34 : 0.4, compactLandscape ? 0.52 : 0.58)
            : Phaser.Math.Clamp(available / Math.max(1, crises.length * 128), 0.52, 0.7);
        const spacing = 108 * scale;
        const total = (crises.length - 1) * spacing;
        const startX = this.uiX + this.uiW * 0.5 - total * 0.5;

        crises.forEach((cr, i) => {
            const x = startX + i * spacing;
            const card = this.createCardObject(x, y, cr);
            this.add.existing(card);
            card.setScale(scale);
            card.setDepth(35 + i);
            card.disableInteractive();

            const zoneW = Math.max(72, card.displayWidth * 0.92);
            const zoneH = Math.max(96, card.displayHeight * 1.02);
            const zone = this.add.zone(x, y, zoneW, zoneH)
                .setRectangleDropZone(zoneW, zoneH)
                .setData('type', 'crisis')
                .setData('crisisId', cr.id)
                .setDepth(42)
                .setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => this.showCardInspect(cr));
            const metaValue = typeof cr.targetRoll === 'number'
                ? this.tr('game_crisis_roll_badge', { value: cr.targetRoll })
                : this.tr('game_crisis_roll_badge_unknown');
            const meta = this.add.text(x, y - card.displayHeight * 0.56, metaValue, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(this.uiW * 0.0094, 9, 12)}px`,
                color: '#ffe7bc',
                fontStyle: '700',
                stroke: '#16222f',
                strokeThickness: 2,
            }).setOrigin(0.5).setDepth(43).setResolution(this.textResolution);
            fitTextToBox(meta, metaValue, Math.max(64, card.displayWidth * 0.8), 14, {
                maxLines: 1,
                ellipsis: true,
            });

            const actionBg = this.add.graphics().setDepth(43);
            const actionLabel = this.add.text(0, 0, '', {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(this.uiW * 0.0088, 9, 12)}px`,
                color: '#f4f8ff',
                fontStyle: '700',
                letterSpacing: 0.4,
            }).setOrigin(0.5).setDepth(44).setResolution(this.textResolution);
            const actionHit = this.add.rectangle(0, 0, 92, 44, 0x000000, 0)
                .setDepth(45)
                .setInteractive({ useHandCursor: true });
            const actionY = y + card.displayHeight * 0.52 + 12;
            actionHit.setPosition(x, actionY);
            actionLabel.setPosition(x, actionY);
            actionHit.on('pointerdown', () => this.tryAttackCrisis(cr));

            this.crisisViews.push({ crisis: cr, zone, card, meta, actionBg, actionHit, actionLabel });
        });
    }

    private createCardObject(x: number, y: number, data: ICardData): CardGameObject {
        const card = new CardGameObject(this, x, y, data, {
            lang: this.lang,
            translate: this.tr.bind(this),
        });
        this.liveCardObjects.add(card);
        card.once(Phaser.GameObjects.Events.DESTROY, () => {
            this.liveCardObjects.delete(card);
        });
        return card;
    }

    private rebuildCompany(cards: ICardData[]) {
        this.companyCards.forEach((c) => c.destroy());
        this.companyCards = [];

        if (!cards || cards.length === 0) return;

        const compactLandscape = this.isCompactLandscapeLayout();
        const y = Phaser.Math.Clamp(
            this.centerDropY + this.centerDropH * (compactLandscape ? 0.61 : 0.67),
            this.centerDropY + 54,
            this.topH + this.centerH - (compactLandscape ? 16 : 24),
        );
        const available = this.uiW * (this.isLandscapeLayout ? 0.72 : 0.86);
        const scale = this.isLandscapeLayout
            ? Phaser.Math.Clamp(available / Math.max(1, cards.length * 126), compactLandscape ? 0.38 : 0.44, compactLandscape ? 0.6 : 0.7)
            : Phaser.Math.Clamp(available / Math.max(1, cards.length * 126), 0.56, 0.86);
        const spacing = 110 * scale;
        const total = (cards.length - 1) * spacing;
        const startX = this.uiX + this.uiW * 0.5 - total * 0.5;

        cards.forEach((data, i) => {
            const card = this.createCardObject(startX + i * spacing, y, data);
            this.add.existing(card);
            card.setScale(scale);
            card.setInteractive({ useHandCursor: true });
            this.input.setDraggable(card as unknown as Phaser.GameObjects.GameObject, false);
            card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                card.setData('inspectDownX', pointer.x);
                card.setData('inspectDownY', pointer.y);
            });
            card.on('pointerup', (pointer: Phaser.Input.Pointer) => {
                const downX = Number(card.getData('inspectDownX') ?? pointer.x);
                const downY = Number(card.getData('inspectDownY') ?? pointer.y);
                const moved = Phaser.Math.Distance.Between(downX, downY, pointer.x, pointer.y);
                if (moved > 14) return;
                this.showCardInspect(data);
            });
            this.companyCards.push(card);
        });
    }

    private rebuildHand(cards: ICardData[]) {
        this.handCards.forEach((c) => c.destroy());
        this.handCards = [];

        if (!cards || cards.length === 0) return;

        const compactLandscape = this.isCompactLandscapeLayout();
        const cardCount = cards.length;
        const useTwoRows = this.isLandscapeLayout
            ? (compactLandscape ? cardCount > 4 : cardCount > 6)
            : cardCount > 5;
        const cardsPerRow = useTwoRows ? Math.ceil(cardCount / 2) : cardCount;
        const available = Math.max(120, this.handCardsRect.w - (compactLandscape ? 10 : 16));

        const baseCardW = 126;
        let scale = this.isLandscapeLayout
            ? Phaser.Math.Clamp(
                available / Math.max(1, cardsPerRow * (baseCardW * (compactLandscape ? 0.98 : 0.94))),
                compactLandscape ? 0.48 : 0.56,
                compactLandscape ? 0.74 : 0.86,
            )
            : Phaser.Math.Clamp(available / Math.max(1, cardsPerRow * (baseCardW * 0.9)), 0.68, 0.96);
        if (useTwoRows) {
            scale = Math.max(scale, this.isLandscapeLayout ? (compactLandscape ? 0.5 : 0.58) : 0.7);
        }

        const spacing = cardsPerRow > 1
            ? Math.min(baseCardW * (compactLandscape ? 0.82 : 0.88) * scale, available / (cardsPerRow - 1))
            : 0;

        const area = this.handCardsRect;
        const firstRowY = area.y + area.h * (useTwoRows
            ? (this.isLandscapeLayout ? (compactLandscape ? 0.28 : 0.33) : 0.34)
            : (this.isLandscapeLayout ? (compactLandscape ? 0.5 : 0.54) : 0.56));
        const rowGap = useTwoRows
            ? Phaser.Math.Clamp(
                area.h * (this.isLandscapeLayout ? (compactLandscape ? 0.4 : 0.44) : 0.42),
                compactLandscape ? 34 : 42,
                compactLandscape ? 62 : 74,
            )
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
                + Math.abs(indexInRow - rowMid) * (this.isLandscapeLayout ? (compactLandscape ? 1.2 : 1.7) : 2.8);

            const card = this.createCardObject(x, y, data);
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
        if (this.pendingPlayedCard && this.pendingPlayedCard !== card) {
            this.pendingPlayedCard.destroy();
        }
        card.disableInteractive();
        this.pendingPlayedCard = card;
        this.handCards = this.handCards.filter((c) => c !== card);
        this.pendingPlayState = stashPendingCard(this.pendingPlayState, String(card.cardData.id ?? ''));

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

        const cost = Math.max(0, Number(card.cardData?.costPA ?? 0));
        if (cost > 0) {
            this.floatText(this.tr('game_ap_spend_preview', { cost }), '#ffd6a3', this.centerDropX, this.centerDropY - 36);
        }
    }

    private rollbackPendingCardVisual(showFeedback: boolean) {
        const pending = this.pendingPlayedCard;
        this.pendingPlayedCard = undefined;
        this.pendingPlayState = rollbackPendingModel(this.pendingPlayState);
        if (!pending || !pending.active) return;

        pending.disableInteractive();
        this.tweens.killTweensOf(pending);

        if (showFeedback) {
            this.floatText(this.tr('game_action_failed'), '#ff8a97');
        }

        this.tweens.add({
            targets: pending,
            x: pending.homeX,
            y: pending.homeY,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            alpha: 1,
            duration: 210,
            ease: 'Cubic.Out',
            onComplete: () => {
                const state = this.serverManager.room?.state as IGameState | undefined;
                const myId = this.serverManager.room?.sessionId ?? '';
                const me = state
                    ? (state.players as unknown as Map<string, IPlayer>).get(myId)
                    : undefined;
                if (pending.active) pending.destroy();
                if (state && me && !this.visualQueue.isBusy) {
                    this.applyState(state, me);
                }
            },
        });
    }

    private clearPendingCardAsAccepted() {
        const pending = this.pendingPlayedCard;
        this.pendingPlayedCard = undefined;
        this.pendingPlayState = acceptPendingCard(this.pendingPlayState);
        if (!pending || !pending.active) return;
        this.tweens.killTweensOf(pending);
        this.tweens.add({
            targets: pending,
            x: this.uiX + this.uiW * 0.5,
            y: this.topH + this.centerH * 0.78,
            scaleX: 0.56,
            scaleY: 0.56,
            alpha: 0,
            duration: 320,
            ease: 'Cubic.Out',
            onComplete: () => {
                if (pending.active) pending.destroy();
            },
        });
    }

    private reconcilePendingCardFromAuthoritativeHand(handCards: ICardData[]) {
        const handIds = handCards
            .map((card) => String(card?.id ?? '').trim())
            .filter((id) => id.length > 0);
        const result = reconcilePendingWithHand(this.pendingPlayState, handIds);
        this.pendingPlayState = result.state;

        if (!this.pendingPlayedCard) return;
        if (result.outcome === 'rollback' || result.outcome === 'accepted') {
            if (this.pendingPlayedCard.active) this.pendingPlayedCard.destroy();
            this.pendingPlayedCard = undefined;
        }
    }

    private cleanupOrphanCardObjects() {
        const prioritized = [
            ...this.handCards,
            ...this.companyCards,
            ...this.crisisViews.map((view) => view.card),
            ...(this.pendingPlayedCard ? [this.pendingPlayedCard] : []),
        ];
        const allowed = new Set<CardGameObject>(prioritized);
        const keepById = new Map<string, CardGameObject>();
        prioritized.forEach((obj) => {
            const id = String(obj.cardData?.id ?? '').trim();
            if (!id || keepById.has(id)) return;
            keepById.set(id, obj);
        });

        Array.from(this.liveCardObjects).forEach((card) => {
            if (!card.active) {
                this.liveCardObjects.delete(card);
                return;
            }
            const id = String(card.cardData?.id ?? '').trim();
            if (id && keepById.has(id) && keepById.get(id) !== card) {
                card.destroy();
                return;
            }
            if (!allowed.has(card)) {
                card.destroy();
            }
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

    private appendGameLog(text: string) {
        const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
        if (!clean) return;
        const stamp = new Date();
        const hh = `${stamp.getHours()}`.padStart(2, '0');
        const mm = `${stamp.getMinutes()}`.padStart(2, '0');
        this.gameLogEntries.push(`[${hh}:${mm}] ${clean}`);
        if (this.gameLogEntries.length > this.gameLogLimit) {
            this.gameLogEntries.splice(0, this.gameLogEntries.length - this.gameLogLimit);
        }
        this.layoutGameLog();
    }

    private resolvePlayerName(playerId?: string) {
        if (!playerId) return this.tr('game_unknown_player');
        const state = this.serverManager.room?.state as IGameState | undefined;
        const player = state
            ? (state.players as unknown as Map<string, IPlayer>).get(playerId)
            : undefined;
        return player?.username ?? playerId;
    }

    private showDiceToast(event: IDiceRolledEvent) {
        const actor = this.resolvePlayerName(event.playerId);
        const line = this.tr('game_dice_result_line', {
            player: actor,
            roll1: event.roll1 ?? 0,
            roll2: event.roll2 ?? 0,
            total: event.total ?? 0,
            status: event.success ? this.tr('game_dice_success') : this.tr('game_dice_fail'),
        });

        this.diceToastText.setText(line).setVisible(true);
        this.diceToastPanel.setVisible(true);
        this.diceToastVisible = true;
        this.layoutDiceToast();

        if (this.diceToastTween) this.diceToastTween.stop();
        this.diceToastTween = this.tweens.add({
            targets: [this.diceToastText, this.diceToastPanel],
            alpha: { from: 1, to: 1 },
            duration: 200,
            yoyo: false,
            repeat: 0,
        });

        this.time.delayedCall(1600, () => this.hideDiceToast());
    }

    private hideDiceToast() {
        if (!this.diceToastVisible) return;
        this.diceToastVisible = false;
        if (this.diceToastTween) this.diceToastTween.stop();
        this.tweens.add({
            targets: [this.diceToastText, this.diceToastPanel],
            alpha: 0,
            duration: 180,
            onComplete: () => {
                this.diceToastText.setVisible(false).setAlpha(1);
                this.diceToastPanel.setVisible(false).setAlpha(1);
            },
        });
    }

    private handleRoomMessage(type: string | number, message: any) {
        switch (type) {
            case ServerEvents.ERROR:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const code = String(message?.code ?? '');
                    const localized = this.localizeServerError(message);
                    this.appendGameLog(`${this.tr('game_log_error')}: ${localized}`);
                    this.rollbackPendingCardVisual(false);
                    if (code === 'TRICKS_LOCKED') {
                        this.floatText(this.tr('game_error_tricks_locked'), '#ff5566');
                        this.cameras.main.shake(200, 0.005);
                    } else {
                        this.floatText(localized, '#ff8293');
                        this.cameras.main.shake(120, 0.0018);
                    }
                    this.time.delayedCall(420, resolve);
                }));
                break;

            case ServerEvents.START_REACTION_TIMER:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const duration = Number(message?.durationMs ?? message?.duration ?? 5000);
                    const label = this.tr('game_reaction_subtitle');
                    if (typeof message?.actionTypeLabel === 'string' && message.actionTypeLabel.trim().length > 0) {
                        this.appendGameLog(String(message.actionTypeLabel));
                    }
                    this.showReactionOverlay(duration, label);
                    resolve();
                }));
                break;

            case ServerEvents.REACTION_TRIGGERED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const name = String(message?.playerName ?? this.tr('game_opponent'));
                    this.appendGameLog(this.tr('game_log_reaction', { name }));
                    this.floatText(this.tr('game_reacted', { name }), '#ffd6a6', this.screenW * 0.5, this.topH + 40);
                    this.time.delayedCall(460, resolve);
                }));
                break;

            case ServerEvents.ACTION_RESOLVED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const success = message?.success !== false;
                    this.appendGameLog(success ? this.tr('game_log_action_ok') : this.tr('game_log_action_fail'));

                    this.hideReactionOverlay();

                    if (success) {
                        this.floatText(this.tr('game_action_resolved'), '#9ff3c2');
                        this.burst(this.screenW * 0.5, this.topH + this.centerH * 0.6, 36);
                        if (this.pendingPlayedCard) this.clearPendingCardAsAccepted();
                    } else {
                        this.floatText(this.tr('game_action_failed'), '#ff8a97');
                        this.cameras.main.shake(180, 0.0022);
                        this.burst(this.screenW * 0.5, this.centerDropY, 26);
                        if (this.pendingPlayedCard) this.rollbackPendingCardVisual(false);
                    }

                    this.time.delayedCall(420, resolve);
                }));
                break;

            case ServerEvents.CARD_DRAWN:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    this.appendGameLog(this.tr('game_log_card_drawn'));
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
                    const playerId = String(message?.playerId ?? '');
                    const actor = this.resolvePlayerName(playerId);
                    this.appendGameLog(this.tr('game_log_turn_started', { player: actor, turn: message?.turnNumber ?? '-' }));
                    this.floatText(this.tr('game_turn_number', { turn: message?.turnNumber ?? '' }), '#d8f4ff', this.screenW * 0.5, this.topH + 26);
                    this.time.delayedCall(320, resolve);
                }));
                break;

            case ServerEvents.DICE_ROLLED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const payload = message as IDiceRolledEvent;
                    this.showDiceToast(payload);
                    const actor = this.resolvePlayerName(payload.playerId);
                    this.appendGameLog(this.tr('game_log_dice', {
                        player: actor,
                        roll1: payload.roll1 ?? 0,
                        roll2: payload.roll2 ?? 0,
                        total: payload.total ?? 0,
                        status: payload.success ? this.tr('game_dice_success') : this.tr('game_dice_fail'),
                    }));
                    this.time.delayedCall(260, resolve);
                }));
                break;

            case ServerEvents.GAME_WON: {
                const event = message as { winnerId?: string; winnerName?: string; finalScore?: number };
                this.appendGameLog(this.tr('game_log_win', {
                    winner: String(event.winnerName ?? this.tr('game_unknown_player')),
                    score: Number(event.finalScore ?? 0),
                }));
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

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  VICTORY SCREEN
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private showVictoryScreen(event: { winnerId?: string; winnerName?: string; finalScore?: number }) {
        this.visualQueue.enqueue(() => new Promise((_resolve) => {
            const winnerName = String(event.winnerName ?? this.tr('game_unknown_player'));
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
            createSimpleButtonFx(this, btnHit, [btnGfx], {
                onClick: () => {
                    window.location.reload();
                },
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

            // Don't resolve â€” game is over, UI stays frozen
        }));
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  TARGET SELECTOR (for Trick cards)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private showTargetSelector(card: CardGameObject) {
        this.hideTargetSelector();

        const state = this.serverManager.room?.state as IGameState | undefined;
        const myId = this.serverManager.room?.sessionId;
        if (!state || !myId) {
            this.snapBack(card, this.tr('game_no_connection'));
            return;
        }

        const selectionRows: Array<{ label: string; onPick: () => void }> = [];
        let titleText = this.tr('game_choose_target');

        if (this.isItemCard(card.cardData)) {
            titleText = this.tr('game_choose_hero_target');
            const me = (state.players as unknown as Map<string, IPlayer>).get(myId);
            const heroes = ((me?.company ?? []) as ICardData[]).filter((entry) => this.isHeroCard(entry));

            if (heroes.length === 0) {
                this.snapBack(card, this.tr('game_error_no_hero_for_item'));
                return;
            }

            if (heroes.length === 1) {
                const single = heroes[0];
                if (!single?.id) {
                    this.snapBack(card, this.tr('game_error_invalid_hero_target'));
                    return;
                }
                this.serverManager.playMagic(card.cardData.id, undefined, single.id);
                this.stashPending(card);
                return;
            }

            heroes.forEach((hero) => {
                const itemCount = Number((hero as any)?.equippedItems?.length ?? 0);
                const suffix = itemCount > 0 ? ` (${this.tr('card_eq_badge', { count: itemCount })})` : '';
                selectionRows.push({
                    label: `${String(hero.name ?? this.tr('game_card_unknown'))}${suffix}`,
                    onPick: () => this.serverManager.playMagic(card.cardData.id, undefined, hero.id),
                });
            });
        } else {
            const opponents: IPlayer[] = [];
            (state.players as unknown as Map<string, IPlayer>).forEach((p, sid) => {
                if (sid !== myId) opponents.push(p);
            });

            if (opponents.length === 0) {
                this.snapBack(card, this.tr('game_waiting_opponents'));
                return;
            }

            opponents.forEach((opp) => {
                selectionRows.push({
                    label: opp.username,
                    onPick: () => this.serverManager.playMagic(card.cardData.id, opp.sessionId),
                });
            });
        }

        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;

        this.targetSelectorOverlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.6)
            .setDepth(550).setInteractive();
        this.targetSelectorOverlay.on('pointerdown', () => {
            this.snapBack(card, this.tr('game_cancelled'));
            this.hideTargetSelector();
        });
        this.targetSelectorElements.push(this.targetSelectorOverlay);

        const title = this.add.text(cx, cy - 94, titleText, {
            fontFamily: FONT_UI,
            fontSize: `${Phaser.Math.Clamp(this.uiW * 0.038, 18, 24)}px`,
            color: '#f8f0e2',
            fontStyle: '700',
            letterSpacing: 2,
        }).setOrigin(0.5).setDepth(551).setResolution(this.textResolution);
        fitTextToBox(title, titleText, this.uiW * 0.84, 56, { maxLines: 2, ellipsis: true });
        this.targetSelectorElements.push(title);

        const btnW = Phaser.Math.Clamp(this.uiW * (this.isLandscapeLayout ? 0.42 : 0.8), 210, 360);
        const btnH = Phaser.Math.Clamp(this.isLandscapeLayout ? 48 : 54, 46, 58);
        const gap = this.isLandscapeLayout ? 12 : 14;
        const totalH = selectionRows.length * btnH + (selectionRows.length - 1) * gap;
        const startY = cy - totalH * 0.5 + btnH * 0.5 - 16;

        selectionRows.forEach((row, i) => {
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

            const label = this.add.text(cx, y, row.label, {
                fontFamily: FONT_UI,
                fontSize: `${Phaser.Math.Clamp(btnW * 0.055, 14, 17)}px`,
                color: '#e8f4ff',
                fontStyle: '700',
            }).setOrigin(0.5).setDepth(552).setResolution(this.textResolution);
            fitTextToBox(label, row.label, btnW - 24, btnH - 10, { maxLines: 1, ellipsis: true });
            this.targetSelectorElements.push(label);

            const hit = this.add.rectangle(cx, y, btnW, btnH, 0x000000, 0)
                .setDepth(553).setInteractive({ useHandCursor: true });
            const fx = createSimpleButtonFx(this, hit, [bg, label], {
                onClick: () => {
                    row.onPick();
                    this.stashPending(card);
                    this.hideTargetSelector();
                },
            });
            this.targetSelectorFx.push(fx);
            this.targetSelectorElements.push(hit);
        });

        const cancelY = startY + selectionRows.length * (btnH + gap) + 10;
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
            fontSize: `${Phaser.Math.Clamp(btnW * 0.052, 13, 16)}px`,
            color: '#ffccdd',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(552).setResolution(this.textResolution);
        this.targetSelectorElements.push(cancelLabel);

        const cancelHit = this.add.rectangle(cx, cancelY, btnW, btnH, 0x000000, 0)
            .setDepth(553).setInteractive({ useHandCursor: true });
        const cancelFx = createSimpleButtonFx(this, cancelHit, [cancelBg, cancelLabel], {
            onClick: () => {
                this.snapBack(card, this.tr('game_cancelled'));
                this.hideTargetSelector();
            },
        });
        this.targetSelectorFx.push(cancelFx);
        this.targetSelectorElements.push(cancelHit);
    }

    private hideTargetSelector() {
        this.targetSelectorFx.forEach((fx) => fx.destroy());
        this.targetSelectorFx = [];
        this.targetSelectorElements.forEach((el) => el.destroy());
        this.targetSelectorElements = [];
        this.targetSelectorOverlay = undefined;
    }
}

