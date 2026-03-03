import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';

export class LoginScene extends Phaser.Scene {
    private serverManager!: ServerManager;
    private feedbackText!: Phaser.GameObjects.Text;
    private joinButton!: Phaser.GameObjects.Rectangle;
    private joinButtonText!: Phaser.GameObjects.Text;

    // Riferimento al DOM element
    private nameInput!: HTMLInputElement;

    constructor() {
        super({ key: 'LoginScene' });
    }

    init(data: { serverManager: ServerManager }) {
        this.serverManager = data.serverManager;
    }

    create() {
        const { width, height } = this.scale;

        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        this.add.text(width / 2, height * 0.2, 'LUCrAre: SEMPRE', {
            fontSize: '32px',
            color: '#f2e9e4',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.3, 'Inserisci il tuo nome CEO', {
            fontSize: '18px',
            color: '#9a8c98'
        }).setOrigin(0.5);

        // Input DOM
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Nome CEO (3-15 car.)';
        this.nameInput.style.width = '200px';
        this.nameInput.style.padding = '10px';
        this.nameInput.style.fontSize = '16px';
        this.nameInput.style.textAlign = 'center';
        this.nameInput.style.border = '2px solid #4a4e69';
        this.nameInput.style.borderRadius = '5px';
        this.nameInput.style.backgroundColor = '#22223b';
        this.nameInput.style.color = '#ffffff';
        this.nameInput.style.outline = 'none';

        this.add.dom(width / 2, height * 0.4, this.nameInput);

        // Feedback Text
        this.feedbackText = this.add.text(width / 2, height * 0.5, '', {
            fontSize: '14px',
            color: '#ff0000',
            align: 'center',
            wordWrap: { width: width - 40 }
        }).setOrigin(0.5);

        // Button
        const btnY = height * 0.6;
        this.joinButton = this.add.rectangle(width / 2, btnY, 200, 50, 0x4cc9f0, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.joinButton.setFillStyle(0x3a0ca3);
            })
            .on('pointerup', () => {
                this.joinButton.setFillStyle(0x4cc9f0);
                this.handleJoin();
            })
            .on('pointerout', () => {
                this.joinButton.setFillStyle(0x4cc9f0);
            });

        this.joinButtonText = this.add.text(width / 2, btnY, 'Entra in Riunione', {
            fontSize: '18px',
            color: '#000000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private async handleJoin() {
        if (!this.serverManager) {
            this.feedbackText.setText('Errore Critico: Client non inizializzato.');
            return;
        }

        const ceoName = this.nameInput.value.trim();

        // Validazione Lato Client
        if (ceoName.length < 3 || ceoName.length > 15) {
            this.feedbackText.setText('Il nome deve essere tra 3 e 15 caratteri.');
            this.feedbackText.setColor('#ff0000');
            return;
        }

        // UX Transizione
        this.joinButton.disableInteractive();
        this.joinButton.setFillStyle(0x555555);
        this.joinButtonText.setText('Connessione...');
        this.nameInput.disabled = true;
        this.feedbackText.setText('');

        try {
            // Unisciti alla stanza passando il nome
            await this.serverManager.joinOfficeRoom(ceoName);

            // Successo: Cambia scena alla GameScene locale 
            // TODO: La direttiva dice di andare alla LobbyScene, per ora mascheriamo la GameScene come test temporaneo se LobbyScene manca
            this.feedbackText.setText('Connesso!');
            this.feedbackText.setColor('#00ff00');

            this.time.delayedCall(500, () => {
                // Rimuoviamo l'input text dal DOM prima di cambiare Scena
                this.nameInput.remove();
                this.scene.start('GameScene', { serverManager: this.serverManager });
            });

        } catch (e: any) {
            // Rifiuto da parte del server
            console.error('Join Error', e);
            const errorMsg = e.message || 'Errore di connessione.';
            this.feedbackText.setText(`Accesso Negato: ${errorMsg}`);
            this.feedbackText.setColor('#ff0000');

            // Ripristina l'UI
            this.joinButton.setInteractive();
            this.joinButton.setFillStyle(0x4cc9f0);
            this.joinButtonText.setText('Riprova');
            this.nameInput.disabled = false;
        }
    }
}
