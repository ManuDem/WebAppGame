type ConsoleMethod = 'log' | 'info' | 'warn';

const shouldKeepLogs = process.env.TEST_DEBUG_LOGS === '1';
let consoleSpies: jest.SpyInstance[] = [];

beforeEach(() => {
    if (shouldKeepLogs) return;
    const methods: ConsoleMethod[] = ['log', 'info', 'warn'];
    consoleSpies = methods.map((method) => jest.spyOn(console, method).mockImplementation(() => undefined));
});

afterEach(() => {
    jest.useRealTimers();
    consoleSpies.forEach((spy) => spy.mockRestore());
    consoleSpies = [];
});

