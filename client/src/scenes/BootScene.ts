import Phaser from 'phaser';

import { ServerManager } from '../network/ServerManager';

export class BootScene extends Phaser.Scene {
    private serverManager!: ServerManager;

    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Here we will load assets in the future
        // this.load.image('card_back', 'assets/card_back.png');
    }

    async create() {
        this.add.text(this.scale.width / 2, this.scale.height / 2, 'Connecting to Server...', {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5);

        this.serverManager = new ServerManager();

        this.serverManager = new ServerManager();

        // Simulate some loading time for assets
        this.time.delayedCall(500, () => {
            this.scene.start('LoginScene', { serverManager: this.serverManager });
        });
    }
}
