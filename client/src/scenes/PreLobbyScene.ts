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
    layoutBrandHeader,
    placeBrandHeader,
} from '../ui/Branding';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { paintRetroButton } from '../ui/RetroButtonPainter';

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
    private readonly textResolution = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));

    constructor() {
        super({ key: 'PreLobbyScene' });
    }

    init(data: { serverManager: ServerManager; lang?: SupportedLanguage; roomCode?: string }) {
        this.serverManager = data?.serverManager ?? new ServerManager();
        this.lang = sanitizeLanguage(data?.lang ?? localStorage.getItem('lucrare_lang'));
        this.roomCode = String(data?.roomCode ?? '').trim();
        this.enteringGame = false;
    }

    create() {
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
            color: '#fff2d8',
            fontStyle: '700',
            stroke: '#102a3d',
            strokeThickness: 2,
        }).setOrigin(0.5);

        this.statusText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#dbeaf7',
            fontStyle: '600',
            align: 'center',
        }).setOrigin(0.5);

        this.feedbackText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ffd7a8',
            fontStyle: '700',
            align: 'center',
        }).setOrigin(0.5);

        this.rulesTitle = this.add.text(0, 0, t(this.lang, 'pre_lobby_rules_title'), {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#ffefcb',
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
            color: '#ffefcb',
            fontStyle: '700',
            letterSpacing: 0.8,
        }).setOrigin(0.5);

        this.playersBody = this.add.text(0, 0, t(this.lang, 'pre_lobby_syncing'), {
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

        this.applyTextResolution();
        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.actionButtonFx?.destroy();
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
                        const markerShort = p.isReady ? this.tr('game_status_ready') : this.tr('game_status_waiting_short');
                        const netShort = p.isConnected ? this.tr('game_status_online_short') : this.tr('game_status_offline_short');
                        return `- ${p.username}${meTag} | ${markerShort} | ${netShort}`;
                    }
                    const marker = p.isReady ? this.tr('game_status_ready') : this.tr('game_status_not_ready');
                    const net = p.isConnected ? this.tr('game_status_online') : this.tr('game_status_offline');
                    return `- ${p.username}${meTag} | ${marker} | ${net}`;
                })
                .join('\n')
            : this.tr('game_lobby_no_players');
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
        const isLandscape = w > h;
        const cx = w * 0.5;

        drawPokemonBackdrop(this.bg, w, h, 0.62);
        this.cloudLayer.setSize(w, h);
        this.ditherLayer.setSize(w, h);

        applyBrandTypography(this.title, this.subtitle, minSide);
        const header = layoutBrandHeader(w, h, minSide);
        placeBrandHeader(this.title, this.subtitle, cx, header.titleY, minSide);

        const panelW = Phaser.Math.Clamp(w * (isLandscape ? 0.9 : 0.95), 320, 980);
        const panelH = Phaser.Math.Clamp(h * (isLandscape ? 0.82 : 0.82), 360, 780);
        const px = cx - panelW * 0.5;
        const py = h - panelH - Phaser.Math.Clamp(h * 0.03, 8, 24);

        this.panel.clear();
        this.panel.fillStyle(0x2a4257, 0.92);
        this.panel.fillRoundedRect(px, py, panelW, panelH, 20);
        this.panel.lineStyle(1.4, 0xf3deb3, 0.95);
        this.panel.strokeRoundedRect(px, py, panelW, panelH, 20);
        this.panel.lineStyle(1, 0xffffff, 0.08);
        this.panel.strokeRoundedRect(px + 4, py + 4, panelW - 8, panelH - 8, 16);

        const topY = py + Phaser.Math.Clamp(panelH * 0.08, 30, 54);
        this.roomCodeText
            .setPosition(cx, topY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.038, 20, 34)}px`);

        this.statusText
            .setPosition(cx, topY + Phaser.Math.Clamp(panelH * 0.1, 36, 54))
            .setWordWrapWidth(panelW * 0.9, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.018, 12, 17)}px`);

        const contentTop = topY + Phaser.Math.Clamp(panelH * 0.17, 64, 96);
        const contentBottom = py + panelH * 0.83;
        const contentH = Math.max(150, contentBottom - contentTop);

        if (isLandscape) {
            const gap = Phaser.Math.Clamp(panelW * 0.03, 16, 28);
            const leftW = (panelW - gap * 3) * 0.52;
            const rightW = panelW - gap * 3 - leftW;
            const boxH = contentH;

            const leftX = px + gap;
            const rightX = leftX + leftW + gap;
            this.drawSubPanel(this.rulesBox, leftX, contentTop, leftW, boxH);
            this.drawSubPanel(this.playersBox, rightX, contentTop, rightW, boxH);

            this.rulesTitle.setPosition(leftX + leftW * 0.5, contentTop + 20);
            this.rulesBody
                .setPosition(leftX + leftW * 0.5, contentTop + 42)
                .setWordWrapWidth(leftW - 28, true)
                .setFontSize(`${Phaser.Math.Clamp(minSide * 0.017, 12, 15)}px`);

            this.playersTitle.setPosition(rightX + rightW * 0.5, contentTop + 20);
            this.playersBody
                .setPosition(rightX + rightW * 0.5, contentTop + 42)
                .setWordWrapWidth(rightW - 28, true)
                .setFontSize(`${Phaser.Math.Clamp(minSide * 0.0165, 11, 14)}px`);
        } else {
            const gap = Phaser.Math.Clamp(panelH * 0.03, 12, 18);
            const boxW = panelW - 24;
            const rulesH = contentH * 0.45;
            const playersH = contentH - rulesH - gap;
            const x = px + 12;

            this.drawSubPanel(this.rulesBox, x, contentTop, boxW, rulesH);
            this.drawSubPanel(this.playersBox, x, contentTop + rulesH + gap, boxW, playersH);

            this.rulesTitle.setPosition(x + boxW * 0.5, contentTop + 18);
            this.rulesBody
                .setPosition(x + boxW * 0.5, contentTop + 38)
                .setWordWrapWidth(boxW - 24, true)
                .setFontSize(`${Phaser.Math.Clamp(minSide * 0.0165, 11, 14)}px`);

            this.playersTitle.setPosition(x + boxW * 0.5, contentTop + rulesH + gap + 18);
            this.playersBody
                .setPosition(x + boxW * 0.5, contentTop + rulesH + gap + 38)
                .setWordWrapWidth(boxW - 24, true)
                .setFontSize(`${Phaser.Math.Clamp(minSide * 0.016, 10, 13)}px`);
        }

        const buttonW = Phaser.Math.Clamp(panelW * 0.58, 220, 420);
        const buttonH = Phaser.Math.Clamp(panelH * 0.1, 48, 62);
        const buttonY = py + panelH * 0.89;
        this.actionButtonHit.setPosition(cx, buttonY).setSize(buttonW, buttonH);
        this.actionButtonGfx.setPosition(cx, buttonY);
        this.actionButtonText
            .setPosition(cx, buttonY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.024, 15, 22)}px`);

        this.feedbackText
            .setPosition(cx, py + panelH * 0.96)
            .setWordWrapWidth(panelW * 0.9, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.0155, 11, 14)}px`);

        this.drawActionButton(Boolean(this.actionButtonHit.input?.enabled));
    }

    private drawSubPanel(target: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
        target.clear();
        target.fillStyle(0x1d2d3c, 0.88);
        target.fillRoundedRect(x, y, w, h, 14);
        target.lineStyle(1.1, 0xb8cfdf, 0.64);
        target.strokeRoundedRect(x, y, w, h, 14);
    }

    private drawActionButton(active: boolean) {
        const w = this.actionButtonHit.width;
        const h = this.actionButtonHit.height;
        paintRetroButton(
            this.actionButtonGfx,
            { width: w, height: h, radius: 12, borderWidth: 1.2 },
            {
                base: active ? 0x4f7d6a : 0x425b52,
                border: active ? 0xd0f6c9 : 0xa9c6bc,
                glossAlpha: active ? 0.13 : 0.07,
            },
        );
        this.actionButtonText.setColor(active ? '#ffffff' : '#d5e3df');
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
        ].forEach((txt) => txt.setResolution(this.textResolution));
    }
}
