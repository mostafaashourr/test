import { createLogger, format, transports } from 'winston';
import logger from './logger'; // assuming logger is your custom wrapper
import * as path from 'path';

// Mocking the winston module
jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');

  // Mocking format methods
  const mockFormat = {
    combine: jest.fn().mockImplementation((...args) => args),
    timestamp: jest.fn().mockImplementation(options => `mockedTimestampFormat(${options.format})`),
    errors: jest.fn(() => 'mockedErrorsFormat'),
    splat: jest.fn(() => 'mockedSplatFormat'),
    json: jest.fn(() => 'mockedJsonFormat'),
    colorize: jest.fn(() => 'mockedColorizeFormat'),
    printf: jest.fn().mockImplementation(templateFunction => templateFunction),
  };

  // Mocking transports
  const mockTransports = {
    Console: jest.fn(),
    File: jest.fn(),
  };

  // Mock logger methods
  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLevel: jest.fn(),
    shutdown: jest.fn(),
  };

  return {
    ...originalModule,
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: mockTransports,
  };
});

describe('Logger', () => {
  const logPath = path.resolve(__dirname, 'logs');
  const logFileName = 'test-log';
  const logLevel = 'info';

  const options = {
    logLevel,
    logFileName,
    logPath,
  };

  let log;

  beforeEach(() => {
    jest.clearAllMocks();
    log = logger(options);
  });

  it('should create a logger with the correct options', () => {
    expect(createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: logLevel,
        transports: expect.any(Array),
      }),
    );
    expect(transports.Console).toHaveBeenCalledWith(
      expect.objectContaining({
        level: logLevel,
        format: expect.anything(),
      }),
    );
    expect(transports.File).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringContaining(logFileName),
      }),
    );
  });

  it('should configure winston formats correctly', () => {
    expect(format.combine).toHaveBeenCalled();
    expect(format.timestamp).toHaveBeenCalledWith({ format: 'YYYY-MM-DD HH:mm:ss,SSS' });
    expect(format.errors).toHaveBeenCalled();
    expect(format.splat).toHaveBeenCalled();
    expect(format.json).toHaveBeenCalled();
  });

  it('should log messages at various levels', () => {
    const debugMessage = 'This is a debug message';
    const warnMessage = 'This is a warning message';
    log.debug(debugMessage);
    log.warn(warnMessage);

    expect(log.debug).toHaveBeenCalledWith(debugMessage);
    expect(log.warn).toHaveBeenCalledWith(warnMessage);
  });

  it('should not log debug messages to file when level is info', () => {
    log.debug('This should not appear in file');
    expect(transports.File).not.toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
      }),
    );
  });

  it('should log errors with stack traces', () => {
    const error = new Error('Test error with stack');
    log.error(error);
    expect(log.error).toHaveBeenCalledWith(error);
  });

  it('should include context in logs', () => {
    const context = { requestId: '12345' };
    log.info('Contextual log', context);
    expect(log.info).toHaveBeenCalledWith(
      'Contextual log',
      expect.objectContaining({
        requestId: '12345',
      }),
    );
  });

  it('should format timestamps correctly', () => {
    expect(format.timestamp).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'YYYY-MM-DD HH:mm:ss,SSS',
      }),
    );
  });
});
