const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// 8098, not 8081, so this app's bundler can run next to other React Native projects.
const config = { server: { port: 8098 } };

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
