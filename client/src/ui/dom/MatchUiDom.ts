import { APP_FONT_FAMILY } from '../Typography';
import type { MatchLayout } from '../layout/MatchLayout';
import { ensureUiRoot } from './UiRoot';

type MatchUiDomCallbacks = {
    onDraw: () => void;
    onEndTurn: () => void;
    onDetails: () => void;
    onToggleLog: () => void;
    onHelp: () => void;
    onEmote: () => void;
};

type MatchUiDomModel = {
    roomCode: string;
    opponents: string;
    turn: string;
    stats: string;
    phase: string;
    reaction: string;
    actionHint: string;
    actionDetail: string;
    actionContext: string;
    canDraw: boolean;
    canEndTurn: boolean;
    showEmote: boolean;
    drawLabel: string;
    endLabel: string;
    detailsLabel: string;
    helpLabel: string;
    emoteLabel: string;
    logTitle: string;
    logToggle: string;
    logEntries: string[];
    logExpanded: boolean;
};

export class MatchUiDom {
    private readonly callbacks: MatchUiDomCallbacks;
    private readonly root: HTMLDivElement;
    private readonly boardSpacer: HTMLDivElement;
    private readonly topBar: HTMLDivElement;
    private readonly topRoom: HTMLParagraphElement;
    private readonly topOpponents: HTMLParagraphElement;
    private readonly hudPanel: HTMLDivElement;
    private readonly hudTurn: HTMLParagraphElement;
    private readonly hudStats: HTMLParagraphElement;
    private readonly hudPhase: HTMLParagraphElement;
    private readonly hudReaction: HTMLParagraphElement;
    private readonly controlsPanel: HTMLDivElement;
    private readonly actionHint: HTMLParagraphElement;
    private readonly actionDetail: HTMLParagraphElement;
    private readonly actionContext: HTMLParagraphElement;
    private readonly actionsRow: HTMLDivElement;
    private readonly drawButton: HTMLButtonElement;
    private readonly endButton: HTMLButtonElement;
    private readonly detailsButton: HTMLButtonElement;
    private readonly helpButton: HTMLButtonElement;
    private readonly emoteButton: HTMLButtonElement;
    private readonly logPanel: HTMLDivElement;
    private readonly logHeaderTitle: HTMLParagraphElement;
    private readonly logToggleButton: HTMLButtonElement;
    private readonly logBody: HTMLDivElement;
    private interactionEnabled = true;
    private currentTier: string = 'E';

    constructor(lang: string, callbacks: MatchUiDomCallbacks) {
        this.callbacks = callbacks;

        const rootNode = ensureUiRoot();
        if (!rootNode) {
            throw new Error('UI root not available');
        }

        const existing = rootNode.querySelector('#game-match-shell');
        if (existing) existing.remove();

        this.root = document.createElement('div');
        this.root.id = 'game-match-shell';
        this.root.className = 'match-ui-shell';
        this.root.dataset.lang = String(lang).toLowerCase();

        this.boardSpacer = document.createElement('div');
        this.boardSpacer.className = 'match-ui-board-spacer';
        this.boardSpacer.setAttribute('aria-hidden', 'true');
        this.boardSpacer.dataset.qaPanel = 'critical';

        this.topBar = document.createElement('div');
        this.topBar.className = 'match-ui-top';
        this.topBar.dataset.qaPanel = 'critical';

        this.topRoom = document.createElement('p');
        this.topRoom.className = 'match-ui-room';

        this.topOpponents = document.createElement('p');
        this.topOpponents.className = 'match-ui-opponents';

        this.topBar.appendChild(this.topRoom);
        this.topBar.appendChild(this.topOpponents);

        this.hudPanel = document.createElement('div');
        this.hudPanel.className = 'match-ui-hud';
        this.hudPanel.dataset.qaPanel = 'critical';

        this.hudTurn = document.createElement('p');
        this.hudTurn.className = 'match-ui-hud-turn';
        this.hudStats = document.createElement('p');
        this.hudStats.className = 'match-ui-hud-stats';
        this.hudPhase = document.createElement('p');
        this.hudPhase.className = 'match-ui-hud-phase';
        this.hudReaction = document.createElement('p');
        this.hudReaction.className = 'match-ui-hud-reaction';

        this.hudPanel.appendChild(this.hudTurn);
        this.hudPanel.appendChild(this.hudStats);
        this.hudPanel.appendChild(this.hudPhase);
        this.hudPanel.appendChild(this.hudReaction);

        this.controlsPanel = document.createElement('div');
        this.controlsPanel.className = 'match-ui-controls';
        this.controlsPanel.dataset.qaPanel = 'critical';

        this.actionHint = document.createElement('p');
        this.actionHint.className = 'match-ui-action-hint';
        this.actionDetail = document.createElement('p');
        this.actionDetail.className = 'match-ui-action-detail';
        this.actionContext = document.createElement('p');
        this.actionContext.className = 'match-ui-action-context';

        this.actionsRow = document.createElement('div');
        this.actionsRow.className = 'match-ui-actions-row';

        this.drawButton = this.createButton('match-ui-btn match-ui-btn-primary');
        this.drawButton.addEventListener('click', () => this.callbacks.onDraw());
        this.endButton = this.createButton('match-ui-btn match-ui-btn-primary');
        this.endButton.addEventListener('click', () => this.callbacks.onEndTurn());
        this.detailsButton = this.createButton('match-ui-btn match-ui-btn-secondary');
        this.detailsButton.addEventListener('click', () => this.callbacks.onDetails());
        this.helpButton = this.createButton('match-ui-btn match-ui-btn-secondary');
        this.helpButton.addEventListener('click', () => this.callbacks.onHelp());
        this.emoteButton = this.createButton('match-ui-btn match-ui-btn-secondary');
        this.emoteButton.addEventListener('click', () => this.callbacks.onEmote());

        this.actionsRow.appendChild(this.drawButton);
        this.actionsRow.appendChild(this.endButton);
        this.actionsRow.appendChild(this.detailsButton);
        this.actionsRow.appendChild(this.helpButton);
        this.actionsRow.appendChild(this.emoteButton);

        this.controlsPanel.appendChild(this.actionHint);
        this.controlsPanel.appendChild(this.actionDetail);
        this.controlsPanel.appendChild(this.actionContext);
        this.controlsPanel.appendChild(this.actionsRow);

        this.logPanel = document.createElement('div');
        this.logPanel.className = 'match-ui-log';
        this.logPanel.dataset.qaPanel = 'critical';

        const logHeader = document.createElement('div');
        logHeader.className = 'match-ui-log-header';
        this.logHeaderTitle = document.createElement('p');
        this.logHeaderTitle.className = 'match-ui-log-title';
        this.logToggleButton = this.createButton('match-ui-btn match-ui-btn-secondary match-ui-log-toggle');
        this.logToggleButton.addEventListener('click', () => this.callbacks.onToggleLog());
        logHeader.appendChild(this.logHeaderTitle);
        logHeader.appendChild(this.logToggleButton);
        this.logBody = document.createElement('div');
        this.logBody.className = 'match-ui-log-body';
        this.logPanel.appendChild(logHeader);
        this.logPanel.appendChild(this.logBody);

        this.root.appendChild(this.topBar);
        this.root.appendChild(this.boardSpacer);
        this.root.appendChild(this.hudPanel);
        this.root.appendChild(this.controlsPanel);
        this.root.appendChild(this.logPanel);
        rootNode.appendChild(this.root);

        this.root.style.fontFamily = APP_FONT_FAMILY;
    }

    private createButton(className: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        return button;
    }

    setLanguage(lang: string): void {
        this.root.dataset.lang = String(lang).toLowerCase();
    }

    applyLayout(layout: MatchLayout): void {
        const place = (node: HTMLElement, r: { x: number; y: number; w: number; h: number }) => {
            node.style.left = `${Math.round(r.x)}px`;
            node.style.top = `${Math.round(r.y)}px`;
            node.style.width = `${Math.round(r.w)}px`;
            node.style.height = `${Math.round(r.h)}px`;
        };

        this.root.style.left = '0px';
        this.root.style.top = '0px';
        this.root.style.width = `${Math.round(layout.screenW)}px`;
        this.root.style.height = `${Math.round(layout.screenH)}px`;
        this.root.style.setProperty('--match-gap', `${Math.round(layout.gap)}px`);
        this.currentTier = layout.tier;
        this.root.classList.toggle('match-ui-landscape-low', layout.tier === 'C');
        this.root.classList.toggle('match-ui-portrait', layout.tier === 'A' || layout.tier === 'B');
        this.root.classList.toggle('match-ui-compact', layout.compactLandscape || layout.compactPortrait);
        const showLogPanel = !(layout.tier === 'A' || layout.tier === 'B');
        const showTopBar = !(layout.tier === 'A' || layout.tier === 'B');
        this.topBar.style.display = showTopBar ? 'flex' : 'none';
        this.logPanel.style.display = showLogPanel ? 'grid' : 'none';

        place(this.topBar, layout.topBar);
        place(this.boardSpacer, layout.board);
        place(this.hudPanel, layout.hud);
        place(this.controlsPanel, layout.controls);
        if (showLogPanel) {
            place(this.logPanel, layout.log);
        }
    }

    setVisible(visible: boolean): void {
        this.root.style.display = visible ? 'block' : 'none';
    }

    setInteractionEnabled(enabled: boolean): void {
        this.interactionEnabled = enabled;
        this.root.classList.toggle('match-ui-disabled', !enabled);
    }

    update(model: MatchUiDomModel): void {
        const showTopText = !(this.currentTier === 'A' || this.currentTier === 'B');
        this.topRoom.textContent = model.roomCode;
        this.topOpponents.textContent = model.opponents;
        this.topRoom.style.display = showTopText && model.roomCode.trim().length > 0 ? 'block' : 'none';
        this.topOpponents.style.display = showTopText && model.opponents.trim().length > 0 ? 'block' : 'none';
        this.hudTurn.textContent = model.turn;
        this.hudStats.textContent = model.stats;
        this.hudPhase.textContent = model.phase;
        this.hudReaction.textContent = model.reaction;
        this.hudPhase.style.display = model.phase.trim().length > 0 ? 'block' : 'none';
        this.hudReaction.style.display = model.reaction.trim().length > 0 ? 'block' : 'none';

        this.actionHint.textContent = model.actionHint;
        this.actionDetail.textContent = model.actionDetail;
        this.actionContext.textContent = model.actionContext;
        this.actionDetail.style.display = model.actionDetail.trim().length > 0 ? 'block' : 'none';
        this.actionContext.style.display = model.actionContext.trim().length > 0 ? 'block' : 'none';

        this.drawButton.textContent = model.drawLabel;
        this.endButton.textContent = model.endLabel;
        this.detailsButton.textContent = model.detailsLabel;
        this.helpButton.textContent = model.helpLabel;
        this.emoteButton.textContent = model.emoteLabel;

        this.drawButton.disabled = !model.canDraw;
        this.endButton.disabled = !model.canEndTurn;
        this.detailsButton.disabled = !this.interactionEnabled;
        this.helpButton.disabled = !this.interactionEnabled;
        this.logToggleButton.disabled = !this.interactionEnabled;
        this.emoteButton.style.display = model.showEmote ? 'inline-flex' : 'none';
        this.actionsRow.classList.toggle('match-ui-actions-row-no-emote', !model.showEmote);

        this.logHeaderTitle.textContent = model.logTitle;
        this.logToggleButton.textContent = model.logToggle;
        this.root.classList.toggle('match-ui-log-expanded', model.logExpanded);

        this.logBody.innerHTML = '';
        const maxEntries = model.logExpanded ? 8 : 2;
        const entries = model.logEntries.slice(-maxEntries);
        entries.forEach((entry) => {
            const item = document.createElement('p');
            item.className = 'match-ui-log-entry';
            item.textContent = entry;
            this.logBody.appendChild(item);
        });
        if (entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'match-ui-log-entry';
            empty.textContent = '-';
            this.logBody.appendChild(empty);
        }
    }

    destroy(): void {
        this.root.remove();
    }
}
