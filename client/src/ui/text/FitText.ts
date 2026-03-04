import Phaser from 'phaser';
import { fitTextToBoxPure, TextFitOptions } from '../../systems/TextFitModel';

export function fitTextToBox(
    textObj: Phaser.GameObjects.Text,
    rawText: string,
    maxWidth: number,
    maxHeight: number,
    options: TextFitOptions = {},
): string {
    const styleSize = Number.parseFloat(String(textObj.style.fontSize ?? '12'));
    const fontSize = Number.isFinite(styleSize) ? styleSize : Number(options.fontSize ?? 12);

    const fitted = fitTextToBoxPure(
        rawText,
        maxWidth,
        maxHeight,
        {
            maxLines: options.maxLines ?? 2,
            ellipsis: options.ellipsis ?? true,
            fontSize,
            lineHeight: options.lineHeight ?? fontSize * 1.2,
        },
    );
    textObj.setWordWrapWidth(maxWidth, true);
    textObj.setText(fitted);
    return fitted;
}
