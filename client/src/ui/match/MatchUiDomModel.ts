import { GamePhase, IGameState, IPlayer } from '../../../../shared/SharedTypes';
import { MatchActionState } from './MatchActionState';
import { buildMatchContextHint } from './MatchHelpContent';
import { buildActionPanelModel, buildHudModel } from './MatchUiPresenter';

export interface MatchUiDomModel {
    roomCode: string;
    opponents: string;
    turn: string;
    stats: string;
    phase: string;
    reaction: string;
    reactionActive: boolean;
    myTurn: boolean;
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
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface BuildMatchUiDomModelInput {
    state: IGameState;
    me: IPlayer;
    opponents: IPlayer[];
    activePlayer?: IPlayer;
    myId: string;
    actionState: MatchActionState;
    roomCode: string;
    reconnectActive: boolean;
    gameLogExpanded: boolean;
    gameLogEntries: string[];
    controlsWidth: number;
    layoutTier: string;
    compactLandscape: boolean;
    compactHud: boolean;
    discardCount: number;
    tr: TranslateFn;
    localizeReason: (reasonKey?: MatchActionState['attackReasonKey']) => string;
    pendingAction: boolean;
}

export function buildCompactHudStats(me: IPlayer, tr: TranslateFn): string {
    return tr('game_hud_stats_micro', {
        ap: Math.max(0, Number(me.actionPoints ?? 0)),
        score: Math.max(0, Number(me.score ?? 0)),
    });
}

export function buildMatchUiDomModel(input: BuildMatchUiDomModelInput): MatchUiDomModel {
    const {
        state,
        me,
        opponents,
        activePlayer,
        myId,
        actionState,
        roomCode,
        reconnectActive,
        gameLogExpanded,
        gameLogEntries,
        controlsWidth,
        layoutTier,
        compactLandscape,
        compactHud,
        discardCount,
        tr,
        localizeReason,
        pendingAction,
    } = input;

    const portraitTier = layoutTier === 'A' || layoutTier === 'B';
    const compactDomText = compactLandscape || controlsWidth < 300 || portraitTier;
    const compactControlsLabels = compactDomText || controlsWidth < 270 || layoutTier === 'C';
    const activePlayerName = String(activePlayer?.username ?? tr('game_unknown_player'));
    const actionPanel = buildActionPanelModel(actionState, activePlayerName, tr, localizeReason);
    const contextHint = buildMatchContextHint({
        phase: state.phase,
        actionState,
        pendingAction,
        tr,
        localizeReason,
    });
    const hud = buildHudModel({
        me,
        opponents,
        activePlayer,
        myId,
        deckCount: Number(state.deckCount ?? 0),
        discardCount,
        reactionActive: state.phase === GamePhase.REACTION_WINDOW,
        phase: String(state.phase ?? '').replace(/_/g, ' '),
        compact: compactHud,
        tr,
    });

    return {
        roomCode: tr('game_room_code', { code: roomCode || '----' }),
        opponents: compactHud
            ? tr('game_hud_opponents', { value: tr('game_opponents_count', { count: opponents.length }) })
            : hud.opponentsLabel,
        turn: hud.turnLabel,
        stats: portraitTier ? buildCompactHudStats(me, tr) : hud.statsLabel,
        phase: portraitTier ? '' : hud.phaseLabel,
        reaction: portraitTier ? '' : hud.reactionLabel,
        reactionActive: state.phase === GamePhase.REACTION_WINDOW,
        myTurn: actionState.isMyTurn,
        actionHint: compactDomText ? tr('game_action_compact_hint') : actionPanel.hint,
        actionDetail: compactDomText ? '' : actionPanel.detail.replace(/\n/g, ' | '),
        actionContext: compactDomText ? '' : contextHint,
        canDraw: !reconnectActive && actionState.canDraw,
        canEndTurn: !reconnectActive && actionState.canEndTurn,
        showEmote: false,
        drawLabel: tr('game_deck'),
        endLabel: compactControlsLabels ? tr('game_end_turn_compact') : tr('game_end_turn'),
        detailsLabel: tr('game_details_button'),
        helpLabel: tr('game_details_button'),
        emoteLabel: tr('game_emote_button'),
        logTitle: tr('game_log_title'),
        logToggle: gameLogExpanded ? tr('game_log_less') : tr('game_log_more'),
        logEntries: gameLogEntries,
        logExpanded: gameLogExpanded,
    };
}
