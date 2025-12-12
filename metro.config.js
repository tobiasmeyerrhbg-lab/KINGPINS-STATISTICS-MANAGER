const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push(
  'db',
  'mp3',
  'ttf',
  'otf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp'
);

config.resolver.sourceExts = [
  'expo.ts',
  'expo.tsx',
  'expo.js',
  'expo.jsx',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'wasm',
  'cjs'
];

module.exports = config;
