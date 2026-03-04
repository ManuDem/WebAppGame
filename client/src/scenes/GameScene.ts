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