import { resolveServerEndpoint } from 'client/src/network/ServerEndpoint';

describe('ServerEndpoint', () => {
    test('explicit endpoint wins and keeps websocket protocol', () => {
        expect(resolveServerEndpoint({ protocol: 'https:', hostname: 'game.example.com' }, 'wss://api.example.com/ws')).toBe('wss://api.example.com/ws');
    });

    test('http explicit endpoint is normalized to ws', () => {
        expect(resolveServerEndpoint({ protocol: 'https:', hostname: 'game.example.com' }, 'https://api.example.com/colyseus')).toBe('wss://api.example.com/colyseus');
    });

    test('localhost fallback targets dedicated Colyseus port', () => {
        expect(resolveServerEndpoint({ protocol: 'http:', hostname: 'localhost', port: '5173' })).toBe('ws://localhost:2567');
        expect(resolveServerEndpoint({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' })).toBe('ws://127.0.0.1:2567');
    });

    test('https production fallback uses same host with wss', () => {
        expect(resolveServerEndpoint({ protocol: 'https:', hostname: 'game.example.com', port: '' })).toBe('wss://game.example.com');
        expect(resolveServerEndpoint({ protocol: 'https:', hostname: 'game.example.com', port: '8443' })).toBe('wss://game.example.com:8443');
    });

    test('http non-local fallback uses same host and port', () => {
        expect(resolveServerEndpoint({ protocol: 'http:', hostname: 'lan-box', port: '8080' })).toBe('ws://lan-box:8080');
        expect(resolveServerEndpoint({ protocol: 'http:', hostname: 'lan-box', port: '' })).toBe('ws://lan-box');
    });
});
