import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LoginScene } from './scenes/LoginScene';
import { PreLobbyScene } from './scenes/PreLobbyScene';
import { GameScene } from './scenes/GameScene';
import { isQaMatchModeEnabled } from './qa/MockMatchState';
import { sanitizeLanguage } from './i18n';
import './app.css';
import { ensureUiRoot, setUiRootLanguage, syncUiRootViewport } from './ui/dom/UiRoot';

const deviceResolution = Math.max(1, Math.min((window.devicePixelRatio || 1) * 1.1, 3));
const qaMatchMode = isQaMatchModeEnabled(window.location.search);
const params = new URLSearchParams(window.location.search);
const qaScreen = String(params.get('qaScreen') ?? '').toLowerCase();
const queryLang = params.get('lang');
if (queryLang) {
    localStorage.setItem('lucrare_lang', sanitizeLanguage(queryLang));
}
const initialLang = sanitizeLanguage(localStorage.getItem('lucrare_lang'));

const resolvedScenes = (() => {
    if (qaMatchMode) return [GameScene];
    if (qaScreen === 'login') return [LoginScene];
    if (qaScreen === 'prelobby') return [PreLobbyScene];
    if (qaScreen === 'boot') return [BootScene, LoginScene];
    return [BootScene, LoginScene, PreLobbyScene, GameScene];
})();

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
        roundPixels: true,
        powerPreference: 'high-performance',
    },
    dom: {
        createContainer: true,
    },
    scene: resolvedScenes,
} as Phaser.Types.Core.GameConfig;

const game = new Phaser.Game(config);
(window as any).game = game;

const syncUiRoot = () => {
    ensureUiRoot();
    syncUiRootViewport(window.innerWidth, window.innerHeight);
    setUiRootLanguage(initialLang);
};
syncUiRoot();
window.addEventListener('resize', syncUiRoot);

export default game;
