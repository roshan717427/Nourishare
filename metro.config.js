const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude unnecessary directories from watching
// But allow Expo's own nested dependencies
config.resolver.blockList = [
  // Exclude Python virtual environments
  /.*\/venv\/.*/,
  /.*\/venv copy\/.*/,
  // Exclude Python cache
  /.*\/__pycache__\/.*/,
  // Only exclude deeply nested node_modules (3+ levels), not Expo's own
  /.*\/node_modules\/.*\/node_modules\/.*\/node_modules\/.*/,
];

module.exports = config;

