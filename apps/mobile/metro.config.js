const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// 2. Force Metro to resolve modules from the project and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. IMPORTANT: Enable Package Exports (this makes the "exports" field work)
config.resolver.unstable_enablePackageExports = true;

// 4. Force Metro to prioritize the "native" version of the package
config.resolver.conditionNames = ['react-native', 'require', 'import'];

module.exports = config;