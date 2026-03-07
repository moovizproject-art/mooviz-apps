/**
 * Metro configuration — הגדרות Metro
 * Configured for pnpm monorepo with workspace packages.
 */
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Allow Metro to follow pnpm symlinks into .pnpm store
    unstable_enableSymlinks: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
