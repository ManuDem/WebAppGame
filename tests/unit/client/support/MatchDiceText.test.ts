import { t } from 'client/src/i18n';
import { buildDiceLogLine, buildDiceOutcomeLine, buildDiceToastText } from 'client/src/ui/match/MatchDiceText';
import { IDiceRolledEvent } from 'shared/SharedTypes';

const trIt = (key: string, vars?: Record<string, string | number>) => t('it', key, vars);

function makeEvent(partial: Partial<IDiceRolledEvent>): IDiceRolledEvent {
    return {
        playerId: 'p1',
        roll1: 4,
        roll2: 2,
        total: 6,
        success: true,
        ...partial,
    };
}

describe('MatchDiceText', () => {
    test('buildDiceOutcomeLine localizza reward e penalty note', () => {
        expect(buildDiceOutcomeLine(makeEvent({ rewardCode: 'vp_2' }), trIt)).toContain('2 VP');
        expect(buildDiceOutcomeLine(makeEvent({ success: false, penaltyCode: 'discard_2' }), trIt)).toContain('Scarta 2 carte');
    });

    test('buildDiceLogLine include modificatore derivato e stato', () => {
        const line = buildDiceLogLine(makeEvent({ total: 9, rewardCode: 'vp_1', targetRoll: 8 }), 'CEO', trIt);
        expect(line).toContain('CEO');
        expect(line).toContain('+3');
        expect(line).toContain('SUCCESSO');
    });

    test('buildDiceToastText concatena header e outcome', () => {
        const line = buildDiceToastText(makeEvent({ success: false, penaltyCode: 'lock_tricks', targetRoll: 9 }), 'CEO', trIt);
        expect(line).toContain('CEO');
        expect(line).toContain('FALLITO');
        expect(line).toContain('Trucchi bloccati');
    });
});