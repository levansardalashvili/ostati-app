// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// lucide-react-native ships its icon barrel as .mjs files resolved via
// package "exports" — Metro needs .mjs in sourceExts to load them.
config.resolver.sourceExts.push('mjs');

module.exports = config;
