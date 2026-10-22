// Phone start: Skia is native here, so the router starts straight away.
// (The web version, boot.web.js, loads Skia's WebAssembly first. They are
// separate files because a bundler follows every require, even one behind
// `if (Platform.OS === 'web')`, and the web loader cannot build for a phone.)
require('expo-router/entry');
