import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { PreLobbyScene } from './scenes/PreLobbyScene';
import { GameScene } from './scenes/GameScene';

const deviceResolution = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

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
        antialias: false,
        antialiasGL: false,
        pixelArt: true,
        roundPixels: true,
        powerPreference: 'high-performance',
    },
    dom: {
        createContainer: true,
    },
    scene: [BootScene, LoginScene, PreLobbyScene, GameScene],
} as Phaser.Types.Core.GameConfig;

const game = new Phaser.Game(config);
(window as any).game = game;

export default game;
