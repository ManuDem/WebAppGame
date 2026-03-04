import { CardType, ICardData } from '../shared/SharedTypes';
import { t } from '../client/src/i18n';
import {
    buildInspectPresentation,
    buildMiniCardInfo,
    localizeCardType,
} from '../client/src/ui/cards/CardPresentationModel';

describe('CardPresentationModel', () => {
    const trIt = (key: string, vars?: Record<string, string | number>) => t('it', key, vars);
    const trEn = (key: string, vars?: Record<string, string | number>) => t('en', key, vars);

    test('localizza correttamente tipo carta IT/EN', () => {
        const hero = { type: CardType.HERO } as ICardData;
        expect(localizeCardType(hero, trIt)).toBe('HERO');
        expect(localizeCardType(hero, trEn)).toBe('HERO');

        const item = { type: CardType.ITEM } as ICardData;
        expect(localizeCardType(item, trIt)).toBe('OGGETTO');
        expect(localizeCardType(item, trEn)).toBe('ITEM');
    });

    test('mini info non mostra dettagli tecnici inutili', () => {
        const card = {
            type: CardType.MAGIC,
            shortDesc: 'Ruba 2 PA all avversario',
            templateId: 'dbg_123',
        } as unknown as ICardData;
        const info = buildMiniCardInfo(card, trIt);
        expect(info).not.toContain('dbg_123');
        expect(info.length).toBeGreaterThan(0);
    });

    test('inspect standard non mostra templateId nel meta', () => {
        const card = {
            type: CardType.ITEM,
            name: 'Taccuino Segreto',
            templateId: 'itm_42',
            costPA: 1,
            description: 'Aggiungi bonus temporaneo',
        } as unknown as ICardData;
        const inspect = buildInspectPresentation(card, trIt);
        expect(inspect.meta).not.toContain('itm_42');
        expect(inspect.title).toBe('Taccuino Segreto');
    });
});
