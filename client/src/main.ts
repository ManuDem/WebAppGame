import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { GameScene } from './scenes/GameScene';

// Mobile-first config
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app', // Container nel DOM
    width: 390,    // iPhone portrait width (base logica)
    height: 844,   // iPhone portrait height
    backgroundColor: '#1a1a2e', // Sfondo scuro per contrasto
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    dom: {
        createContainer: true
    },
    scene: [BootScene, LoginScene, GameScene]
};

export default new Phaser.Game(config);
