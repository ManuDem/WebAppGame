import {
    CardType,
    ClientMessages,
    GamePhase,
    ICardData,
    IGameState,
    IPlayer,
    IPendingAction,
    MAX_ACTION_POINTS,
    ServerEvents,
} from '../../../shared/SharedTypes';
import cardsDbRaw from '../../../shared/cards_db.json';
import { getCardLocalizedText } from '../../../shared/CardTextCatalog';
import { sanitizeLanguage, SupportedLanguage, t } from '../i18n';

export type MockMatchPreset = 'my_turn' | 'other_turn' | 'reaction_window';
export interface MockMatchOptions {
    longNames?: boolean;
}

const LOCAL_ID = 'qa_local';
const OPP_1_ID = 'qa_opp_1';
const OPP_2_ID = 'qa_opp_2';

let cardSeq = 0;

interface CardTemplateRecord {
    id: string;
    type: string;
    cost?: number;
    shortDesc?: string;
    description?: string;
    name?: string;
    targetRoll?: number;
    modifier?: number;
    subtype?: string;
}

const cardTemplates = new Map<string, CardTemplateRecord>();
(cardsDbRaw as CardTemplateRecord[]).forEach((row) => {
    const id = String(row?.id ?? '').trim();
    if (!id) return;
    cardTemplates.set(id, row);
});

function nextCardId(templateId: string): string {
    cardSeq += 1;
    return `qa_${templateId}_${cardSeq}`;
}

function resolveCardType(raw: string | undefined): CardType {
    const type = String(raw ?? '').toLowerCase();
    if (type === CardType.HERO || type === CardType.EMPLOYEE) return CardType.HERO;
    if (type === CardType.ITEM || type === CardType.OGGETTO) return CardType.ITEM;
    if (type === CardType.MAGIC || type === CardType.EVENTO) return CardType.MAGIC;
    if (type === CardType.MODIFIER) return CardType.MODIFIER;
    if (type === CardType.CHALLENGE || type === CardType.REACTION) return CardType.CHALLENGE;
    if (type === CardType.MONSTER || type === CardType.IMPREVISTO || type === CardType.CRISIS) return CardType.MONSTER;
    if (type === CardType.PARTY_LEADER) return CardType.PARTY_LEADER;
    return CardType.MAGIC;
}

function buildMockCard(templateId: string, lang: SupportedLanguage, extra: Partial<ICardData> = {}): ICardData {
    const template = cardTemplates.get(templateId);
    const localized = getCardLocalizedText(templateId, lang, {
        name: String(template?.name ?? templateId),
        shortDesc: String(template?.shortDesc ?? ''),
        description: String(template?.description ?? ''),
    });

    return {
        id: nextCardId(templateId),
        templateId,
        type: resolveCardType(template?.type),
        costPA: typeof template?.cost === 'number' ? template.cost : undefined,
        name: localized.name,
        shortDesc: localized.shortDesc,
        description: localized.description,
        targetRoll: typeof template?.targetRoll === 'number' ? template.targetRoll : undefined,
        modifier: typeof template?.modifier === 'number' ? template.modifier : undefined,
        subtype: (template?.subtype ?? 'none') as any,
        isFaceUp: true,
        ...extra,
    };
}

function buildMockCards(lang: SupportedLanguage) {
    const equippedTool = buildMockCard('itm_01', lang, { subtype: 'equipment', modifier: 1 });

    const localCompany = [
        buildMockCard('emp_03', lang, { modifier: 1, equippedItems: [equippedTool] }),
        buildMockCard('emp_05', lang),
    ];

    const localHand = [
        buildMockCard('emp_01', lang),
        buildMockCard('trk_01', lang),
        buildMockCard('trk_02', lang),
        buildMockCard('itm_02', lang),
        buildMockCard('rea_01', lang),
        buildMockCard('mod_01', lang),
    ];

    const opp1Company = [buildMockCard('emp_02', lang)];
    const opp2Company = [buildMockCard('emp_04', lang)];

    const centralCrises = [
        buildMockCard('crs_01', lang, { subtype: 'monster', targetRoll: 7 }),
        buildMockCard('crs_02', lang, { subtype: 'monster', targetRoll: 8 }),
        buildMockCard('crs_03', lang, { subtype: 'monster', targetRoll: 9 }),
    ];

    const crisisRefillPool = [
        buildMockCard('crs_01', lang, { subtype: 'monster', targetRoll: 7 }),
        buildMockCard('crs_02', lang, { subtype: 'monster', targetRoll: 8 }),
    ];

    const drawPool = [
        buildMockCard('emp_06', lang),
        buildMockCard('trk_03', lang),
        buildMockCard('itm_01', lang),
    ];

    return {
        localCompany,
        localHand,
        opp1Company,
        opp2Company,
        centralCrises,
        crisisRefillPool,
        drawPool,
    };
}

function createPlayer(
    sessionId: string,
    username: string,
    actionPoints: number,
    score: number,
    hand: ICardData[],
    company: ICardData[],
): IPlayer {
    return {
        sessionId,
        username,
        isReady: true,
        isConnected: true,
        actionPoints,
        hand,
        company,
        score,
        victories: 0,
        activeEffects: [],
    };
}

function parsePreset(raw: string | null | undefined): MockMatchPreset {
    const value = String(raw ?? '').toLowerCase();
    if (value === 'other' || value === 'other_turn' || value === 'opponent') return 'other_turn';
    if (value === 'reaction' || value === 'reaction_window') return 'reaction_window';
    return 'my_turn';
}

function parseLang(search: string, fallback: SupportedLanguage): SupportedLanguage {
    const params = new URLSearchParams(search);
    const fromQuery = params.get('lang') ?? params.get('qaLang');
    return sanitizeLanguage(fromQuery ?? fallback);
}

function parseBooleanQueryFlag(value: string | null): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function isQaLongNamesEnabled(search: string = window.location.search): boolean {
    const params = new URLSearchParams(search);
    return parseBooleanQueryFlag(params.get('qaLongNames'));
}

function buildQaPlayerName(baseName: string, role: 'local' | 'north' | 'south', longNames: boolean): string {
    if (!longNames) return baseName;

    const suffixByRole = {
        local: 'DirezioneOperativaUltraMegaTeamPhoenix',
        north: 'ConsorzioSettentrionaleDelleAcquisizioniGlobali',
        south: 'FederazioneMeridionaleDiInnovazioneStrategica',
    } as const;
    return `${baseName} ${suffixByRole[role]}`.trim();
}

export function isQaMatchModeEnabled(search: string = window.location.search): boolean {
    const params = new URLSearchParams(search);
    return params.get('qaMatch') === '1' || params.get('mockMatch') === '1';
}

export function resolveMockMatchPreset(search: string = window.location.search): MockMatchPreset {
    const params = new URLSearchParams(search);
    return parsePreset(params.get('qaState') ?? params.get('qaTurn'));
}

export interface MockMatchBundle {
    state: IGameState;
    localSessionId: string;
    roomCode: string;
    drawPool: ICardData[];
    crisisRefillPool: ICardData[];
    lang: SupportedLanguage;
}

export function createMockMatchBundle(
    preset: MockMatchPreset = 'my_turn',
    lang: SupportedLanguage = 'it',
    options: MockMatchOptions = {},
): MockMatchBundle {
    const language = sanitizeLanguage(lang);
    const longNames = options.longNames === true;
    const cards = buildMockCards(language);
    const tr = (key: string, vars?: Record<string, string | number>) => t(language, key, vars);

    const localPlayer = createPlayer(
        LOCAL_ID,
        buildQaPlayerName(tr('qa_mock_local_name'), 'local', longNames),
        preset === 'other_turn' ? 1 : 3,
        1,
        cards.localHand,
        cards.localCompany,
    );

    const opp1 = createPlayer(
        OPP_1_ID,
        buildQaPlayerName(tr('qa_mock_opp_north'), 'north', longNames),
        2,
        1,
        [buildMockCard('trk_04', language)],
        cards.opp1Company,
    );

    const opp2 = createPlayer(
        OPP_2_ID,
        buildQaPlayerName(tr('qa_mock_opp_south'), 'south', longNames),
        3,
        0,
        [buildMockCard('rea_02', language)],
        cards.opp2Company,
    );

    const players = new Map<string, IPlayer>();
    players.set(localPlayer.sessionId, localPlayer);
    players.set(opp1.sessionId, opp1);
    players.set(opp2.sessionId, opp2);

    const pendingAction: IPendingAction | null = preset === 'reaction_window'
        ? {
            id: 'qa_pending_1',
            playerId: OPP_1_ID,
            actionType: ClientMessages.PLAY_MAGIC,
            targetCardId: 'qa_pending_card',
            targetPlayerId: LOCAL_ID,
            timestamp: Date.now(),
            isCancelled: false,
        }
        : null;

    const state: IGameState = {
        phase: preset === 'reaction_window' ? GamePhase.REACTION_WINDOW : GamePhase.PLAYER_TURN,
        players,
        hostSessionId: LOCAL_ID,
        playerOrder: [LOCAL_ID, OPP_1_ID, OPP_2_ID],
        currentTurnPlayerId: preset === 'my_turn' ? LOCAL_ID : OPP_1_ID,
        turnIndex: preset === 'my_turn' ? 0 : 1,
        centralCrises: cards.centralCrises,
        deckCount: 24,
        actionStack: pendingAction ? [pendingAction] : [],
        pendingAction,
        reactionEndTime: preset === 'reaction_window' ? Date.now() + 4500 : 0,
        turnNumber: 5,
    };

    return {
        state,
        localSessionId: LOCAL_ID,
        roomCode: 'QAM4',
        drawPool: cards.drawPool,
        crisisRefillPool: cards.crisisRefillPool,
        lang: language,
    };
}

type RoomLike = {
    sessionId: string;
    state: IGameState;
};

export class MockServerManager {
    public room?: RoomLike;

    public onStateChange?: (state: IGameState) => void;
    public onPlayerChange?: (player: IPlayer) => void;
    public onRoomMessage?: (type: string | number, message: any) => void;

    private drawIndex = 0;
    private crisisIndex = 0;

    constructor(
        private readonly bundle: MockMatchBundle,
    ) {
        this.room = {
            sessionId: bundle.localSessionId,
            state: bundle.state,
        };
    }

    private tr(key: string, vars?: Record<string, string | number>) {
        return t(this.bundle.lang, key, vars);
    }

    private emitState() {
        if (!this.room) return;
        this.onStateChange?.(this.room.state);
        const me = this.room.state.players.get(this.room.sessionId);
        if (me) this.onPlayerChange?.(me);
    }

    private emitMessage(type: ServerEvents, payload: any) {
        this.onRoomMessage?.(type, payload);
    }

    private emitError(code: string, message: string) {
        this.emitMessage(ServerEvents.ERROR, { code, message });
    }

    private getLocalPlayer() {
        if (!this.room) return undefined;
        return this.room.state.players.get(this.room.sessionId);
    }

    public drawCard() {
        if (!this.room) return;
        const state = this.room.state;
        const me = this.getLocalPlayer();
        if (!me) return;

        if (state.phase !== GamePhase.PLAYER_TURN) {
            this.emitError('WRONG_PHASE', this.tr('qa_mock_wrong_phase_draw'));
            return;
        }
        if (state.currentTurnPlayerId !== me.sessionId) {
            this.emitError('NOT_YOUR_TURN', this.tr('qa_mock_not_your_turn'));
            return;
        }
        if (me.actionPoints < 1) {
            this.emitError('NO_PA', this.tr('qa_mock_no_pa_draw'));
            return;
        }
        if (state.deckCount <= 0) {
            this.emitError('DECK_EMPTY', this.tr('qa_mock_deck_empty'));
            return;
        }

        me.actionPoints -= 1;
        state.deckCount = Math.max(0, state.deckCount - 1);
        const drawCard = this.bundle.drawPool[this.drawIndex % this.bundle.drawPool.length];
        this.drawIndex += 1;
        const cloned = {
            ...drawCard,
            id: nextCardId(drawCard.templateId),
            equippedItems: (drawCard.equippedItems ?? []).map((item) => ({ ...item, id: nextCardId(item.templateId) })),
        } as ICardData;
        me.hand.push(cloned);

        this.emitMessage(ServerEvents.CARD_DRAWN, { card: cloned, remainingDeck: state.deckCount });
        this.emitState();
    }

    public endTurn() {
        if (!this.room) return;
        const state = this.room.state;
        const me = this.getLocalPlayer();
        if (!me) return;

        if (state.phase !== GamePhase.PLAYER_TURN) {
            this.emitError('WRONG_PHASE', this.tr('qa_mock_wrong_phase_end'));
            return;
        }
        if (state.currentTurnPlayerId !== me.sessionId) {
            this.emitError('NOT_YOUR_TURN', this.tr('qa_mock_not_your_turn_end'));
            return;
        }

        state.turnIndex = (state.turnIndex + 1) % state.playerOrder.length;
        state.currentTurnPlayerId = state.playerOrder[state.turnIndex];
        state.turnNumber += 1;
        state.phase = GamePhase.PLAYER_TURN;
        state.pendingAction = null;
        state.actionStack = [];
        state.reactionEndTime = 0;

        const active = state.players.get(state.currentTurnPlayerId);
        if (active) active.actionPoints = MAX_ACTION_POINTS;
        me.actionPoints = Math.max(0, me.actionPoints);

        this.emitMessage(ServerEvents.TURN_STARTED, {
            playerId: state.currentTurnPlayerId,
            turnNumber: state.turnNumber,
            actionPoints: active?.actionPoints ?? MAX_ACTION_POINTS,
        });
        this.emitState();
    }

    public solveCrisis(crisisId: string, heroCardId?: string) {
        if (!this.room) return;
        const state = this.room.state;
        const me = this.getLocalPlayer();
        if (!me) return;

        if (state.phase !== GamePhase.PLAYER_TURN) {
            this.emitError('WRONG_PHASE', this.tr('qa_mock_wrong_phase_monster'));
            return;
        }
        if (state.currentTurnPlayerId !== me.sessionId) {
            this.emitError('NOT_YOUR_TURN', this.tr('qa_mock_not_your_turn'));
            return;
        }
        const attackCost = Math.max(1, Number(state.centralCrises.find((crisis) => crisis.id === crisisId)?.costPA ?? 2));
        if (me.actionPoints < attackCost) {
            this.emitError('NO_PA', this.tr('qa_mock_no_pa_monster'));
            return;
        }

        const idx = state.centralCrises.findIndex((crisis) => crisis.id === crisisId);
        if (idx < 0) {
            this.emitError('CRISIS_NOT_FOUND', this.tr('qa_mock_crisis_missing'));
            return;
        }

        const heroes = ((me.company ?? []) as ICardData[]).filter((entry) => {
            const typeValue = String(entry?.type ?? '').trim().toLowerCase();
            return typeValue === 'hero' || typeValue === 'employee';
        });
        if (heroes.length === 0) {
            this.emitError('NO_HERO_FOR_ATTACK', this.tr('game_error_no_hero_for_attack'));
            return;
        }
        if (!heroCardId) {
            this.emitError('MISSING_ATTACK_HERO', this.tr('game_error_missing_attack_hero'));
            return;
        }

        const selectedHero = heroes.find((hero) => String(hero.id) === String(heroCardId));
        if (!selectedHero) {
            this.emitError('INVALID_ATTACK_HERO', this.tr('game_error_invalid_attack_hero'));
            return;
        }

        const crisis = state.centralCrises[idx];
        const roll1 = 3 + ((state.turnNumber + idx) % 3);
        const roll2 = 2 + ((state.turnNumber + idx + 1) % 4);
        let modifier = Number(crisis?.modifier ?? 0);
        if (Number.isFinite(Number((selectedHero as any)?.modifier))) {
            modifier += Number((selectedHero as any)?.modifier);
        }
        const equippedItems = ((selectedHero as any)?.equippedItems ?? []) as ICardData[];
        equippedItems.forEach((item) => {
            if (Number.isFinite(Number((item as any)?.modifier))) {
                modifier += Number((item as any).modifier);
            }
        });
        const targetRoll = Number.isFinite(Number(crisis?.targetRoll)) ? Number(crisis.targetRoll) : 8;
        const total = roll1 + roll2 + modifier;
        const success = total >= targetRoll;

        me.actionPoints = Math.max(0, me.actionPoints - attackCost);
        this.emitMessage(ServerEvents.DICE_ROLLED, {
            playerId: me.sessionId,
            cardId: crisis.id,
            roll1,
            roll2,
            modifier,
            targetRoll,
            total,
            success,
        });

        if (success) {
            me.score += 1;
            state.centralCrises.splice(idx, 1);
            if (this.bundle.crisisRefillPool.length > 0) {
                const refill = this.bundle.crisisRefillPool[this.crisisIndex % this.bundle.crisisRefillPool.length];
                this.crisisIndex += 1;
                state.centralCrises.push({
                    ...refill,
                    id: nextCardId(refill.templateId),
                });
            }
            this.emitMessage(ServerEvents.ACTION_RESOLVED, {
                success: true,
                log: [this.tr('qa_mock_monster_solved', { name: String(crisis.name ?? crisis.templateId) })],
            });
        } else {
            this.emitMessage(ServerEvents.ACTION_RESOLVED, {
                success: false,
                log: [this.tr('qa_mock_monster_failed', { name: String(crisis.name ?? crisis.templateId) })],
            });
        }

        this.emitState();
    }

    public playEmployee(_cardId: string) {
        this.emitError('INVALID_CARD_TYPE', this.tr('qa_mock_unsupported_employee'));
    }

    public playMagic(_cardId: string, _targetPlayerId?: string, _targetHeroCardId?: string) {
        this.emitError('INVALID_CARD_TYPE', this.tr('qa_mock_unsupported_magic'));
    }

    public playReaction(_cardId: string) {
        this.emitError('NO_REACTION_WINDOW', this.tr('qa_mock_unsupported_reaction'));
    }

    public sendEmote(emoteId: string) {
        const me = this.getLocalPlayer();
        if (!me) return;
        this.emitMessage(ServerEvents.EMOTE, { playerId: me.sessionId, emoteId: String(emoteId ?? 'thumbs_up') });
    }

    public joinGame() {
        this.emitError('WRONG_PHASE', this.tr('qa_mock_unsupported_join'));
    }

    public startMatch() {
        this.emitError('WRONG_PHASE', this.tr('qa_mock_unsupported_start'));
    }
}

export function createMockServerManager(
    search: string = window.location.search,
    lang?: SupportedLanguage,
): MockServerManager {
    const preset = resolveMockMatchPreset(search);
    const persistedLang = typeof localStorage !== 'undefined'
        ? localStorage.getItem('lucrare_lang')
        : null;
    const selectedLang = parseLang(search, sanitizeLanguage(lang ?? persistedLang));
    const bundle = createMockMatchBundle(preset, selectedLang, {
        longNames: isQaLongNamesEnabled(search),
    });
    return new MockServerManager(bundle);
}
