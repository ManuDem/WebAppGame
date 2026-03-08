import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: true,
        port: 3000,
        fs: {
            allow: ['..']
        }
    },
    build: {
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1800,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                    network: ['colyseus.js'],
                },
            },
        },
    },
});
