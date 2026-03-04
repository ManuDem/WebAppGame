const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'manud', 'Desktop', 'WebApp Game', 'WebAppGame', 'client', 'src', 'scenes', 'GameScene.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Aggiungiamo i Container e i nuovi field Layout
code = code.replace(
    /private topH: number = 0;[\s\S]*?private bottomY: number = 0;/,
    `private UI_W: number = 0;
    private UI_X: number = 0;
    private topH: number = 0;
    private centerH: number = 0;
    private centerY: number = 0;
    private bottomH: number = 0;
    private bottomY: number = 0;

    // ── Layout Containers ────────────────────────────────────
    private topUI!: Phaser.GameObjects.Container;
    private centerUI!: Phaser.GameObjects.Container;
    private bottomUI!: Phaser.GameObjects.Container;
    private bgGraphics!: Phaser.GameObjects.Graphics;`
);

// 2. Sostituiamo create() per supportare resize e container
const createRegex = /create\(\) \{[\s\S]*?this\._setupDropHandlers\(\);\n    \}/;
code = code.replace(createRegex, `create() {
        this.bgGraphics = this.add.graphics();
        
        this.topUI = this.add.container(0, 0);
        this.centerUI = this.add.container(0, 0);
        this.bottomUI = this.add.container(0, 0);

        this._buildParticles();
        this._buildReactionOverlay(0, 0);
        this._setupDropHandlers();

        this.scale.on('resize', this.resize, this);
        this.resize({ width: this.scale.width, height: this.scale.height } as Phaser.Structs.Size);
    }

    // ─────────────────────────────────────────────────────────
    //  RESIZE HANDLER
    // ─────────────────────────────────────────────────────────
    private resize(gameSize: Phaser.Structs.Size) {
        let { width, height } = gameSize;
        
        // Modalità "App": se lo schermo è molto largo (Desktop), limitiamo la larghezza
        // e la centriamo, mantenendo l'altezza fissa.
        const isLandscape = width > height;
        this.UI_W = isLandscape ? Math.min(width, 500) : width;
        this.UI_X = (width - this.UI_W) / 2;

        this.topH = height * 0.15;
        this.centerH = height * 0.55;
        this.bottomH = height * 0.30;
        
        this.centerY = this.topH + this.centerH / 2;
        this.bottomY = this.topH + this.centerH + this.bottomH / 2;

        this.topUI.setPosition(this.UI_X, 0);
        this.centerUI.setPosition(this.UI_X, this.topH);
        this.bottomUI.setPosition(this.UI_X, this.topH + this.centerH);

        this._buildBackground(width, height);
        this._buildTopUI();
        this._buildCenterUI();
        this._buildBottomUI();

        // Reposition reaction overlay to center
        if (this.reactionOverlay) {
            this.reactionOverlay.setPosition(width / 2, height / 2);
            this.reactionOverlay.setSize(width, height);
            this.reactionLabel.setPosition(width / 2, height / 2 - 20);
            if (this.reactionTimerGfx) {
               this.reactionTimerGfx.setPosition(width / 2 - 150, height / 2 + 50);
            }
        }

        // Re-render state visuals based on new sizes if available
        if (this.serverManager?.room?.state) {
            const rawState = this.serverManager.room.state as any;
            const myPl = rawState.players.get(this.serverManager.room.sessionId);
            if (myPl) this._applyStateVisuals(rawState, myPl);
        }
    }`);

// 3. Riscriviamo le fuzioni UI per usare coordinate relative ai Container
code = code.replace(
    /private _buildBackground\(w: number, h: number\) \{[\s\S]*?grid\.strokePath\(\);\n    \}/,
    `private _buildBackground(w: number, h: number) {
        this.bgGraphics.clear();
        this.bgGraphics.fillStyle(0x060614, 1);
        this.bgGraphics.fillRect(0, 0, w, h);
        
        this.bgGraphics.lineStyle(1, 0x1a1a3a, 0.3);
        const cw = this.UI_W;
        for (let y = 0; y < h; y += 32) {
            this.bgGraphics.moveTo(this.UI_X, y); this.bgGraphics.lineTo(this.UI_X + cw, y);
        }
        this.bgGraphics.strokePath();
    }`
);

// TopUI
code = code.replace(
    /private _buildTopUI\(w: number\) \{[\s\S]*?\}\)\.setOrigin\(0\.5\)\.setDepth\(5\)\.setName\('opponentPlaceholder'\);\n    \}/,
    `private _buildTopUI() {
        this.topUI.removeAll(true);
        const w = this.UI_W;
        
        const g = this.add.graphics();
        g.fillStyle(0x12082a, 0.6); // Semi-trasparent minimal
        g.fillRoundedRect(4, 4, w - 8, this.topH - 8, 12);
        g.lineStyle(1.5, 0x3a1a5a, 0.5);
        g.strokeRoundedRect(4, 4, w - 8, this.topH - 8, 12);

        const lbl = this.add.text(14, 10, '🏢 CEO RIVALI', {
            fontSize: '13px', color: '#b57bee', fontStyle: 'bold', letterSpacing: 1
        }).setDepth(5);

        const ph = this.add.text(w / 2, this.topH / 2 + 6, 'In attesa di avversari...', {
            fontSize: '12px', color: '#444466', fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(5).setName('opponentPlaceholder');

        this.topUI.add([g, lbl, ph]);
    }`
);

// Update Opponent Panels to append to topUI
code = code.replace(
    /this\.opponentContainers\.push\(cont\);\n        \}\);/,
    `this.opponentContainers.push(cont);
            this.topUI.add(cont);
        });`
);
code = code.replace(/const startX = w \/ 2 - totalW \/ 2 \+ panelW \/ 2;/, `const startX = this.UI_W / 2 - totalW / 2 + panelW / 2;`);
code = code.replace(/const panelW = Math\.min\(100, \(w - 20\) \/ opponents\.length - 6\);/, `const panelW = Math.min(100, (this.UI_W - 20) / opponents.length - 6);`);
code = code.replace(/private _updateOpponentPanels\(state: IGameState, w: number\) \{/, `private _updateOpponentPanels(state: IGameState, _oldW?: number) {`);
code = code.replace(/this\.children\.getByName\('opponentPlaceholder'\)/, `this.topUI.getByName('opponentPlaceholder')`);

// CenterUI
const buildCenterRegex = /private _buildCenterUI\(w: number\) \{[\s\S]*?this\._drawEndTurnButton\(etX, deckY, etW, etH, false\);\n[\s\S]*?\}\)\.setOrigin\(0\.5\)\.setDepth\(7\);\n[\s\S]*?\}\)\.on\('pointerout'[\s\S]*?\}\);/;
code = code.replace(
    buildCenterRegex,
    `private _buildCenterUI() {
        this.centerUI.removeAll(true);
        const w = this.UI_W;
        
        const g = this.add.graphics();
        // Minimal no-block background
        g.fillStyle(0x0e0d26, 0.3);
        g.fillRoundedRect(4, 2, w - 8, this.centerH - 4, 10);
        g.lineStyle(2, 0x2a1a4a, 0.5);
        g.strokeRoundedRect(4, 2, w - 8, this.centerH - 4, 10);

        const lbl = this.add.text(w / 2, 18, '📋 CRISI AZIENDALI', {
            fontSize: '12px', color: '#664444', fontStyle: 'bold', letterSpacing: 1
        }).setOrigin(0.5).setDepth(5);

        // Center DropZone needs to be global actually or correctly hooked, 
        // but we can put it in CenterUI and bounds will be relative.
        const czW = w - 16;
        const czH = this.centerH * 0.45;
        const czX = w / 2;
        const czY = this.centerH / 2 + 5;

        // Visual debug/glow for center table
        const centerGfx = this.add.graphics().setDepth(2);
        centerGfx.lineStyle(2, 0x4cc9f0, 0.0); // Nascosto di default, acceso su drag volendo
        centerGfx.strokeRoundedRect(czX - czW / 2 + 8, czY - czH / 2, czW - 16, czH, 10);
        centerGfx.setName('centerDash');

        this.centerTableDropZone = this.add.zone(czX, czY, czW, czH)
            .setRectangleDropZone(czW, czH);
        this.centerTableDropZone.setData('type', 'center_table');

        this.turnIndicatorText = this.add.text(w / 2, this.centerH / 2 - 20, 'In attesa...', {
            fontSize: '18px', color: '#9a8c98', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(10);

        const companyLbl = this.add.text(12, this.centerH - 25, '🏢 AREA AZIENDA', {
            fontSize: '10px', color: '#4cc9f0', fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(4);

        const deckX = w - 60;
        const deckY = this.centerH - 80;

        this.deckButton = this.add.graphics().setDepth(6);
        this._drawDeckButton(deckX, deckY, true);

        this.deckCountText = this.add.text(deckX, deckY + 26, '?', {
            fontSize: '12px', color: '#cccccc', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(7);

        this.deckButtonHit = this.add.rectangle(deckX, deckY, 80, 110, 0x000000, 0)
            .setInteractive({ useHandCursor: true }).setDepth(8)
            .on('pointerdown', () => {
                this.serverManager.drawCard();
                this.deckButtonHit.disableInteractive();
            });

        const etX = deckX - 100;
        const etW = 110;
        const etH = 44;

        this.endTurnButton = this.add.graphics().setDepth(6);
        this._drawEndTurnButton(etX, deckY, etW, etH, false);

        this.endTurnButtonText = this.add.text(etX, deckY, 'Fine\\nTurno', {
            fontSize: '13px', color: '#555577', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5).setDepth(7);

        this.endTurnButtonHit = this.add.rectangle(etX, deckY, etW, etH, 0x000000, 0)
            .setInteractive({ useHandCursor: true }).setDepth(8)
            .on('pointerdown', () => {
                this.serverManager.endTurn();
                this.endTurnButtonHit.disableInteractive();
            });

        this.centerUI.add([
            g, lbl, centerGfx, this.centerTableDropZone, 
            this.turnIndicatorText, companyLbl,
            this.deckButton, this.deckCountText, this.deckButtonHit,
            this.endTurnButton, this.endTurnButtonText, this.endTurnButtonHit
        ]);
        `
);
code = code.replace(/    \}/, `    }`);

// BottomUI
code = code.replace(
    /private _buildBottomUI\(w: number\) \{[\s\S]*?this\.paBubbles\.push\(bubble\);\n        \}\n    \}/,
    `private _buildBottomUI() {
        this.bottomUI.removeAll(true);
        const w = this.UI_W;
        
        const g = this.add.graphics();
        g.fillStyle(0x080620, 0.6); // Minimal transparent bottom
        g.fillRect(0, 0, w, this.bottomH);
        g.lineStyle(2, 0xb57bee, 0.4);
        g.moveTo(0, 0); g.lineTo(w, 0);
        g.strokePath();

        const title = this.add.text(12, 8, '🃏 LA TUA MANO', {
            fontSize: '11px', color: '#b57bee', fontStyle: 'bold', letterSpacing: 1
        }).setDepth(5);

        const paY = 44;
        this.add.text(12, paY - 12, 'PA', {
            fontSize: '11px', color: '#888899', fontStyle: 'bold'
        }).setDepth(5);

        this.paBubbles = [];
        for (let i = 0; i < 3; i++) {
            const bx = 16 + i * 26;
            const bubble = this.add.circle(bx, paY + 8, 9, 0x22223b)
                .setDepth(5).setStrokeStyle(1.5, 0x4cc9f0, 0.5);
            this.paBubbles.push(bubble);
            this.bottomUI.add(bubble);
        }
        
        this.bottomUI.add([g, title]);
    }`
);

// Reaction overlay should be built statically then bounds updated.
code = code.replace(/private _buildReactionOverlay\(w: number, h: number\) \{/, `private _buildReactionOverlay(_w: number, _h: number) {\n        const w = this.scale.width; const h = this.scale.height;`);

// Rebuild crisis zones relative to UI_W
code = code.replace(/private _rebuildCrisisZones\(w: number, crises: ICardData\[\]\) \{/, `private _rebuildCrisisZones(_oldW: number, crises: ICardData[]) {
        const w = this.UI_W;`);
code = code.replace(/const sy = this\.topH \+ 52 \+ slotH \/ 2;/, `const sy = 52 + slotH / 2;`);
code = code.replace(/this\.crisisDropZones\.push\(\{ zone, crisisId: cr\.id, gfx \}\);/, `this.crisisDropZones.push({ zone, crisisId: cr.id, gfx });
            this.centerUI.add([gfx, zone]);`);

// Update Company Area relative properly
code = code.replace(/private _updateCompanyArea\(_w: number, companyCards: ICardData\[\]\) \{/, `private _updateCompanyArea(_oldW: number, companyCards: ICardData[]) {`);
code = code.replace(/const cy = this\.topH \+ this\.centerH - 35;/, `const cy = this.centerH - 35;`);
code = code.replace(/this\.companyCards\.push\(card\);/, `this.companyCards.push(card);
            this.centerUI.add(card);`);

// Update Hand Rendering positioning
code = code.replace(/private renderHand\(handData: ICardData\[\]\) \{[\s\S]*?const \{ width \} = this\.scale;/, `private renderHand(handData: ICardData[]) {
        const width = this.UI_W;`);
code = code.replace(/this\.bottomY/g, `this.bottomH * 0.65`); // Local Y in bottomUI
code = code.replace(/this\.handCards\.push\(card\);/, `this.handCards.push(card);
            this.bottomUI.add(card);`);

// Apply visuals references
code = code.replace(/this\._rebuildCrisisZones\(width, /, `this._rebuildCrisisZones(this.UI_W, `);
code = code.replace(/this\._updateOpponentPanels\(state, width\);/, `this._updateOpponentPanels(state, this.UI_W);`);
code = code.replace(/this\._updateCompanyArea\(width, /, `this._updateCompanyArea(this.UI_W, `);

// Fly dragging fixes (coordinate space)
// In azione risolta
code = code.replace(/x: 60, y: this\.topH \+ this\.centerH - 35,/, `x: 60, y: this.bottomY - 100,`);

// Fine update
fs.writeFileSync(filePath, code);
