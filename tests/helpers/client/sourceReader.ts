import fs from 'node:fs';
import path from 'node:path';

export function readSource(relativePath: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
