module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                babelConfig: true,
                tsconfig: 'tsconfig.json',
            },
        ],
        '^.+\\.(js|mjs)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(rou3|@colyseus/better-call)/)',
    ],
    moduleNameMapper: {
        '^../shared/(.*)$': '<rootDir>/shared/$1',
    },
};
