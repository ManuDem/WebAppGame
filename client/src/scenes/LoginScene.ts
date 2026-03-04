import Phaser from 'phaser';
import { ServerManager } from '../network/ServerManager';

const FONT_DISPLAY = 'Bebas Neue, Barlow Condensed, Impact, sans-serif';
const FONT_UI = 'Sora, Trebuchet MS, sans-serif';

export class LoginScene extends Phaser.Scene {
    private serverManager!: ServerManager;

    private bg!: Phaser.GameObjects.Graphics;
    private ambientA!: Phaser.GameObjects.Ellipse;
    private ambientB!: Phaser.GameObjects.Ellipse;
    private ambientC!: Phaser.GameObjects.Ellipse;

    private panelGfx!: Phaser.GameObjects.Graphics;
    private panelShimmer!: Phaser.GameObjects.Graphics;

    private title!: Phaser.GameObjects.Text;
    private subtitle!: Phaser.GameObjects.Text;
    private inputLabel!: Phaser.GameObjects.Text;
    private hint!: Phaser.GameObjects.Text;
    private feedback!: Phaser.GameObjects.Text;

    private joinButtonGfx!: Phaser.GameObjects.Graphics;
    private joinButtonText!: Phaser.GameObjects.Text;
    private joinButtonHit!: Phaser.GameObjects.Rectangle;

    private inputDom!: Phaser.GameObjects.DOMElement;
    private nameInput!: HTMLInputElement;

    private busy = false;

    constructor() {
        super({ key: 'LoginScene' });
    }

    init(data: { serverManager: ServerManager }) {
        this.serverManager = data?.serverManager ?? new ServerManager();
    }

    create() {
        this.bg = this.add.graphics();

        this.ambientA = this.add.ellipse(0, 0, 100, 100, 0x5cc8ff, 0.14).setBlendMode(Phaser.BlendModes.ADD);
        this.ambientB = this.add.ellipse(0, 0, 100, 100, 0x5af2b6, 0.1).setBlendMode(Phaser.BlendModes.ADD);
        this.ambientC = this.add.ellipse(0, 0, 100, 100, 0xffb56a, 0.09).setBlendMode(Phaser.BlendModes.ADD);

        this.panelGfx = this.add.graphics();
        this.panelShimmer = this.add.graphics().setAlpha(0.18);

        this.title = this.add.text(0, 0, 'LUCrAre: SEMPRE', {
            fontFamily: FONT_DISPLAY,
            fontSize: '64px',
            color: '#ecf7ff',
            letterSpacing: 1.5,
        }).setOrigin(0.5).setAlpha(0);

        this.subtitle = this.add.text(0, 0, 'A satirical office card game', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#8fb4cc',
            fontStyle: '600',
        }).setOrigin(0.5).setAlpha(0);

        this.inputLabel = this.add.text(0, 0, 'CEO NAME', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#9fc4dd',
            fontStyle: '700',
            letterSpacing: 1,
        }).setOrigin(0.5);

        this.hint = this.add.text(0, 0, 'Use 3-15 alphanumeric characters', {
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#71899c',
            fontStyle: '500',
        }).setOrigin(0.5);

        this.feedback = this.add.text(0, 0, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            color: '#ff6f7e',
            align: 'center',
        }).setOrigin(0.5);

        this.joinButtonGfx = this.add.graphics();
        this.joinButtonText = this.add.text(0, 0, 'Enter Meeting', {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#ecf8ff',
            fontStyle: '700',
        }).setOrigin(0.5);

        this.joinButtonHit = this.add.rectangle(0, 0, 200, 56, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        this.createInput();

        this.joinButtonHit.on('pointerover', () => {
            if (this.busy) return;
            this.tweens.add({ targets: [this.joinButtonGfx, this.joinButtonText], scaleX: 1.03, scaleY: 1.03, duration: 100 });
        });
        this.joinButtonHit.on('pointerout', () => {
            this.tweens.add({ targets: [this.joinButtonGfx, this.joinButtonText], scaleX: 1, scaleY: 1, duration: 100 });
        });
        this.joinButtonHit.on('pointerdown', () => {
            if (this.busy) return;
            this.tweens.add({ targets: [this.joinButtonGfx, this.joinButtonText], scaleX: 0.97, scaleY: 0.97, duration: 80 });
        });
        this.joinButtonHit.on('pointerup', () => {
            if (this.busy) return;
            this.tweens.add({
                targets: [this.joinButtonGfx, this.joinButtonText],
                scaleX: 1,
                scaleY: 1,
                duration: 80,
                onComplete: () => this.handleJoin(),
            });
        });

        this.input.keyboard?.on('keydown-ENTER', this.handleJoin, this);

        this.scale.on('resize', this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off('resize', this.handleResize, this);
            this.input.keyboard?.off('keydown-ENTER', this.handleJoin, this);
            this.cleanupInput();
        });

        this.handleResize(this.scale.gameSize);
        this.playIntroMotion();
    }

    private createInput() {
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'CorporateDragon';
        this.nameInput.maxLength = 15;
        this.nameInput.autocomplete = 'off';
        this.nameInput.spellcheck = false;

        Object.assign(this.nameInput.style, {
            width: '320px',
            maxWidth: '78vw',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid #45647a',
            background: 'rgba(15, 27, 38, 0.92)',
            color: '#ebf5fb',
            fontFamily: FONT_UI,
            fontSize: '16px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            textAlign: 'center',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'all 120ms ease',
        } as CSSStyleDeclaration);

        this.nameInput.addEventListener('focus', () => {
            this.nameInput.style.borderColor = '#7dd6ff';
            this.nameInput.style.boxShadow = '0 0 0 3px rgba(125, 214, 255, 0.2)';
        });

        this.nameInput.addEventListener('blur', () => {
            this.nameInput.style.borderColor = '#45647a';
            this.nameInput.style.boxShadow = 'none';
        });

        this.inputDom = this.add.dom(0, 0, this.nameInput).setDepth(20);
    }

    private cleanupInput() {
        if (this.nameInput && this.nameInput.parentNode) {
            this.nameInput.remove();
        }
    }

    private playIntroMotion() {
        this.cameras.main.fadeIn(300, 8, 13, 20);

        this.tweens.add({ targets: this.title, alpha: 1, y: '-=8', duration: 460, ease: 'Sine.Out' });
        this.tweens.add({ targets: this.subtitle, alpha: 1, y: '+=4', duration: 460, delay: 110, ease: 'Sine.Out' });

        this.tweens.add({
            targets: [this.ambientA, this.ambientB, this.ambientC],
            alpha: '+=0.07',
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });

        this.tweens.add({
            targets: this.panelShimmer,
            alpha: { from: 0.06, to: 0.22 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        const minSide = Math.min(w, h);

        this.redrawBackground(w, h);

        this.ambientA.setPosition(w * 0.18, h * 0.26).setSize(minSide * 0.55, minSide * 0.55);
        this.ambientB.setPosition(w * 0.82, h * 0.72).setSize(minSide * 0.68, minSide * 0.68);
        this.ambientC.setPosition(w * 0.55, h * 0.12).setSize(minSide * 0.42, minSide * 0.42);

        const panelW = Phaser.Math.Clamp(w * 0.46, 320, 540);
        const panelH = Phaser.Math.Clamp(h * 0.46, 280, 420);
        const px = w * 0.5 - panelW * 0.5;
        const py = h * 0.52 - panelH * 0.5;

        this.redrawPanel(px, py, panelW, panelH);

        this.title
            .setPosition(w * 0.5, py - Phaser.Math.Clamp(minSide * 0.08, 48, 78))
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.095, 44, 74)}px`);

        this.subtitle
            .setPosition(w * 0.5, this.title.y + Phaser.Math.Clamp(minSide * 0.06, 34, 48))
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.025, 14, 20)}px`);

        const inputY = py + panelH * 0.48;
        this.inputLabel
            .setPosition(w * 0.5, inputY - 52)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.018, 11, 14)}px`);

        this.inputDom.setPosition(w * 0.5, inputY);

        const buttonY = inputY + Phaser.Math.Clamp(panelH * 0.26, 72, 96);
        const buttonW = Phaser.Math.Clamp(panelW * 0.62, 200, 320);
        const buttonH = Phaser.Math.Clamp(panelH * 0.17, 46, 58);

        this.joinButtonHit.setPosition(w * 0.5, buttonY).setSize(buttonW, buttonH);
        this.redrawJoinButton(buttonW, buttonH);
        this.joinButtonGfx.setPosition(w * 0.5, buttonY);

        this.joinButtonText
            .setPosition(w * 0.5, buttonY)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.026, 14, 19)}px`);

        this.hint
            .setPosition(w * 0.5, inputY + 40)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.016, 11, 13)}px`);

        this.feedback
            .setPosition(w * 0.5, buttonY + buttonH * 0.9)
            .setFontSize(`${Phaser.Math.Clamp(minSide * 0.017, 12, 14)}px`);
    }

    private redrawBackground(w: number, h: number) {
        this.bg.clear();

        this.bg.fillStyle(0x070d14, 1);
        this.bg.fillRect(0, 0, w, h);

        const bands = 22;
        for (let i = 0; i < bands; i++) {
            const t = i / bands;
            this.bg.fillStyle(0x102130, 0.16 * (1 - t));
            this.bg.fillRect(0, i * (h / bands), w, h / bands + 1);
        }

        this.bg.fillStyle(0x74ccff, 0.05);
        this.bg.fillRect(w * 0.1, h * 0.18, w * 0.8, 2);
        this.bg.fillRect(w * 0.16, h * 0.84, w * 0.68, 2);
    }

    private redrawPanel(x: number, y: number, w: number, h: number) {
        this.panelGfx.clear();
        this.panelGfx.fillStyle(0x111f2d, 0.88);
        this.panelGfx.fillRoundedRect(x, y, w, h, 20);

        this.panelGfx.lineStyle(1.4, 0x4a728a, 0.95);
        this.panelGfx.strokeRoundedRect(x, y, w, h, 20);

        this.panelGfx.fillStyle(0xffffff, 0.03);
        this.panelGfx.fillRoundedRect(x + 1, y + 1, w - 2, h * 0.28, { tl: 20, tr: 20, bl: 0, br: 0 });

        this.panelShimmer.clear();
        this.panelShimmer.fillStyle(0x85dbff, 0.45);
        this.panelShimmer.fillRoundedRect(x + w * 0.14, y + h * 0.11, w * 0.72, 2, 1);
    }

    private redrawJoinButton(buttonW: number, buttonH: number) {
        this.joinButtonGfx.clear();

        const fill = this.busy ? 0x37566e : 0x3f8fb8;
        const edge = this.busy ? 0x5a7890 : 0x8bd8ff;

        this.joinButtonGfx.fillStyle(fill, 1);
        this.joinButtonGfx.fillRoundedRect(-buttonW * 0.5, -buttonH * 0.5, buttonW, buttonH, 12);
        this.joinButtonGfx.fillStyle(0xffffff, 0.12);
        this.joinButtonGfx.fillRoundedRect(-buttonW * 0.5, -buttonH * 0.5, buttonW, buttonH * 0.46, { tl: 12, tr: 12, bl: 0, br: 0 });
        this.joinButtonGfx.lineStyle(1.2, edge, 1);
        this.joinButtonGfx.strokeRoundedRect(-buttonW * 0.5, -buttonH * 0.5, buttonW, buttonH, 12);
    }

    private setBusy(value: boolean) {
        this.busy = value;
        this.nameInput.disabled = value;
        this.joinButtonHit.input && (this.joinButtonHit.input.enabled = !value);
        this.redrawJoinButton(this.joinButtonHit.width, this.joinButtonHit.height);

        if (value) {
            this.joinButtonText.setText('Connecting...').setColor('#d8eefc');
        } else {
            this.joinButtonText.setText('Enter Meeting').setColor('#ecf8ff');
        }
    }

    private async handleJoin() {
        if (this.busy) return;

        const ceoName = this.nameInput.value.trim();
        if (!/^[a-zA-Z0-9]{3,15}$/.test(ceoName)) {
            this.feedback.setText('Name must be 3-15 alphanumeric characters.').setColor('#ff7f8f');
            this.cameras.main.shake(120, 0.002);
            return;
        }

        this.feedback.setText('').setColor('#ff7f8f');
        this.setBusy(true);

        try {
            await this.serverManager.joinOfficeRoom(ceoName);

            this.feedback.setText('Connected. Entering table...').setColor('#9df3be');
            this.cameras.main.fadeOut(320, 8, 13, 20);

            this.time.delayedCall(340, () => {
                this.cleanupInput();
                this.scene.start('GameScene', { serverManager: this.serverManager });
            });
        } catch (e: any) {
            const errorMsg = e?.message ? String(e.message) : 'Connection error';
            this.feedback.setText(`Access denied: ${errorMsg}`).setColor('#ff7f8f');
            this.setBusy(false);
        }
    }
}