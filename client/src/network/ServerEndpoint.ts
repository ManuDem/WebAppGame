export interface BrowserLocationLike {
    protocol?: string;
    hostname?: string;
    port?: string;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const LOCAL_SERVER_PORT = '2567';

function isLocalHostname(hostname: string): boolean {
    return LOCAL_HOSTNAMES.has(String(hostname ?? '').trim().toLowerCase());
}

function normalizeExplicitEndpoint(raw?: string): string | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;

    try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
        if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
        if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

export function resolveServerEndpoint(locationLike: BrowserLocationLike, explicitEndpoint?: string): string {
    const explicit = normalizeExplicitEndpoint(explicitEndpoint);
    if (explicit) return explicit;

    const protocol = String(locationLike?.protocol ?? '').trim().toLowerCase();
    const hostname = String(locationLike?.hostname ?? '').trim() || 'localhost';
    const port = String(locationLike?.port ?? '').trim();

    if (isLocalHostname(hostname)) {
        return `ws://${hostname}:${LOCAL_SERVER_PORT}`;
    }

    if (protocol === 'https:') {
        return port && port !== '443' ? `wss://${hostname}:${port}` : `wss://${hostname}`;
    }

    return port && port !== '80' ? `ws://${hostname}:${port}` : `ws://${hostname}`;
}
