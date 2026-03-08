import { IDiceRolledEvent } from '../../../../shared/SharedTypes';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function resolveModifierValue(event: IDiceRolledEvent): number {
    if (Number.isFinite(Number(event.modifier))) return Number(event.modifier);
    return Number(event.total ?? 0) - Number(event.roll1 ?? 0) - Number(event.roll2 ?? 0);
}

function formatModifierText(value: number): string {
    if (value > 0) return `+${value}`;
    if (value < 0) return `${value}`;
    return '';
}

function localizeRewardCode(rewardCode: string | undefined, tr: TranslateFn): string | null {
    if (!rewardCode) return null;
    if (rewardCode.startsWith('vp_')) {
        const parsed = parseInt(rewardCode.replace('vp_', ''), 10);
        const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        return tr('game_reward_vp', { value: safe });
    }
    return rewardCode;
}

function localizePenaltyCode(penaltyCode: string | undefined, tr: TranslateFn): string | null {
    if (!penaltyCode) return null;
    switch (penaltyCode) {
        case 'discard_2':
            return tr('game_penalty_discard_2');
        case 'lose_employee':
            return tr('game_penalty_lose_employee');
        case 'lock_tricks':
            return tr('game_penalty_lock_tricks');
        default:
            return penaltyCode;
    }
}

export function buildDiceOutcomeLine(event: IDiceRolledEvent, tr: TranslateFn): string | null {
    if (event.success) {
        const reward = localizeRewardCode(event.rewardCode, tr);
        if (!reward) return null;
        return tr('game_dice_reward_line', { value: reward });
    }

    const penalty = localizePenaltyCode(event.penaltyCode, tr);
    if (!penalty) return null;
    return tr('game_dice_penalty_line', { value: penalty });
}

export function buildDiceLogLine(event: IDiceRolledEvent, actor: string, tr: TranslateFn): string {
    return tr('game_log_dice_ext', {
        player: actor,
        roll1: event.roll1 ?? 0,
        roll2: event.roll2 ?? 0,
        modifierText: formatModifierText(resolveModifierValue(event)),
        total: event.total ?? 0,
        target: Number.isFinite(Number(event.targetRoll)) ? Number(event.targetRoll) : '-',
        status: event.success ? tr('game_dice_success') : tr('game_dice_fail'),
    });
}

export function buildDiceToastText(event: IDiceRolledEvent, actor: string, tr: TranslateFn): string {
    const headerLine = tr('game_dice_result_line_ext', {
        player: actor,
        roll1: event.roll1 ?? 0,
        roll2: event.roll2 ?? 0,
        modifierText: formatModifierText(resolveModifierValue(event)),
        total: event.total ?? 0,
        target: Number.isFinite(Number(event.targetRoll)) ? Number(event.targetRoll) : '-',
        status: event.success ? tr('game_dice_success') : tr('game_dice_fail'),
    });
    const outcomeLine = buildDiceOutcomeLine(event, tr);
    return outcomeLine ? `${headerLine}\n${outcomeLine}` : headerLine;
}
