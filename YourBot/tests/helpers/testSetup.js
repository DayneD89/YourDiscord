// Common test setup utilities to eliminate duplicate beforeEach/afterEach patterns
// Provides centralized timer, console, and environment management

/**
 * Standard test setup with common mocks and utilities
 * Call this in beforeEach to get consistent test environment
 */
function setupTest(options = {}) {
  const setup = {
    consoleSpy: null,
    consoleErrorSpy: null,
    consoleWarnSpy: null,
    originalNodeEnv: process.env.NODE_ENV,
    restoreFunction: null
  };

  // Clear all mocks
  jest.clearAllMocks();

  // Setup fake timers if requested
  if (options.useFakeTimers !== false) {
    jest.clearAllTimers();
    jest.useFakeTimers();
  }

  // Setup console spies if requested
  if (options.mockConsole !== false) {
    setup.consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    if (options.mockConsoleError !== false) {
      setup.consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    }
    
    if (options.mockConsoleWarn !== false) {
      setup.consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    }
  }

  // Setup environment variables
  if (options.nodeEnv) {
    process.env.NODE_ENV = options.nodeEnv;
  }

  // Mock process.exit to prevent tests from actually exiting
  if (options.mockProcessExit !== false) {
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code}) called`);
    });
  }

  // Create restore function
  setup.restoreFunction = () => teardownTest(setup);

  return setup;
}

/**
 * Standard test teardown - call this in afterEach
 */
function teardownTest(setup) {
  // Restore console spies
  if (setup.consoleSpy) {
    setup.consoleSpy.mockRestore();
  }
  if (setup.consoleErrorSpy) {
    setup.consoleErrorSpy.mockRestore();
  }
  if (setup.consoleWarnSpy) {
    setup.consoleWarnSpy.mockRestore();
  }

  // Restore environment
  process.env.NODE_ENV = setup.originalNodeEnv;

  // Restore timers
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }

  // Restore process.exit
  if (process.exit.mockRestore) {
    process.exit.mockRestore();
  }
}

/**
 * Wait for all promises to resolve (useful for async testing)
 */
async function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Advance timers and flush promises (common pattern)
 */
async function advanceTimersAndFlush(ms) {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Create a spy on an object method with automatic restore
 */
function createSpy(object, method, implementation) {
  const spy = jest.spyOn(object, method);
  if (implementation) {
    spy.mockImplementation(implementation);
  }
  return spy;
}

/**
 * Create a mock that can be restored
 */
function createMock(implementation) {
  return jest.fn(implementation);
}

module.exports = {
  setupTest,
  teardownTest,
  flushPromises,
  advanceTimersAndFlush,
  createSpy,
  createMock
};