import winston from 'winston';
import LokiTransport from 'winston-loki';
import { getCurrentCorrelationId } from '@audibook/correlation';

// Detect service name from environment or process context
function getServiceName(): string {
  // First try explicit SERVICE_NAME (set in workers main.ts)
  if (process.env['SERVICE_NAME']) {
    return process.env['SERVICE_NAME'];
  }
  
  // For workers, check WORKER_SERVICE_NAME
  if (process.env['WORKER_SERVICE_NAME']) {
    return process.env['WORKER_SERVICE_NAME'];
  }
  
  // Check if we're in the workers context by checking the process title or cwd
  const processTitle = process.title || '';
  const cwd = process.cwd();
  
  // If running from workers directory or process mentions workers
  if (cwd.includes('/workers') || processTitle.includes('workers') || 
      process.argv.some(arg => arg.includes('workers'))) {
    return 'audibook-worker';
  }
  
  // Check for API context
  if (cwd.includes('/api') || processTitle.includes('api') ||
      process.argv.some(arg => arg.includes('api'))) {
    return process.env['API_SERVICE_NAME'] || 'audibook-api';
  }
  
  // Check for web context  
  if (cwd.includes('/web') || processTitle.includes('web') ||
      process.argv.some(arg => arg.includes('web'))) {
    return process.env['WEB_SERVICE_NAME'] || 'audibook-web';
  }
  
  return 'unknown';
}

const service = getServiceName();

// Debug: Check environment variables
console.log('Logger initialization:', {
  LOKI_HOST: process.env['LOKI_HOST'],
  LOKI_BASIC_AUTH: process.env['LOKI_BASIC_AUTH'] ? 'SET' : 'NOT SET',
  SERVICE_NAME: service,
});

// Create transports array
const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf((log) => {
        const { timestamp, level, message, service, correlationId, ...meta } =
          log;

        const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
        const corrId = correlationId && typeof correlationId === 'string' ? `[${correlationId.slice(0, 8)}]` : '';
        return `${timestamp} [${service}]${corrId} ${level}: ${message} ${metaString}`;
      })
    ),
  }),
];

// Add Loki transport if LOKI_HOST is configured
if (process.env['LOKI_HOST']) {
  console.log('Adding Loki transport to:', process.env['LOKI_HOST']);

  transports.push(
    new LokiTransport({
      host: process.env['LOKI_HOST'],
      // Add basicAuth only if it's configured
      ...(process.env['LOKI_BASIC_AUTH'] ? { basicAuth: process.env['LOKI_BASIC_AUTH'] } : {}),
      labels: {
        app: 'audibook-studio',
        service,
        environment: process.env['NODE_ENV'] || 'development',
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('Loki connection error:', err);
      },
      timeout: 30000,
      clearOnError: true,
      batching: true,
      interval: 5,
    })
  );
} else {
  console.log('Loki transport NOT configured - missing environment variables');
}

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  defaultMeta: {
    service,
    get correlationId() {
      return getCurrentCorrelationId();
    },
  },
  transports,
});

// Test log
logger.info('Logger initialized', {
  transportCount: transports.length,
  lokiConfigured: transports.length > 1,
});

export function createLogger(context: string) {
  return logger.child({ context });
}
