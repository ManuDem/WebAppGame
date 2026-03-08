import Phaser from 'phaser';
import { GamePhase, IGameState, IPlayer, MIN_PLAYERS_TO_START, ServerEvents } from '../../../shared/SharedTypes';
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
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { buildMatchHelpContent } from '../ui/match/MatchHelpContent';
import { getButtonContractByTier, getMenuTypographyByTier, getSafeAreaByTier, LayoutTier, resolveLayoutTier } from '../ui/layout/LayoutTokens';
import { createMockPreLobbyServerManager } from '../qa/MockPreLobbyState';
import { setUiRootLanguage, setUiRootScreen, syncUiRootViewport } from '../ui/dom/UiRoot';

const FONT_UI = APP_FONT_FAMILY;

export class PreLobbyScene extends Phaser.Scene {
    private serverManager!: ServerManager;
    private lang: SupportedLanguage = DEFAULT_LANGUAGE;
    private roomCode = '';

    private bg!: Phaser.GameObjects.Graphics;
    private cloudLayer!: Phaser.GameObjects.TileSprite;
    private ditherLayer!: Phaser.GameObjects.TileSprite;

    private panel!: Phaser.GameObjects.Graphics;
    private rulesBox!: Phaser.GameObjects.Graphics;
    private playersBox!: Phaser.GameObjects.Graphics;
    private actionButtonGfx!: Phaser.GameObjects.Graphics;
    private actionButtonText!: Phaser.GameObjects.Text;
    private actionButtonHit!: Phaser.GameObjects.Rectangle;
    private actionButtonFx?: SimpleButtonController;
    private helpButtonGfx!: Phaser.GameObjects.Graphics;
    private helpButtonText!: Phaser.GameObjects.Text;
    private helpButtonHit!: Phaser.GameObjects.Rectangle;
    private helpButtonFx?: SimpleButtonController;

    private helpOverlay!: Phaser.GameObjects.Rectangle;
    private helpPanel!: Phaser.GameObjects.Graphics;
    private helpTitle!: Phaser.GameObjects.Text;
    private helpBody!: Phaser.GameObjects.Text;
    private helpCloseBtn!: Phaser.GameObjects.Graphics;
    private helpCloseHit!: Phaser.GameObjects.Rectangle;
    private helpCloseLabel!: Phaser.GameObjects.Text;
    private helpCloseFx?: SimpleButtonController;
    private helpVisible = false;
    private readonly preLobbyGuideEnabled = false;

    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private roomCodeText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private feedbackText!: Phaser.GameObjects.Text;
    private rulesTitle!: Phaser.GameObjects.Text;
    private rulesBody!: Phaser.GameObjects.Text;
    private playersTitle!: Phaser.GameObjects.Text;
    private playersBody!: Phaser.GameObjects.Text;

    private enteringGame = false;
    private playersBodyRaw = '';
    private readonly textResolution = 4;

    constructor() {
        super({ key: 'PreLobbyScene' });
    }

    init(data: { serverManager?: ServerManager; lang?: SupportedLanguage; roomCode?: string }) {
        const params = new URLSearchParams(window.location.search);
        const queryLang = params.get('lang');
        this.lang = sanitizeLanguage(data?.lang ?? queryLang ?? localStorage.getItem('lucrare_lang'));
        if (queryLang) localStorage.setItem('lucrare_lang', this.lang);

        const qaPreLobbyMode = params.get('qaPreLobby') === '1' || params.get('qaScreen') === 'prelobby';
        if (data?.serverManager) {
            this.serverManager = data.serverManager;
        } else if (qaPreLobbyMode) {
            this.serverManager = createMockPreLobbyServerManager(this.lang) as unknown as ServerManager;
        } else {
            this.serverManager = new ServerManager();
        }

        this.roomCode = String(data?.roomCode ?? (qaPreLobbyMode ? 'QAPL' : '')).trim();
        this.enteringGame = false;
    }

    create() {
        setUiRootScreen('prelobby');
        setUiRootLanguage(this.lang);
        syncUiRootViewport(this.scale.width, this.scale.height);
        if (!this.serverManager.room) {
            this.scene.start('LoginScene', { serverManager: this.serverManager });
            return;
        }

        this.bg = this.add.graphics();
        ensurePokemonTextures(this);
        this.cloudLayer = this.add.tileSprite(0, 0, 256, 128, 'poke-clouds').setOrigin(0).setAlpha(0.33).setDepth(-60);
        this.ditherLayer = this.add.tileSprite(0, 0, 64, 64, 'poke-dither').setOrigin(0).setAlpha(0.2).setDepth(-59);

        this.panel = this.add.graphics();
        this.rulesBox = this.add.graphics();
        this.playersBox = this.add.graphics();
        this.actionButtonGfx = this.add.graphics();

        this.title = this.add.text(0, 0, BRAND_TITLE_TEXT, BRAND_TITLE_STYLE).setOrigin(0.5);
        this.subtitle = this.add.text(0, 0, t(this.lang, 'brand_subtitle'), BRAND_SUBTITLE_STYLE).setOrigin(0.5);

        this.roomCodeText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '20px',
            color: '#daf2ff',
            fontStyle: '700',
            stroke: '#123955',
            strokeThickness: 2,
        }).setOrigin(0.5);

        this.statusText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#cbe3f8',
            fontStyle: '600',
            align: 'center',
        }).setOrigin(0.5);

        this.feedbackText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ffd8a6',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5);

        this.rulesTitle = this.add.text(0, 0, t(this.lang, 'pre_lobby_rules_title'), {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#d8ecff',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0.5);

        this.rulesBody = this.add.text(0, 0, t(this.lang, 'pre_lobby_rules_body'), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#e7f4ff',
            fontStyle: '600',
            align: 'left',
            lineSpacing: 5,
        }).setOrigin(0.5, 0);

        this.playersTitle = this.add.text(0, 0, t(this.lang, 'pre_lobby_players_title'), {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#d8ecff',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0.5);

        this.playersBodyRaw = t(this.lang, 'pre_lobby_syncing');
        this.playersBody = this.add.text(0, 0, this.playersBodyRaw, {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#d8e8f7',
            fontStyle: '600',
            align: 'left',
            lineSpacing: 5,
        }).setOrigin(0.5, 0);

        this.actionButtonText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: '700',
        }).setOrigin(0.5);

        this.actionButtonHit = this.add.rectangle(0, 0, 220, 56, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        this.actionButtonFx = createSimpleButtonFx(
            this,
            this.actionButtonHit,
            [this.actionButtonGfx, this.actionButtonText],
            { onClick: () => this.handleActionClick() },
        );

        this.helpButtonGfx = this.add.graphics();
        this.helpButtonText = this.add.text(0, 0, '?', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#f5fbff',
            fontStyle: '700',
        }).setOrigin(0.5);
        this.helpButtonHit = this.add.rectangle(0, 0, 42, 42, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.helpButtonFx = createSimpleButtonFx(
            this,
            this.helpButtonHit,
            [this.helpButtonGfx, this.helpButtonText],
            { onClick: () => this.showHelpOverlay() },
        );
        if (!this.preLobbyGuideEnabled && this.helpButtonHit.input) {
            this.helpButtonHit.input.enabled = false;
        }

        this.helpOverlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72)
            .setDepth(200)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.helpOverlay.on('pointerdown', () => this.hideHelpOverlay());
        this.helpPanel = this.add.graphics().setDepth(201).setVisible(false);
        this.helpTitle = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f2f8ff',
            fontStyle: '700',
            align: 'center',
            wordWrap: { width: 700 },
        }).setOrigin(0.5, 0).setDepth(202).setVisible(false);
        this.helpBody = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#d8e9f8',
            align: 'left',
            lineSpacing: 5,
            wordWrap: { width: 700 },
        }).setOrigin(0.5, 0).setDepth(202).setVisible(false);
        this.helpCloseBtn = this.add.graphics().setDepth(203).setVisible(false);
        this.helpCloseHit = this.add.rectangle(0, 0, 42, 42, 0x000000, 0)
            .setDepth(204)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        if (this.helpCloseHit.input) this.helpCloseHit.input.enabled = false;
        this.helpCloseLabel = this.add.text(0, 0, 'X', {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#f7fdff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(205).setVisible(false);
        this.helpCloseFx = createSimpleButtonFx(
            this,
            this.helpCloseHit,
            [this.helpCloseBtn, this.helpCloseLabel],
            { onClick: () => this.hideHelpOverlay() },
        );
        if (!this.preLobbyGuideEnabled && this.helpCloseHit.input) {
            this.helpCloseHit.input.enabled = false;
        }

        this.applyTextResolution();
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.actionButtonFx?.destroy();
            this.helpButtonFx?.destroy();
            this.helpCloseFx?.destroy();
            if (this.serverManager.onStateChange === this.handleStateChange) this.serverManager.onStateChange = undefined;
            if (this.serverManager.onPlayerChange === this.handlePlayerChange) this.serverManager.onPlayerChange = undefined;
            if (this.serverManager.onRoomMessage === this.handleRoomMessage) this.serverManager.onRoomMessage = undefined;
        });

        this.serverManager.onStateChange = this.handleStateChange;
        this.serverManager.onPlayerChange = this.handlePlayerChange;
        this.serverManager.onRoomMessage = this.handleRoomMessage;

        this.handleResize(this.scale.gameSize);

        const state = this.serverManager.room.state as IGameState | undefined;
        if (state) this.handleStateChange(state);
    }

    update() {
        this.cloudLayer.tilePositionX += 0.08;
        this.cloudLayer.tilePositionY += 0.01;
        this.ditherLayer.tilePositionX += 0.03;
        this.ditherLayer.tilePositionY += 0.006;
    }

    private tr(key: string, vars?: Record<string, string | number>) {
        return t(this.lang, key, vars);
    }

    private isPreLobbyPhase(phase?: GamePhase) {
        return phase === GamePhase.PRE_LOBBY || phase === GamePhase.WAITING_FOR_PLAYERS;
    }

    private readonly handleStateChange = (state: IGameState) => {
        if (!this.serverManager.room) return;

        if (!this.isPreLobbyPhase(state.phase)) {
            this.enterGame(state);
            return;
        }

        this.renderLobbyState(state);
    };

    private readonly handlePlayerChange = (_player: IPlayer) => {
        const state = this.serverManager.room?.state as IGameState | undefined;
        if (state) this.renderLobbyState(state);
    };

    private readonly handleRoomMessage = (type: string | number, message: any) => {
        if (type === ServerEvents.ERROR) {
            const text = String(message?.message ?? this.tr('game_action_denied'));
            this.feedbackText.setText(text).setColor('#ffb4c2');
            this.cameras.main.shake(120, 0.0018);
            return;
        }

        if (type === ServerEvents.TURN_STARTED) {
            const state = this.serverManager.room?.state as IGameState | undefined;
            if (state && !this.isPreLobbyPhase(state.phase)) {
                this.enterGame(state);
            }
        }
    };

    private renderLobbyState(state: IGameState) {
        const room = this.serverManager.room;
        if (!room) return;

        const myId = room.sessionId;
        const playerMap = state.players as unknown as Map<string, IPlayer>;
        const me = playerMap.get(myId);

        const players = Array.from(playerMap.values());
        const connected = players.filter((p) => p.isConnected);
        const readyCount = connected.filter((p) => p.isReady).length;
        const enoughPlayers = connected.length >= MIN_PLAYERS_TO_START;
        const everyoneReady = enoughPlayers && connected.every((p) => p.isReady);
        const missing = Math.max(0, MIN_PLAYERS_TO_START - readyCount);
        const isHost = state.hostSessionId === myId;

        this.roomCodeText.setText(this.tr('game_room_code', { code: this.roomCode || '----' }));

        let status = '';
        if (!enoughPlayers) {
            status = this.tr('game_lobby_need_more', { connected: connected.length, ready: readyCount, missing });
        } else if (!everyoneReady) {
            status = this.tr('game_lobby_wait_all', { ready: readyCount, total: connected.length });
        } else if (isHost) {
            status = this.tr('game_lobby_host_can_start');
        } else {
            status = this.tr('game_lobby_wait_host_start');
        }
        this.statusText.setText(status);

        const compactList = this.scale.width > this.scale.height || this.scale.height < 620;
        const list = players.length > 0
            ? players
                .sort((a, b) => Number(b.isConnected) - Number(a.isConnected) || a.username.localeCompare(b.username))
                .map((p) => {
                    const meTag = p.sessionId === myId ? ` ${this.tr('game_you')}` : '';
                    if (compactList) {
                        const compactStatus = p.isConnected
                            ? (p.isReady ? this.tr('game_status_ready') : this.tr('game_status_waiting_short'))
                            : this.tr('game_status_offline_short');
                        return `${p.username}${meTag} | ${compactStatus}`;
                    }
                    const marker = p.isReady ? this.tr('game_status_ready') : this.tr('game_status_not_ready');
                    const net = p.isConnected ? this.tr('game_status_online') : this.tr('game_status_offline');
                    return `- ${p.username}${meTag} | ${marker} | ${net}`;
                })
                .join('\n')
            : this.tr('game_lobby_no_players');
        this.playersBodyRaw = list;
        this.playersBody.setText(list);

        const canReady = Boolean(me && !me.isReady);
        const canStart = Boolean(me && isHost && me.isReady && everyoneReady);
        const buttonEnabled = canReady || canStart;

        const label = canReady
            ? this.tr('game_ready')
            : canStart
                ? this.tr('game_start_match')
                : isHost
                    ? this.tr('game_start_waiting')
                    : this.tr('game_ready_confirmed');

        this.actionButtonText.setText(label);
        if (this.actionButtonHit.input) this.actionButtonHit.input.enabled = buttonEnabled;
        this.drawActionButton(buttonEnabled);
        this.handleResize(this.scale.gameSize);
    }

    private handleActionClick() {
        if (this.enteringGame) return;
        const room = this.serverManager.room;
        if (!room) return;

        const state = room.state as IGameState;
        if (!this.isPreLobbyPhase(state.phase)) return;

        const myId = room.sessionId;
        const playerMap = state.players as unknown as Map<string, IPlayer>;
        const me = playerMap.get(myId);
        if (!me) return;

        const connected = Array.from(playerMap.values()).filter((p) => p.isConnected);
        const enoughPlayers = connected.length >= MIN_PLAYERS_TO_START;
        const everyoneReady = enoughPlayers && connected.every((p) => p.isReady);
        const isHost = state.hostSessionId === myId;

        if (!me.isReady) {
            this.serverManager.joinGame();
            this.feedbackText.setText(this.tr('game_ready_waiting')).setColor('#d9f7b9');
            return;
        }

        if (isHost && everyoneReady) {
            this.serverManager.startMatch();
            this.feedbackText.setText(this.tr('pre_lobby_starting')).setColor('#9fe6ff');
        }
    }

    private enterGame(state: IGameState) {
        if (this.enteringGame) return;
        this.enteringGame = true;
        if (this.helpVisible) this.hideHelpOverlay();

        const room = this.serverManager.room;
        const isHost = Boolean(room && state.hostSessionId === room.sessionId);
        this.cameras.main.fadeOut(220, 8, 13, 20);
        this.time.delayedCall(230, () => {
            this.scene.start('GameScene', {
                serverManager: this.serverManager,
                lang: this.lang,
                roomCode: this.roomCode,
                isHost,
            });
        });
    }

    private handleResize(size: Phaser.Structs.Size) {
        const w = size.width;
        const h = size.height;
        const minSide = Math.min(w, h);
        const tier = resolveLayoutTier(w, h);
        const safe = getSafeAreaByTier(tier);
        const buttonContract = getButtonContractByTier(tier);
        const menuType = getMenuTypographyByTier(tier);
        const isLandscape = tier === 'C' || tier === 'E';
        const useCompactRules = this.useCompactRulesCopy(tier);
        const compactLandscape = tier === 'C';
        const panelBaseW = tier === 'A' ? 336 : tier === 'B' ? 360 : tier === 'C' ? 560 : tier === 'D' ? 620 : 700;
        const panelBaseH = tier === 'A' ? 520 : tier === 'B' ? 560 : tier === 'C' ? 316 : tier === 'D' ? 620 : 440;
        const cx = w * 0.5;

        drawPokemonBackdrop(this.bg, w, h, 0.61);
        this.cloudLayer.setSize(w, h);
        this.ditherLayer.setSize(w, h);
        syncUiRootViewport(w, h);

        const header = getBrandHeaderMetrics(w, h);
        applyBrandTypography(this.title, this.subtitle, header);
        placeBrandHeader(this.title, this.subtitle, cx, header);

        const maxPanelW = Math.max(260, w - safe.left - safe.right - 8);
        const panelW = Math.min(panelBaseW, maxPanelW);
        const panelTop = Math.max(safe.top + 8, header.bottomY + 10);
        const availablePanelH = Math.max(220, h - panelTop - safe.bottom);
        const panelH = Math.max(Math.min(panelBaseH, availablePanelH), Math.min(availablePanelH, 300));
        const px = cx - panelW * 0.5;
        const py = Math.max(panelTop, h - panelH - safe.bottom);

        this.panel.clear();
        this.panel.fillStyle(0x213f58, 0.93);
        this.panel.fillRoundedRect(px, py, panelW, panelH, 20);
        this.panel.fillStyle(0x8fd8ff, 0.07);
        this.panel.fillRoundedRect(px + 4, py + 4, panelW - 8, Math.max(24, panelH * 0.2), { tl: 16, tr: 16, bl: 0, br: 0 });
        this.panel.lineStyle(1.4, 0xbfe3ff, 0.95);
        this.panel.strokeRoundedRect(px, py, panelW, panelH, 20);
        this.panel.lineStyle(1, 0xffffff, 0.08);
        this.panel.strokeRoundedRect(px + 4, py + 4, panelW - 8, panelH - 8, 16);

        const topY = py + 34;
        this.roomCodeText
            .setPosition(cx, topY)
            .setFontSize(`${menuType.roomCode}px`);

        this.statusText
            .setPosition(cx, topY + (compactLandscape ? 40 : 44))
            .setWordWrapWidth(panelW * 0.9, true)
            .setFontSize(`${menuType.body}px`);

        const buttonBaseW = tier === 'A' ? 252 : tier === 'B' ? 272 : tier === 'C' ? 286 : 320;
        const buttonW = Math.max(220, Math.min(buttonBaseW, panelW - 36));
        const buttonH = Math.max(compactLandscape ? 40 : 44, buttonContract.primaryHeight - (compactLandscape ? 6 : 0));
        const footerGap = compactLandscape ? 8 : 12;
        const feedbackBlockH = Math.max(compactLandscape ? 14 : 18, Math.round(menuType.caption * (compactLandscape ? 1.4 : 1.8)));
        const contentTop = topY + (compactLandscape ? 66 : 78);
        const contentBottom = py + panelH - (buttonH + feedbackBlockH + footerGap * 2);
        const contentH = Math.max(isLandscape ? 86 : 128, contentBottom - contentTop);
        const buttonY = contentBottom + footerGap + buttonH * 0.5;

        this.rulesTitle.setFontSize(`${menuType.sectionTitle}px`);
        this.playersTitle.setFontSize(`${menuType.sectionTitle}px`);
        const rulesCopy = this.getRulesCopy(tier);
        this.rulesBody.setText(rulesCopy);

        if (isLandscape) {
            const gap = compactLandscape ? 10 : 20;
            const leftW = (panelW - gap * 3) * (compactLandscape ? 0.42 : 0.52);
            const rightW = panelW - gap * 3 - leftW;
            const boxH = Math.max(compactLandscape ? 98 : 84, contentH);
            const leftX = px + gap;
            const rightX = leftX + leftW + gap;

            this.drawSubPanel(this.rulesBox, leftX, contentTop, leftW, boxH);
            this.drawSubPanel(this.playersBox, rightX, contentTop, rightW, boxH);

            this.rulesTitle.setPosition(leftX + leftW * 0.5, contentTop + 20);
            this.rulesBody.setPosition(leftX + leftW * 0.5, contentTop + 42);
            this.fitTextBlock(
                this.rulesBody,
                rulesCopy,
                leftW - 28,
                boxH - 62,
                useCompactRules ? Math.max(10, menuType.caption - (compactLandscape ? 1 : 0)) : menuType.body,
                compactLandscape ? 9 : Math.max(10, menuType.caption - 1),
                compactLandscape ? 2 : 5,
            );

            this.playersTitle.setPosition(rightX + rightW * 0.5, contentTop + 20);
            this.playersBody.setPosition(rightX + rightW * 0.5, contentTop + 42);
            this.fitTextBlock(
                this.playersBody,
                this.playersBodyRaw || String(this.playersBody.text ?? ''),
                rightW - 28,
                boxH - 62,
                compactLandscape ? Math.max(10, menuType.caption - 1) : menuType.caption,
                compactLandscape ? 9 : Math.max(10, menuType.caption - 1),
                compactLandscape ? 2 : 4,
            );
        } else {
            const gap = tier === 'A' ? 10 : 12;
            const boxW = panelW - 24;
            const minRulesH = useCompactRules ? 82 : 132;
            const minPlayersH = tier === 'A' ? 80 : 92;
            const rulesTargetH = Math.round(contentH * (useCompactRules ? 0.34 : 0.46));
            const maxRulesH = Math.max(minRulesH, contentH - minPlayersH - gap);
            const rulesH = Math.max(minRulesH, Math.min(rulesTargetH, maxRulesH));
            const playersH = Math.max(minPlayersH, contentH - rulesH - gap);
            const x = px + 12;
            const playersY = contentTop + rulesH + gap;

            this.drawSubPanel(this.rulesBox, x, contentTop, boxW, rulesH);
            this.drawSubPanel(this.playersBox, x, playersY, boxW, playersH);

            this.rulesTitle.setPosition(x + boxW * 0.5, contentTop + 18);
            this.rulesBody.setPosition(x + boxW * 0.5, contentTop + 38);
            this.fitTextBlock(
                this.rulesBody,
                rulesCopy,
                boxW - 24,
                rulesH - 54,
                menuType.caption,
                10,
                4,
            );

            this.playersTitle.setPosition(x + boxW * 0.5, playersY + 18);
            this.playersBody.setPosition(x + boxW * 0.5, playersY + 38);
            this.fitTextBlock(
                this.playersBody,
                this.playersBodyRaw || String(this.playersBody.text ?? ''),
                boxW - 24,
                playersH - 54,
                menuType.caption,
                10,
                4,
            );
        }

        this.actionButtonHit.setPosition(cx, buttonY).setSize(buttonW, buttonH);
        this.actionButtonGfx.setPosition(cx, buttonY);
        this.actionButtonText
            .setPosition(cx, buttonY)
            .setFontSize(`${menuType.button}px`);

        this.feedbackText
            .setPosition(cx, py + panelH - Math.max(16, feedbackBlockH * 0.45))
            .setWordWrapWidth(panelW * 0.9, true)
            .setFontSize(`${menuType.caption}px`);

        if (this.preLobbyGuideEnabled) {
            const helpSize = minSide < 420 ? 36 : 40;
            this.helpButtonHit
                .setPosition(px + panelW - helpSize * 0.5 - 10, topY - 2)
                .setSize(helpSize, helpSize)
                .setVisible(true);
            this.helpButtonGfx.setPosition(this.helpButtonHit.x, this.helpButtonHit.y).setVisible(true);
            this.helpButtonText
                .setPosition(this.helpButtonHit.x, this.helpButtonHit.y - 1)
                .setFontSize(`${menuType.button}px`)
                .setVisible(true);
            this.drawHelpButton(true);
            this.layoutHelpOverlay();
        } else {
            if (this.helpVisible) this.hideHelpOverlay();
            this.helpButtonHit.setVisible(false);
            this.helpButtonGfx.setVisible(false);
            this.helpButtonText.setVisible(false);
            this.helpOverlay.setVisible(false);
            this.helpPanel.setVisible(false);
            this.helpTitle.setVisible(false);
            this.helpBody.setVisible(false);
            this.helpCloseBtn.setVisible(false);
            this.helpCloseHit.setVisible(false);
            this.helpCloseLabel.setVisible(false);
            if (this.helpButtonHit.input) this.helpButtonHit.input.enabled = false;
            if (this.helpCloseHit.input) this.helpCloseHit.input.enabled = false;
        }

        this.drawActionButton(Boolean(this.actionButtonHit.input?.enabled));
    }

    private useCompactRulesCopy(tier: LayoutTier): boolean {
        return tier === 'A' || tier === 'B' || tier === 'C';
    }

    private getRulesCopy(tier: LayoutTier): string {
        if (tier === 'C') return this.tr('game_rules_micro');
        return this.useCompactRulesCopy(tier)
            ? this.tr('game_rules_brief')
            : this.tr('pre_lobby_rules_body');
    }

    private fitTextBlock(
        textObj: Phaser.GameObjects.Text,
        rawText: string,
        maxWidth: number,
        maxHeight: number,
        preferredFontSize: number,
        minFontSize: number,
        baseLineSpacing: number,
    ) {
        const width = Math.max(72, Math.floor(maxWidth));
        const height = Math.max(18, Math.floor(maxHeight));
        const fullText = String(rawText ?? '').trim();

        textObj.setWordWrapWidth(width, true);
        if (!fullText) {
            textObj.setText('');
            return;
        }

        for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 1) {
            const spacing = Math.max(0, Math.round(baseLineSpacing * (fontSize / Math.max(preferredFontSize, 1))));
            textObj
                .setFontSize(`${fontSize}px`)
                .setLineSpacing(spacing)
                .setText(fullText);
            if (textObj.getBounds().height <= height + 0.5) return;
        }

        const lines = fullText.split('\n');
        const fallbackSpacing = Math.max(0, Math.round(baseLineSpacing * 0.65));
        textObj
            .setFontSize(`${minFontSize}px`)
            .setLineSpacing(fallbackSpacing)
            .setText(fullText);
        if (textObj.getBounds().height <= height + 0.5) return;

        let visibleLines = [...lines];
        while (visibleLines.length > 1) {
            textObj.setText(visibleLines.join('\n'));
            if (textObj.getBounds().height <= height + 0.5) return;

            visibleLines.pop();
            const lastIndex = visibleLines.length - 1;
            const lastLine = String(visibleLines[lastIndex] ?? '').replace(/\.{3}$/, '').trimEnd();
            visibleLines[lastIndex] = lastLine ? `${lastLine}...` : '...';
        }

        let singleLine = String(visibleLines[0] ?? '').replace(/\.{3}$/, '').trimEnd();
        while (singleLine.length > 1) {
            textObj.setText(`${singleLine}...`);
            if (textObj.getBounds().height <= height + 0.5) return;
            singleLine = singleLine.slice(0, -1).trimEnd();
        }
        textObj.setText(singleLine ? `${singleLine}...` : '...');
    }

    private drawSubPanel(target: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
        target.clear();
        target.fillStyle(0x193247, 0.9);
        target.fillRoundedRect(x, y, w, h, 14);
        target.fillStyle(0x8fd8ff, 0.05);
        target.fillRoundedRect(x + 3, y + 3, w - 6, Math.max(16, h * 0.18), { tl: 11, tr: 11, bl: 0, br: 0 });
        target.lineStyle(1.1, 0xb9d9ef, 0.68);
        target.strokeRoundedRect(x, y, w, h, 14);
    }

    private drawActionButton(active: boolean) {
        const w = this.actionButtonHit.width;
        const h = this.actionButtonHit.height;
        paintRetroButton(
            this.actionButtonGfx,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x3d8f6c : 0x47667c,
                border: active ? 0xcff6dd : 0xbbd9ec,
                glossAlpha: active ? 0.13 : 0.07,
            },
        );
        this.actionButtonText.setColor(active ? '#ffffff' : '#d5e3df');
    }

    private drawHelpButton(active: boolean) {
        const w = this.helpButtonHit.width;
        const h = this.helpButtonHit.height;
        paintRetroButton(
            this.helpButtonGfx,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x496786 : 0x32465b,
                border: active ? 0xd6ecff : 0x89a3bb,
                glossAlpha: active ? 0.17 : 0.08,
            },
        );
        this.helpButtonText.setColor(active ? '#f7fdff' : '#c6d6e6');
    }

    private layoutHelpOverlay() {
        const w = this.scale.width;
        const h = this.scale.height;
        const menuType = getMenuTypographyByTier(resolveLayoutTier(w, h));
        const cx = w * 0.5;
        const cy = h * 0.5;
        const panelW = Phaser.Math.Clamp(w * (w > h ? 0.72 : 0.92), 300, 860);
        const panelH = Phaser.Math.Clamp(h * (w > h ? 0.82 : 0.88), 280, 760);
        const panelX = cx - panelW * 0.5;
        const panelY = cy - panelH * 0.5;

        this.helpOverlay.setPosition(cx, cy).setSize(w, h);

        this.helpPanel.clear();
        this.helpPanel.fillStyle(0x1a2a3b, 0.97);
        this.helpPanel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
        this.helpPanel.fillStyle(0xffffff, 0.08);
        this.helpPanel.fillRoundedRect(panelX + 3, panelY + 3, panelW - 6, 38, { tl: 14, tr: 14, bl: 0, br: 0 });
        this.helpPanel.lineStyle(2, 0xb7d2eb, 0.92);
        this.helpPanel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);

        const closeSize = Phaser.Math.Clamp(panelW * 0.05, 30, 40);
        const closeX = panelX + panelW - closeSize * 0.5 - 12;
        const closeY = panelY + closeSize * 0.5 + 10;
        this.helpCloseBtn.clear();
        this.helpCloseBtn.fillStyle(0x2d4257, 0.98);
        this.helpCloseBtn.fillCircle(closeX, closeY, closeSize * 0.5);
        this.helpCloseBtn.lineStyle(2, 0xf0f8ff, 0.95);
        this.helpCloseBtn.strokeCircle(closeX, closeY, closeSize * 0.5);
        this.helpCloseHit.setPosition(closeX, closeY).setSize(closeSize + 14, closeSize + 14);
        this.helpCloseLabel
            .setPosition(closeX, closeY - 1)
            .setFontSize(`${menuType.sectionTitle}px`);

        const helpContent = buildMatchHelpContent(this.tr.bind(this));
        this.helpTitle
            .setText(helpContent.title)
            .setPosition(cx, panelY + 14)
            .setWordWrapWidth(panelW - 56)
            .setFontSize(`${menuType.sectionTitle + 1}px`);
        this.helpBody
            .setText(`${helpContent.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n')}\n\n${helpContent.closeHint}`)
            .setPosition(cx, panelY + 62)
            .setWordWrapWidth(panelW - 44)
            .setFontSize(`${menuType.body}px`);

        if (!this.helpVisible) {
            this.helpPanel.setVisible(false);
            this.helpTitle.setVisible(false);
            this.helpBody.setVisible(false);
            this.helpCloseBtn.setVisible(false);
            this.helpCloseHit.setVisible(false);
            this.helpCloseLabel.setVisible(false);
        }
    }

    private showHelpOverlay() {
        if (!this.preLobbyGuideEnabled) return;
        if (this.helpVisible) return;
        this.helpVisible = true;
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
            },
        });
    }

    private applyTextResolution() {
        [
            this.title,
            this.subtitle,
            this.roomCodeText,
            this.statusText,
            this.feedbackText,
            this.rulesTitle,
            this.rulesBody,
            this.playersTitle,
            this.playersBody,
            this.actionButtonText,
            this.helpButtonText,
            this.helpTitle,
            this.helpBody,
            this.helpCloseLabel,
        ].forEach((txt) => txt.setResolution(this.textResolution));
    }
}





