// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Block optional lightningcss platform packages that aren't installed on this machine.
// Metro tries to watch every package it sees referenced; without this it crashes on
// packages like lightningcss-android-arm64 that npm skips as optional deps.
const missingOptionalPkgs = [
  'lightningcss-darwin-x64',
  'lightningcss-darwin-arm64',
  'lightningcss-linux-x64-gnu',
  'lightningcss-linux-x64-musl',
  'lightningcss-linux-arm64-gnu',
  'lightningcss-linux-arm64-musl',
  'lightningcss-linux-arm-gnueabihf',
  'lightningcss-win32-arm64-msvc',
  'lightningcss-freebsd-x64',
  'lightningcss-android-arm64',
];

const blockListRegex = new RegExp(
  missingOptionalPkgs.map((pkg) => `node_modules[\\\\/]${pkg}[\\\\/]`).join('|')
);

config.resolver = {
  ...config.resolver,
  blockList: blockListRegex,
};

module.exports = config;
