export interface TextFitOptions {
    maxLines?: number;
    fontSize?: number;
    lineHeight?: number;
    ellipsis?: boolean;
}

export type TextMeasureFn = (text: string, fontSize: number) => number;

export function fitTextToBoxPure(
    rawText: string,
    maxWidth: number,
    maxHeight: number,
    options: TextFitOptions = {},
    measure: TextMeasureFn = defaultMeasure,
): string {
    const value = normalize(rawText);
    if (!value) return '';

    const fontSize = Math.max(8, Number(options.fontSize ?? 12));
    const lineHeight = Math.max(8, Number(options.lineHeight ?? fontSize * 1.22));
    const maxByHeight = Math.max(1, Math.floor(maxHeight / lineHeight));
    const maxByOptions = Math.max(1, Number(options.maxLines ?? 2));
    const maxLines = Math.max(1, Math.min(maxByHeight, maxByOptions));
    const allowEllipsis = options.ellipsis !== false;
    const width = Math.max(32, Math.floor(maxWidth));

    const words = value.split(' ').filter((chunk) => chunk.length > 0);
    const lines: string[] = [];
    let current = '';

    const pushCurrent = () => {
        if (!current) return;
        lines.push(current);
        current = '';
    };

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (measure(candidate, fontSize) <= width) {
            current = candidate;
            return;
        }

        if (!current) {
            current = trimToWidth(word, width, fontSize, measure, false);
            pushCurrent();
            return;
        }

        pushCurrent();
        if (measure(word, fontSize) <= width) {
            current = word;
        } else {
            lines.push(trimToWidth(word, width, fontSize, measure, false));
        }
    });
    pushCurrent();

    if (lines.length <= maxLines) {
        return lines.join('\n');
    }

    const clamped = lines.slice(0, maxLines);
    if (allowEllipsis) {
        clamped[maxLines - 1] = trimToWidth(`${clamped[maxLines - 1]}...`, width, fontSize, measure, true);
    }
    return clamped.join('\n');
}

function trimToWidth(
    text: string,
    maxWidth: number,
    fontSize: number,
    measure: TextMeasureFn,
    keepEllipsis: boolean,
): string {
    const clean = normalize(text);
    if (!clean) return '';
    if (measure(clean, fontSize) <= maxWidth) return clean;

    let lo = 0;
    let hi = clean.length;
    let best = '';
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidateRaw = clean.slice(0, Math.max(0, mid));
        const candidate = candidateRaw;
        if (measure(candidate, fontSize) <= maxWidth) {
            best = candidate;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (best.length >= clean.length) return best;
    if (keepEllipsis) return addEllipsis(best, maxWidth, fontSize, measure);
    return best;
}

function normalize(input: string): string {
    return String(input ?? '').replace(/\s+/g, ' ').trim();
}

function defaultMeasure(text: string, fontSize: number): number {
    return String(text ?? '').length * fontSize * 0.56;
}

function addEllipsis(
    value: string,
    maxWidth: number,
    fontSize: number,
    measure: TextMeasureFn,
): string {
    let core = String(value ?? '').replace(/\.+$/, '');
    if (!core) return '...';
    while (core.length > 0 && measure(`${core}...`, fontSize) > maxWidth) {
        core = core.slice(0, -1);
    }
    return core.length > 0 ? `${core}...` : '...';
}
