const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot   = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');   // cryptgo-mobile/

const config = getDefaultConfig(projectRoot);

// Allow Metro to watch files outside the project root (shared package)
config.watchFolders = [workspaceRoot];

// Look for node_modules in both the app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot,   'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force React (and its sub-paths) to always resolve from THIS app's node_modules,
// not from cryptgo-mobile/node_modules/react found via hierarchical walk from
// the ../shared/ directory. Two React instances in one bundle crash with
// "property is not writable" + "Cannot read property 'default' of undefined".
//
// We use extraNodeModules (checked BEFORE the filesystem walk) rather than
// disableHierarchicalLookup — that flag also breaks react-native's own internal
// nested packages (react-native/node_modules/@react-native/*) causing a black screen.
config.resolver.extraNodeModules = {
  'react':                    path.resolve(projectRoot, 'node_modules/react'),
  'react/jsx-runtime':        path.resolve(projectRoot, 'node_modules/react/jsx-runtime'),
  'react/jsx-dev-runtime':    path.resolve(projectRoot, 'node_modules/react/jsx-dev-runtime'),
  'react-native':             path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
