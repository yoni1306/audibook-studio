// Test setup for workers - configure logging to reduce noise during tests
process.env['LOG_LEVEL'] = 'warn'; // Only show warnings and errors during tests

// Suppress console.log from logger initialization
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  // Filter out logger initialization messages during tests
  const message = args.join(' ');
  if (message.includes('Logger initialization:') || 
      message.includes('Adding Loki transport') || 
      message.includes('Loki transport NOT configured')) {
    return;
  }
  originalConsoleLog.apply(console, args);
};
