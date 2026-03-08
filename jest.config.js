const baseTransform = {
    '^.+\\.tsx?$': [
        'ts-jest',
        {
            tsconfig: 'tsconfig.json',
            babelConfig: true,
        },
    ],
    '^.+\\.(js|mjs)$': 'babel-jest',
};

const baseProject = {
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    moduleDirectories: ['node_modules', '<rootDir>', '<rootDir>/server/node_modules'],
    transform: baseTransform,
    transformIgnorePatterns: ['/node_modules/(?!(rou3|@colyseus/better-call)/)'],
    clearMocks: true,
    restoreMocks: true,
};

module.exports = {
    projects: [
        {
            ...baseProject,
            displayName: 'unit:client:contracts',
            roots: [
                '<rootDir>/tests/unit/client/contracts',
                '<rootDir>/tests/unit/client/dom',
                '<rootDir>/tests/unit/client/login',
            ],
            testMatch: ['**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
        {
            ...baseProject,
            displayName: 'unit:client:logic',
            roots: [
                '<rootDir>/tests/unit/client/logic',
                '<rootDir>/tests/unit/client/qa',
                '<rootDir>/tests/unit/client/support',
            ],
            testMatch: ['**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
        {
            ...baseProject,
            displayName: 'unit:shared',
            roots: ['<rootDir>/tests/unit/shared'],
            testMatch: ['**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
        {
            ...baseProject,
            displayName: 'unit:server',
            roots: ['<rootDir>/tests/unit/server'],
            testMatch: ['**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
        {
            ...baseProject,
            displayName: 'integration:server:smoke',
            roots: [
                '<rootDir>/tests/integration/server/core',
                '<rootDir>/tests/integration/server/lobby',
                '<rootDir>/tests/integration/server/win',
            ],
            testMatch: ['**/*.test.ts'],
            testTimeout: 30000,
            maxWorkers: 1,
            restoreMocks: false,
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
        {
            ...baseProject,
            displayName: 'integration:server:reaction',
            roots: ['<rootDir>/tests/integration/server/reaction'],
            testMatch: ['**/*.test.ts'],
            testTimeout: 30000,
            maxWorkers: 1,
            restoreMocks: false,
            setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.base.setup.ts'],
        },
    ],
};
