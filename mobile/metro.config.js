// Expo's default Metro config, minus the web builds that live inside this
// folder (dist/, dist-iphone/). Metro would otherwise watch thousands of
// built files and stall.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const escape = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const builds = ['dist', 'dist-iphone'].map((d) => new RegExp(`^${escape(path.resolve(__dirname, d))}[\\\\/].*`));
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...builds];

module.exports = config;
