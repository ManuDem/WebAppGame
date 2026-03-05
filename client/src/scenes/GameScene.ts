import Phaser from 'phaser';
import { CardGameObject } from '../gameobjects/CardGameObject';
import { ReconnectStatus, ServerManager } from '../network/ServerManager';
import { VisualEventQueue } from '../systems/VisualEventQueue';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { requestCardArtwork, resolveCardArtworkTexture } from '../ui/CardArtworkResolver';
import { fitTextToBox } from '../ui/text/FitText';
import { buildInspectPresentation, getCardDisplayName } from '../ui/cards/CardPresentationModel';
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
import { buildCardRegistryPlan } from '../systems/CardObjectRegistry';
import { computeMatchLayout, drawMatchLayoutDebug, LayoutRect, MatchLayout } from '../ui/layout/MatchLayout';
import { buildActionPanelModel, buildHudModel, compactPlayerName } from '../ui/match/MatchUiPresenter';
import { buildMatchContextHint, buildMatchHelpContent } from '../ui/match/MatchHelpContent';
import { createMockServerManager, isQaMatchModeEnabled } from '../qa/MockMatchState';
import { getButtonContractByTier } from '../ui/layout/LayoutTokens';
import { ensureUiRoot, removeUiRootChildById, setUiRootLanguage, setUiRootScreen, syncUiRootViewport } from '../ui/dom/UiRoot';
import { MatchUiDom } from '../ui/dom/MatchUiDom';
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
    slotBg?: Phaser.GameObjects.Graphics;
    meta?: Phaser.GameObjects.Text;
    actionBg?: Phaser.GameObjects.Graphics;
    actionHit?: Phaser.GameObjects.Rectangle;
    actionLabel?: Phaser.GameObjects.Text;
    actionFx?: SimpleButtonController;
};

export class GameScene extends Phaser.Scene {
    private serverManager!: ServerManager;
    private visualQueue!: VisualEventQueue;
    private mockMode = false;

    private latestState?: IGameState;
    private latestPlayer?: IPlayer;

    private screenW = 1280;
    private screenH = 720;
    private uiW = 1280;
    private uiX = 0;
    private topH = 130;
    private centerH = 360;
    private matchLayout!: MatchLayout;
    private matchDom?: MatchUiDom;
    // Use DOM shell for textual match UI to avoid canvas crowding/overlap on small viewports.
    private readonly useDomMatchUi = true;
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
    private actionPanelContext!: Phaser.GameObjects.Text;
    private helpButton!: Phaser.GameObjects.Graphics;
    private helpHit!: Phaser.GameObjects.Rectangle;
    private helpButtonText!: Phaser.GameObjects.Text;
    private emoteButton!: Phaser.GameObjects.Graphics;
    private emoteHit!: Phaser.GameObjects.Rectangle;
    private emoteButtonText!: Phaser.GameObjects.Text;
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
    private cardInspectArtworkMaskShape!: Phaser.GameObjects.Graphics;
    private cardInspectArtworkMask!: Phaser.Display.Masks.GeometryMask;
    private cardInspectCloseBtn!: Phaser.GameObjects.Graphics;
    private cardInspectCloseHit!: Phaser.GameObjects.Rectangle;
    private cardInspectCloseLabel!: Phaser.GameObjects.Text;
    private cardInspectTitle!: Phaser.GameObjects.Text;
    private cardInspectType!: Phaser.GameObjects.Text;
    private cardInspectBody!: Phaser.GameObjects.Text;
    private cardInspectHint!: Phaser.GameObjects.Text;
    private cardInspectVisible = false;
    private cardInspectAnimating = false;
    private cardInspectOpenTween?: Phaser.Tweens.Tween;
    private cardInspectCloseTween?: Phaser.Tweens.Tween;
    private inspectedCard?: ICardData;
    private diceToastPanel!: Phaser.GameObjects.Graphics;
    private diceToastText!: Phaser.GameObjects.Text;
    private diceToastVisible = false;
    private diceToastTween?: Phaser.Tweens.Tween;
    private reconnectOverlay!: Phaser.GameObjects.Rectangle;
    private reconnectPanel!: Phaser.GameObjects.Graphics;
    private reconnectTitle!: Phaser.GameObjects.Text;
    private reconnectBody!: Phaser.GameObjects.Text;
    private reconnectActive = false;
    private reconnectRedirectTimer?: Phaser.Time.TimerEvent;
    private reconnectDomNode?: HTMLDivElement;
    private reconnectDomTitle?: HTMLParagraphElement;
    private reconnectDomBody?: HTMLParagraphElement;

    private fxEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private ambientEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

    private opponentViews: Phaser.GameObjects.Container[] = [];
    private crisisViews: CrisisView[] = [];
    private companyCards: CardGameObject[] = [];
    private handCards: CardGameObject[] = [];
    private liveCardObjects = new Set<CardGameObject>();

    private pendingPlayedCard?: CardGameObject;
    private pendingPlayState = createPendingPlayState();
    private pendingTransitionId = 0;
    private myTurnTween?: Phaser.Tweens.Tween;
    private deckButtonFx?: SimpleButtonController;
    private endButtonFx?: SimpleButtonController;
    private readyButtonFx?: SimpleButtonController;
    private gameLogToggleFx?: SimpleButtonController;
    private cardInspectCloseFx?: SimpleButtonController;
    private helpButtonFx?: SimpleButtonController;
    private emoteButtonFx?: SimpleButtonController;
    private helpCloseFx?: SimpleButtonController;
    private emoteCycleIndex = 0;
    private previousAP = -1;
    private redirectingToPreLobby = false;
    private estimatedDeckBase = 0;
    private readonly debugLayoutMode = (
        window.location.search.includes('uiDebug=1')
        || localStorage.getItem('lucrare_ui_debug') === '1'
    );
    private layoutDebugGfx?: Phaser.GameObjects.Graphics;
    private qaInspectRequested = false;
    private qaHelpRequested = false;
    private qaOverlayApplied = false;

    // Target Selector state
    private targetSelectorOverlay?: Phaser.GameObjects.Rectangle;
    private targetSelectorElements: Phaser.GameObjects.GameObject[] = [];
    private targetSelectorFx: SimpleButtonController[] = [];
    private helpOverlay!: Phaser.GameObjects.Rectangle;
    private helpPanel!: Phaser.GameObjects.Graphics;
    private helpTitle!: Phaser.GameObjects.Text;
    private helpBody!: Phaser.GameObjects.Text;
    private helpCloseBtn!: Phaser.GameObjects.Graphics;
    private helpCloseHit!: Phaser.GameObjects.Rectangle;
    private helpCloseLabel!: Phaser.GameObjects.Text;
    private helpVisible = false;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { serverManager?: ServerManager; lang?: SupportedLanguage; roomCode?: string; isHost?: boolean }) {
        const params = new URLSearchParams(window.location.search);
        const queryLang = params.get('lang');
        this.lang = sanitizeLanguage(data?.lang ?? queryLang ?? localStorage.getItem('lucrare_lang'));
        if (queryLang) localStorage.setItem('lucrare_lang', this.lang);
        setUiRootScreen('match');
        setUiRootLanguage(this.lang);
        this.mockMode = isQaMatchModeEnabled(window.location.search);
        this.qaInspectRequested = params.get('qaInspect') === '1';
        this.qaHelpRequested = params.get('qaHelp') === '1';
        this.qaOverlayApplied = false;

        this.serverManager = data?.serverManager as ServerManager;
        if (!this.serverManager && this.mockMode) {
            this.serverManager = createMockServerManager(window.location.search, this.lang) as unknown as ServerManager;
        }

        this.roomCode = String(data?.roomCode ?? (this.mockMode ? 'QAM4' : ''));
        this.visualQueue = new VisualEventQueue();
        this.redirectingToPreLobby = false;
        this.liveCardObjects.clear();
        this.pendingPlayState = createPendingPlayState();
        this.pendingPlayedCard = undefined;

        if (this.serverManager) {
            this.serverManager.onStateChange = this.handleStateChange.bind(this);
            this.serverManager.onPlayerChange = this.handlePlayerChange.bind(this);
            this.serverManager.onRoomMessage = this.handleRoomMessage.bind(this);
            this.serverManager.onReconnectStatus = this.handleReconnectStatus.bind(this);
        }
    }

    create() {
        if (!this.serverManager) {
            this.scene.start('LoginScene', { serverManager: new ServerManager() });
            return;
        }

        this.createAnimatedBackground();
        this.createUiObjects();
        this.createOverlay();
        this.createReconnectDomOverlay();
        this.createMatchDomOverlay();
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
            this.cardInspectCloseFx?.destroy();
            this.helpButtonFx?.destroy();
            this.emoteButtonFx?.destroy();
            this.helpCloseFx?.destroy();
            this.liveCardObjects.clear();
            if (this.cardInspectOpenTween) this.cardInspectOpenTween.stop();
            if (this.cardInspectCloseTween) this.cardInspectCloseTween.stop();
            if (this.reconnectRedirectTimer) this.reconnectRedirectTimer.remove(false);
            if (this.serverManager) {
                this.serverManager.onReconnectStatus = undefined;
            }
            removeUiRootChildById('game-reconnect-overlay');
            removeUiRootChildById('game-match-shell');
            this.reconnectDomNode = undefined;
            this.reconnectDomTitle = undefined;
            this.reconnectDomBody = undefined;
            this.matchDom?.destroy();
            this.matchDom = undefined;
        });

        this.handleResize(this.scale.gameSize);
        this.appendGameLog(this.tr('game_log_match_ready'));
        if (this.mockMode) {
            this.appendGameLog(this.tr('game_mock_mode_active'));
        }

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
        return this.isLandscapeLayout && (this.matchLayout?.tier === 'C' || this.screenH <= 430);
    }

    private boostText(...texts: Array<Phaser.GameObjects.Text | undefined>) {
        texts.forEach((text) => text?.setResolution(this.textResolution));
    }

    private hasPendingPlayInFlight() {
        return Boolean(this.pendingPlayedCard?.active || this.pendingPlayState.pendingCardId);
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
        this.matchDom?.setLanguage(this.lang);
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
        this.actionPanelContext.setText(this.tr('game_hint_wait_phase'));
        this.helpButtonText.setText('?');
        this.emoteButtonText.setText(this.tr('game_emote_button'));
        this.gameLogTitle.setText(this.tr('game_log_title'));
        this.gameLogToggleLabel.setText(this.gameLogExpanded ? this.tr('game_log_less') : this.tr('game_log_more'));
        this.reactionTitle.setText(this.tr('game_reaction_title'));
        this.reactionSubtitle.setText(this.tr('game_reaction_subtitle'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));
        const helpContent = buildMatchHelpContent(this.tr.bind(this));
        this.helpTitle.setText(helpContent.title);
        this.helpBody.setText(`${helpContent.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n')}\n\n${helpContent.closeHint}`);
        this.refreshMatchDomUi();
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
        if (this.reconnectActive) {
            this.floatText(this.tr('game_reconnect_action_blocked'), '#ff9aa7');
            return;
        }
        if (this.hasPendingPlayInFlight()) {
            const reason = this.localizeActionBlockReason('game_reason_action_pending');
            this.floatText(this.tr('game_draw_blocked', { reason }), '#ff9aa7');
            return;
        }
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
        if (this.reconnectActive) {
            this.floatText(this.tr('game_reconnect_action_blocked'), '#ff9aa7');
            return;
        }
        if (this.hasPendingPlayInFlight()) {
            const reason = this.localizeActionBlockReason('game_reason_action_pending');
            this.floatText(this.tr('game_end_turn_blocked', { reason }), '#ff9aa7');
            return;
        }
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
        if (this.reconnectActive) {
            this.floatText(this.tr('game_reconnect_action_blocked'), '#ff9aa7');
            return;
        }
        if (this.hasPendingPlayInFlight()) {
            const reason = this.localizeActionBlockReason('game_reason_action_pending');
            this.floatText(this.tr('game_attack_blocked', { reason }), '#ff9aa7');
            return;
        }
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

        this.serverManager.solveCrisis(String(crisis.id));
        this.floatText(this.tr('game_attack_sent', { cost: attack.cost }), '#9ff3c2');
        this.appendGameLog(this.tr('game_attack_sent_log', { name: getCardDisplayName(crisis, this.lang, this.tr.bind(this)) }));
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
        this.actionPanelContext = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '10px',
            color: '#d9edff',
            fontStyle: '700',
            lineSpacing: 1,
            wordWrap: { width: 280 },
        }).setOrigin(0, 0).setDepth(19);

        this.helpButton = this.add.graphics().setDepth(20);
        this.helpHit = this.add.rectangle(0, 0, 42, 42, 0x000000, 0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });
        this.helpButtonText = this.add.text(0, 0, '?', {
            fontFamily: FONT_UI,
            fontSize: '19px',
            color: '#f7fcff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(22);

        this.emoteButton = this.add.graphics().setDepth(20);
        this.emoteHit = this.add.rectangle(0, 0, 42, 42, 0x000000, 0)
            .setDepth(21)
            .setInteractive({ useHandCursor: true });
        this.emoteButtonText = this.add.text(0, 0, 'EM', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#f7fcff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(22);

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
            this.actionPanelContext,
            this.helpButtonText,
            this.emoteButtonText,
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
        this.cardInspectArtworkMaskShape = this.add.graphics().setDepth(541).setVisible(false);
        this.cardInspectArtworkMask = this.cardInspectArtworkMaskShape.createGeometryMask();
        this.cardInspectArtworkImage.setMask(this.cardInspectArtworkMask);
        this.cardInspectCloseBtn = this.add.graphics().setDepth(543).setVisible(false);
        this.cardInspectCloseHit = this.add.rectangle(0, 0, 44, 44, 0x000000, 0)
            .setDepth(544)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        if (this.cardInspectCloseHit.input) this.cardInspectCloseHit.input.enabled = false;
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

        this.helpOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7)
            .setDepth(532)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.helpOverlay.on('pointerdown', () => this.hideHelpOverlay());
        this.helpPanel = this.add.graphics().setDepth(533).setVisible(false);
        this.helpTitle = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f5f9ff',
            fontStyle: '700',
            align: 'center',
            letterSpacing: 1,
            wordWrap: { width: 700 },
        }).setOrigin(0.5, 0).setDepth(534).setVisible(false);
        this.helpBody = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#dcecff',
            align: 'left',
            lineSpacing: 5,
            wordWrap: { width: 720 },
        }).setOrigin(0.5, 0).setDepth(534).setVisible(false);
        this.helpCloseBtn = this.add.graphics().setDepth(535).setVisible(false);
        this.helpCloseHit = this.add.rectangle(0, 0, 44, 44, 0x000000, 0)
            .setDepth(536)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        if (this.helpCloseHit.input) this.helpCloseHit.input.enabled = false;
        this.helpCloseHit.on('pointerdown', () => this.hideHelpOverlay());
        this.helpCloseLabel = this.add.text(0, 0, 'X', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f8fdff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(537).setVisible(false);

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

        this.reconnectOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.66)
            .setDepth(700)
            .setVisible(false)
            .setInteractive({ useHandCursor: false });
        this.reconnectOverlay.on('pointerdown', () => undefined);

        this.reconnectPanel = this.add.graphics().setDepth(701).setVisible(false);
        this.reconnectTitle = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '24px',
            color: '#f4f9ff',
            fontStyle: '700',
            align: 'center',
            letterSpacing: 1.2,
            wordWrap: { width: 560 },
        }).setOrigin(0.5, 0).setDepth(702).setVisible(false);
        this.reconnectBody = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#dcecff',
            align: 'center',
            lineSpacing: 4,
            wordWrap: { width: 560 },
        }).setOrigin(0.5, 0).setDepth(702).setVisible(false);

        this.boostText(
            this.reactionTitle,
            this.reactionSubtitle,
            this.cardInspectTitle,
            this.cardInspectType,
            this.cardInspectBody,
            this.cardInspectHint,
            this.cardInspectCloseLabel,
            this.helpTitle,
            this.helpBody,
            this.helpCloseLabel,
            this.diceToastText,
            this.reconnectTitle,
            this.reconnectBody,
        );

        this.cardInspectCloseFx?.destroy();
        this.cardInspectCloseFx = createSimpleButtonFx(
            this,
            this.cardInspectCloseHit,
            [this.cardInspectCloseBtn, this.cardInspectCloseLabel],
            { onClick: () => this.hideCardInspect() },
        );

        this.helpCloseFx?.destroy();
        this.helpCloseFx = createSimpleButtonFx(
            this,
            this.helpCloseHit,
            [this.helpCloseBtn, this.helpCloseLabel],
            { onClick: () => this.hideHelpOverlay() },
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
                onClick: () => this.toggleGameLog(),
            },
        );

        this.helpButtonFx = createSimpleButtonFx(
            this,
            this.helpHit,
            [this.helpButton, this.helpButtonText],
            { onClick: () => this.showHelpOverlay() },
        );

        this.emoteButtonFx = createSimpleButtonFx(
            this,
            this.emoteHit,
            [this.emoteButton, this.emoteButtonText],
            { onClick: () => this.sendQuickEmote() },
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

            if (this.reconnectActive) {
                this.snapBack(card, this.tr('game_reconnect_action_blocked'));
                return;
            }

            if (this.hasPendingPlayInFlight() && this.pendingPlayedCard !== card) {
                this.snapBack(card, this.tr('game_action_pending_wait'));
                return;
            }

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
        syncUiRootViewport(this.screenW, this.screenH);

        this.matchLayout = computeMatchLayout(this.screenW, this.screenH);
        this.isLandscapeLayout = this.matchLayout.isLandscape;
        this.uiW = this.matchLayout.content.w;
        this.uiX = this.matchLayout.content.x;
        this.topH = this.matchLayout.topBar.h;
        this.centerH = this.matchLayout.board.h;
        this.handCardsRect = this.matchLayout.handCards;

        this.retroLayerA.setSize(this.screenW, this.screenH);
        this.retroLayerB.setSize(this.screenW, this.screenH);

        this.drawBackground();
        this.layoutPanels();
        this.layoutOverlay();
        this.layoutReconnectDomOverlay();
        this.matchDom?.applyLayout(this.matchLayout);
        this.updateAmbientEmitterBounds();

        const state = this.serverManager?.room?.state as IGameState | undefined;
        if (state && this.serverManager?.room) {
            const me = (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId);
            if (me) this.applyState(state, me);
        }
    }

    private drawBackground() {
        drawPokemonBackdrop(this.bg, this.screenW, this.screenH, 0.58);

        const content = this.matchLayout.content;
        const topBar = this.matchLayout.topBar;
        const board = this.matchLayout.board;
        const hand = this.matchLayout.hand;
        this.bg.fillStyle(0xf6e2b9, 0.14);
        this.bg.fillRect(content.x + 12, topBar.y + topBar.h + 1, content.w - 24, 2);
        if (this.matchLayout.sidebar) {
            this.bg.fillRect(this.matchLayout.sidebar.x - 1, board.y + 6, 2, board.h - 12);
        } else {
            this.bg.fillRect(content.x + 12, hand.y - 1, content.w - 24, 2);
        }
    }

    private updateAmbientEmitterBounds() {
        if (!this.ambientEmitter) return;
        const content = this.matchLayout.content;
        this.ambientEmitter.setConfig({
            x: { min: content.x + 16, max: content.x + content.w - 16 },
            y: { min: content.y + 12, max: content.y + content.h - 18 },
        });
    }

    private layoutPanels() {
        const topRect = this.matchLayout.topBar;
        const boardRect = this.matchLayout.board;
        const handRect = this.matchLayout.hand;
        const sidebarRect = this.matchLayout.sidebar;
        const topY = topRect.y;

        const compactLandscape = this.isCompactLandscapeLayout();
        const compactPortrait = !this.isLandscapeLayout && this.uiW < 470;
        const buttonContract = getButtonContractByTier(this.matchLayout.tier);

        this.showPlayersIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 860 : 520);
        this.showDeckIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 760 : 500);
        this.showApIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 700 : 420);
        this.showStartIcon = !compactLandscape && this.uiW >= (this.isLandscapeLayout ? 1120 : 560);

        this.playersIcon.setVisible(this.showPlayersIcon);
        this.deckIcon.setVisible(this.showDeckIcon);
        this.apIcon.setVisible(this.showApIcon);

        this.topPanel.clear();
        this.topPanel.fillStyle(0x262b37, 0.86);
        this.topPanel.fillRoundedRect(topRect.x + 4, topRect.y + 4, topRect.w - 8, topRect.h - 8, 16);
        this.topPanel.lineStyle(1.1, 0x978369, 0.9);
        this.topPanel.strokeRoundedRect(topRect.x + 4, topRect.y + 4, topRect.w - 8, topRect.h - 8, 16);

        this.centerPanel.clear();
        this.centerPanel.fillStyle(0x1b2130, 0.84);
        this.centerPanel.fillRoundedRect(boardRect.x + 4, boardRect.y + 2, boardRect.w - 8, boardRect.h - 4, 16);
        this.centerPanel.lineStyle(1.1, 0x7188a8, 0.84);
        this.centerPanel.strokeRoundedRect(boardRect.x + 4, boardRect.y + 2, boardRect.w - 8, boardRect.h - 4, 16);

        if (sidebarRect) {
            this.centerPanel.fillStyle(0x1d2636, 0.88);
            this.centerPanel.fillRoundedRect(sidebarRect.x + 2, sidebarRect.y + 2, sidebarRect.w - 4, sidebarRect.h - 4, 14);
            this.centerPanel.lineStyle(1, 0x7a8fad, 0.78);
            this.centerPanel.strokeRoundedRect(sidebarRect.x + 2, sidebarRect.y + 2, sidebarRect.w - 4, sidebarRect.h - 4, 14);
        }

        this.bottomPanel.clear();
        this.bottomPanel.fillStyle(0x202736, 0.92);
        this.bottomPanel.fillRoundedRect(handRect.x + 2, handRect.y + 2, handRect.w - 4, handRect.h - 4, 14);
        this.bottomPanel.lineStyle(1.1, 0x7e96b6, 0.8);
        this.bottomPanel.strokeRoundedRect(handRect.x + 2, handRect.y + 2, handRect.w - 4, handRect.h - 4, 14);

        const topInfoY = compactLandscape
            ? topY + Phaser.Math.Clamp(topRect.h * 0.16, 11, 20)
            : topY + Phaser.Math.Clamp(topRect.h * 0.12, 16, 30);
        const opponentRowY = compactLandscape
            ? topY + Phaser.Math.Clamp(topRect.h * 0.38, 22, topRect.h - 20)
            : topY + Phaser.Math.Clamp(topRect.h * 0.34, 34, topRect.h - 24);
        const showTopTitle = !compactLandscape && !compactPortrait;
        const showTopMeta = !compactLandscape && !(compactPortrait && this.matchLayout.tier === 'A');

        const logDockWidth = (this.gameLogExpanded || this.isLandscapeLayout) ? 0 : (this.matchLayout?.log?.w ?? 0) + 18;
        const topTitleWrap = Phaser.Math.Clamp(
            this.uiW - (this.showPlayersIcon ? 84 : 50) - logDockWidth,
            120,
            this.uiW * (compactLandscape ? 0.56 : 0.7),
        );

        this.topTitle.setVisible(showTopTitle);
        if (showTopTitle) {
            this.topTitle
                .setPosition(this.uiX + (this.showPlayersIcon ? 54 : 18), topInfoY)
                .setWordWrapWidth(topTitleWrap, true)
                .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 19)}px`);
            fitTextToBox(this.topTitle, this.topTitle.text, topTitleWrap, Math.max(20, this.topH * 0.2), { maxLines: 2, ellipsis: true });
        }
        this.roomCodeText
            .setPosition(this.uiX + 14, showTopTitle ? opponentRowY : topInfoY)
            .setOrigin(0, 0.5)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0115, compactLandscape ? 11 : 11, 14)}px`)
            .setVisible(showTopMeta);
        if (showTopMeta) {
            fitTextToBox(this.roomCodeText, this.roomCodeText.text, Math.max(88, this.uiW * 0.25), 16, { maxLines: 1, ellipsis: true });
        }
        if (this.showPlayersIcon) {
            this.playersIcon.setPosition(this.uiX + 28, opponentRowY).setDisplaySize(compactLandscape ? 22 : 26, compactLandscape ? 22 : 26);
        }
        this.opponentsPlaceholder
            .setPosition(this.uiX + this.uiW * 0.5, opponentRowY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0118, compactLandscape ? 11 : 11, 16)}px`);
        if (showTopMeta) {
            fitTextToBox(
                this.opponentsPlaceholder,
                this.opponentsPlaceholder.text,
                Math.max(120, this.uiW - (this.showPlayersIcon ? 120 : 86)),
                Math.max(16, this.topH * 0.18),
                { maxLines: 1, ellipsis: true },
            );
        } else {
            this.opponentsPlaceholder.setVisible(false);
        }
        this.layoutHud(compactLandscape);

        const centerTop = boardRect.y + (this.isLandscapeLayout ? (compactLandscape ? 8 : 12) : 14);
        const centerTitleY = centerTop + 2;
        const crisisTitleY = centerTop + Phaser.Math.Clamp(boardRect.h * (compactLandscape ? 0.18 : 0.3), compactLandscape ? 28 : 52, 98);

        this.centerTitle
            .setPosition(this.uiX + this.uiW * 0.5, centerTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.014, 12, 17)}px`);
        this.centerTitle.setVisible(!compactPortrait && !compactLandscape);
        this.turnText.setVisible(false);

        this.centerDropW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(boardRect.w * (compactLandscape ? 0.64 : 0.58), 220, 620)
            : Phaser.Math.Clamp(boardRect.w * 0.86, 280, 580);
        this.centerDropH = this.isLandscapeLayout
            ? Phaser.Math.Clamp(boardRect.h * (compactLandscape ? 0.46 : 0.36), 98, compactLandscape ? 198 : 176)
            : Phaser.Math.Clamp(boardRect.h * 0.42, 124, 230);
        this.centerDropX = boardRect.x + boardRect.w * 0.5;
        this.centerDropY = boardRect.y + boardRect.h * (this.isLandscapeLayout ? (compactLandscape ? 0.55 : 0.58) : 0.56);

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

        this.crisisTitle.setPosition(boardRect.x + boardRect.w * 0.5, crisisTitleY).setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);
        this.companyTitle
            .setPosition(boardRect.x + boardRect.w * 0.5, boardRect.y + boardRect.h - Phaser.Math.Clamp(boardRect.h * (compactLandscape ? 0.1 : 0.13), 20, 34))
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.011, 11, 14)}px`);
        this.crisisTitle.setVisible((!compactPortrait || boardRect.h > 250) && !compactLandscape);
        this.companyTitle.setVisible((!compactPortrait || boardRect.h > 250) && !compactLandscape);

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
        const endH = Math.max(buttonContract.primaryHeight, Phaser.Math.Clamp(deckH * 0.44, 40, 56));
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
        const lobbyY = boardRect.y + boardRect.h * 0.56;

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
        const readyH = Math.max(buttonContract.primaryHeight, Phaser.Math.Clamp(lobbyH * 0.2, 40, 56));
        const readyY = lobbyY + lobbyH * 0.34;
        this.readyHit.setPosition(lobbyX, readyY).setSize(readyW, readyH);
        this.readyButton.setPosition(lobbyX, readyY);
        this.readyButtonText
            .setPosition(lobbyX, readyY)
            .setFontSize(`${Phaser.Math.Clamp(readyW * 0.08, 13, 17)}px`);
        this.startIcon.setPosition(lobbyX - readyW * 0.36, readyY).setDisplaySize(20, 20);

        const handTitleY = controls.y + Phaser.Math.Clamp(controls.h * 0.2, 12, 18);
        const apY = controls.y + Phaser.Math.Clamp(controls.h * 0.43, 24, 34);
        const compactControls = compactLandscape || controls.w < 280;
        const showInlineApIcon = this.showApIcon && controls.w >= 240;
        this.handTitle
            .setPosition(controls.x + 14, handTitleY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * (compactControls ? 0.0102 : 0.012), 11, 16)}px`);
        this.paLabel
            .setPosition(controls.x + (showInlineApIcon ? 42 : 14), apY)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * (compactControls ? 0.0095 : 0.0105), 11, 14)}px`);
        if (showInlineApIcon) {
            this.apIcon.setPosition(controls.x + 20, apY + 2).setDisplaySize(18, 18).setVisible(true);
        } else {
            this.apIcon.setVisible(false);
        }
        const orbStart = controls.x + (showInlineApIcon ? 106 : 44);
        const orbGap = Phaser.Math.Clamp(this.uiW * (compactControls ? 0.013 : 0.018), compactControls ? 17 : 22, compactControls ? 22 : 28);
        this.paOrbs.forEach((orb, index) => orb.setPosition(orbStart + index * orbGap, apY + 2));

        const actionLeft = controls.x + 10;
        const actionRight = endX - endW * 0.5 - 12;
        const actionAvailable = Math.max(0, actionRight - actionLeft);
        const actionW = actionAvailable >= 110
            ? Phaser.Math.Clamp(actionAvailable, 110, this.isLandscapeLayout ? 540 : 420)
            : actionAvailable;
        const actionH = Math.max(46, controls.h - 10);
        const actionY = controls.y + 5;
        const showActionPanel = actionW >= 118;
        const compactPortraitAction = !this.isLandscapeLayout && (this.matchLayout.tier === 'A' || this.matchLayout.tier === 'B');
        const compactAction = (compactLandscape || controls.w < 270 || compactPortraitAction) && showActionPanel;
        const actionWrap = Math.max(80, actionW - 62);
        this.actionPanel.clear();
        if (showActionPanel) {
            this.actionPanel.fillStyle(0x1a2736, 0.92);
            this.actionPanel.fillRoundedRect(actionLeft, actionY, actionW, actionH, 10);
            this.actionPanel.lineStyle(1, 0x89a8c7, 0.72);
            this.actionPanel.strokeRoundedRect(actionLeft, actionY, actionW, actionH, 10);
        }

        this.actionPanelTitle
            .setPosition(actionLeft + 10, actionY + 10)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, compactLandscape ? 11 : 10, 12)}px`)
            .setVisible(showActionPanel && !compactAction);
        this.actionPanelHint
            .setPosition(actionLeft + 10, actionY + (compactAction ? 8 : 20))
            .setWordWrapWidth(actionWrap, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, compactLandscape ? 11 : 10, 13)}px`)
            .setVisible(showActionPanel);
        this.actionPanelDetail
            .setPosition(actionLeft + 10, actionY + actionH * 0.56)
            .setWordWrapWidth(actionWrap, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0088, compactLandscape ? 11 : 9, 12)}px`)
            .setVisible(showActionPanel && !compactAction);
        this.actionPanelContext
            .setPosition(actionLeft + 10, actionY + (compactAction ? actionH - 12 : actionH - 18))
            .setWordWrapWidth(actionWrap, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0082, compactLandscape ? 11 : 8, 11)}px`)
            .setVisible(showActionPanel && !compactAction);

        const helpSize = Phaser.Math.Clamp(actionH * 0.5, 34, 42);
        const helpX = showActionPanel
            ? actionLeft + actionW - helpSize * 0.5 - 8
            : endX - endW * 0.5 - helpSize * 0.5 - 8;
        const helpY = showActionPanel ? actionY + helpSize * 0.5 + 3 : controlsY;
        this.helpHit.setSize(helpSize, helpSize).setPosition(helpX, helpY).setVisible(true);
        this.helpButton.setPosition(helpX, helpY).setVisible(true);
        this.helpButtonText
            .setPosition(helpX, helpY - 1)
            .setFontSize(`${Phaser.Math.Clamp(helpSize * 0.48, 14, 22)}px`)
            .setVisible(true);
        this.drawHelpButton(true);

        const showEmoteButton = showActionPanel && actionW >= 210;
        const emoteX = helpX - helpSize - 8;
        const emoteY = helpY;
        this.emoteHit.setSize(helpSize, helpSize).setPosition(emoteX, emoteY).setVisible(showEmoteButton);
        this.emoteButton.setPosition(emoteX, emoteY).setVisible(showEmoteButton);
        this.emoteButtonText
            .setPosition(emoteX, emoteY)
            .setFontSize(`${Phaser.Math.Clamp(helpSize * 0.28, 9, 13)}px`)
            .setVisible(showEmoteButton);
        if (this.emoteHit.input) this.emoteHit.input.enabled = showEmoteButton;
        this.drawEmoteButton(showEmoteButton);

        this.handCardsRect = {
            ...this.matchLayout.handCards,
        };

        this.layoutGameLog();
        this.layoutDebugOverlay();

        this.drawDeckButton(false);
        this.drawEndButton(false);
        this.drawReadyButton(false);
        this.syncCanvasUiForDomMode();
    }

    private syncCanvasUiForDomMode() {
        if (!this.useDomMatchUi) return;
        const hideCanvasUi = !this.isPreLobbyPhase(this.serverManager?.room?.state?.phase);
        if (!hideCanvasUi) return;

        const hide = (obj?: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible) => obj?.setVisible(false);
        hide(this.topPanel);
        hide(this.topTitle);
        hide(this.roomCodeText);
        hide(this.opponentsPlaceholder);
        hide(this.hudPanel);
        hide(this.hudTurnText);
        hide(this.hudStatsText);
        hide(this.hudStateText);
        hide(this.hudReactionText);
        hide(this.deckButton);
        hide(this.deckHit);
        hide(this.deckLabel);
        hide(this.deckCountText);
        hide(this.deckIcon);
        hide(this.endButton);
        hide(this.endHit);
        hide(this.endButtonText);
        hide(this.handTitle);
        hide(this.paLabel);
        hide(this.actionPanel);
        hide(this.actionPanelTitle);
        hide(this.actionPanelHint);
        hide(this.actionPanelDetail);
        hide(this.actionPanelContext);
        hide(this.helpButton);
        hide(this.helpHit);
        hide(this.helpButtonText);
        hide(this.emoteButton);
        hide(this.emoteHit);
        hide(this.emoteButtonText);
        hide(this.gameLogPanel);
        hide(this.gameLogTitle);
        hide(this.gameLogBody);
        hide(this.gameLogToggleBg);
        hide(this.gameLogToggleHit);
        hide(this.gameLogToggleLabel);

        if (this.deckHit.input) this.deckHit.input.enabled = false;
        if (this.endHit.input) this.endHit.input.enabled = false;
        if (this.helpHit.input) this.helpHit.input.enabled = false;
        if (this.emoteHit.input) this.emoteHit.input.enabled = false;
        if (this.gameLogToggleHit.input) this.gameLogToggleHit.input.enabled = false;
    }

    private layoutHud(compactLandscape: boolean) {
        const hudRect = this.matchLayout.hud;
        const hudW = Math.max(120, hudRect.w);
        const compactHud = compactLandscape || this.uiW < 560 || this.matchLayout.tier === 'C';
        const hudH = Math.max(28, hudRect.h);
        const hudX = hudRect.x;
        const hudY = hudRect.y;

        this.hudPanel.clear();
        this.hudPanel.fillStyle(0x1a2838, 0.9);
        this.hudPanel.fillRoundedRect(hudX, hudY, hudW, hudH, 10);
        this.hudPanel.lineStyle(1, 0x7da0bf, 0.75);
        this.hudPanel.strokeRoundedRect(hudX, hudY, hudW, hudH, 10);

        const padX = Phaser.Math.Clamp(this.uiW * 0.012, 10, 18);
        const leftX = hudX + padX;
        const rightX = hudX + hudW - padX;
        const line1Y = hudY + (compactHud ? hudH * 0.5 : hudH * 0.37);
        const line2Y = hudY + hudH * 0.74;

        this.hudTurnText
            .setPosition(leftX, line1Y)
            .setWordWrapWidth(hudW * (compactHud ? 0.58 : 0.48), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * (compactHud ? 0.0112 : 0.0108), 10, compactHud ? 15 : 14)}px`);
        fitTextToBox(this.hudTurnText, this.hudTurnText.text, hudW * (compactHud ? 0.58 : 0.48), hudH * 0.44, {
            maxLines: compactHud ? 1 : 2,
            ellipsis: true,
        });
        this.hudReactionText
            .setPosition(rightX, line1Y)
            .setWordWrapWidth(hudW * (compactHud ? 0.38 : 0.44), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.01, 9, 13)}px`);
        fitTextToBox(this.hudReactionText, this.hudReactionText.text, hudW * (compactHud ? 0.38 : 0.44), hudH * 0.44, {
            maxLines: 1,
            ellipsis: true,
        });
        this.hudStatsText
            .setPosition(leftX, line2Y)
            .setWordWrapWidth(hudW * 0.7, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0098, 9, 13)}px`);
        fitTextToBox(this.hudStatsText, this.hudStatsText.text, hudW * 0.7, hudH * 0.42, {
            maxLines: compactHud ? 1 : 2,
            ellipsis: true,
        });
        this.hudStateText
            .setPosition(rightX, line2Y)
            .setOrigin(1, 0.5)
            .setWordWrapWidth(hudW * 0.3, true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0094, 9, 12)}px`);
        fitTextToBox(this.hudStateText, this.hudStateText.text, hudW * 0.3, hudH * 0.42, {
            maxLines: 1,
            ellipsis: true,
        });

        if (compactHud) {
            this.hudStatsText.setVisible(false);
            this.hudStateText.setVisible(false);
            this.hudReactionText.setVisible(this.hudReactionText.text.trim().length > 0);
        } else {
            this.hudStatsText.setVisible(true);
            this.hudStateText.setVisible(true);
            this.hudReactionText.setVisible(true);
        }
    }

    private layoutGameLog() {
        const log = this.matchLayout?.log;
        if (!log) return;
        if (!this.isLandscapeLayout) {
            // Keep portrait mode clean and deterministic: avoid expanded log panels over board/controls.
            this.gameLogExpanded = false;
        }
        const domDrivenLog = this.useDomMatchUi && !this.isPreLobbyPhase(this.serverManager?.room?.state?.phase);
        if (domDrivenLog) {
            this.gameLogPanel.setVisible(false);
            this.gameLogTitle.setVisible(false);
            this.gameLogBody.setVisible(false);
            this.gameLogToggleBg.setVisible(false);
            this.gameLogToggleHit.setVisible(false);
            this.gameLogToggleLabel.setVisible(false);
            if (this.gameLogToggleHit.input) this.gameLogToggleHit.input.enabled = false;
            return;
        }
        if (!this.isLandscapeLayout) {
            // Portrait hotfix: hide floating game log to prevent overlap with controls + hand.
            this.gameLogPanel.setVisible(false);
            this.gameLogTitle.setVisible(false);
            this.gameLogBody.setVisible(false);
            this.gameLogToggleBg.setVisible(false);
            this.gameLogToggleHit.setVisible(false);
            this.gameLogToggleLabel.setVisible(false);
            if (this.gameLogToggleHit.input) this.gameLogToggleHit.input.enabled = false;
            return;
        }

        const content = this.matchLayout.content;

        const pad = 8;
        const compactPortrait = !this.isLandscapeLayout && this.uiW < 470;
        const compactLandscape = this.isCompactLandscapeLayout();
        if (compactLandscape && this.gameLogExpanded) {
            this.gameLogExpanded = false;
        }
        // Keep portrait log docked to top/log slot so it never overlays action controls.
        const tinyPortraitDock = false;
        const collapsedW = Phaser.Math.Clamp(
            tinyPortraitDock ? this.matchLayout.controls.w * 0.46 : log.w,
            this.isLandscapeLayout ? (compactLandscape ? 168 : 220) : (tinyPortraitDock ? 146 : 180),
            this.isLandscapeLayout ? (compactLandscape ? 280 : 340) : (tinyPortraitDock ? 210 : 500),
        );
        const collapsedH = Phaser.Math.Clamp(
            tinyPortraitDock ? this.matchLayout.controls.h * 0.58 : log.h,
            compactLandscape ? 30 : (tinyPortraitDock ? 30 : 36),
            compactLandscape ? 44 : (tinyPortraitDock ? 40 : 52),
        );
        const expandedW = Phaser.Math.Clamp(content.w * (this.isLandscapeLayout ? 0.56 : 0.9), 280, 760);
        const expandedH = Phaser.Math.Clamp(this.matchLayout.board.h * (this.isLandscapeLayout ? 0.72 : 0.56), 180, 360);
        const logH = this.gameLogExpanded ? expandedH : collapsedH;
        const compactDockX = this.matchLayout.controls.x + this.matchLayout.controls.w - collapsedW - 8;
        const compactDockY = this.matchLayout.controls.y + this.matchLayout.controls.h - collapsedH - 4;
        const x = this.gameLogExpanded
            ? content.x + (content.w - expandedW) * 0.5
            : (tinyPortraitDock
                ? compactDockX
                : log.x + Math.max(0, log.w - collapsedW));
        const y = this.gameLogExpanded
            ? this.matchLayout.board.y + Math.max(8, this.matchLayout.board.h * 0.08)
            : (
                compactLandscape
                    ? log.y
                    : (tinyPortraitDock ? compactDockY : log.y)
            );
        const w = this.gameLogExpanded ? expandedW : collapsedW;
        const headerH = this.gameLogExpanded ? 28 : collapsedH;

        this.gameLogPanel.clear();
        this.gameLogPanel.fillStyle(0x162435, this.gameLogExpanded ? 0.96 : 0.92);
        this.gameLogPanel.fillRoundedRect(x, y, w, logH, 10);
        this.gameLogPanel.lineStyle(1, 0x7ea3c8, this.gameLogExpanded ? 0.9 : 0.75);
        this.gameLogPanel.strokeRoundedRect(x, y, w, logH, 10);

        const toggleW = Phaser.Math.Clamp(w * (this.gameLogExpanded ? 0.18 : 0.24), 68, 100);
        const toggleH = this.gameLogExpanded ? 18 : (compactLandscape ? 18 : 20);
        const toggleX = x + w - toggleW - pad;
        const toggleY = y + (this.gameLogExpanded ? 6 : (logH - toggleH) * 0.5);

        this.gameLogTitle
            .setPosition(x + pad, y + headerH * 0.52)
            .setWordWrapWidth(Math.max(90, w - toggleW - pad * 3), true)
            .setFontSize(this.gameLogExpanded
                ? `${Phaser.Math.Clamp(this.uiW * 0.0105, 10, 14)}px`
                : `${Phaser.Math.Clamp(this.uiW * 0.0096, compactLandscape ? 11 : 9, 12)}px`);
        this.gameLogTitle.setText(this.tr('game_log_title'));
        fitTextToBox(
            this.gameLogTitle,
            this.gameLogTitle.text,
            Math.max(90, w - toggleW - pad * 3),
            Math.max(16, headerH - 8),
            { maxLines: 1, ellipsis: true },
        );

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
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0088, compactLandscape ? 11 : 9, 11)}px`)
            .setText(this.gameLogExpanded ? this.tr('game_log_less') : this.tr('game_log_more'));

        const showCollapsedBody = !this.gameLogExpanded && !this.isLandscapeLayout && !tinyPortraitDock && (!compactPortrait || this.uiW > 420);
        const bodyY = this.gameLogExpanded ? y + headerH + 2 : y + logH * 0.5;
        const maxBodyH = Math.max(0, logH - headerH - pad);
        const maxLines = compactLandscape
            ? (this.gameLogExpanded ? 2 : 1)
            : (this.gameLogExpanded ? Math.max(2, Math.floor(maxBodyH / 15)) : 1);
        const rendered = this.gameLogEntries.slice(-maxLines).join('\n');

        this.gameLogBody
            .setPosition(x + pad, bodyY)
            .setOrigin(0, this.gameLogExpanded ? 0 : 0.5)
            .setWordWrapWidth(this.gameLogExpanded ? (w - (pad * 2)) : Math.max(80, w - (pad * 2) - toggleW - 8), true)
            .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0096, compactLandscape ? 11 : 9, 12)}px`)
            .setVisible(this.gameLogExpanded ? maxBodyH > 10 : showCollapsedBody && rendered.length > 0)
            .setText(rendered.length > 0 ? rendered : this.tr('game_log_empty'));

        if (!this.gameLogExpanded && showCollapsedBody) {
            this.gameLogBody.setText((this.gameLogEntries[this.gameLogEntries.length - 1] ?? this.tr('game_log_empty')).replace(/\n/g, ' '));
            fitTextToBox(this.gameLogBody, this.gameLogBody.text, Math.max(80, w - (pad * 2) - toggleW - 8), 18, {
                maxLines: 1,
                ellipsis: true,
            });
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
            this.toLayoutRect(this.helpHit.getBounds()),
            this.toLayoutRect(this.emoteHit.getBounds()),
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
        this.layoutHelpOverlay();
        this.layoutCardInspectOverlay();
        this.layoutDiceToast();
        this.layoutReconnectOverlay();
        this.layoutReconnectDomOverlay();
    }

    private createReconnectDomOverlay() {
        const root = ensureUiRoot();
        if (!root) return;

        removeUiRootChildById('game-reconnect-overlay');

        const panel = document.createElement('div');
        panel.id = 'game-reconnect-overlay';
        panel.className = 'ui-reconnect-overlay';

        const title = document.createElement('p');
        title.className = 'ui-reconnect-title';
        title.textContent = this.tr('game_reconnect_title');

        const body = document.createElement('p');
        body.className = 'ui-reconnect-body';
        body.textContent = this.tr('game_reconnect_body', { attempt: 1, seconds: 30, retry: this.tr('game_reconnect_retry_now') });

        panel.appendChild(title);
        panel.appendChild(body);
        root.appendChild(panel);

        this.reconnectDomNode = panel;
        this.reconnectDomTitle = title;
        this.reconnectDomBody = body;
        this.layoutReconnectDomOverlay();
    }

    private createMatchDomOverlay() {
        if (!this.useDomMatchUi) return;
        const root = ensureUiRoot();
        if (!root) return;
        this.matchDom?.destroy();
        this.matchDom = new MatchUiDom(this.lang, {
            onDraw: () => this.tryDrawCard(),
            onEndTurn: () => this.tryEndTurn(),
            onDetails: () => this.showActionDetailsOverlay(),
            onToggleLog: () => this.toggleGameLog(),
            onHelp: () => this.showHelpOverlay(),
            onEmote: () => this.sendQuickEmote(),
        });
        this.matchDom.setVisible(true);
        if (this.matchLayout) {
            this.matchDom.applyLayout(this.matchLayout);
        }
    }

    private layoutReconnectDomOverlay() {
        const node = this.reconnectDomNode;
        if (!node) return;
        const compactLandscape = this.isCompactLandscapeLayout();
        if (compactLandscape) {
            node.style.width = 'min(64vw, 520px)';
        } else if (this.matchLayout?.tier === 'D' || this.matchLayout?.tier === 'E') {
            node.style.width = 'min(62vw, 620px)';
        } else {
            node.style.width = 'min(92vw, 560px)';
        }
    }

    private setReconnectDomVisible(visible: boolean, title?: string, body?: string) {
        if (!this.reconnectDomNode) return;
        if (title && this.reconnectDomTitle) this.reconnectDomTitle.textContent = title;
        if (body && this.reconnectDomBody) this.reconnectDomBody.textContent = body;
        this.reconnectDomNode.classList.toggle('active', visible);
    }

    private layoutReconnectOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;
        const panelW = Phaser.Math.Clamp(this.screenW * (this.isLandscapeLayout ? 0.52 : 0.88), 260, 560);
        const panelH = Phaser.Math.Clamp(this.screenH * (this.isLandscapeLayout ? 0.34 : 0.26), 132, 240);
        const panelX = cx - panelW * 0.5;
        const panelY = cy - panelH * 0.5;

        this.reconnectOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);
        this.reconnectPanel.clear();
        this.reconnectPanel.fillStyle(0x1d2b3b, 0.97);
        this.reconnectPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
        this.reconnectPanel.fillStyle(0xffffff, 0.08);
        this.reconnectPanel.fillRoundedRect(panelX + 3, panelY + 3, panelW - 6, 40, { tl: 14, tr: 14, bl: 0, br: 0 });
        this.reconnectPanel.lineStyle(1.8, 0xb9d5ef, 0.92);
        this.reconnectPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);

        this.reconnectTitle
            .setPosition(cx, panelY + 18)
            .setWordWrapWidth(panelW - 30)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.052, 16, 26)}px`);
        fitTextToBox(this.reconnectTitle, this.reconnectTitle.text, panelW - 30, 52, { maxLines: 2, ellipsis: true });

        const bodyY = panelY + 68;
        const bodyH = panelH - 80;
        this.reconnectBody
            .setPosition(cx, bodyY)
            .setWordWrapWidth(panelW - 36)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.028, 12, 15)}px`);
        fitTextToBox(this.reconnectBody, this.reconnectBody.text, panelW - 36, bodyH, { maxLines: 4, ellipsis: true });

        if (!this.reconnectActive) {
            this.reconnectOverlay.setVisible(false);
            this.reconnectPanel.setVisible(false);
            this.reconnectTitle.setVisible(false);
            this.reconnectBody.setVisible(false);
        }
    }

    private layoutHelpOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;
        const panelW = Phaser.Math.Clamp(this.screenW * (this.isLandscapeLayout ? 0.72 : 0.94), 300, 860);
        const panelH = Phaser.Math.Clamp(this.screenH * (this.isLandscapeLayout ? 0.82 : 0.9), 280, 760);
        const panelX = cx - panelW * 0.5;
        const panelY = cy - panelH * 0.5;

        this.helpOverlay.setPosition(cx, cy).setSize(this.screenW, this.screenH);

        this.helpPanel.clear();
        this.helpPanel.fillStyle(0x1b2b3d, 0.97);
        this.helpPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
        this.helpPanel.fillStyle(0xffffff, 0.08);
        this.helpPanel.fillRoundedRect(panelX + 3, panelY + 3, panelW - 6, 40, { tl: 16, tr: 16, bl: 0, br: 0 });
        this.helpPanel.lineStyle(2, 0xbad5ee, 0.92);
        this.helpPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
        this.helpPanel.lineStyle(1, 0x92acc2, 0.22);
        this.helpPanel.strokeRoundedRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 16);

        const closeSize = Phaser.Math.Clamp(panelW * 0.05, 30, 40);
        const closeCx = panelX + panelW - closeSize * 0.5 - 14;
        const closeCy = panelY + closeSize * 0.5 + 12;
        this.helpCloseBtn.clear();
        this.helpCloseBtn.fillStyle(0x2d4257, 0.98);
        this.helpCloseBtn.fillCircle(closeCx, closeCy, closeSize * 0.5);
        this.helpCloseBtn.lineStyle(2, 0xf0f8ff, 0.95);
        this.helpCloseBtn.strokeCircle(closeCx, closeCy, closeSize * 0.5);
        this.helpCloseHit
            .setPosition(closeCx, closeCy)
            .setSize(closeSize + 14, closeSize + 14);
        this.helpCloseLabel
            .setPosition(closeCx, closeCy - 1)
            .setFontSize(`${Phaser.Math.Clamp(closeSize * 0.56, 18, 24)}px`);

        this.helpTitle
            .setPosition(cx, panelY + 16)
            .setWordWrapWidth(panelW - 60)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.036, 18, 30)}px`);
        fitTextToBox(this.helpTitle, this.helpTitle.text, panelW - 60, 46, {
            maxLines: 2,
            ellipsis: true,
        });

        const bodyY = panelY + 66;
        const bodyMaxH = panelH - 82;
        this.helpBody
            .setPosition(cx, bodyY)
            .setWordWrapWidth(panelW - 44)
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.019, 12, 17)}px`);
        fitTextToBox(this.helpBody, this.helpBody.text, panelW - 44, bodyMaxH, {
            maxLines: Math.max(6, Math.floor(bodyMaxH / Phaser.Math.Clamp(panelW * 0.021, 18, 28))),
            ellipsis: true,
        });

        if (!this.helpVisible) {
            this.helpPanel.setVisible(false);
            this.helpTitle.setVisible(false);
            this.helpBody.setVisible(false);
            this.helpCloseBtn.setVisible(false);
            this.helpCloseHit.setVisible(false);
            this.helpCloseLabel.setVisible(false);
        }
    }

    private layoutCardInspectOverlay() {
        const cx = this.screenW * 0.5;
        const cy = this.screenH * 0.5;
        const safePad = this.isLandscapeLayout ? 18 : 12;
        const maxPanelW = Math.max(280, this.screenW - safePad * 2);
        const maxPanelH = Math.max(280, this.screenH - safePad * 2);
        const panelW = this.isLandscapeLayout
            ? Phaser.Math.Clamp(Math.min(this.screenW * 0.7, 760), 360, maxPanelW)
            : Phaser.Math.Clamp(Math.min(this.screenW * 0.92, 420), 300, maxPanelW);
        const panelH = Phaser.Math.Clamp(this.screenH * 0.88, 320, maxPanelH);
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

        const textureRatio = this.getInspectArtworkRatio();
        const artPad = this.isLandscapeLayout ? 22 : 20;
        const artMaxW = panelW - 36;
        const artMinW = Phaser.Math.Clamp(panelW * (this.isLandscapeLayout ? 0.42 : 0.62), 220, artMaxW);
        const artMaxH = Phaser.Math.Clamp(panelH * (this.isLandscapeLayout ? 0.41 : 0.39), 170, 260);
        const artMinH = Phaser.Math.Clamp(panelH * (this.isLandscapeLayout ? 0.2 : 0.22), 150, 220);
        const headerBottomY = panelY + Phaser.Math.Clamp(panelH * 0.205, 78, 138);

        let artH = Phaser.Math.Clamp((artMaxW - artPad) / textureRatio + artPad, artMinH, artMaxH);
        let artW = Phaser.Math.Clamp((artH - artPad) * textureRatio + artPad, artMinW, artMaxW);

        const minBodyH = Phaser.Math.Clamp(panelH * 0.28, 96, 220);
        const hintY = panelY + panelH - 14;
        let artY = headerBottomY;
        let bodyY = artY + artH + 18;
        let bodyMaxH = hintY - bodyY - 10;
        if (bodyMaxH < minBodyH) {
            const reduceBy = Math.min(minBodyH - bodyMaxH, artH - artMinH);
            artH -= reduceBy;
            artW = Phaser.Math.Clamp((artH - artPad) * textureRatio + artPad, artMinW, artMaxW);
            bodyY = artY + artH + 18;
            bodyMaxH = hintY - bodyY - 10;
        }
        bodyMaxH = Math.max(84, bodyMaxH);
        const artX = panelX + (panelW - artW) * 0.5;

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
        this.cardInspectArtworkMaskShape.clear();
        this.cardInspectArtworkMaskShape.fillStyle(0xffffff, 1);
        this.cardInspectArtworkMaskShape.fillRoundedRect(artX + 5, artY + 5, Math.max(1, artW - 10), Math.max(1, artH - 10), 10);
        this.cardInspectArtworkMaskShape.setVisible(this.cardInspectVisible || this.cardInspectAnimating);
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
            .setPosition(cx, bodyY)
            .setWordWrapWidth(panelW - 38)
            .setLineSpacing(4)
            .setColor('#2a2f37')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.019, 14, 21)}px`);
        fitTextToBox(this.cardInspectBody, this.cardInspectBody.text, panelW - 38, bodyMaxH, {
            maxLines: Math.max(3, Math.floor(bodyMaxH / Phaser.Math.Clamp(panelW * 0.019 * 1.28, 18, 28))),
            ellipsis: true,
        });
        this.cardInspectHint
            .setPosition(cx, hintY)
            .setColor('#4b6075')
            .setFontSize(`${Phaser.Math.Clamp(panelW * 0.014, 11, 14)}px`);

        if (!this.cardInspectVisible && !this.cardInspectAnimating) {
            this.cardInspectPanel.setVisible(false);
            this.cardInspectArtwork.setVisible(false);
            this.cardInspectArtworkImage.setVisible(false);
            this.cardInspectArtworkMaskShape.setVisible(false);
            this.cardInspectCloseBtn.setVisible(false);
            this.cardInspectCloseHit.setVisible(false);
            this.cardInspectCloseLabel.setVisible(false);
        }
    }

    private getInspectArtworkRatio(): number {
        if (!this.inspectedCard) return 1.35;
        const textureKey = resolveCardArtworkTexture(this, this.inspectedCard);
        if (!textureKey || !this.textures.exists(textureKey)) return 1.35;
        const sourceImage = this.textures.get(textureKey)?.getSourceImage() as { width?: number; height?: number } | undefined;
        const sourceW = Number(sourceImage?.width ?? 0);
        const sourceH = Number(sourceImage?.height ?? 0);
        if (!Number.isFinite(sourceW) || !Number.isFinite(sourceH) || sourceW <= 0 || sourceH <= 0) {
            return 1.35;
        }
        return Phaser.Math.Clamp(sourceW / sourceH, 0.65, 1.9);
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
        const scale = Math.min((artW - 10) / sourceW, (artH - 10) / sourceH);
        if (!Number.isFinite(scale) || scale <= 0) {
            this.cardInspectArtworkImage.setVisible(false);
            return;
        }
        this.cardInspectArtworkImage.setDisplaySize(
            Math.max(1, Math.floor(sourceW * scale)),
            Math.max(1, Math.floor(sourceH * scale)),
        );
        this.cardInspectArtworkImage.setVisible(this.cardInspectVisible || this.cardInspectAnimating);
    }

    private layoutDiceToast() {
        const toastW = Phaser.Math.Clamp(this.uiW * (this.isLandscapeLayout ? 0.42 : 0.9), 240, 540);
        const lineCount = Math.max(1, String(this.diceToastText?.text ?? '').split('\n').length);
        const dynamicHeight = this.screenH * 0.1 + lineCount * 14;
        const toastH = Phaser.Math.Clamp(dynamicHeight, 66, 148);
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
        if (this.helpVisible) this.hideHelpOverlay();
        this.matchDom?.setInteractionEnabled(false);
        if (this.cardInspectCloseTween) {
            this.cardInspectCloseTween.stop();
            this.cardInspectCloseTween = undefined;
        }
        if (this.cardInspectOpenTween) {
            this.cardInspectOpenTween.stop();
            this.cardInspectOpenTween = undefined;
        }

        this.inspectedCard = card;
        const presentation = buildInspectPresentation(card, this.lang, this.tr.bind(this));
        this.cardInspectTitle.setText(presentation.title);
        this.cardInspectType.setText(presentation.meta);
        this.cardInspectBody.setText(presentation.lines.join('\n\n'));
        this.cardInspectHint.setText(this.tr('game_close_hint'));

        this.cardInspectVisible = true;
        this.cardInspectAnimating = true;
        this.cardInspectOverlay.setVisible(true).setAlpha(0);
        this.cardInspectPanel.setVisible(true);
        this.cardInspectArtwork.setVisible(true);
        this.cardInspectArtworkMaskShape.setVisible(true);
        this.cardInspectArtworkImage.setVisible(false).setAlpha(0);
        this.cardInspectCloseBtn.setVisible(true);
        this.cardInspectCloseHit.setVisible(true);
        if (this.cardInspectCloseHit.input) this.cardInspectCloseHit.input.enabled = true;
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

        const panelTargets: Array<Phaser.GameObjects.GameObject & { alpha: number; scaleX: number; scaleY: number }> = [
            this.cardInspectPanel,
            this.cardInspectArtwork,
        ];
        panelTargets.forEach((target) => {
            target.alpha = 0;
            target.scaleX = 0.965;
            target.scaleY = 0.965;
        });

        const textTargets: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [
            this.cardInspectCloseBtn,
            this.cardInspectCloseLabel,
            this.cardInspectTitle,
            this.cardInspectType,
            this.cardInspectBody,
            this.cardInspectHint,
        ];
        textTargets.forEach((target) => {
            target.alpha = 0;
        });
        this.cardInspectArtworkImage.alpha = 0;

        this.tweens.add({
            targets: this.cardInspectOverlay,
            alpha: 0.72,
            duration: 140,
            ease: 'Sine.Out',
        });

        this.tweens.add({
            targets: [...textTargets, this.cardInspectArtworkImage],
            alpha: 1,
            duration: 190,
            ease: 'Cubic.Out',
        });

        this.cardInspectOpenTween = this.tweens.add({
            targets: panelTargets,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 190,
            ease: 'Cubic.Out',
            onComplete: () => {
                this.cardInspectAnimating = false;
            },
        });
    }

    private hideCardInspect() {
        if (!this.cardInspectVisible && !this.cardInspectAnimating) return;
        if (this.cardInspectOpenTween) {
            this.cardInspectOpenTween.stop();
            this.cardInspectOpenTween = undefined;
        }

        this.cardInspectVisible = false;
        this.cardInspectCloseHit.setVisible(false);
        if (this.cardInspectCloseHit.input) this.cardInspectCloseHit.input.enabled = false;
        this.cardInspectAnimating = true;

        const panelFadeTargets: Array<Phaser.GameObjects.GameObject & { alpha: number; scaleX?: number; scaleY?: number }> = [
            this.cardInspectPanel,
            this.cardInspectArtwork,
            this.cardInspectArtworkMaskShape,
        ];
        const textFadeTargets: Array<Phaser.GameObjects.GameObject & { alpha: number }> = [
            this.cardInspectArtworkImage,
            this.cardInspectCloseBtn,
            this.cardInspectCloseLabel,
            this.cardInspectTitle,
            this.cardInspectType,
            this.cardInspectBody,
            this.cardInspectHint,
        ];

        this.tweens.add({
            targets: textFadeTargets,
            alpha: 0,
            duration: 130,
            ease: 'Sine.In',
        });

        this.cardInspectCloseTween = this.tweens.add({
            targets: panelFadeTargets,
            alpha: 0,
            scaleX: 0.97,
            scaleY: 0.97,
            duration: 150,
            ease: 'Sine.In',
            onComplete: () => {
                this.cardInspectOverlay.setVisible(false).setAlpha(1);
                this.cardInspectPanel.setVisible(false).setAlpha(1).setScale(1);
                this.cardInspectArtwork.setVisible(false).setAlpha(1).setScale(1);
                this.cardInspectArtworkMaskShape.setVisible(false).setAlpha(1).setScale(1);
                this.cardInspectArtworkImage.setVisible(false).setAlpha(1);
                this.cardInspectCloseBtn.setVisible(false).setAlpha(1);
                this.cardInspectCloseLabel.setVisible(false).setAlpha(1);
                this.cardInspectTitle.setVisible(false).setAlpha(1);
                this.cardInspectType.setVisible(false).setAlpha(1);
                this.cardInspectBody.setVisible(false).setAlpha(1);
                this.cardInspectHint.setVisible(false).setAlpha(1);
                this.inspectedCard = undefined;
                this.cardInspectAnimating = false;
                if (!this.helpVisible) {
                    this.matchDom?.setInteractionEnabled(true);
                }
            },
        });

        this.tweens.add({
            targets: this.cardInspectOverlay,
            alpha: 0,
            duration: 140,
            ease: 'Sine.In',
        });
    }

    private showActionDetailsOverlay() {
        const room = this.serverManager?.room;
        const state = room?.state as IGameState | undefined;
        const me = room
            ? (state?.players as unknown as Map<string, IPlayer> | undefined)?.get(room.sessionId)
            : undefined;
        if (!room || !state || !me) {
            this.showHelpOverlay();
            return;
        }

        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        const actionState = evaluateMatchActionState({ state, me, myId: room.sessionId });
        const panelModel = buildActionPanelModel(
            actionState,
            String(active?.username ?? this.tr('game_unknown_player')),
            this.tr.bind(this),
            this.localizeActionBlockReason.bind(this),
        );
        const contextHint = buildMatchContextHint({
            phase: state.phase,
            actionState,
            pendingAction: this.hasPendingPlayInFlight(),
            tr: this.tr.bind(this),
            localizeReason: this.localizeActionBlockReason.bind(this),
        });
        const bodyLines = [panelModel.hint, panelModel.detail, contextHint]
            .map((line) => String(line ?? '').trim())
            .filter((line) => line.length > 0);
        this.showHelpOverlay({
            title: this.tr('game_action_details_title'),
            body: bodyLines.join('\n\n'),
        });
    }

    private showHelpOverlay(custom?: { title: string; body: string }) {
        if (this.helpVisible) return;
        this.helpVisible = true;
        this.matchDom?.setInteractionEnabled(false);
        this.hideTargetSelector();
        if (this.cardInspectVisible) this.hideCardInspect();

        if (custom) {
            this.helpTitle.setText(custom.title);
            this.helpBody.setText(`${custom.body}\n\n${this.tr('game_help_close_hint')}`);
        } else {
            const helpContent = buildMatchHelpContent(this.tr.bind(this));
            this.helpTitle.setText(helpContent.title);
            this.helpBody.setText(`${helpContent.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n')}\n\n${helpContent.closeHint}`);
        }
        this.layoutHelpOverlay();

        this.helpOverlay.setVisible(true).setAlpha(0);
        this.helpPanel.setVisible(true).setAlpha(0);
        this.helpTitle.setVisible(true).setAlpha(0);
        this.helpBody.setVisible(true).setAlpha(0);
        this.helpCloseBtn.setVisible(true).setAlpha(0);
        this.helpCloseHit.setVisible(true).setAlpha(0);
        this.helpCloseLabel.setVisible(true).setAlpha(0);
        if (this.helpCloseHit.input) this.helpCloseHit.input.enabled = true;

        this.tweens.add({
            targets: [
                this.helpOverlay,
                this.helpPanel,
                this.helpTitle,
                this.helpBody,
                this.helpCloseBtn,
                this.helpCloseHit,
                this.helpCloseLabel,
            ],
            alpha: 1,
            duration: 160,
            ease: 'Sine.Out',
        });
    }

    private hideHelpOverlay() {
        if (!this.helpVisible) return;
        this.helpVisible = false;
        if (this.helpCloseHit.input) this.helpCloseHit.input.enabled = false;

        this.tweens.add({
            targets: [
                this.helpOverlay,
                this.helpPanel,
                this.helpTitle,
                this.helpBody,
                this.helpCloseBtn,
                this.helpCloseHit,
                this.helpCloseLabel,
            ],
            alpha: 0,
            duration: 140,
            ease: 'Sine.In',
            onComplete: () => {
                if (this.helpVisible) return;
                this.helpOverlay.setVisible(false).setAlpha(1);
                this.helpPanel.setVisible(false).setAlpha(1);
                this.helpTitle.setVisible(false).setAlpha(1);
                this.helpBody.setVisible(false).setAlpha(1);
                this.helpCloseBtn.setVisible(false).setAlpha(1);
                this.helpCloseHit.setVisible(false).setAlpha(1);
                this.helpCloseLabel.setVisible(false).setAlpha(1);
                if (!this.cardInspectVisible && !this.cardInspectAnimating) {
                    this.matchDom?.setInteractionEnabled(true);
                }
            },
        });
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
        this.applyQaOverlayIfNeeded();

        if (state.phase === GamePhase.REACTION_WINDOW && !this.reactionVisible) {
            const remaining = state.reactionEndTime ? Math.max(250, state.reactionEndTime - Date.now()) : 5000;
            this.showReactionOverlay(remaining, this.tr('game_reaction_subtitle'));
        }

        if (state.phase !== GamePhase.REACTION_WINDOW && this.reactionVisible) {
            this.hideReactionOverlay();
        }
    }

    private applyQaOverlayIfNeeded() {
        if (this.qaOverlayApplied) return;
        if (!this.qaInspectRequested && !this.qaHelpRequested) return;

        if (this.qaInspectRequested && !this.cardInspectVisible) {
            const card = this.handCards[0]?.cardData ?? this.companyCards[0]?.cardData ?? this.crisisViews[0]?.crisis;
            if (card) {
                this.showCardInspect(card);
            }
        } else if (this.qaHelpRequested && !this.helpVisible) {
            this.showHelpOverlay();
        }

        const inspectReady = !this.qaInspectRequested || this.cardInspectVisible;
        const helpReady = !this.qaHelpRequested || this.helpVisible;
        if (inspectReady && helpReady) {
            this.qaOverlayApplied = true;
        }
    }

    private redirectToPreLobby() {
        if (this.redirectingToPreLobby) return;
        this.redirectingToPreLobby = true;
        if (this.helpVisible) this.hideHelpOverlay();
        if (this.cardInspectVisible) this.hideCardInspect();
        this.hideTargetSelector();
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

        const deckCount = Number(state.deckCount ?? 0);
        const discardCount = this.estimateDiscardCount(state);
        const compactHud = this.isCompactLandscapeLayout() || this.uiW < 560;
        const hud = buildHudModel({
            me,
            opponents,
            activePlayer: active,
            myId,
            deckCount,
            discardCount,
            reactionActive: state.phase === GamePhase.REACTION_WINDOW,
            phase: String(state.phase ?? '').replace(/_/g, ' '),
            compact: compactHud,
            tr: this.tr.bind(this),
        });
        this.hudTurnText.setText(hud.turnLabel);
        this.hudStatsText.setText(hud.statsLabel);
        this.hudStateText.setText(hud.phaseLabel);
        this.hudReactionText.setText(hud.reactionLabel);
        if (compactHud) {
            this.topTitle.setText(this.tr('game_hud_opponents', { value: this.tr('game_opponents_count', { count: opponents.length }) }));
        } else {
            this.topTitle.setText(hud.opponentsLabel);
        }
        const getWrap = (textObj: Phaser.GameObjects.Text, fallback: number) => {
            const raw = Number((textObj.style as any)?.wordWrapWidth ?? fallback);
            return Number.isFinite(raw) && raw > 0 ? raw : fallback;
        };
        const hudHeightCap = Math.max(20, this.matchLayout.hud.h * 0.46);
        fitTextToBox(this.hudTurnText, this.hudTurnText.text, getWrap(this.hudTurnText, this.uiW * 0.46), hudHeightCap, { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudReactionText, this.hudReactionText.text, getWrap(this.hudReactionText, this.uiW * 0.4), hudHeightCap, { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudStatsText, this.hudStatsText.text, getWrap(this.hudStatsText, this.uiW * 0.66), hudHeightCap, { maxLines: 2, ellipsis: true });
        fitTextToBox(this.hudStateText, this.hudStateText.text, getWrap(this.hudStateText, this.uiW * 0.28), hudHeightCap, { maxLines: 2, ellipsis: true });
        fitTextToBox(this.topTitle, this.topTitle.text, getWrap(this.topTitle, this.uiW * 0.54), Math.max(22, this.matchLayout.topBar.h * 0.24), { maxLines: 2, ellipsis: true });
        this.refreshMatchDomUi();
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
        const baseState = evaluateMatchActionState({ state, me, myId });
        const pendingAction = this.hasPendingPlayInFlight();
        const actionState: MatchActionState = pendingAction
            ? {
                ...baseState,
                canDraw: false,
                canEndTurn: false,
                canAttackMonster: false,
                drawReasonKey: 'game_reason_action_pending',
                endReasonKey: 'game_reason_action_pending',
                attackReasonKey: 'game_reason_action_pending',
            }
            : baseState;

        const domMatchUiActive = this.useDomMatchUi && !this.isPreLobbyPhase(state.phase);
        if (domMatchUiActive) {
            if (this.deckHit.input) this.deckHit.input.enabled = false;
            if (this.endHit.input) this.endHit.input.enabled = false;
            if (this.helpHit.input) this.helpHit.input.enabled = false;
            if (this.emoteHit.input) this.emoteHit.input.enabled = false;
            if (this.gameLogToggleHit.input) this.gameLogToggleHit.input.enabled = false;
        } else {
            if (this.deckHit.input) this.deckHit.input.enabled = true;
            if (this.endHit.input) this.endHit.input.enabled = true;
        }

        this.drawDeckButton(actionState.canDraw);
        this.drawEndButton(actionState.canEndTurn);
        if (!actionState.canDraw) this.deckButtonFx?.reset();
        if (!actionState.canEndTurn) this.endButtonFx?.reset();

        const canReact = !pendingAction && state.phase === GamePhase.REACTION_WINDOW && state.pendingAction?.playerId !== myId;
        const canPlayTurn = !pendingAction && actionState.isMyTurn && state.phase === GamePhase.PLAYER_TURN;

        this.handCards.forEach((card) => {
            const canPlayThisCard = canPlayTurn || (canReact && this.isReactionCard(card.cardData));
            if (!card.input) {
                card.setInteractive({ useHandCursor: true });
            }
            if (card.input) card.input.enabled = true;
            this.input.setDraggable(card as unknown as Phaser.GameObjects.GameObject, canPlayThisCard);
        });

        if (!domMatchUiActive) {
            this.updateActionPanel(state, me, myId, actionState);
        }
        this.updateCrisisActionButtons(state, me, myId);
        this.refreshMatchDomUi(actionState);
    }

    private updateActionPanel(state: IGameState, _me: IPlayer, myId: string, actionState: MatchActionState) {
        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        const panelModel = buildActionPanelModel(
            actionState,
            String(active?.username ?? this.tr('game_unknown_player')),
            this.tr.bind(this),
            this.localizeActionBlockReason.bind(this),
        );
        const contextHint = buildMatchContextHint({
            phase: state.phase,
            actionState,
            pendingAction: this.hasPendingPlayInFlight(),
            tr: this.tr.bind(this),
            localizeReason: this.localizeActionBlockReason.bind(this),
        });
        this.actionPanelHint.setText(panelModel.hint);
        this.actionPanelDetail.setText(panelModel.detail);
        this.actionPanelContext.setText(contextHint);

        const hintWrap = Number((this.actionPanelHint.style as any)?.wordWrapWidth ?? 240);
        const detailWrap = Number((this.actionPanelDetail.style as any)?.wordWrapWidth ?? 240);
        const contextWrap = Number((this.actionPanelContext.style as any)?.wordWrapWidth ?? 240);
        const compactAction = this.isCompactLandscapeLayout()
            || this.matchLayout.controls.w < 270
            || (!this.isLandscapeLayout && (this.matchLayout.tier === 'A' || this.matchLayout.tier === 'B'));
        if (compactAction) {
            this.actionPanelHint.setText(
                actionState.canAttackMonster
                    ? this.tr('game_attack_cta_compact')
                    : this.tr('game_attack_cta_locked_compact'),
            );
            this.actionPanelDetail.setText('');
            this.actionPanelContext.setText('');
        }
        fitTextToBox(this.actionPanelHint, this.actionPanelHint.text, hintWrap, Math.max(18, this.matchLayout.controls.h * 0.38), {
            maxLines: compactAction ? 1 : 2,
            ellipsis: true,
        });
        if (!compactAction) {
            fitTextToBox(this.actionPanelDetail, this.actionPanelDetail.text, detailWrap, Math.max(18, this.matchLayout.controls.h * 0.46), {
                maxLines: 2,
                ellipsis: true,
            });
            fitTextToBox(this.actionPanelContext, this.actionPanelContext.text, contextWrap, Math.max(16, this.matchLayout.controls.h * 0.22), {
                maxLines: 2,
                ellipsis: true,
            });
        }

        if (this.targetSelectorOverlay?.visible && state.currentTurnPlayerId !== myId) {
            this.hideTargetSelector();
        }
    }

    private updateCrisisActionButtons(state: IGameState, me: IPlayer, myId: string) {
        this.crisisViews.forEach((view) => {
            if (!view.actionBg || !view.actionHit || !view.actionLabel) return;
            const evalAttack = evaluateSingleMonsterAttack({ state, me, myId }, view.crisis);
            const hit = view.actionHit;
            const w = Phaser.Math.Clamp(hit.width, 52, 96);
            const h = Phaser.Math.Clamp(hit.height, 34, 48);
            const compactCta = w < 76;
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
                        ? (compactCta ? this.tr('game_attack_cta_compact') : this.tr('game_attack_cta_cost', { cost: evalAttack.cost }))
                        : (compactCta ? this.tr('game_attack_cta_locked_compact') : this.tr('game_attack_cta_locked')),
                )
                .setColor(evalAttack.canAttack ? '#f6fff8' : '#c7d6e6');
            fitTextToBox(view.actionLabel, view.actionLabel.text, w - 10, h - 6, { maxLines: 1, ellipsis: true });
        });
    }

    private refreshMatchDomUi(actionStateInput?: MatchActionState) {
        if (!this.useDomMatchUi || !this.matchDom) return;
        const room = this.serverManager?.room;
        if (!room) return;
        const state = room.state as IGameState | undefined;
        if (!state) return;
        const me = (state.players as unknown as Map<string, IPlayer>).get(room.sessionId);
        if (!me) return;
        if (!this.matchLayout) return;

        const waiting = this.isPreLobbyPhase(state.phase);
        this.matchDom.setVisible(!waiting);
        if (waiting) return;

        const players = Array.from((state.players as unknown as Map<string, IPlayer>).values());
        const opponents = players.filter((p) => p.sessionId !== room.sessionId);
        const active = (state.players as unknown as Map<string, IPlayer>).get(state.currentTurnPlayerId);
        const compactHud = this.isCompactLandscapeLayout() || this.uiW < 560;
        const actionStateBase = actionStateInput ?? evaluateMatchActionState({
            state,
            me,
            myId: room.sessionId,
        });
        const actionState: MatchActionState = this.hasPendingPlayInFlight()
            ? {
                ...actionStateBase,
                canDraw: false,
                canEndTurn: false,
                canAttackMonster: false,
                drawReasonKey: 'game_reason_action_pending',
                endReasonKey: 'game_reason_action_pending',
                attackReasonKey: 'game_reason_action_pending',
            }
            : actionStateBase;

        const panelModel = buildActionPanelModel(
            actionState,
            String(active?.username ?? this.tr('game_unknown_player')),
            this.tr.bind(this),
            this.localizeActionBlockReason.bind(this),
        );
        const controlsWidth = this.matchLayout?.controls?.w ?? 300;
        const compactDomText = this.isCompactLandscapeLayout()
            || controlsWidth < 300
            || this.matchLayout.tier === 'A'
            || this.matchLayout.tier === 'B';
        const portraitTier = this.matchLayout.tier === 'A' || this.matchLayout.tier === 'B';
        const contextHint = buildMatchContextHint({
            phase: state.phase,
            actionState,
            pendingAction: this.hasPendingPlayInFlight(),
            tr: this.tr.bind(this),
            localizeReason: this.localizeActionBlockReason.bind(this),
        });
        const deckCount = Number(state.deckCount ?? 0);
        const discardCount = this.estimateDiscardCount(state);
        const hud = buildHudModel({
            me,
            opponents,
            activePlayer: active,
            myId: room.sessionId,
            deckCount,
            discardCount,
            reactionActive: state.phase === GamePhase.REACTION_WINDOW,
            phase: String(state.phase ?? '').replace(/_/g, ' '),
            compact: compactHud,
            tr: this.tr.bind(this),
        });
        const compactStats = this.tr('game_hud_stats_micro', {
            ap: Math.max(0, Number(me.actionPoints ?? 0)),
            score: Math.max(0, Number(me.score ?? 0)),
        });

        const canDrawNow = !this.reconnectActive && actionState.canDraw;
        const canEndNow = !this.reconnectActive && actionState.canEndTurn;
        this.matchDom.update({
            roomCode: this.tr('game_room_code', { code: this.roomCode || '----' }),
            opponents: portraitTier
                ? ''
                : compactHud
                ? this.tr('game_hud_opponents', { value: this.tr('game_opponents_count', { count: opponents.length }) })
                : hud.opponentsLabel,
            turn: hud.turnLabel,
            stats: portraitTier ? compactStats : hud.statsLabel,
            phase: portraitTier ? '' : hud.phaseLabel,
            reaction: portraitTier ? '' : hud.reactionLabel,
            actionHint: compactDomText
                ? this.tr('game_action_compact_hint')
                : panelModel.hint,
            actionDetail: compactDomText ? '' : panelModel.detail.replace(/\n/g, ' | '),
            actionContext: compactDomText ? '' : contextHint,
            canDraw: canDrawNow,
            canEndTurn: canEndNow,
            showEmote: !portraitTier && controlsWidth >= 210 && !this.isCompactLandscapeLayout(),
            drawLabel: this.tr('game_deck'),
            endLabel: this.tr('game_end_turn'),
            detailsLabel: this.tr('game_details_button'),
            helpLabel: this.tr('game_help_button_short'),
            emoteLabel: this.tr('game_emote_button'),
            logTitle: this.tr('game_log_title'),
            logToggle: this.gameLogExpanded ? this.tr('game_log_less') : this.tr('game_log_more'),
            logEntries: portraitTier ? [] : this.gameLogEntries,
            logExpanded: this.gameLogExpanded,
        });
    }

    private drawHelpButton(active: boolean) {
        const w = this.helpHit.width;
        const h = this.helpHit.height;
        paintRetroButton(
            this.helpButton,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x4d6788 : 0x37475c,
                border: active ? 0xd8ebff : 0x8ea3bb,
                glossAlpha: active ? 0.18 : 0.09,
            },
        );
        this.helpButtonText.setColor(active ? '#f7fdff' : '#c7d6e6');
    }

    private drawEmoteButton(active: boolean) {
        const w = this.emoteHit.width;
        const h = this.emoteHit.height;
        paintRetroButton(
            this.emoteButton,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x5d4a7b : 0x3f3f58,
                border: active ? 0xf0dcff : 0x98a3bb,
                glossAlpha: active ? 0.17 : 0.08,
            },
        );
        this.emoteButtonText.setColor(active ? '#f8f1ff' : '#ced4e1');
    }

    private getEmoteLabel(emoteId: string | undefined): string {
        switch (String(emoteId ?? '')) {
            case 'fire': return this.tr('game_emote_fire');
            case 'laugh': return this.tr('game_emote_laugh');
            case 'thumbs_up':
            default:
                return this.tr('game_emote_thumbs_up');
        }
    }

    private sendQuickEmote() {
        if (this.reconnectActive) {
            this.floatText(this.tr('game_reconnect_action_blocked'), '#ff9aa7');
            return;
        }
        const emotes = ['thumbs_up', 'fire', 'laugh'];
        const emoteId = emotes[this.emoteCycleIndex % emotes.length];
        this.emoteCycleIndex += 1;

        this.serverManager.sendEmote(emoteId);
        const label = this.getEmoteLabel(emoteId);
        this.floatText(this.tr('game_emote_sent', { emote: label }), '#d6ddff', this.emoteHit.x, this.emoteHit.y - 34);
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
        if (compactTop) {
            if (!this.topTitle.visible) {
                this.opponentsPlaceholder.setVisible(false);
                return;
            }
            const summary = opponents
                .slice()
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, 4)
                .map((opp) => `${compactPlayerName(opp.username, 7)} ${this.tr('game_vp_short')} ${opp.score ?? 0}`)
                .join('  |  ');
            this.opponentsPlaceholder
                .setText(summary || this.tr('game_waiting_opponents'))
                .setVisible(true)
                .setFontSize(`${Phaser.Math.Clamp(this.uiW * 0.0116, 10, 14)}px`);
            return;
        }

        const gapX = this.isLandscapeLayout ? 8 : 10;
        const gapY = this.isLandscapeLayout ? 8 : 9;
        const topRect = this.matchLayout.topBar;
        const topHeaderH = Phaser.Math.Clamp(topRect.h * 0.28, 30, 46);
        const areaTop = topRect.y + topHeaderH + 14;
        const areaBottom = topRect.y + topRect.h - 12;
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
        this.crisisViews.forEach(({ zone, card, slotBg, meta, actionBg, actionHit, actionLabel, actionFx }) => {
            actionFx?.destroy();
            zone.destroy();
            card.destroy();
            slotBg?.destroy();
            meta?.destroy();
            actionBg?.destroy();
            actionHit?.destroy();
            actionLabel?.destroy();
        });
        this.crisisViews = [];

        if (!crises || crises.length === 0) return;

        const compactLandscape = this.isCompactLandscapeLayout();
        const boardRect = this.matchLayout.board;
        const boardTop = boardRect.y + 8;
        const boardBottom = boardRect.y + boardRect.h - 8;
        const bandTop = boardTop + boardRect.h * (this.isLandscapeLayout ? (compactLandscape ? 0.04 : 0.07) : 0.06);
        const bandBottom = boardTop + boardRect.h * (this.isLandscapeLayout ? (compactLandscape ? 0.5 : 0.54) : 0.5);
        const y = Phaser.Math.Clamp(
            (bandTop + bandBottom) * 0.5,
            bandTop + 12,
            bandBottom - 12,
        );

        const available = boardRect.w * (this.isLandscapeLayout ? (compactLandscape ? 0.74 : 0.8) : 0.86);
        const slotW = available / Math.max(1, crises.length);
        const targetScale = this.matchLayout.cardSizes.boardW / 126;
        const maxScaleByWidth = (slotW * 0.82) / 126;
        const maxScaleByHeight = ((bandBottom - bandTop) * 0.78) / 178;
        const scale = Phaser.Math.Clamp(
            Math.min(
                targetScale,
                maxScaleByWidth,
                maxScaleByHeight,
                this.isLandscapeLayout ? (compactLandscape ? 0.48 : 0.58) : 0.68,
            ),
            this.isLandscapeLayout ? (compactLandscape ? 0.31 : 0.35) : 0.44,
            this.isLandscapeLayout ? (compactLandscape ? 0.48 : 0.58) : 0.68,
        );
        const spacing = Math.max(slotW, 96 * scale);
        const total = (crises.length - 1) * spacing;
        const startX = boardRect.x + boardRect.w * 0.5 - total * 0.5;

        crises.forEach((cr, i) => {
            const x = startX + i * spacing;
            const card = this.createCardObject(x, y, cr);
            this.add.existing(card);
            card.setScale(scale);
            card.setDepth(35 + i);
            card.disableInteractive();

            const slotBg = this.add.graphics().setDepth(34 + i);
            const slotW = Math.max(90, card.displayWidth * 1.04);
            const slotH = Math.max(120, card.displayHeight * 1.08);
            slotBg.fillStyle(0x203247, 0.58);
            slotBg.fillRoundedRect(x - slotW * 0.5, y - slotH * 0.5, slotW, slotH, 12);
            slotBg.lineStyle(1.2, 0x91bad8, 0.6);
            slotBg.strokeRoundedRect(x - slotW * 0.5, y - slotH * 0.5, slotW, slotH, 12);

            const zoneW = Math.max(72, card.displayWidth * 0.92);
            const zoneH = Math.max(96, card.displayHeight * 1.02);
            const zone = this.add.zone(x, y, zoneW, zoneH)
                .setData('type', 'crisis')
                .setData('crisisId', cr.id)
                .setDepth(42)
                .setInteractive({ useHandCursor: true });

            zone.on('pointerdown', () => this.showCardInspect(cr));
            const metaValue = typeof cr.targetRoll === 'number'
                ? this.tr('game_crisis_roll_badge', { value: cr.targetRoll })
                : this.tr('game_crisis_roll_badge_unknown');
            const metaY = Phaser.Math.Clamp(
                y - card.displayHeight * 0.56,
                boardTop + 8,
                y - card.displayHeight * 0.34,
            );
            const meta = this.add.text(x, metaY, metaValue, {
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
                fontSize: `${Phaser.Math.Clamp(this.uiW * 0.0088, compactLandscape ? 8 : 9, 12)}px`,
                color: '#f4f8ff',
                fontStyle: '700',
                letterSpacing: 0.4,
            }).setOrigin(0.5).setDepth(44).setResolution(this.textResolution);
            const actionW = Phaser.Math.Clamp(
                spacing - 10,
                compactLandscape ? 54 : 60,
                compactLandscape ? 82 : 96,
            );
            const actionH = compactLandscape ? 38 : 44;
            const actionHit = this.add.rectangle(0, 0, actionW, actionH, 0x000000, 0)
                .setDepth(45)
                .setInteractive({ useHandCursor: true });
            const actionY = Phaser.Math.Clamp(
                y + card.displayHeight * 0.52 + (compactLandscape ? 8 : 12),
                y + card.displayHeight * 0.38,
                boardBottom - actionH * 0.5 - 6,
            );
            actionHit.setPosition(x, actionY);
            actionLabel.setPosition(x, actionY);
            const actionFx = createSimpleButtonFx(
                this,
                actionHit,
                [actionBg, actionLabel],
                { onClick: () => this.tryAttackCrisis(cr) },
            );

            this.crisisViews.push({ crisis: cr, zone, card, slotBg, meta, actionBg, actionHit, actionLabel, actionFx });
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
        const boardRect = this.matchLayout.board;
        const boardTop = boardRect.y + 8;
        const boardBottom = boardRect.y + boardRect.h - 8;
        const bandTop = boardTop + boardRect.h * (this.isLandscapeLayout ? (compactLandscape ? 0.58 : 0.6) : 0.56);
        const bandBottom = boardBottom - (compactLandscape ? 8 : 10);
        const y = Phaser.Math.Clamp(
            (bandTop + bandBottom) * 0.5,
            bandTop + 10,
            bandBottom - 10,
        );
        const available = boardRect.w * (this.isLandscapeLayout ? (compactLandscape ? 0.68 : 0.72) : 0.8);
        const slotW = available / Math.max(1, cards.length);
        const targetScale = this.matchLayout.cardSizes.boardW / 126;
        const maxScaleByWidth = (slotW * 0.84) / 126;
        const maxScaleByHeight = ((bandBottom - bandTop) * 0.8) / 178;
        const scale = Phaser.Math.Clamp(
            Math.min(
                targetScale,
                maxScaleByWidth,
                maxScaleByHeight,
                this.isLandscapeLayout ? (compactLandscape ? 0.48 : 0.56) : 0.72,
            ),
            this.isLandscapeLayout ? (compactLandscape ? 0.31 : 0.36) : 0.5,
            this.isLandscapeLayout ? (compactLandscape ? 0.48 : 0.56) : 0.72,
        );
        const spacing = Math.max(slotW, 96 * scale);
        const total = (cards.length - 1) * spacing;
        const startX = boardRect.x + boardRect.w * 0.5 - total * 0.5;

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
        const area = this.handCardsRect;
        const cardCount = cards.length;
        const targetCardW = this.matchLayout.cardSizes.handW;
        const targetCardH = this.matchLayout.cardSizes.handH;
        const baseCardW = 126;
        const scale = Phaser.Math.Clamp(targetCardW / baseCardW, 0.24, 0.82);

        const horizontalStride = Math.max(24, targetCardW * (compactLandscape ? 0.74 : 0.8));
        const cardsPerRowCapacity = Math.max(1, Math.floor((area.w - targetCardW) / horizontalStride) + 1);
        const useTwoRows = cardCount > cardsPerRowCapacity && area.h >= (targetCardH * 1.75);
        const cardsPerRow = useTwoRows ? Math.ceil(cardCount / 2) : cardCount;

        const rowSpan = Math.max(0, cardsPerRow - 1);
        const spacing = rowSpan > 0
            ? Math.min(horizontalStride, Math.max(22, (area.w - targetCardW) / rowSpan))
            : 0;

        const firstRowY = area.y + (useTwoRows ? (targetCardH * 0.5 + 6) : area.h * 0.5);
        const rowGap = useTwoRows
            ? Phaser.Math.Clamp(targetCardH * (compactLandscape ? 0.78 : 0.84), 32, 76)
            : 0;

        cards.forEach((data, i) => {
            const row = useTwoRows && i >= cardsPerRow ? 1 : 0;
            const indexInRow = row === 0 ? i : i - cardsPerRow;
            const rowCount = useTwoRows
                ? (row === 0 ? Math.min(cardsPerRow, cardCount) : cardCount - cardsPerRow)
                : cardCount;
            const rowSpread = Math.max(0, rowCount - 1);
            const rowStartX = area.x + area.w * 0.5 - (rowSpread * spacing) * 0.5;
            const rowMid = rowSpread * 0.5;

            const x = rowStartX + indexInRow * spacing;
            const cardHalfH = (targetCardH) * 0.5;
            const yRaw = firstRowY
                + row * rowGap
                + Math.abs(indexInRow - rowMid) * (this.isLandscapeLayout ? (compactLandscape ? 1.2 : 1.7) : 2.8);
            const y = Phaser.Math.Clamp(
                yRaw,
                area.y + cardHalfH + 2,
                area.y + area.h - cardHalfH - 2,
            );

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
        this.pendingTransitionId += 1;
        if (this.pendingPlayedCard && this.pendingPlayedCard !== card) {
            this.tweens.killTweensOf(this.pendingPlayedCard);
            this.pendingPlayedCard.destroy();
        }
        card.disableInteractive();
        card.setData('pendingTransitionId', this.pendingTransitionId);
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
        const rollbackTransitionId = ++this.pendingTransitionId;
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
                if (rollbackTransitionId !== this.pendingTransitionId) return;
                if (state && me && !this.visualQueue.isBusy) {
                    this.applyState(state, me);
                }
            },
        });
    }

    private clearPendingCardAsAccepted() {
        const pending = this.pendingPlayedCard;
        this.pendingTransitionId += 1;
        this.pendingPlayedCard = undefined;
        this.pendingPlayState = acceptPendingCard(this.pendingPlayState);
        if (!pending || !pending.active) return;
        this.tweens.killTweensOf(pending);
        this.tweens.add({
            targets: pending,
            x: this.uiX + this.uiW * 0.5,
            y: this.matchLayout.board.y + this.matchLayout.board.h * 0.78,
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
        const pendingId = String(this.pendingPlayedCard.cardData?.id ?? '').trim();
        const mustCleanup = result.outcome === 'rollback'
            || result.outcome === 'accepted'
            || !this.pendingPlayState.pendingCardId
            || (pendingId.length > 0 && handIds.includes(pendingId));
        if (!mustCleanup) return;

        this.pendingTransitionId += 1;
        this.tweens.killTweensOf(this.pendingPlayedCard);
        if (this.pendingPlayedCard.active) this.pendingPlayedCard.destroy();
        this.pendingPlayedCard = undefined;
    }

    private cleanupOrphanCardObjects() {
        const prioritized = [
            ...this.handCards,
            ...this.companyCards,
            ...this.crisisViews.map((view) => view.card),
            ...(this.pendingPlayedCard ? [this.pendingPlayedCard] : []),
        ];
        const plan = buildCardRegistryPlan(
            prioritized.map((card) => ({
                ref: card,
                id: String(card.cardData?.id ?? ''),
                active: card.active,
            })),
            Array.from(this.liveCardObjects).map((card) => ({
                ref: card,
                id: String(card.cardData?.id ?? ''),
                active: card.active,
            })),
        );

        plan.destroyRefs.forEach((card) => card.destroy());
        Array.from(this.liveCardObjects).forEach((card) => {
            if (!card.active) this.liveCardObjects.delete(card);
        });
    }

    private snapBack(card: CardGameObject, msg: string) {
        this.floatText(msg, '#ff8392', card.x, card.homeY - 84);
        this.tweens.killTweensOf(card);
        this.tweens.add({
            targets: card,
            x: card.homeX,
            y: card.homeY,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            alpha: 1,
            duration: 210,
            ease: 'Cubic.Out',
            onComplete: () => {
                if (!card.active) return;
                card.setDepth((card as any).homeDepth ?? card.depth);
            },
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
        this.refreshMatchDomUi();
    }

    private toggleGameLog() {
        this.gameLogExpanded = !this.gameLogExpanded;
        this.layoutPanels();
        const state = this.serverManager?.room?.state as IGameState | undefined;
        const me = state && this.serverManager?.room
            ? (state.players as unknown as Map<string, IPlayer>).get(this.serverManager.room.sessionId)
            : undefined;
        if (state && me) this.applyState(state, me);
        this.refreshMatchDomUi();
    }

    private resolvePlayerName(playerId?: string) {
        if (!playerId) return this.tr('game_unknown_player');
        const state = this.serverManager.room?.state as IGameState | undefined;
        const player = state
            ? (state.players as unknown as Map<string, IPlayer>).get(playerId)
            : undefined;
        return player?.username ?? playerId;
    }

    private localizeRewardCode(rewardCode?: string): string | null {
        if (!rewardCode) return null;
        if (rewardCode.startsWith('vp_')) {
            const parsed = parseInt(rewardCode.replace('vp_', ''), 10);
            const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            return this.tr('game_reward_vp', { value: safe });
        }
        return rewardCode;
    }

    private localizePenaltyCode(penaltyCode?: string): string | null {
        if (!penaltyCode) return null;
        switch (penaltyCode) {
            case 'discard_2':
                return this.tr('game_penalty_discard_2');
            case 'lose_employee':
                return this.tr('game_penalty_lose_employee');
            case 'lock_tricks':
                return this.tr('game_penalty_lock_tricks');
            default:
                return penaltyCode;
        }
    }

    private buildDiceOutcomeLine(event: IDiceRolledEvent): string | null {
        if (event.success) {
            const reward = this.localizeRewardCode(event.rewardCode);
            if (!reward) return null;
            return this.tr('game_dice_reward_line', { value: reward });
        }
        const penalty = this.localizePenaltyCode(event.penaltyCode);
        if (!penalty) return null;
        return this.tr('game_dice_penalty_line', { value: penalty });
    }

    private showDiceToast(event: IDiceRolledEvent) {
        const actor = this.resolvePlayerName(event.playerId);
        const modifier = Number.isFinite(Number(event.modifier))
            ? Number(event.modifier)
            : Number(event.total ?? 0) - Number(event.roll1 ?? 0) - Number(event.roll2 ?? 0);
        const modifierText = modifier > 0 ? `+${modifier}` : (modifier < 0 ? `${modifier}` : '');
        const targetValue = Number.isFinite(Number(event.targetRoll)) ? Number(event.targetRoll) : '-';

        const headerLine = this.tr('game_dice_result_line_ext', {
            player: actor,
            roll1: event.roll1 ?? 0,
            roll2: event.roll2 ?? 0,
            modifierText,
            total: event.total ?? 0,
            target: targetValue,
            status: event.success ? this.tr('game_dice_success') : this.tr('game_dice_fail'),
        });
        const outcomeLine = this.buildDiceOutcomeLine(event);
        const line = outcomeLine ? `${headerLine}\n${outcomeLine}` : headerLine;

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
                    this.floatText(
                        this.tr('game_reacted', { name }),
                        '#ffd6a6',
                        this.screenW * 0.5,
                        this.matchLayout.board.y + Math.max(38, this.matchLayout.board.h * 0.14),
                    );
                    this.time.delayedCall(460, resolve);
                }));
                break;

            case ServerEvents.ACTION_RESOLVED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const success = message?.success !== false;
                    this.appendGameLog(success ? this.tr('game_log_action_ok') : this.tr('game_log_action_fail'));
                    const serverLog = Array.isArray(message?.log)
                        ? message.log
                            .map((entry: unknown) => String(entry ?? '').replace(/\s+/g, ' ').trim())
                            .filter((entry: string) => entry.length > 0)
                        : [];
                    serverLog.slice(0, 3).forEach((entry: string) => this.appendGameLog(entry));

                    this.hideReactionOverlay();

                    if (success) {
                        this.floatText(this.tr('game_action_resolved'), '#9ff3c2');
                        this.burst(this.screenW * 0.5, this.matchLayout.board.y + this.matchLayout.board.h * 0.6, 36);
                        if (this.pendingPlayedCard) this.clearPendingCardAsAccepted();
                    } else {
                        const failHint = serverLog.length > 0 ? serverLog[serverLog.length - 1] : this.tr('game_action_failed');
                        this.floatText(failHint, '#ff8a97');
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
                    const targetY = this.matchLayout.handCards.y + this.matchLayout.handCards.h * 0.67;
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
                    this.floatText(
                        this.tr('game_turn_number', { turn: message?.turnNumber ?? '' }),
                        '#d8f4ff',
                        this.screenW * 0.5,
                        this.matchLayout.board.y + Math.max(34, this.matchLayout.board.h * 0.12),
                    );
                    this.time.delayedCall(320, resolve);
                }));
                break;

            case ServerEvents.DICE_ROLLED:
                this.visualQueue.enqueue(() => new Promise((resolve) => {
                    const payload = message as IDiceRolledEvent;
                    this.showDiceToast(payload);
                    const actor = this.resolvePlayerName(payload.playerId);
                    const modifier = Number.isFinite(Number(payload.modifier))
                        ? Number(payload.modifier)
                        : Number(payload.total ?? 0) - Number(payload.roll1 ?? 0) - Number(payload.roll2 ?? 0);
                    const modifierText = modifier > 0 ? `+${modifier}` : (modifier < 0 ? `${modifier}` : '');
                    const targetValue = Number.isFinite(Number(payload.targetRoll)) ? Number(payload.targetRoll) : '-';
                    this.appendGameLog(this.tr('game_log_dice_ext', {
                        player: actor,
                        roll1: payload.roll1 ?? 0,
                        roll2: payload.roll2 ?? 0,
                        modifierText,
                        total: payload.total ?? 0,
                        target: targetValue,
                        status: payload.success ? this.tr('game_dice_success') : this.tr('game_dice_fail'),
                    }));
                    const outcomeLine = this.buildDiceOutcomeLine(payload);
                    if (outcomeLine) this.appendGameLog(outcomeLine);
                    this.time.delayedCall(260, resolve);
                }));
                break;

            case ServerEvents.EMOTE: {
                const payload = message as { playerId?: string; emoteId?: string };
                const state = this.serverManager?.room?.state as IGameState | undefined;
                const player = payload?.playerId && state
                    ? (state.players as unknown as Map<string, IPlayer>).get(payload.playerId)
                    : undefined;
                const playerName = String(player?.username ?? this.tr('game_unknown_player'));
                const emote = this.getEmoteLabel(payload?.emoteId);
                this.appendGameLog(this.tr('game_log_emote', { player: playerName, emote }));
                this.floatText(`${playerName} ${emote}`, '#d4dcff');
                break;
            }

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

    private handleReconnectStatus(status: ReconnectStatus) {
        const stage = String(status?.stage ?? '');
        const useCanvasReconnectOverlay = !this.reconnectDomNode;
        if (stage === 'reconnecting') {
            this.reconnectActive = true;
            if (this.helpVisible) this.hideHelpOverlay();
            if (this.cardInspectVisible) this.hideCardInspect();
            this.hideTargetSelector();
            if (this.reconnectRedirectTimer) {
                this.reconnectRedirectTimer.remove(false);
                this.reconnectRedirectTimer = undefined;
            }
            const remaining = Math.max(0, Math.ceil((status.maxWindowMs - status.elapsedMs) / 1000));
            const retryText = Number.isFinite(Number(status.nextRetryMs)) && Number(status.nextRetryMs) > 0
                ? this.tr('game_reconnect_retry_wait', { ms: Number(status.nextRetryMs) })
                : this.tr('game_reconnect_retry_now');
            this.reconnectTitle.setText(this.tr('game_reconnect_title'));
            this.reconnectBody.setText(this.tr('game_reconnect_body', {
                attempt: Math.max(1, Number(status.attempt ?? 1)),
                seconds: remaining,
                retry: retryText,
            }));
            this.setReconnectDomVisible(
                true,
                this.tr('game_reconnect_title'),
                this.tr('game_reconnect_body', {
                    attempt: Math.max(1, Number(status.attempt ?? 1)),
                    seconds: remaining,
                    retry: retryText,
                }),
            );
            this.reconnectOverlay.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectPanel.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectTitle.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectBody.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            if (useCanvasReconnectOverlay) this.layoutReconnectOverlay();
            return;
        }

        if (stage === 'reconnected') {
            this.reconnectActive = false;
            this.setReconnectDomVisible(false);
            this.reconnectOverlay.setVisible(false);
            this.reconnectPanel.setVisible(false);
            this.reconnectTitle.setVisible(false);
            this.reconnectBody.setVisible(false);
            this.appendGameLog(this.tr('game_reconnect_ok'));
            this.floatText(this.tr('game_reconnect_ok'), '#9ff3c2');
            return;
        }

        if (stage === 'failed') {
            this.reconnectActive = true;
            this.reconnectTitle.setText(this.tr('game_reconnect_failed_title'));
            this.reconnectBody.setText(this.tr('game_reconnect_failed_body'));
            this.setReconnectDomVisible(
                true,
                this.tr('game_reconnect_failed_title'),
                this.tr('game_reconnect_failed_body'),
            );
            this.reconnectOverlay.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectPanel.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectTitle.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            this.reconnectBody.setVisible(useCanvasReconnectOverlay).setAlpha(1);
            if (useCanvasReconnectOverlay) this.layoutReconnectOverlay();
            this.appendGameLog(this.tr('game_reconnect_failed_title'));
            if (this.reconnectRedirectTimer) this.reconnectRedirectTimer.remove(false);
            this.reconnectRedirectTimer = this.time.delayedCall(900, () => {
                this.scene.start('LoginScene', {
                    serverManager: this.serverManager,
                    reconnectMessage: this.tr('login_reconnect_failed'),
                });
            });
            return;
        }

        this.reconnectActive = false;
        this.setReconnectDomVisible(false);
        this.reconnectOverlay.setVisible(false);
        this.reconnectPanel.setVisible(false);
        this.reconnectTitle.setVisible(false);
        this.reconnectBody.setVisible(false);
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
                    this.handleReturnToMainMenu();
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

    private handleReturnToMainMenu() {
        try {
            const leaveResult = this.serverManager?.leaveRoom?.(true);
            if (leaveResult && typeof (leaveResult as Promise<unknown>).catch === 'function') {
                (leaveResult as Promise<unknown>).catch(() => undefined);
            }
        } catch {
            // Best-effort cleanup only.
        }

        const sceneManager = this.scene.manager as any;
        const canGoLogin = Boolean(sceneManager?.keys?.LoginScene);
        if (canGoLogin) {
            this.scene.start('LoginScene');
            return;
        }

        window.location.assign(window.location.pathname);
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //  TARGET SELECTOR (for Trick cards)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private showTargetSelector(card: CardGameObject) {
        if (this.reconnectActive) {
            this.snapBack(card, this.tr('game_reconnect_action_blocked'));
            return;
        }
        this.hideTargetSelector();
        if (this.hasPendingPlayInFlight() && this.pendingPlayedCard !== card) {
            this.snapBack(card, this.tr('game_action_pending_wait'));
            return;
        }

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
                    label: `${getCardDisplayName(hero, this.lang, this.tr.bind(this))}${suffix}`,
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

        this.targetSelectorOverlay.setAlpha(0);
        const stagedElements = this.targetSelectorElements.filter((el) => el !== this.targetSelectorOverlay);
        stagedElements.forEach((el) => {
            if ('setAlpha' in el) (el as Phaser.GameObjects.GameObject & { setAlpha: (v: number) => any }).setAlpha(0);
            if ('y' in el) (el as Phaser.GameObjects.GameObject & { y: number }).y += 8;
        });

        this.tweens.add({
            targets: this.targetSelectorOverlay,
            alpha: 0.6,
            duration: 130,
            ease: 'Sine.Out',
        });
        this.tweens.add({
            targets: stagedElements as any,
            alpha: 1,
            y: '-=8',
            duration: 170,
            ease: 'Cubic.Out',
        });
    }

    private hideTargetSelector() {
        this.targetSelectorFx.forEach((fx) => fx.destroy());
        this.targetSelectorFx = [];
        this.targetSelectorElements.forEach((el) => {
            this.tweens.killTweensOf(el);
            el.destroy();
        });
        this.targetSelectorElements = [];
        this.targetSelectorOverlay = undefined;
    }
}

