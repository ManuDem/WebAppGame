import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';
import { readFreshReconnectContext } from '../network/ReconnectPolicy';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import {
    applyBrandTypography,
    BRAND_SUBTITLE_STYLE,
    BRAND_TITLE_STYLE,
    BRAND_TITLE_TEXT,
    placeBrandHeader,
} from '../ui/Branding';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { APP_FONT_FAMILY } from '../ui/Typography';
import { computeInitialScreenLayout } from '../ui/layout/InitialScreenLayout';
import { getMenuTypographyByTier } from '../ui/layout/LayoutTokens';
import { setUiRootLanguage, setUiRootScreen, syncUiRootViewport } from '../ui/dom/UiRoot';

const FONT_UI = APP_FONT_FAMILY;

type LangButton = {
    bg: Phaser.GameObjects.Graphics;
    hit: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    code: string;
};

type MenuDot = {
    node: Phaser.GameObjects.Arc;
    xRatio: number;
    yRatio: number;
    amp: number;
    speed: number;
    phase: number;
};

type EntryMode = 'host' | 'join';

type LoginSceneInitData = {
    serverManager: ServerManager;
    reconnectMessage?: string;
    reconnectPrefill?: {
        ceoName?: string;
        roomCode?: string;
    };
};

export class LoginScene extends Phaser.Scene {
    private serverManager!: ServerManager;

    private bg!: Phaser.GameObjects.Graphics;
    private cloudLayer!: Phaser.GameObjects.TileSprite;
    private ditherLayer!: Phaser.GameObjects.TileSprite;

    private panelGfx!: Phaser.GameObjects.Graphics;
    private panelShimmer!: Phaser.GameObjects.Graphics;
    private inputFrame!: Phaser.GameObjects.Graphics;

    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private inputLabel!: Phaser.GameObjects.Text;
    private hint!: Phaser.GameObjects.Text;
    private feedback!: Phaser.GameObjects.Text;

    private joinButtonGfx!: Phaser.GameObjects.Graphics;
    private joinButtonText!: Phaser.GameObjects.Text;
    private joinButtonHit!: Phaser.GameObjects.Rectangle;
    private backButtonGfx!: Phaser.GameObjects.Graphics;
    private backButtonText!: Phaser.GameObjects.Text;
    private backButtonHit!: Phaser.GameObjects.Rectangle;

    private langLabel!: Phaser.GameObjects.Text;
    private langButtons: Partial<Record<SupportedLanguage, LangButton>> = {};
    private modeLabel!: Phaser.GameObjects.Text;
    private modeButtons: Partial<Record<EntryMode, LangButton>> = {};
    private roomCodeLabel!: Phaser.GameObjects.Text;
    private roomCodeValue!: Phaser.GameObjects.Text;

    private inputDom!: Phaser.GameObjects.DOMElement;
    private nameInput!: HTMLInputElement;
    private roomCodeDom!: Phaser.GameObjects.DOMElement;
    private roomCodeInput!: HTMLInputElement;
    private joinButtonFx?: SimpleButtonController;
    private backButtonFx?: SimpleButtonController;
    private langButtonFx: SimpleButtonController[] = [];
    private modeButtonFx: SimpleButtonController[] = [];
    private menuDots: MenuDot[] = [];
    private inputPlaced = false;
    private nameExample = '';

    private busy = false;
    private lang: SupportedLanguage = DEFAULT_LANGUAGE;
    private mode: EntryMode = 'host';
    private modeConfirmed = false;
    private activeRoomCode = '0000';
    private initialFeedbackMessage = '';
    private reconnectPrefillName = '';
    private reconnectPrefillRoomCode = '';
    private readonly textResolution = 4;

    constructor() {
        super({ key: 'LoginScene' });
    }

    init(data?: LoginSceneInitData) {
        const params = new URLSearchParams(window.location.search);
        const queryLang = params.get('lang');
        this.serverManager = data?.serverManager ?? new ServerManager();
        this.lang = sanitizeLanguage(queryLang ?? localStorage.getItem('lucrare_lang'));
        if (queryLang) localStorage.setItem('lucrare_lang', this.lang);
        this.mode = 'host';
        this.modeConfirmed = false;
        this.nameExample = this.generateExampleName();
        this.activeRoomCode = `${Math.floor(1000 + Math.random() * 9000)}`;
        this.initialFeedbackMessage = typeof data?.reconnectMessage === 'string' ? data.reconnectMessage : '';
        this.reconnectPrefillName = '';
        this.reconnectPrefillRoomCode = '';

        const explicitPrefill = this.normalizeReconnectPrefill(
            data?.reconnectPrefill?.ceoName,
            data?.reconnectPrefill?.roomCode,
        );
        const shouldLoadStoredReconnectPrefill = Boolean(this.initialFeedbackMessage) || Boolean(data?.reconnectPrefill);
        const storedPrefill = shouldLoadStoredReconnectPrefill ? this.loadStoredReconnectPrefill() : null;
        const reconnectPrefill = explicitPrefill ?? storedPrefill;
        if (reconnectPrefill) {
            this.mode = 'join';
            this.modeConfirmed = true;
            this.reconnectPrefillName = reconnectPrefill.ceoName;
            this.reconnectPrefillRoomCode = reconnectPrefill.roomCode;
            this.activeRoomCode = reconnectPrefill.roomCode;
        } else if (this.initialFeedbackMessage) {
            this.mode = 'join';
            this.modeConfirmed = true;
        }
    }

    create() {
        this.inputPlaced = false;
        setUiRootScreen('login');
        setUiRootLanguage(this.lang);
        syncUiRootViewport(this.scale.width, this.scale.height);
        this.bg = this.add.graphics();
        ensurePokemonTextures(this);
        this.cloudLayer = this.add.tileSprite(0, 0, 256, 128, 'poke-clouds')
            .setOrigin(0)
            .setAlpha(0.33)
            .setDepth(-60);
        this.ditherLayer = this.add.tileSprite(0, 0, 64, 64, 'poke-dither')
            .setOrigin(0)
            .setAlpha(0.2)
            .setDepth(-59);

        this.panelGfx = this.add.graphics();
        this.panelShimmer = this.add.graphics().setAlpha(0);
        this.inputFrame = this.add.graphics().setDepth(25);

        this.title = this.add.text(0, 0, BRAND_TITLE_TEXT, BRAND_TITLE_STYLE).setOrigin(0.5).setAlpha(0);
        this.subtitle = this.add.text(0, 0, t(this.lang, 'brand_subtitle'), BRAND_SUBTITLE_STYLE).setOrigin(0.5).setAlpha(0);

        this.inputLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#d8edff',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.hint = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#c6dff3',
            fontStyle: '500',
        }).setOrigin(0.5);

        this.feedback = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ff8297',
            align: 'center',
        }).setOrigin(0.5);

        this.joinButtonGfx = this.add.graphics();
        this.joinButtonText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: '700',
        }).setOrigin(0.5);

        this.joinButtonHit = this.add.rectangle(0, 0, 200, 56, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        this.backButtonGfx = this.add.graphics();
        this.backButtonText = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ffffff',
            fontStyle: '700',
        }).setOrigin(0.5);
        this.backButtonHit = this.add.rectangle(0, 0, 108, 38, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        this.createMenuDots();
        this.createLanguageControls();
        this.createModeControls();
        this.createInput();
        this.applyReconnectPrefill();
        this.refreshLocalizedText();
        if (this.initialFeedbackMessage) {
            this.feedback.setText(this.initialFeedbackMessage).setColor('#ffcb80');
        }
        if (this.mode === 'host') {
            void this.refreshHostRoomCode();
        }

        this.boostText(
            this.title,
            this.subtitle,
            this.inputLabel,
            this.hint,
            this.feedback,
            this.joinButtonText,
            this.backButtonText,
            this.langLabel,
            this.modeLabel,
            this.roomCodeLabel,
            this.roomCodeValue,
            this.langButtons.it?.label,
            this.langButtons.en?.label,
            this.modeButtons.host?.label,
            this.modeButtons.join?.label,
        );

        this.joinButtonFx = createSimpleButtonFx(
            this,
            this.joinButtonHit,
            [this.joinButtonGfx, this.joinButtonText],
            { onClick: () => this.handleJoin() },
        );

        this.backButtonFx = createSimpleButtonFx(
            this,
            this.backButtonHit,
            [this.backButtonGfx, this.backButtonText],
            { onClick: () => this.handleBack() },
        );

        this.input.keyboard?.on('keydown-ENTER', this.handleJoin, this);

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.input.keyboard?.off('keydown-ENTER', this.handleJoin, this);
            this.joinButtonFx?.destroy();
            this.backButtonFx?.destroy();
            this.langButtonFx.forEach((fx) => fx.destroy());
            this.langButtonFx = [];
            this.modeButtonFx.forEach((fx) => fx.destroy());
            this.modeButtonFx = [];
            this.menuDots.forEach((dot) => dot.node.destroy());
            this.menuDots = [];
            this.cleanupInput();
        });

        this.handleResize(this.scale.gameSize);
        this.playIntroMotion();
    }

    private createMenuDots() {
        // Keep only cloud movement in background (no floating dots/circles).
        this.menuDots = [];
    }

    private createLanguageControls() {
        this.langLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#d7deea',
            fontStyle: '700',
            letterSpacing: 0.6,
        }).setOrigin(0.5).setDepth(40);

        this.langButtons.it = this.createLanguageButton('IT', 'it');
        this.langButtons.en = this.createLanguageButton('EN', 'en');
    }

    private createModeControls() {
        this.modeLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#d7deea',
            fontStyle: '700',
            letterSpacing: 0.6,
        }).setOrigin(0.5).setDepth(40);

        this.modeButtons.host = this.createModeButton(t(this.lang, 'login_mode_host'), 'host');
        this.modeButtons.join = this.createModeButton(t(this.lang, 'login_mode_join'), 'join');

        this.roomCodeLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#e6f2ff',
            fontStyle: '700',
            letterSpacing: 0.7,
        }).setOrigin(0.5).setDepth(40);

        this.roomCodeValue = this.add.text(0, 0, this.activeRoomCode, {
            fontFamily: FONT_UI,
            fontSize: '22px',
            color: '#d9f1ff',
            fontStyle: '700',
            stroke: '#123954',
            strokeThickness: 2,
            letterSpacing: 2.1,
        }).setOrigin(0.5).setDepth(41);
    }

    private createLanguageButton(label: string, language: SupportedLanguage): LangButton {
        const bg = this.add.graphics().setDepth(40);
        const txt = this.add.text(0, 0, label, {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#f4f8ff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(41);
        const hit = this.add.rectangle(0, 0, 56, 44, 0x000000, 0)
            .setDepth(41)
            .setInteractive({ useHandCursor: true });
        const fx = createSimpleButtonFx(this, hit, [bg, txt], {
            onClick: () => this.setLanguage(language),
        });
        this.langButtonFx.push(fx);

        return { bg, hit, label: txt, code: label };
    }

    private createModeButton(label: string, mode: EntryMode): LangButton {
        const bg = this.add.graphics().setDepth(40);
        const txt = this.add.text(0, 0, label, {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#f4f8ff',
            fontStyle: '700',
        }).setOrigin(0.5).setDepth(41);
        const hit = this.add.rectangle(0, 0, 96, 44, 0x000000, 0)
            .setDepth(41)
            .setInteractive({ useHandCursor: true });
        const fx = createSimpleButtonFx(this, hit, [bg, txt], {
            onClick: () => this.setMode(mode),
        });
        this.modeButtonFx.push(fx);
        return { bg, hit, label: txt, code: label };
    }

    private drawLanguageButton(button: LangButton, active: boolean) {
        const w = button.hit.width;
        const h = button.hit.height;

        paintRetroButton(
            button.bg,
            { width: w, height: h, radius: 8, borderWidth: 1.1 },
            {
                base: active ? 0x336a9f : 0x2f5c6c,
                border: active ? 0xe2f2ff : 0xb9d9e6,
                glossAlpha: active ? 0.2 : 0.1,
            },
        );
        button.label.setText(active ? `${button.code}*` : button.code);
        button.label.setColor('#ffffff');
    }

    private drawModeButton(button: LangButton, active: boolean) {
        const w = button.hit.width;
        const h = button.hit.height;

        paintRetroButton(
            button.bg,
            { width: w, height: h, radius: 9, borderWidth: 1.1 },
            {
                base: active ? 0x4a7f66 : 0x355e78,
                border: active ? 0xcdf3d8 : 0xb9d8ef,
                glossAlpha: active ? 0.16 : 0.09,
            },
        );
        button.label.setColor('#ffffff');
    }

    private redrawBackButton(buttonW: number, buttonH: number) {
        paintRetroButton(
            this.backButtonGfx,
            { width: buttonW, height: buttonH, radius: 10, borderWidth: 1.1 },
            {
                base: 0x385c79,
                border: 0xc8e6fb,
                glossAlpha: 0.14,
            },
        );
    }

    private setMode(mode: EntryMode) {
        if (this.mode === mode && this.modeConfirmed) return;
        this.mode = mode;
        this.modeConfirmed = true;
        if (mode === 'host') {
            void this.refreshHostRoomCode();
            this.nameInput.focus();
        } else if (this.modeConfirmed) {
            this.roomCodeInput.focus();
        }
        this.feedback.setText('');
        this.refreshLocalizedText();
        this.handleResize(this.scale.gameSize);
    }

    private handleBack() {
        if (this.busy) return;
        this.modeConfirmed = false;
        this.feedback.setText('');
        this.refreshLocalizedText();
        this.handleResize(this.scale.gameSize);
    }
    private setLanguage(language: SupportedLanguage) {
        this.lang = language;
        localStorage.setItem('lucrare_lang', language);
        setUiRootLanguage(language);
        this.refreshLocalizedText();
        this.feedback.setText('');
        this.handleResize(this.scale.gameSize);
    }

    private refreshLocalizedText() {
        const showForm = this.modeConfirmed;
        this.subtitle.setText(t(this.lang, 'brand_subtitle'));
        this.inputLabel.setText(t(this.lang, 'login_name_label'));
        this.hint.setText(t(this.lang, 'login_hint'));
        this.langLabel.setText(t(this.lang, 'login_language'));
        this.modeLabel.setText(showForm
            ? (this.mode === 'host' ? t(this.lang, 'login_mode_host') : t(this.lang, 'login_mode_join'))
            : t(this.lang, 'login_choose_mode'));
        this.roomCodeLabel.setText(t(this.lang, 'login_room_code_label'));
        this.backButtonText.setText(t(this.lang, 'login_back'));
        this.nameInput.placeholder = t(this.lang, 'login_name_example', { name: this.nameExample });
        this.roomCodeInput.placeholder = t(this.lang, 'login_room_code_hint');
        this.roomCodeValue.setText(this.activeRoomCode);

        this.setBusy(this.busy);

        const itButton = this.langButtons.it;
        const enButton = this.langButtons.en;
        if (itButton) this.drawLanguageButton(itButton, this.lang === 'it');
        if (enButton) this.drawLanguageButton(enButton, this.lang === 'en');

        const hostButton = this.modeButtons.host;
        const joinButton = this.modeButtons.join;
        const modeSelected = this.modeConfirmed;
        if (hostButton) {
            hostButton.label.setText(t(this.lang, 'login_mode_host'));
            this.drawModeButton(hostButton, modeSelected && this.mode === 'host');
        }
        if (joinButton) {
            joinButton.label.setText(t(this.lang, 'login_mode_join'));
            this.drawModeButton(joinButton, modeSelected && this.mode === 'join');
        }

        const showModeChoice = !showForm;
        if (hostButton) {
            hostButton.bg.setVisible(showModeChoice);
            hostButton.hit.setVisible(showModeChoice);
            hostButton.label.setVisible(showModeChoice);
        }
        if (joinButton) {
            joinButton.bg.setVisible(showModeChoice);
            joinButton.hit.setVisible(showModeChoice);
            joinButton.label.setVisible(showModeChoice);
        }

        this.inputLabel.setVisible(showForm);
        this.hint.setVisible(showForm);
        this.feedback.setVisible(showForm);
        this.joinButtonGfx.setVisible(showForm);
        this.joinButtonText.setVisible(showForm);
        this.joinButtonHit.setVisible(showForm);
        this.roomCodeLabel.setVisible(showForm);
        this.backButtonGfx.setVisible(showForm);
        this.backButtonText.setVisible(showForm);
        this.backButtonHit.setVisible(showForm);

        const nameNode = this.inputDom.node as HTMLElement;
        nameNode.style.display = showForm ? 'block' : 'none';
        nameNode.style.visibility = showForm ? 'visible' : 'hidden';
        this.inputDom.setVisible(showForm);

        const showJoinCodeInput = showForm && this.mode === 'join';
        const codeNode = this.roomCodeDom.node as HTMLElement;
        codeNode.style.display = showJoinCodeInput ? 'block' : 'none';
        codeNode.style.visibility = showJoinCodeInput ? 'visible' : 'hidden';
        this.roomCodeDom.setVisible(showJoinCodeInput);
        this.roomCodeValue.setVisible(showForm && !showJoinCodeInput);
    }

    private createInput() {
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = t(this.lang, 'login_name_placeholder');
        this.nameInput.maxLength = 15;
        this.nameInput.autocomplete = 'off';
        this.nameInput.spellcheck = false;
        this.nameInput.tabIndex = 0;

        const inputStyle: Partial<CSSStyleDeclaration> = {
            width: '320px',
            maxWidth: '78vw',
            minHeight: '48px',
            margin: '0',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1.6px solid #7da5c4',
            background: 'linear-gradient(180deg, rgba(247, 252, 255, 0.99), rgba(236, 246, 255, 0.99))',
            color: '#0f2e44',
            fontFamily: FONT_UI,
            fontSize: '16px',
            fontWeight: '600',
            lineHeight: '1.3',
            letterSpacing: '0.25px',
            textAlign: 'center',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            userSelect: 'text',
            display: 'block',
            caretColor: '#0f2e44',
            boxShadow: '0 6px 14px rgba(7, 22, 36, 0.17)',
            opacity: '1',
        };
        Object.assign(this.nameInput.style, inputStyle);
        this.nameInput.style.setProperty('-webkit-user-select', 'text');
        this.nameInput.style.setProperty('-webkit-text-fill-color', '#0f2e44');
        this.nameInput.style.setProperty('position', 'relative');
        this.nameInput.style.setProperty('z-index', '2');
        this.nameInput.style.setProperty('appearance', 'none');
        this.nameInput.style.setProperty('-webkit-appearance', 'none');

        this.nameInput.addEventListener('focus', () => {
            this.nameInput.style.borderColor = '#4f95c4';
            this.nameInput.style.boxShadow = '0 0 0 3px rgba(79, 149, 196, 0.24), 0 6px 14px rgba(7, 22, 36, 0.2)';
        });

        this.nameInput.addEventListener('blur', () => {
            this.nameInput.style.borderColor = '#7da5c4';
            this.nameInput.style.boxShadow = '0 6px 14px rgba(7, 22, 36, 0.17)';
        });

        this.inputDom = this.add.dom(0, 0, this.nameInput).setDepth(26);
        this.inputDom.setOrigin(0.5, 0.5);
        const domNode = this.inputDom.node as HTMLElement;
        domNode.style.display = 'block';
        domNode.style.width = 'auto';
        domNode.style.height = 'auto';
        domNode.style.pointerEvents = 'auto';
        domNode.style.opacity = '0';
        domNode.style.visibility = 'visible';
        domNode.style.zIndex = '1200';
        const domParent = domNode.parentElement as HTMLElement | null;
        if (domParent) {
            domParent.style.zIndex = '20';
        }
        domNode.addEventListener('pointerdown', (event) => event.stopPropagation());
        domNode.addEventListener('mousedown', (event) => event.stopPropagation());
        domNode.addEventListener('touchstart', (event) => event.stopPropagation());
        this.nameInput.addEventListener('keydown', (event) => event.stopPropagation());
        this.nameInput.addEventListener('pointerdown', (event) => event.stopPropagation());

        this.time.delayedCall(180, () => this.nameInput.focus());

        this.roomCodeInput = document.createElement('input');
        this.roomCodeInput.type = 'text';
        this.roomCodeInput.inputMode = 'numeric';
        this.roomCodeInput.placeholder = t(this.lang, 'login_room_code_hint');
        this.roomCodeInput.maxLength = 4;
        this.roomCodeInput.autocomplete = 'off';
        this.roomCodeInput.spellcheck = false;
        this.roomCodeInput.tabIndex = 0;

        const codeStyle: Partial<CSSStyleDeclaration> = {
            width: '168px',
            maxWidth: '56vw',
            minHeight: '44px',
            margin: '0',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1.6px solid #7da5c4',
            background: 'linear-gradient(180deg, rgba(247, 252, 255, 0.99), rgba(236, 246, 255, 0.99))',
            color: '#0f2e44',
            fontFamily: FONT_UI,
            fontSize: '19px',
            fontWeight: '700',
            lineHeight: '1.2',
            letterSpacing: '2px',
            textAlign: 'center',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            userSelect: 'text',
            display: 'block',
            caretColor: '#0f2e44',
            boxShadow: '0 6px 14px rgba(7, 22, 36, 0.17)',
            opacity: '1',
        };
        Object.assign(this.roomCodeInput.style, codeStyle);
        this.roomCodeInput.style.setProperty('-webkit-user-select', 'text');
        this.roomCodeInput.style.setProperty('-webkit-text-fill-color', '#0f2e44');
        this.roomCodeInput.style.setProperty('position', 'relative');
        this.roomCodeInput.style.setProperty('z-index', '2');
        this.roomCodeInput.style.setProperty('appearance', 'none');
        this.roomCodeInput.style.setProperty('-webkit-appearance', 'none');

        this.roomCodeInput.addEventListener('input', () => {
            this.roomCodeInput.value = this.roomCodeInput.value.replace(/\D/g, '').slice(0, 4);
        });
        this.roomCodeInput.addEventListener('focus', () => {
            this.roomCodeInput.style.borderColor = '#4f95c4';
            this.roomCodeInput.style.boxShadow = '0 0 0 3px rgba(79, 149, 196, 0.24), 0 6px 14px rgba(7, 22, 36, 0.2)';
        });
        this.roomCodeInput.addEventListener('blur', () => {
            this.roomCodeInput.style.borderColor = '#7da5c4';
            this.roomCodeInput.style.boxShadow = '0 6px 14px rgba(7, 22, 36, 0.17)';
        });

        this.roomCodeDom = this.add.dom(0, 0, this.roomCodeInput).setDepth(26);
        this.roomCodeDom.setOrigin(0.5, 0.5);
        const roomCodeNode = this.roomCodeDom.node as HTMLElement;
        roomCodeNode.style.display = 'none';
        roomCodeNode.style.width = 'auto';
        roomCodeNode.style.height = 'auto';
        roomCodeNode.style.pointerEvents = 'auto';
        roomCodeNode.style.opacity = '1';
        roomCodeNode.style.visibility = 'hidden';
        roomCodeNode.style.zIndex = '1200';
        roomCodeNode.addEventListener('pointerdown', (event) => event.stopPropagation());
        roomCodeNode.addEventListener('mousedown', (event) => event.stopPropagation());
        roomCodeNode.addEventListener('touchstart', (event) => event.stopPropagation());
        this.roomCodeInput.addEventListener('keydown', (event) => event.stopPropagation());
        this.roomCodeInput.addEventListener('pointerdown', (event) => event.stopPropagation());
    }

    private cleanupInput() {
        if (this.inputDom) this.inputDom.destroy();
        if (this.roomCodeDom) this.roomCodeDom.destroy();
        this.inputPlaced = false;
    }

    private normalizeReconnectPrefill(ceoNameRaw: unknown, roomCodeRaw: unknown): { ceoName: string; roomCode: string } | null {
        const ceoName = String(ceoNameRaw ?? '').trim();
        const roomCode = String(roomCodeRaw ?? '').replace(/\D/g, '').slice(0, 4);
        if (!/^[a-zA-Z0-9]{3,15}$/.test(ceoName)) return null;
        if (!/^\d{4}$/.test(roomCode)) return null;
        return { ceoName, roomCode };
    }

    private loadStoredReconnectPrefill(): { ceoName: string; roomCode: string } | null {
        try {
            const storage = typeof window !== 'undefined' ? window.localStorage : null;
            const snapshot = readFreshReconnectContext(storage);
            if (!snapshot) return null;
            return this.normalizeReconnectPrefill(snapshot.ceoName, snapshot.roomCode);
        } catch {
            return null;
        }
    }

    private applyReconnectPrefill() {
        if (!this.modeConfirmed || this.mode !== 'join') return;
        if (!this.reconnectPrefillName || !this.reconnectPrefillRoomCode) return;
        this.nameInput.value = this.reconnectPrefillName;
        this.roomCodeInput.value = this.reconnectPrefillRoomCode;
        this.activeRoomCode = this.reconnectPrefillRoomCode;
    }

    update() {
        this.cloudLayer.tilePositionX += 0.08;
        this.cloudLayer.tilePositionY += 0.01;
        this.ditherLayer.tilePositionX += 0.03;
        this.ditherLayer.tilePositionY += 0.006;
    }

    private playIntroMotion() {
        this.cameras.main.fadeIn(300, 8, 13, 20);

        this.tweens.add({ targets: this.title, alpha: 1, duration: 460, ease: 'Sine.Out' });
        this.tweens.add({ targets: this.subtitle, alpha: 1, duration: 460, delay: 110, ease: 'Sine.Out' });

        this.panelShimmer.setAlpha(0);
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        const centerX = Math.round(w * 0.5);
        const showForm = this.modeConfirmed;
        this.refreshLocalizedText();
        this.redrawBackground(w, h);
        this.cloudLayer.setSize(w, h);
        this.ditherLayer.setSize(w, h);
        syncUiRootViewport(w, h);
        const initialLayout = computeInitialScreenLayout(w, h, { showForm });
        const { tier, header, panel, loginTokens } = initialLayout;
        const compactTier = tier === 'C';
        const menuType = getMenuTypographyByTier(tier);

        applyBrandTypography(this.title, this.subtitle, {
            titleFontSize: header.titleFontSize,
            subtitleFontSize: header.subtitleFontSize,
            titleY: header.titleY,
            subtitleY: header.subtitleY,
            bottomY: header.headerBottomY,
            headerGap: header.headerGap,
        });
        placeBrandHeader(this.title, this.subtitle, centerX, {
            titleFontSize: header.titleFontSize,
            subtitleFontSize: header.subtitleFontSize,
            titleY: header.titleY,
            subtitleY: header.subtitleY,
            bottomY: header.headerBottomY,
            headerGap: header.headerGap,
        });

        this.redrawPanel(panel.x, panel.y, panel.w, panel.h);

        const contentLeft = panel.x + loginTokens.panelPaddingX;
        const contentRight = panel.x + panel.w - loginTokens.panelPaddingX;
        const contentW = Math.max(220, contentRight - contentLeft);
        const sectionGap = compactTier ? Math.max(8, loginTokens.sectionGap - 3) : loginTokens.sectionGap;
        const rowGap = compactTier ? Math.max(6, loginTokens.rowGap - 2) : loginTokens.rowGap;
        const labelH = menuType.caption + 4;
        const modeLabelH = showForm
            ? menuType.body + 5
            : menuType.label + 7;
        const segmentedH = Math.max(44, loginTokens.segmentedButtonHeight);
        const primaryH = Math.max(44, loginTokens.primaryButtonHeight);
        const langButtonBaseW = tier === 'A' ? 68 : tier === 'B' ? 70 : tier === 'C' ? 68 : 72;
        const modeChoiceBaseW = tier === 'A' ? 290 : tier === 'B' ? 304 : tier === 'C' ? 340 : 360;
        const modeFormBaseW = tier === 'A' ? 178 : tier === 'B' ? 192 : tier === 'C' ? 208 : 224;
        const backBaseW = tier === 'A' ? 96 : tier === 'B' ? 102 : tier === 'C' ? 104 : 112;
        const roomCodeInputBaseW = tier === 'A' ? 184 : tier === 'B' ? 196 : tier === 'C' ? 188 : 220;
        const nameInputBaseW = tier === 'A' ? 268 : tier === 'B' ? 286 : tier === 'C' ? 300 : 340;
        const joinButtonBaseW = tier === 'A' ? 268 : tier === 'B' ? 286 : tier === 'C' ? 300 : 340;
        let cursorY = panel.y + loginTokens.panelPaddingY;
        const maxContentBottom = panel.y + panel.h - loginTokens.panelPaddingY;

        this.langLabel
            .setPosition(centerX, cursorY + labelH * 0.5)
            .setWordWrapWidth(contentW * 0.75, true)
            .setFontSize(`${menuType.caption}px`);
        cursorY += labelH + rowGap;

        const langButtonW = Math.max(54, Math.min(langButtonBaseW, (contentW - rowGap) * 0.5));
        const langButtonH = segmentedH;
        const itX = centerX - (langButtonW * 0.5 + rowGap * 0.5);
        const enX = centerX + (langButtonW * 0.5 + rowGap * 0.5);
        if (this.langButtons.it) {
            this.langButtons.it.hit.setPosition(itX, cursorY + langButtonH * 0.5).setSize(langButtonW, langButtonH);
            this.langButtons.it.bg.setPosition(itX, cursorY + langButtonH * 0.5);
            this.langButtons.it.label.setPosition(itX, cursorY + langButtonH * 0.5).setFontSize(`${menuType.caption}px`);
        }
        if (this.langButtons.en) {
            this.langButtons.en.hit.setPosition(enX, cursorY + langButtonH * 0.5).setSize(langButtonW, langButtonH);
            this.langButtons.en.bg.setPosition(enX, cursorY + langButtonH * 0.5);
            this.langButtons.en.label.setPosition(enX, cursorY + langButtonH * 0.5).setFontSize(`${menuType.caption}px`);
        }
        cursorY += langButtonH + sectionGap;

        this.modeLabel
            .setPosition(centerX, cursorY + modeLabelH * 0.5)
            .setWordWrapWidth(contentW * 0.92, true)
            .setFontSize(`${modeLabelH}px`);
        cursorY += modeLabelH + rowGap;

        const modeButtonW = showForm
            ? Math.max(140, Math.min(modeFormBaseW, contentW * 0.72))
            : Math.max(240, Math.min(modeChoiceBaseW, contentW));
        const modeHostY = cursorY + segmentedH * 0.5;
        const modeJoinY = modeHostY + segmentedH + rowGap;
        const modeFontSize = showForm
            ? menuType.caption
            : menuType.label;

        if (this.modeButtons.host) {
            this.modeButtons.host.hit.setPosition(centerX, modeHostY).setSize(modeButtonW, segmentedH);
            this.modeButtons.host.bg.setPosition(centerX, modeHostY);
            this.modeButtons.host.label.setPosition(centerX, modeHostY).setFontSize(`${modeFontSize}px`);
        }
        if (this.modeButtons.join) {
            this.modeButtons.join.hit.setPosition(centerX, modeJoinY).setSize(modeButtonW, segmentedH);
            this.modeButtons.join.bg.setPosition(centerX, modeJoinY);
            this.modeButtons.join.label.setPosition(centerX, modeJoinY).setFontSize(`${modeFontSize}px`);
        }

        const backW = Math.max(94, Math.min(backBaseW, contentW * 0.35));
        const backH = segmentedH;
        const backX = contentLeft + backW * 0.5;
        const backY = panel.y + loginTokens.panelPaddingY + backH * 0.5;
        this.backButtonHit.setPosition(backX, backY).setSize(backW, backH);
        this.backButtonGfx.setPosition(backX, backY);
        this.backButtonText
            .setPosition(backX, backY)
            .setFontSize(`${menuType.caption}px`);
        this.redrawBackButton(backW, backH);

        if (showForm) {
            cursorY = Math.max(cursorY, backY + backH * 0.5 + sectionGap);

            const roomLabelH = menuType.caption + 2;
            this.roomCodeLabel
                .setPosition(centerX, cursorY + roomLabelH * 0.5)
                .setWordWrapWidth(contentW * 0.92, true)
                .setFontSize(`${roomLabelH}px`);
            cursorY += roomLabelH + rowGap;

            const roomCodeH = menuType.roomCode;
            this.roomCodeValue
                .setPosition(centerX, cursorY + roomCodeH * 0.55)
                .setFontSize(`${roomCodeH}px`);
            const roomCodeInputW = Math.max(170, Math.min(roomCodeInputBaseW, contentW * 0.74));
            this.roomCodeInput.style.width = `${Math.round(roomCodeInputW)}px`;
            this.roomCodeInput.style.fontSize = `${menuType.input}px`;
            this.roomCodeInput.style.minHeight = `${Math.round(Math.max(42, loginTokens.inputHeight))}px`;
            this.roomCodeDom.updateSize();
            this.roomCodeDom.setPosition(centerX, cursorY + roomCodeH * 0.55);
            cursorY += roomCodeH + sectionGap;

            const inputLabelH = menuType.caption + 3;
            this.inputLabel
                .setPosition(centerX, cursorY + inputLabelH * 0.5)
                .setWordWrapWidth(contentW * 0.92, true)
                .setFontSize(`${inputLabelH}px`);
            cursorY += inputLabelH + rowGap;

            const inputW = Math.max(250, Math.min(nameInputBaseW, contentW * 0.92));
            this.nameInput.style.width = `${Math.round(inputW)}px`;
            this.nameInput.style.maxWidth = `${Math.round(Math.min(w * 0.8, inputW))}px`;
            this.nameInput.style.padding = `${compactTier ? 11 : 12}px 14px`;
            this.nameInput.style.fontSize = `${menuType.input}px`;
            this.nameInput.style.minHeight = `${Math.round(Math.max(44, loginTokens.inputHeight))}px`;
            this.inputDom.updateSize();
            this.inputFrame.clear();
            this.inputDom.setPosition(centerX, cursorY + loginTokens.inputHeight * 0.5);
            if (!this.inputPlaced) {
                const domNode = this.inputDom.node as HTMLElement;
                domNode.style.opacity = '1';
                this.inputPlaced = true;
            }
            cursorY += loginTokens.inputHeight + sectionGap;

            const hintH = compactTier ? 16 : 24;
            this.hint
                .setPosition(centerX, cursorY + hintH * 0.5)
                .setWordWrapWidth(contentW * 0.92, true)
                .setFontSize(`${menuType.caption}px`);
            cursorY += hintH + rowGap;

            const buttonY = Math.min(cursorY + primaryH * 0.5, maxContentBottom - (primaryH * 0.5) - 22);
            const buttonW = Math.max(220, Math.min(joinButtonBaseW, contentW * 0.92));
            this.joinButtonHit.setPosition(centerX, buttonY).setSize(buttonW, primaryH);
            this.redrawJoinButton(buttonW, primaryH);
            this.joinButtonGfx.setPosition(centerX, buttonY);
            this.joinButtonText
                .setPosition(centerX, buttonY)
                .setFontSize(`${menuType.button}px`);
            cursorY = buttonY + primaryH * 0.5 + rowGap;

            const feedbackY = Math.min(cursorY + 10, maxContentBottom - 8);
            this.feedback
                .setPosition(centerX, feedbackY)
                .setWordWrapWidth(contentW * 0.94, true)
                .setFontSize(`${menuType.caption}px`);
        } else {
            const hiddenInputY = panel.y + panel.h - 28;
            this.inputDom.setPosition(centerX, hiddenInputY);
            this.roomCodeDom.setPosition(centerX, hiddenInputY);

            const modeButtonIdleW = Math.max(220, Math.min(300, contentW));
            this.joinButtonHit.setPosition(centerX, panel.y + panel.h - primaryH).setSize(modeButtonIdleW, primaryH);
            this.joinButtonGfx.setPosition(centerX, panel.y + panel.h - primaryH);
            this.joinButtonText.setPosition(centerX, panel.y + panel.h - primaryH);
            this.hint.setPosition(centerX, panel.y + panel.h - 26);
            this.feedback.setPosition(centerX, panel.y + panel.h - 12);
        }

    }

    private generateExampleName(): string {
        const prefix = ['Pixel', 'Neo', 'Turbo', 'Luna', 'Mega', 'Hyper', 'Zeta', 'Astra'];
        const core = ['Mercato', 'Boss', 'Profit', 'Ledger', 'Biz', 'Factory', 'Rocket', 'Trade'];
        const suffix = ['Lab', 'Corp', 'Team', 'Works', 'Hub', 'Line', 'Point', 'Base'];
        const previous = localStorage.getItem('lucrare_last_example_name') ?? '';

        let candidate = '';
        for (let attempt = 0; attempt < 8; attempt++) {
            const p = prefix[Math.floor(Math.random() * prefix.length)];
            const c = core[Math.floor(Math.random() * core.length)];
            const s = suffix[Math.floor(Math.random() * suffix.length)];
            candidate = `${p}${c}${s}`.slice(0, 15);
            if (candidate !== previous) break;
        }

        localStorage.setItem('lucrare_last_example_name', candidate);
        return candidate;
    }

    private redrawBackground(w: number, h: number) {
        drawPokemonBackdrop(this.bg, w, h, 0.61);
    }

    private redrawPanel(x: number, y: number, w: number, h: number) {
        this.panelGfx.clear();
        this.panelGfx.fillStyle(0x22435f, 0.93);
        this.panelGfx.fillRoundedRect(x, y, w, h, 20);
        this.panelGfx.fillStyle(0x8fd8ff, 0.07);
        this.panelGfx.fillRoundedRect(x + 4, y + 4, w - 8, Math.max(24, h * 0.22), { tl: 16, tr: 16, bl: 0, br: 0 });

        this.panelGfx.lineStyle(1.4, 0xbfe3ff, 0.94);
        this.panelGfx.strokeRoundedRect(x, y, w, h, 20);

        this.panelGfx.lineStyle(1, 0xffffff, 0.1);
        this.panelGfx.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 16);

        this.panelShimmer.clear();
        this.panelShimmer.setAlpha(0);
    }

    private redrawJoinButton(buttonW: number, buttonH: number) {
        const fill = this.busy ? 0x4f7b8a : 0x3d8f6c;
        const edge = this.busy ? 0xbfdceb : 0xcff6dd;
        paintRetroButton(
            this.joinButtonGfx,
            { width: buttonW, height: buttonH, radius: 12, borderWidth: 1.2 },
            {
                base: fill,
                border: edge,
                glossAlpha: 0.12,
            },
        );
    }

    private setBusy(value: boolean) {
        this.busy = value;
        this.nameInput.disabled = value || !this.modeConfirmed;
        this.roomCodeInput.disabled = value || this.mode !== 'join' || !this.modeConfirmed;
        if (!value && this.modeConfirmed) {
            if (this.mode === 'join') this.roomCodeInput.focus();
            else this.nameInput.focus();
        }
        this.joinButtonHit.input && (this.joinButtonHit.input.enabled = !value && this.modeConfirmed);
        this.backButtonHit.input && (this.backButtonHit.input.enabled = !value && this.modeConfirmed);
        if (this.modeButtons.host?.hit.input) this.modeButtons.host.hit.input.enabled = !value && !this.modeConfirmed;
        if (this.modeButtons.join?.hit.input) this.modeButtons.join.hit.input.enabled = !value && !this.modeConfirmed;
        if (value) this.joinButtonFx?.reset();
        if (value) this.backButtonFx?.reset();
        this.redrawJoinButton(this.joinButtonHit.width, this.joinButtonHit.height);
        this.redrawBackButton(this.backButtonHit.width, this.backButtonHit.height);

        if (value) {
            this.joinButtonText.setText(t(this.lang, 'login_connecting')).setColor('#ffffff');
        } else {
            const actionLabel = !this.modeConfirmed
                ? t(this.lang, 'login_select_mode')
                : this.mode === 'host'
                    ? t(this.lang, 'login_create_match')
                    : t(this.lang, 'login_join_match');
            this.joinButtonText.setText(actionLabel).setColor('#ffffff');
        }
    }

    private async handleJoin() {
        if (this.busy) return;
        if (!this.modeConfirmed) {
            this.feedback.setText(t(this.lang, 'login_select_mode')).setColor('#ffcb80');
            this.cameras.main.shake(90, 0.0014);
            return;
        }

        const ceoName = this.nameInput.value.trim();
        if (!/^[a-zA-Z0-9]{3,15}$/.test(ceoName)) {
            this.feedback.setText(t(this.lang, 'login_invalid_name')).setColor('#ff7f8f');
            this.cameras.main.shake(120, 0.002);
            return;
        }

        const roomCode = this.mode === 'host'
            ? this.activeRoomCode
            : this.roomCodeInput.value.replace(/\D/g, '').slice(0, 4);
        if (!/^\d{4}$/.test(roomCode)) {
            this.feedback.setText(t(this.lang, 'login_invalid_room_code')).setColor('#ff7f8f');
            this.cameras.main.shake(120, 0.002);
            return;
        }

        if (this.mode === 'join') {
            const exists = await this.serverManager.roomCodeExists(roomCode);
            if (!exists) {
                this.feedback.setText(t(this.lang, 'login_room_not_found')).setColor('#ff7f8f');
                this.cameras.main.shake(120, 0.002);
                return;
            }
        }

        this.feedback.setText('').setColor('#ff7f8f');
        this.setBusy(true);

        try {
            if (this.mode === 'host') {
                await this.serverManager.createOfficeRoom(ceoName, roomCode);
            } else {
                await this.serverManager.joinOfficeRoom(ceoName, roomCode);
            }

            this.feedback.setText(t(this.lang, 'login_connected')).setColor('#9df3be');
            this.cameras.main.fadeOut(320, 8, 13, 20);

            this.time.delayedCall(340, () => {
                this.cleanupInput();
                this.scene.start('PreLobbyScene', {
                    serverManager: this.serverManager,
                    lang: this.lang,
                    roomCode,
                    isHost: this.mode === 'host',
                });
            });
        } catch (e: any) {
            const errorMsg = e?.message ? String(e.message) : t(this.lang, 'login_connection_error');
            this.feedback.setText(t(this.lang, 'login_access_denied', { message: errorMsg })).setColor('#ff7f8f');
            this.setBusy(false);
        }
    }

    private async refreshHostRoomCode() {
        try {
            this.activeRoomCode = await this.serverManager.suggestRoomCode();
        } catch {
            this.activeRoomCode = `${Math.floor(1000 + Math.random() * 9000)}`;
        }
        this.roomCodeValue.setText(this.activeRoomCode);
        this.refreshLocalizedText();
    }

    private boostText(...texts: Array<Phaser.GameObjects.Text | undefined>) {
        texts.forEach((text) => text?.setResolution(this.textResolution));
    }
}

