import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { GameScene } from './scenes/GameScene';

const deviceResolution = Math.max(1.5, Math.min((window.devicePixelRatio || 1) * 1.25, 4));

const config = {
    type: Phaser.AUTO,
    parent: 'app',
    resolution: deviceResolution,
    autoRound: false,
    width: 1280,
    height: 720,
    backgroundColor: '#0b1220',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    render: {
        antialias: true,
        antialiasGL: true,
        pixelArt: false,
        roundPixels: false,
        powerPreference: 'high-performance',
    },
    dom: {
        createContainer: true,
    },
    scene: [BootScene, LoginScene, GameScene],
} as Phaser.Types.Core.GameConfig;

const game = new Phaser.Game(config);
(window as any).game = game;

export default game;
