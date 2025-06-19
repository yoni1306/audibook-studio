const path = require('path');
const winston = require('winston');
const LokiTransport = require('winston-loki');

// Load environment-specific .env file
const envFile = '.env.local';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

console.log('Testing Loki connection with the following configuration:');
console.log('  LOKI_HOST:', process.env['LOKI_HOST']);
console.log('  LOKI_BASIC_AUTH:', process.env['LOKI_BASIC_AUTH'] ? 'SET' : 'NOT SET');

// Create a logger with Loki transport
const logger = winston.createLogger({
  level: 'debug',
  defaultMeta: {
    service: 'loki-test',
    environment: process.env['NODE_ENV'] || 'development',
  },
  transports: [
    // Console transport for local visibility
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${message} ${metaString}`;
        })
      ),
    }),
    
    // Loki transport for sending logs to Grafana Loki
    new LokiTransport({
      host: process.env['LOKI_HOST'],
      basicAuth: process.env['LOKI_BASIC_AUTH'] || undefined,
      labels: {
        app: 'audibook-studio',
        service: 'loki-test',
        environment: process.env['NODE_ENV'] || 'development',
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('Loki connection error:', err);
      },
      timeout: 5000,
      interval: 2,
    }),
  ],
});

// Send test logs
logger.info('Test log message - INFO level');
logger.debug('Test log message - DEBUG level');
logger.warn('Test log message - WARN level', { testData: true });
logger.error('Test log message - ERROR level', { error: 'test error' });

console.log('\nSending test logs to Loki...');
console.log('Waiting for logs to be sent (5 seconds)...');

// Wait for logs to be sent before exiting
setTimeout(() => {
  console.log('\nTest completed. Check your Grafana Loki dashboard to verify logs were received.');
  console.log('If logs are not showing up, verify:');
  console.log('1. Loki container is running (docker ps | grep loki)');
  console.log('2. LOKI_HOST in .env.local is set to http://localhost:3100');
  console.log('3. Your application can reach the Loki container');
  process.exit(0);
}, 5000);
