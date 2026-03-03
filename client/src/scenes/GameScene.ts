import Phaser from 'phaser';
import { CardGameObject } from '../gameobjects/CardGameObject';
import { ServerManager } from '../network/ServerManager';
import { IGameState, IPlayer, ICardData } from '../../../shared/SharedTypes';

export class GameScene extends Phaser.Scene {
    private serverManager!: ServerManager;
    private handCards: CardGameObject[] = [];
    private stateText!: Phaser.GameObjects.Text;

    // UI Elements for Phase 4
    private deckButton!: Phaser.GameObjects.Rectangle;
    private deckCountText!: Phaser.GameObjects.Text;
    private endTurnButton!: Phaser.GameObjects.Rectangle;
    private endTurnButtonText!: Phaser.GameObjects.Text;
    private actionPointsText!: Phaser.GameObjects.Text;
    private turnIndicatorText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { serverManager: ServerManager }) {
        this.serverManager = data.serverManager;
        // Listeners for UI Syncing
        if (this.serverManager) {
            this.serverManager.onStateChange = this.handleStateChange.bind(this);
            this.serverManager.onPlayerChange = this.handlePlayerChange.bind(this);
        }
    }

    create() {
        const { width, height } = this.scale;

        // 1. TOP UI: Avversari (20% dello schermo in alto)
        const topHeight = height * 0.2;
        this.add.rectangle(width / 2, topHeight / 2, width, topHeight, 0x22223b)
            .setStrokeStyle(2, 0xd00000); // Bordo debug
        this.add.text(width / 2, topHeight / 2, 'TOP UI\nAvversari (CEO Rivali)', {
            fontSize: '18px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5);

        // 2. CENTER UI: Il Tavolo o "Ufficio" (55% dello schermo al centro)
        const centerHeight = height * 0.55;
        const centerY = topHeight + (centerHeight / 2);
        this.add.rectangle(width / 2, centerY, width, centerHeight, 0x4a4e69)
            .setStrokeStyle(4, 0x9a8c98);
        this.add.text(width / 2, centerY, 'CENTER UI\nTavolo & Crisi Aziendali', {
            fontSize: '24px', color: '#f2e9e4', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 3. BOTTOM UI: La Mano del giocatore (25% dello schermo in basso)
        const bottomHeight = height * 0.25;
        const bottomY = topHeight + centerHeight + (bottomHeight / 2);
        this.add.rectangle(width / 2, bottomY, width, bottomHeight, 0x11111a)
            .setStrokeStyle(2, 0x4cc9f0);
        this.add.text(width / 2, bottomY, 'BOTTOM UI\nLe tue Carte Dipendente/Azione', {
            fontSize: '18px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5);

        // Turn Indicator (Top center below Avversari)
        this.turnIndicatorText = this.add.text(width / 2, topHeight + 15, 'In attesa d\'inizio...', {
            fontSize: '16px', color: '#ffcc00', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Deck Button (Center leftish)
        this.deckButton = this.add.rectangle(width / 2 - 60, centerY + 30, 80, 110, 0x800000)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.serverManager.drawCard();
                this.deckButton.disableInteractive();
                // Si riabiliterà all'update dello stato se è ancora il suo turno e ha PA
                this.time.delayedCall(500, () => {
                    if (this.serverManager.room) this.updateInteractables(this.serverManager.room.state);
                });
            });

        this.add.text(width / 2 - 60, centerY + 30, 'MAZZO', {
            fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.deckCountText = this.add.text(width / 2 - 60, centerY + 65, 'Carte: ?', {
            fontSize: '12px', color: '#dddddd'
        }).setOrigin(0.5);

        // End Turn Button (Center rightish)
        this.endTurnButton = this.add.rectangle(width / 2 + 60, centerY + 30, 100, 40, 0x4cc9f0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.serverManager.endTurn();
                this.endTurnButton.disableInteractive();
            });

        this.endTurnButtonText = this.add.text(width / 2 + 60, centerY + 30, 'Fine Turno', {
            fontSize: '14px', color: '#000000', fontStyle: 'bold'
        }).setOrigin(0.5);

        // PA HUD (Bottom UI left corner)
        this.actionPointsText = this.add.text(20, bottomY - 60, 'PA: 0', {
            fontSize: '18px', color: '#00ff00', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.stateText = this.add.text(width / 2, topHeight / 2 + 30, 'Phase: WAITING', {
            fontSize: '14px', color: '#aaaaaa', align: 'center'
        }).setOrigin(0.5);
    }

    private handleStateChange(state: IGameState) {
        if (!this.stateText) return;
        this.stateText.setText(`Fase: ${state.phase} | Turno: ${state.turnNumber}`);
        this.deckCountText.setText(`Carte: ${state.deckCount}`);
        this.updateInteractables(state);
    }

    private updateInteractables(state: IGameState) {
        if (!this.serverManager.room) return;

        const mySessionId = this.serverManager.room.sessionId;
        const isMyTurn = state.currentTurnPlayerId === mySessionId;
        const myPlayer = state.players.get(mySessionId);

        const activePlayer = state.players.get(state.currentTurnPlayerId);

        if (activePlayer) {
            this.turnIndicatorText.setText(isMyTurn ? 'IL TUO TURNO!' : `Turno di: ${activePlayer.username}`);
            this.turnIndicatorText.setColor(isMyTurn ? '#00ff00' : '#ffcc00');
        }

        // Logic to enable/disable strictly based on state and my turn
        if (isMyTurn && state.phase === 'PLAYER_TURN') {
            const hasPA = (myPlayer?.actionPoints || 0) >= 1; // DRAW_CARD_COST is conceptually 1
            const hasCards = state.deckCount > 0;

            if (hasPA && hasCards) {
                this.deckButton.setInteractive({ useHandCursor: true });
                this.deckButton.setStrokeStyle(3, 0x00ff00);
            } else {
                this.deckButton.disableInteractive();
                this.deckButton.setStrokeStyle(3, 0x555555);
            }

            this.endTurnButton.setInteractive({ useHandCursor: true });
            this.endTurnButton.setFillStyle(0x4cc9f0);
            this.endTurnButtonText.setText('Fine Turno');
        } else {
            this.deckButton.disableInteractive();
            this.deckButton.setStrokeStyle(3, 0x555555);

            this.endTurnButton.disableInteractive();
            this.endTurnButton.setFillStyle(0x555555);
            this.endTurnButtonText.setText('Attendi...');
        }
    }

    private handlePlayerChange(player: IPlayer) {
        // Logging temporary
        console.log('Player update received', player);
        this.actionPointsText.setText(`PA: ${player.actionPoints}`);
        this.renderHand(player.hand);
    }

    private renderHand(handData: ICardData[]) {
        const { width, height } = this.scale;

        // Pulisce le carte vecchie (metodo semplice rigenerativo)
        this.handCards.forEach(card => card.destroy());
        this.handCards = [];

        if (!handData || handData.length === 0) return;

        // Calcola la posizione
        const bottomHeight = height * 0.25;
        const bottomY = (height * 0.75) + (bottomHeight / 2);

        const cardSpacing = 110;
        const startX = (width / 2) - ((handData.length - 1) * cardSpacing) / 2;

        handData.forEach((cardData, index) => {
            const card = new CardGameObject(this, startX + (index * cardSpacing), bottomY, cardData);
            this.add.existing(card);
            this.handCards.push(card);
        });
    }
}
