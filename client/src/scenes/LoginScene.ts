import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';
import { DEFAULT_LANGUAGE, sanitizeLanguage, SupportedLanguage, t } from '../i18n';
import { createSimpleButtonFx, SimpleButtonController } from '../ui/SimpleButtonFx';
import { drawPokemonBackdrop, ensurePokemonTextures } from '../ui/PokemonVisuals';
import { applyBrandTypography, BRAND_SUBTITLE_STYLE, BRAND_TITLE_STYLE, BRAND_TITLE_TEXT, placeBrandHeader } from '../ui/Branding';
import { paintRetroButton } from '../ui/RetroButtonPainter';
import { APP_FONT_FAMILY } from '../ui/Typography';

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
    private readonly textResolution = Math.max(2, Math.min((window.devicePixelRatio || 1) * 1.5, 4));

    constructor() {
        super({ key: 'LoginScene' });
    }

    init(data: { serverManager: ServerManager }) {
        this.serverManager = data?.serverManager ?? new ServerManager();
        this.lang = sanitizeLanguage(localStorage.getItem('lucrare_lang'));
        this.modeConfirmed = false;
        this.nameExample = this.generateExampleName();
        this.activeRoomCode = `${Math.floor(1000 + Math.random() * 9000)}`;
    }

    create() {
        this.inputPlaced = false;
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
            color: '#f7f0d8',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.hint = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#e6f2ff',
            fontStyle: '500',
        }).setOrigin(0.5);

        this.feedback = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ff5e75',
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
        this.refreshLocalizedText();
        void this.refreshHostRoomCode();

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

        this.modeButtons.host = this.createModeButton('HOST', 'host');
        this.modeButtons.join = this.createModeButton('JOIN', 'join');

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
            color: '#f7f0d8',
            fontStyle: '700',
            stroke: '#102a3d',
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
        const hit = this.add.rectangle(0, 0, 52, 30, 0x000000, 0)
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
        const hit = this.add.rectangle(0, 0, 90, 30, 0x000000, 0)
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
                base: active ? 0x3b5f99 : 0x3c6655,
                border: active ? 0xf6f0cf : 0xc8efcf,
                glossAlpha: active ? 0.24 : 0.1,
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
                base: active ? 0x8a5a2d : 0x37566f,
                border: active ? 0xffd7a1 : 0xb7d4ea,
                glossAlpha: active ? 0.18 : 0.1,
            },
        );
        button.label.setColor('#ffffff');
    }

    private redrawBackButton(buttonW: number, buttonH: number) {
        paintRetroButton(
            this.backButtonGfx,
            { width: buttonW, height: buttonH, radius: 10, borderWidth: 1.1 },
            {
                base: 0x3f5872,
                border: 0xcde2f7,
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
        this.refreshLocalizedText();
        this.feedback.setText('');
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
            minHeight: '46px',
            margin: '0',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1.6px solid #7a92ad',
            background: 'rgba(251, 254, 255, 0.98)',
            color: '#102a3d',
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
            caretColor: '#102a3d',
            boxShadow: '0 4px 10px rgba(7, 22, 36, 0.16)',
            opacity: '1',
        };
        Object.assign(this.nameInput.style, inputStyle);
        this.nameInput.style.setProperty('-webkit-user-select', 'text');
        this.nameInput.style.setProperty('-webkit-text-fill-color', '#102a3d');
        this.nameInput.style.setProperty('position', 'relative');
        this.nameInput.style.setProperty('z-index', '2');
        this.nameInput.style.setProperty('appearance', 'none');
        this.nameInput.style.setProperty('-webkit-appearance', 'none');

        this.nameInput.addEventListener('focus', () => {
            this.nameInput.style.borderColor = '#4f7ea2';
            this.nameInput.style.boxShadow = '0 0 0 3px rgba(79, 126, 162, 0.24), 0 4px 12px rgba(7, 22, 36, 0.18)';
        });

        this.nameInput.addEventListener('blur', () => {
            this.nameInput.style.borderColor = '#7a92ad';
            this.nameInput.style.boxShadow = '0 4px 10px rgba(7, 22, 36, 0.16)';
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
            minHeight: '42px',
            margin: '0',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1.6px solid #7a92ad',
            background: 'rgba(251, 254, 255, 0.98)',
            color: '#102a3d',
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
            caretColor: '#102a3d',
            boxShadow: '0 4px 10px rgba(7, 22, 36, 0.16)',
            opacity: '1',
        };
        Object.assign(this.roomCodeInput.style, codeStyle);
        this.roomCodeInput.style.setProperty('-webkit-user-select', 'text');
        this.roomCodeInput.style.setProperty('-webkit-text-fill-color', '#102a3d');
        this.roomCodeInput.style.setProperty('position', 'relative');
        this.roomCodeInput.style.setProperty('z-index', '2');
        this.roomCodeInput.style.setProperty('appearance', 'none');
        this.roomCodeInput.style.setProperty('-webkit-appearance', 'none');

        this.roomCodeInput.addEventListener('input', () => {
            this.roomCodeInput.value = this.roomCodeInput.value.replace(/\D/g, '').slice(0, 4);
        });
        this.roomCodeInput.addEventListener('focus', () => {
            this.roomCodeInput.style.borderColor = '#4f7ea2';
            this.roomCodeInput.style.boxShadow = '0 0 0 3px rgba(79, 126, 162, 0.24), 0 4px 12px rgba(7, 22, 36, 0.18)';
        });
        this.roomCodeInput.addEventListener('blur', () => {
            this.roomCodeInput.style.borderColor = '#7a92ad';
            this.roomCodeInput.style.boxShadow = '0 4px 10px rgba(7, 22, 36, 0.16)';
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

    update() {
        this.cloudLayer.tilePositionX += 0.08;
        this.cloudLayer.tilePositionY += 0.01;
        this.ditherLayer.tilePositionX += 0.03;
        this.ditherLayer.tilePositionY += 0.006;
    }

    private playIntroMotion() {
        this.cameras.main.fadeIn(300, 8, 13, 20);

        this.tweens.add({ targets: this.title, alpha: 1, y: '-=8', duration: 460, ease: 'Sine.Out' });
        this.tweens.add({ targets: this.subtitle, alpha: 1, y: '+=4', duration: 460, delay: 110, ease: 'Sine.Out' });

        this.panelShimmer.setAlpha(0);
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        const minSide = Math.min(w, h);
        const centerX = Math.round(w * 0.5);
        const showForm = this.modeConfirmed;
        const isLandscape = w > h;
        this.redrawBackground(w, h);
        this.cloudLayer.setSize(w, h);
        this.ditherLayer.setSize(w, h);

        const sidePad = Phaser.Math.Clamp(w * 0.04, 10, 34);
        const bottomPad = Phaser.Math.Clamp(h * 0.03, 8, 24);
        const panelW = Phaser.Math.Clamp(w - sidePad * 2, 300, isLandscape ? 760 : 640);
        const desiredPanelH = showForm
            ? Phaser.Math.Clamp(h * (isLandscape ? 0.8 : 0.69), 300, 620)
            : Phaser.Math.Clamp(h * (isLandscape ? 0.72 : 0.56), 250, 520);
        const headerReserve = showForm
            ? Phaser.Math.Clamp(minSide * 0.27, 88, 152)
            : Phaser.Math.Clamp(minSide * 0.23, 76, 138);
        const availablePanelH = Math.max(190, h - headerReserve - bottomPad);
        let panelH = Math.min(desiredPanelH, availablePanelH);
        panelH = Math.max(panelH, Math.min(showForm ? 270 : 230, availablePanelH));

        const px = centerX - panelW * 0.5;
        const py = Math.max(6, h - panelH - bottomPad);

        this.redrawPanel(px, py, panelW, panelH);

        applyBrandTypography(this.title, this.subtitle, minSide);
        const titleFont = Math.min(
            Phaser.Math.Clamp(minSide * 0.102, 40, 96),
            Phaser.Math.Clamp(h * 0.115, 34, 72),
        );
        const subtitleFont = Math.min(
            Phaser.Math.Clamp(minSide * 0.023, 12, 22),
            Phaser.Math.Clamp(h * 0.032, 11, 20),
        );
        this.title.setFontSize(`${Math.round(titleFont)}px`);
        this.subtitle.setFontSize(`${Math.round(subtitleFont)}px`);

        const titleTop = Phaser.Math.Clamp(h * 0.028, 6, 22);
        const titleBottom = py - Phaser.Math.Clamp(minSide * 0.032, 8, 18);
        const titleAreaH = Math.max(56, titleBottom - titleTop);
        const titleY = titleTop + titleAreaH * 0.38;
        placeBrandHeader(this.title, this.subtitle, centerX, titleY, minSide);

        const langLabelY = py + (showForm ? panelH * 0.09 : panelH * 0.12);
        const langButtonsY = langLabelY + Phaser.Math.Clamp(panelH * 0.07, 20, 26);
        const langButtonW = Phaser.Math.Clamp(panelW * 0.16, 52, 68);
        const langButtonH = Phaser.Math.Clamp(panelH * 0.08, 28, 36);
        const langGap = Phaser.Math.Clamp(panelW * 0.035, 12, 20);
        const itX = centerX - (langButtonW * 0.5 + langGap * 0.5);
        const enX = centerX + (langButtonW * 0.5 + langGap * 0.5);

        this.langLabel
            .setPosition(centerX, langLabelY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.014, 11, 14)}px`);

        if (this.langButtons.it) {
            this.langButtons.it.hit.setPosition(itX, langButtonsY).setSize(langButtonW, langButtonH);
            this.langButtons.it.bg.setPosition(itX, langButtonsY);
            this.langButtons.it.label.setPosition(itX, langButtonsY);
        }
        if (this.langButtons.en) {
            this.langButtons.en.hit.setPosition(enX, langButtonsY).setSize(langButtonW, langButtonH);
            this.langButtons.en.bg.setPosition(enX, langButtonsY);
            this.langButtons.en.label.setPosition(enX, langButtonsY);
        }

        const modeLabelY = showForm ? py + panelH * 0.22 : py + panelH * 0.31;
        const modeLabelFont = showForm
            ? Phaser.Math.Clamp(minSide * 0.022, 15, 21)
            : Phaser.Math.Clamp(minSide * 0.026, 18, 27);

        const modeButtonW = showForm
            ? Phaser.Math.Clamp(panelW * 0.34, 140, 210)
            : Phaser.Math.Clamp(panelW * 0.78, 240, 470);
        let modeButtonH = showForm
            ? Phaser.Math.Clamp(panelH * 0.09, 34, 42)
            : Phaser.Math.Clamp(panelH * 0.15, 56, 82);
        const modeVerticalGap = showForm
            ? Phaser.Math.Clamp(panelH * 0.03, 10, 16)
            : Phaser.Math.Clamp(panelH * 0.07, 18, 30);
        const modeAreaTop = showForm ? py + panelH * 0.26 : py + panelH * 0.44;
        const modeAreaBottom = showForm ? py + panelH * 0.4 : py + panelH * 0.9;
        const modeAreaH = Math.max(80, modeAreaBottom - modeAreaTop);
        if (modeButtonH * 2 + modeVerticalGap > modeAreaH) {
            modeButtonH = Math.max(30, (modeAreaH - modeVerticalGap) * 0.5);
        }
        const modeHostY = modeAreaTop + modeButtonH * 0.5;
        const modeJoinY = modeHostY + modeButtonH + modeVerticalGap;
        const modeFontSize = showForm
            ? Phaser.Math.Clamp(minSide * 0.016, 12, 14)
            : Phaser.Math.Clamp(minSide * 0.03, 17, 26);

        this.modeLabel
            .setPosition(centerX, modeLabelY)
            .setWordWrapWidth(panelW * 0.86, true)
            .setFontSize(`${modeLabelFont}px`);

        if (this.modeButtons.host) {
            this.modeButtons.host.hit.setPosition(centerX, modeHostY).setSize(modeButtonW, modeButtonH);
            this.modeButtons.host.bg.setPosition(centerX, modeHostY);
            this.modeButtons.host.label.setPosition(centerX, modeHostY).setFontSize(`${modeFontSize}px`);
        }
        if (this.modeButtons.join) {
            this.modeButtons.join.hit.setPosition(centerX, modeJoinY).setSize(modeButtonW, modeButtonH);
            this.modeButtons.join.bg.setPosition(centerX, modeJoinY);
            this.modeButtons.join.label.setPosition(centerX, modeJoinY).setFontSize(`${modeFontSize}px`);
        }

        const backW = Phaser.Math.Clamp(panelW * 0.24, 98, 136);
        const backH = Phaser.Math.Clamp(panelH * 0.09, 34, 42);
        const backX = px + backW * 0.64;
        const backY = py + Phaser.Math.Clamp(panelH * 0.11, 30, 46);
        this.backButtonHit.setPosition(backX, backY).setSize(backW, backH);
        this.backButtonGfx.setPosition(backX, backY);
        this.backButtonText
            .setPosition(backX, backY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.017, 12, 16)}px`);
        this.redrawBackButton(backW, backH);

        const roomCodeY = py + panelH * 0.39;
        this.roomCodeLabel
            .setPosition(centerX, roomCodeY - Phaser.Math.Clamp(panelH * 0.08, 22, 30))
            .setWordWrapWidth(panelW * 0.82, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.016, 12, 15)}px`);

        this.roomCodeValue
            .setPosition(centerX, roomCodeY + 6)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.038, 22, 34)}px`);

        this.roomCodeInput.style.width = `${Math.round(Phaser.Math.Clamp(panelW * 0.5, 170, 260))}px`;
        this.roomCodeInput.style.fontSize = `${Math.round(Phaser.Math.Clamp(minSide * 0.03, 18, 24))}px`;
        this.roomCodeInput.style.minHeight = `${Math.round(Phaser.Math.Clamp(minSide * 0.056, 42, 50))}px`;
        this.roomCodeDom.updateSize();
        this.roomCodeDom.setPosition(centerX, roomCodeY + 6);

        const inputYFinal = py + panelH * 0.6;
        this.inputLabel
            .setPosition(centerX, inputYFinal - Phaser.Math.Clamp(panelH * 0.09, 28, 40))
            .setWordWrapWidth(panelW * 0.84, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.019, 12, 15)}px`);

        const inputW = Phaser.Math.Clamp(panelW * 0.68, 250, 390);
        this.nameInput.style.width = `${Math.round(inputW)}px`;
        this.nameInput.style.maxWidth = `${Math.round(Math.min(w * 0.8, inputW))}px`;
        this.nameInput.style.padding = `${Math.round(Phaser.Math.Clamp(minSide * 0.013, 11, 14))}px 14px`;
        this.nameInput.style.fontSize = `${Math.round(Phaser.Math.Clamp(minSide * 0.022, 16, 19))}px`;
        this.nameInput.style.minHeight = `${Math.round(Phaser.Math.Clamp(minSide * 0.06, 44, 52))}px`;
        this.inputDom.updateSize();

        this.inputFrame.clear();
        this.inputDom.setPosition(centerX, inputYFinal);
        if (!this.inputPlaced) {
            const domNode = this.inputDom.node as HTMLElement;
            domNode.style.opacity = '1';
            this.inputPlaced = true;
        }

        const buttonY = py + panelH * 0.82;
        const buttonW = Phaser.Math.Clamp(panelW * 0.7, 220, 380);
        const buttonH = Phaser.Math.Clamp(panelH * 0.16, 48, 62);

        this.joinButtonHit.setPosition(centerX, buttonY).setSize(buttonW, buttonH);
        this.redrawJoinButton(buttonW, buttonH);
        this.joinButtonGfx.setPosition(centerX, buttonY);

        this.joinButtonText
            .setPosition(centerX, buttonY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.027, 15, 21)}px`);

        this.hint
            .setPosition(centerX, py + panelH * 0.71)
            .setWordWrapWidth(panelW * 0.88, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.0165, 11, 14)}px`);

        this.feedback
            .setPosition(centerX, py + panelH * 0.92)
            .setWordWrapWidth(panelW * 0.9, true)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.0175, 12, 15)}px`);

        this.refreshLocalizedText();
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
        drawPokemonBackdrop(this.bg, w, h, 0.64);
    }

    private redrawPanel(x: number, y: number, w: number, h: number) {
        this.panelGfx.clear();
        this.panelGfx.fillStyle(0x2d4a60, 0.92);
        this.panelGfx.fillRoundedRect(x, y, w, h, 20);

        this.panelGfx.lineStyle(1.4, 0xf3deb3, 0.95);
        this.panelGfx.strokeRoundedRect(x, y, w, h, 20);

        this.panelGfx.lineStyle(1, 0xffffff, 0.08);
        this.panelGfx.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 16);

        this.panelShimmer.clear();
        this.panelShimmer.setAlpha(0);
    }

    private redrawJoinButton(buttonW: number, buttonH: number) {
        const fill = this.busy ? 0x5f7f53 : 0x4f7d6a;
        const edge = this.busy ? 0xa4c496 : 0xd0f6c9;
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

