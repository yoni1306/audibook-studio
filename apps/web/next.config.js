//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },

  // Performance optimizations
  experimental: {
    // Enable faster builds in development
    turbo: {
      rules: {
        '*.tsx': {
          loaders: ['@nx/next/plugin/with-nx'],
        },
      },
    },
  },
  // Optimize bundle splitting
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Optimize MUI imports for faster compilation
      config.resolve.alias = {
        ...config.resolve.alias,
        '@mui/material': '@mui/material',
        '@mui/x-data-grid': '@mui/x-data-grid',
      };
      
      // Enable faster refresh
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            mui: {
              test: /[\\/]node_modules[\\/]@mui[\\/]/,
              name: 'mui',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }
    return config;
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);