import { CardEffectParser, IResolveQueueResult } from "../../../shared/CardEffectParser";
import { ICardData, IGameState, IPendingAction } from "../../../shared/SharedTypes";

export interface IResolveReactionQueueResult {
    originalAction: IPendingAction | null;
    parserResult: IResolveQueueResult | null;
    parserSuccess: boolean;
    log: string[];
}

export function resolveReactionQueue(state: IGameState): IResolveReactionQueueResult {
    const originalAction = (state.pendingAction ?? null) as IPendingAction | null;
    const chainStack = [...state.actionStack].reverse();
    const reactions = chainStack.slice(1);

    let parserResult: IResolveQueueResult | null = null;
    try {
        if (originalAction) {
            parserResult = CardEffectParser.resolveQueue(originalAction, reactions, state);
        }
    } catch (error) {
        console.error("[GAME] resolveReactionQueue fatal error:", error);
        parserResult = {
            success: false,
            log: ["[resolveQueue] Internal error during resolution. Action cancelled."],
        };
    }

    const parserSuccess = parserResult ? parserResult.success : !originalAction?.isCancelled;
    return {
        originalAction,
        parserResult,
        parserSuccess,
        log: parserResult ? [...parserResult.log] : [],
    };
}

export function consumePendingDrawTags(
    state: IGameState,
    drawCard: () => ICardData | null,
    toRuntimeCard: (card: ICardData) => ICardData,
): number {
    let drawnCards = 0;

    state.players.forEach((player: any) => {
        const effects = player.activeEffects as string[];
        for (let i = effects.length - 1; i >= 0; i--) {
            const tag = effects[i];
            if (typeof tag !== "string" || !tag.startsWith("pending_draw_")) continue;

            const drawCount = parseInt(tag.replace("pending_draw_", ""), 10);
            if (Number.isFinite(drawCount) && drawCount > 0) {
                for (let drawIndex = 0; drawIndex < drawCount; drawIndex++) {
                    const drawn = drawCard();
                    if (!drawn) break;
                    (player.hand as ICardData[]).push(toRuntimeCard(drawn));
                    drawnCards++;
                }
            }

            effects.splice(i, 1);
        }
    });

    return drawnCards;
}

