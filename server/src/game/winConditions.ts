import { IPlayer } from "../../../shared/SharedTypes";

export interface IWinCheckResult {
    won: boolean;
    weightedEmployeeCount: number;
    crisisVP: number;
}

export function calculateWeightedEmployeeCount(player: IPlayer): number {
    const companyArr = player.company as any[];
    const effects = player.activeEffects as string[];

    let maxMultiplier = 1;
    for (const effect of effects) {
        if (typeof effect !== "string") continue;
        if (!effect.startsWith("win_multiplier_")) continue;
        const parsed = parseInt(effect.replace("win_multiplier_", ""), 10);
        if (Number.isFinite(parsed) && parsed > maxMultiplier) {
            maxMultiplier = parsed;
        }
    }

    return companyArr.length * maxMultiplier;
}

export function evaluatePlayerWin(
    player: IPlayer,
    requiredEmployees: number,
    requiredCrisisVP: number,
): IWinCheckResult {
    const weightedEmployeeCount = calculateWeightedEmployeeCount(player);
    const crisisVP = player.score;
    const won = weightedEmployeeCount >= requiredEmployees || crisisVP >= requiredCrisisVP;
    return { won, weightedEmployeeCount, crisisVP };
}


